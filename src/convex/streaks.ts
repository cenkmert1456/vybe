import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";

/**
 * Match streak + daily interaction tracking.
 *
 * Rules (enforced server-side):
 *  - a day counts when the user answers the daily question, sends a message,
 *    or opens the app (touchActive)
 *  - max ONE streak progression per calendar day (never farmable)
 *  - streak grows when the last activity was yesterday; resets otherwise
 */

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function yesterdayKey(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Public entry point used by other mutations (open/message/answer). */
export const recordActivity = mutation({
  args: { type: v.string() },
  handler: async (ctx, { type }) => {
    const me = await getMyProfile(ctx);
    if (!me) return { current: 0, longest: 0 };
    return await recordDailyActivity(ctx, me._id, type);
  },
});

/** Record a qualifying daily activity. Called by other mutations server-side. */
export async function recordDailyActivity(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  type: string,
): Promise<{ current: number; longest: number }> {
  const now = nowMs();
  const today = dateKey(now);

  // Log the activity for the Daily Vibe task list.
  const log = await ctx.db
    .query("dailyActivity")
    .withIndex("by_profile_date", (q) =>
      q.eq("profileId", profileId).eq("date", today),
    )
    .first();
  if (log) {
    if (!log.activities.includes(type)) {
      await ctx.db.patch(log._id, {
        activities: [...log.activities, type],
      });
    }
  } else {
    await ctx.db.insert("dailyActivity", {
      profileId,
      date: today,
      activities: [type],
      createdAt: now,
    });
  }

  const streak = await ctx.db
    .query("streaks")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .first();

  // Already counted today → no progression.
  if (streak && streak.lastDate === today) {
    return { current: streak.current, longest: streak.longest };
  }

  const next =
    !streak || streak.lastDate !== yesterdayKey(today) ? 1 : streak.current + 1;

  if (streak) {
    await ctx.db.patch(streak._id, {
      current: next,
      longest: Math.max(streak.longest, next),
      lastDate: today,
      lastType: type,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("streaks", {
      profileId,
      current: next,
      longest: next,
      lastDate: today,
      lastType: type,
      updatedAt: now,
    });
  }
  return { current: next, longest: Math.max(next, streak?.longest ?? next) };
}

/** My current streak + today's completed tasks. */
export const myStreak = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;

    const now = nowMs();
    const today = dateKey(now);
    const yesterday = yesterdayKey(today);

    const streak = await ctx.db
      .query("streaks")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .first();

    // The streak visually continues while the user still has today ahead of them.
    const alive =
      !streak ||
      streak.lastDate === today ||
      streak.lastDate === yesterday;

    const log = await ctx.db
      .query("dailyActivity")
      .withIndex("by_profile_date", (q) =>
        q.eq("profileId", me._id).eq("date", today),
      )
      .first();

    // Task completion: answer = daily answer today, message = msg counter, open = open counter.
    const answer = await ctx.db
      .query("dailyAnswers")
      .withIndex("by_profile_date", (q) =>
        q.eq("profileId", me._id).eq("date", today),
      )
      .first();
    const msgCounter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `msg:${today}`),
      )
      .first();
    const openCounter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `open:${today}`),
      )
      .first();

    return {
      current: streak?.current ?? 0,
      longest: streak?.longest ?? 0,
      alive,
      lastDate: streak?.lastDate ?? null,
      tasks: {
        answer: Boolean(answer),
        message: (msgCounter?.count ?? 0) > 0,
        open: (openCounter?.count ?? 0) > 0,
      },
      activities: log?.activities ?? [],
    };
  },
});
