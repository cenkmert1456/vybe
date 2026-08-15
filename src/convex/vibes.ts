import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

/**
 * Vibe reactions: quick, playful signals (🔥 Energetic, 🎵 Music, ☕ Coffee,
 * ✈ Travel) sent to another profile. A vibe is deliberately NOT a like — it
 * never creates a match on its own and never consumes the daily like budget.
 * Recipients see vibes in their Activity feed and on their profile.
 */
export const VIBE_TYPES = [
  "energetic",
  "music",
  "coffee",
  "travel",
] as const;
export type VibeType = (typeof VIBE_TYPES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** One vibe per type per person per day — playful, not spammy. */
export const DAILY_VIBE_LIMIT = 20;

export const sendVibe = mutation({
  args: {
    toProfileId: v.id("profiles"),
    type: v.string(),
  },
  handler: async (ctx, { toProfileId, type }) => {
    const me = await getMyProfile(ctx);
    if (!me || !me.onboardingCompleted)
      throw new Error("Complete onboarding first");

    if (!(VIBE_TYPES as readonly string[]).includes(type)) {
      throw new Error("Unknown vibe");
    }
    if (me._id === toProfileId) throw new Error("You cannot vibe yourself");

    const target = await ctx.db.get(toProfileId);
    if (!target) throw new Error("Profile not found");
    if (target.profileHidden || !target.showInDiscovery)
      throw new Error("Profile is not available");

    // Respect blocks in both directions.
    const blocked = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) =>
        q.eq("blockerProfileId", me._id).eq("blockedProfileId", toProfileId),
      )
      .first();
    if (blocked) throw new Error("Profile is not available");

    const now = nowMs();

    // Don't spam: only one vibe of the same type per person per day.
    const dayStart = now - DAY_MS;
    const existing = await ctx.db
      .query("vibes")
      .withIndex("by_from", (q) => q.eq("fromProfileId", me._id))
      .filter((q) => q.gte(q.field("createdAt"), dayStart))
      .collect();
    const dup = existing.find(
      (x) => x.toProfileId === toProfileId && x.type === type,
    );
    if (dup) return { ok: true, alreadySent: true };

    // Daily send cap (backend source of truth).
    const d = new Date(now);
    const dayKey = d.toISOString().slice(0, 10);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `vibe:${dayKey}`),
      )
      .first();
    if ((counter?.count ?? 0) >= DAILY_VIBE_LIMIT) {
      throw new Error("You've sent a lot of vibes today — pace yourself");
    }
    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        profileId: me._id,
        key: `vibe:${dayKey}`,
        count: 1,
      });
    }

    await ctx.db.insert("vibes", {
      fromProfileId: me._id,
      toProfileId,
      type,
      createdAt: now,
    });

    // Notify the recipient (only real users read a feed).
    if (target.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId: toProfileId,
        type: "like",
        fromProfileId: me._id,
        title: `${me.firstName} sent you a vibe ${vibeEmoji(type)}`,
        createdAt: now,
      });
    }

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "vibe_sent",
      metadata: { type, toProfileId: toProfileId.toString() },
      createdAt: now,
    });
    await ctx.db.patch(me._id, { lastActiveAt: now });

    return { ok: true, alreadySent: false };
  },
});

/** Incoming vibes, enriched with the sender's profile (profile "My vibe" tab). */
export const receivedVibes = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];

    const rows = await ctx.db
      .query("vibes")
      .withIndex("by_to", (q) => q.eq("toProfileId", me._id))
      .order("desc")
      .collect();

    const out: {
      type: string;
      createdAt: number;
      from: { _id: string; firstName: string; photos: string[] } | null;
    }[] = [];
    for (const r of rows.slice(0, 30)) {
      const from = await ctx.db.get(r.fromProfileId);
      out.push({
        type: r.type,
        createdAt: r.createdAt,
        from: from
          ? {
              _id: from._id.toString(),
              firstName: from.firstName,
              photos: from.photos,
            }
          : null,
      });
    }
    return out;
  },
});

/** Whether I already vibed a profile today (for repeat-action UI). */
export const alreadyVibed = query({
  args: { toProfileId: v.id("profiles") },
  handler: async (ctx, { toProfileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const dayStart = nowMs() - DAY_MS;
    const rows = await ctx.db
      .query("vibes")
      .withIndex("by_from", (q) => q.eq("fromProfileId", me._id))
      .filter((q) => q.gte(q.field("createdAt"), dayStart))
      .collect();
    return rows
      .filter((r) => r.toProfileId === toProfileId)
      .map((r) => r.type);
  },
});

export function vibeEmoji(type: string): string {
  switch (type) {
    case "energetic":
      return "🔥";
    case "music":
      return "🎵";
    case "coffee":
      return "☕";
    case "travel":
      return "✈️";
    default:
      return "✨";
  }
}
