import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "VYBE";

/** Deterministic-ish unique code; collision-checked at insert time. */
async function generateUniqueCode(ctx: QueryCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = "";
    for (let i = 0; i < 5; i++) {
      suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const code = `${CODE_PREFIX}-${suffix}`;
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    const onProfile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("referralCode"), code))
      .first();
    if (!existing && !onProfile) return code;
  }
  return `${CODE_PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

/** Make sure the signed-in user has a referral code (idempotent). */
export const ensureReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    if (me.referralCode) return { code: me.referralCode };
    const code = await generateUniqueCode(ctx);
    await ctx.db.patch(me._id, { referralCode: code });
    return { code };
  },
});

/**
 * My referral info: code + stats + reward status (honest — no fake rewards).
 * Queries cannot write, so a missing code is reported as null and the client
 * calls ensureReferralCode to persist it once.
 */
export const myReferral = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const code = me.referralCode ?? null;

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerProfileId", me._id))
      .collect();

    return {
      code,
      inviteCount: referrals.length,
      rewardedCount: referrals.filter((r) => r.status === "rewarded").length,
      rewardActive: false, // reward granting is infra-ready, not yet live
      link: code ? `https://vybe.app/i/${code}` : null,
      referredBy: me.referredByCode ?? null,
    };
  },
});

/** Apply a referral code (called during onboarding). One-time per user. */
export const applyReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Complete onboarding first");
    if (me.referredByCode) throw new Error("You already used a referral code");
    if (me.referralCode === code.trim().toUpperCase())
      throw new Error("You can't use your own referral code");

    const normalized = code.trim().toUpperCase();
    if (!normalized.startsWith(CODE_PREFIX)) throw new Error("Invalid referral code");

    const referrer = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("referralCode"), normalized))
      .first();
    if (!referrer) throw new Error("This referral code doesn't exist");
    if (referrer._id === me._id) throw new Error("You can't use your own referral code");

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredProfileId", me._id))
      .first();
    if (existing) throw new Error("Referral already recorded");

    await ctx.db.insert("referrals", {
      referrerProfileId: referrer._id,
      referredProfileId: me._id,
      code: normalized,
      status: "pending",
      createdAt: nowMs(),
    });
    await ctx.db.patch(me._id, { referredByCode: normalized });

    // Notify the referrer (real users only).
    if (referrer.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId: referrer._id,
        type: "system",
        fromProfileId: me._id,
        title: `${me.firstName} joined VYBE with your code 🎉`,
        createdAt: nowMs(),
      });
    }
    return { ok: true };
  },
});
