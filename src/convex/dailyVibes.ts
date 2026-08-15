import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

const REACTIONS = ["🔥", "❤️", "😂", "😍", "👍", "🤔", "🙌", "✨"];

/** Toggle an emoji reaction on a daily answer (one per profile + emoji). */
export const reactToAnswer = mutation({
  args: {
    answerId: v.id("dailyAnswers"),
    emoji: v.string(),
  },
  handler: async (ctx, { answerId, emoji }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (!REACTIONS.includes(emoji)) throw new Error("Invalid reaction");
    const answer = await ctx.db.get(answerId);
    if (!answer || !answer.shareOnProfile) throw new Error("Not found");

    const existing = await ctx.db
      .query("dailyVibeReactions")
      .withIndex("by_answer_profile", (q) =>
        q.eq("answerId", answerId).eq("profileId", me._id),
      )
      .first();
    if (existing) {
      if (existing.emoji === emoji) {
        await ctx.db.delete(existing._id);
        return { reacted: false };
      }
      await ctx.db.patch(existing._id, { emoji, createdAt: nowMs() });
      return { reacted: true };
    }
    await ctx.db.insert("dailyVibeReactions", {
      answerId,
      profileId: me._id,
      emoji,
      createdAt: nowMs(),
    });
    return { reacted: true };
  },
});

/** Reactions + counts for one answer, with whether I reacted. */
export const reactionsForAnswer = query({
  args: { answerId: v.id("dailyAnswers") },
  handler: async (ctx, { answerId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("dailyVibeReactions")
      .withIndex("by_answer", (q) => q.eq("answerId", answerId))
      .collect();
    const counts = new Map<string, number>();
    let mine: string | null = null;
    for (const r of rows) {
      counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
      if (r.profileId === me._id) mine = r.emoji;
    }
    return [...counts.entries()].map(([emoji, count]) => ({
      emoji,
      count,
      mine: emoji === mine,
    }));
  },
});

/**
 * Today's shared answers from other discoverable profiles — a lightweight
 * social feed you can react to and start conversations from.
 */
export const todayAnswerFeed = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];

    const all = await ctx.db.query("dailyAnswers").collect();
    const out = [];
    for (const a of all) {
      if (!a.shareOnProfile) continue;
      if (a.profileId === me._id) continue;
      const p = await ctx.db.get(a.profileId);
      if (!p || p.profileHidden || !p.onboardingCompleted) continue;
      const reactions = await ctx.db
        .query("dailyVibeReactions")
        .withIndex("by_answer", (q) => q.eq("answerId", a._id))
        .collect();
      const counts = new Map<string, number>();
      for (const r of reactions)
        counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
      out.push({
        answerId: a._id,
        question: a.question,
        answer: a.answer,
        date: a.date,
        profile: {
          _id: p._id,
          firstName: p.firstName,
          photos: p.photos,
          verified: p.verified,
          city: p.city,
        },
        reactions: [...counts.entries()].map(([emoji, count]) => ({
          emoji,
          count,
          mine: reactions.some((r) => r.profileId === me._id && r.emoji === emoji),
        })),
      });
    }
    return out
      .sort((x, y) => (x.date < y.date ? 1 : -1))
      .slice(0, 30);
  },
});
