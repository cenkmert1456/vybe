import { mutation, query, MutationCtx } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";
import { entitlementsForUser } from "./entitlements";

export const BOOST_DURATION_MS = 30 * 60 * 1000; // 30 minutes — configurable

/** Current boost state: active countdown, credits left, and last results. */
export const boostStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;

    const ent = await entitlementsForUser(ctx, me.userId);
    const monthlyLimit = ent?.entitlements.boostCreditsPerMonth ?? 0;

    const now = nowMs();
    const d = new Date(now);
    const monthKey = d.toISOString().slice(0, 7);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `boost:${monthKey}`),
      )
      .first();
    const used = counter?.count ?? 0;

    const active = await ctx.db
      .query("boosts")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .first();
    const activeBoost =
      active && active.status === "active" && active.expiresAt > now
        ? {
            startedAt: active.startedAt,
            expiresAt: active.expiresAt,
            remainingMs: active.expiresAt - now,
          }
        : null;

    // Latest completed boost results (real tracked numbers).
    const completed = active && active.status === "completed" ? active.result : null;

    return {
      credits: Math.max(0, monthlyLimit - used),
      monthlyLimit,
      active: activeBoost,
      lastResult: completed,
    };
  },
});

/** Activate a Boost. Backend enforces the monthly credit allowance. */
export const activateBoost = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Complete onboarding first");

    const ent = await entitlementsForUser(ctx, me.userId);
    const monthlyLimit = ent?.entitlements.boostCreditsPerMonth ?? 0;
    if (monthlyLimit <= 0) throw new Error("Boost requires a paid membership");

    const now = nowMs();
    const d = new Date(now);
    const monthKey = d.toISOString().slice(0, 7);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `boost:${monthKey}`),
      )
      .first();
    const used = counter?.count ?? 0;
    if (used >= monthlyLimit)
      throw new Error("You've used all your Boosts this month");

    // No concurrent boosts.
    const active = await ctx.db
      .query("boosts")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .first();
    if (active && active.status === "active" && active.expiresAt > now) {
      throw new Error("A Boost is already active");
    }
    // Close a stale row.
    if (active && active.status === "active" && active.expiresAt <= now) {
      await ctx.db.patch(active._id, {
        status: "completed",
        endedAt: now,
        result: await computeResult(ctx, active._id),
      });
    }

    const baseViews = await ctx.db
      .query("profileViews")
      .withIndex("by_viewed", (q) => q.eq("viewedProfileId", me._id))
      .collect()
      .then((r) => r.length);

    if (counter) {
      await ctx.db.patch(counter._id, { count: used + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        profileId: me._id,
        key: `boost:${monthKey}`,
        count: 1,
      });
    }

    await ctx.db.insert("boosts", {
      profileId: me._id,
      startedAt: now,
      expiresAt: now + BOOST_DURATION_MS,
      status: "active",
      baseViews,
    });

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "boost_started",
      createdAt: now,
    });
    await ctx.db.insert("activity", {
      profileId: me._id,
      type: "system",
      title: "Your VYBE Boost is live",
      createdAt: now,
    });

    return { startedAt: now, expiresAt: now + BOOST_DURATION_MS };
  },
});

/** Called on app open: finalize any boost whose window has elapsed. */
export const sweepExpiredBoost = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const now = nowMs();
    const active = await ctx.db
      .query("boosts")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .first();
    if (!active || active.status !== "active" || active.expiresAt > now)
      return null;
    const result = await computeResult(ctx, active._id);
    await ctx.db.patch(active._id, {
      status: "completed",
      endedAt: now,
      result,
    });
    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "boost_completed",
      metadata: result,
      createdAt: now,
    });
    return result;
  },
});

/** Real result numbers from tracked events during the boost window. */
async function computeResult(
  ctx: MutationCtx,
  boostId: import("./_generated/dataModel").Id<"boosts">,
) {
  const boost = await ctx.db.get(boostId);
  if (!boost) return { views: 0, likes: 0, matches: 0 };
  const start = boost.startedAt;
  const end = boost.expiresAt;

  const views = await ctx.db
    .query("profileViews")
    .withIndex("by_viewed", (q) => q.eq("viewedProfileId", boost.profileId))
    .collect()
    .then((r) => r.filter((x) => x.createdAt >= start && x.createdAt <= end).length);

  const swipes = await ctx.db
    .query("swipes")
    .withIndex("by_to", (q) => q.eq("toProfileId", boost.profileId))
    .collect()
    .then((r) => r.filter((x) => x.createdAt >= start && x.createdAt <= end));
  const likes = swipes.filter((s) => s.action === "like" || s.action === "superLike").length;

  const matches = await ctx.db
    .query("matches")
    .withIndex("by_participants", (q) => q.eq("participants", [boost.profileId]))
    .collect()
    .then((r) => r.filter((m) => m.createdAt >= start && m.createdAt <= end && m.status === "active").length);

  return { views, likes, matches };
}
