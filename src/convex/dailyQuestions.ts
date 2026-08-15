import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";
import { api } from "./_generated/api";

const QUESTIONS = [
  "What's one thing that instantly improves your day?",
  "Coffee date or midnight walk?",
  "Where would you teleport right now?",
  "What's your current favorite song genre?",
  "What's the best meal you've had recently?",
  "Window seat or aisle seat?",
  "Early bird or night owl — no takesies backsies?",
  "What's a skill you wish you had?",
  "Beach day or city day?",
  "What's your go-to comfort show or movie?",
  "Sweet or savory breakfast?",
  "What's a small thing that made you smile today?",
  "Summer or winter — pick one forever?",
  "What's on your bucket list this year?",
  "Texting or calling?",
  "What's the most underrated food?",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's question (rotates daily from the managed library). */
export const todayQuestion = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const today = dateKey(nowMs());
    const row = await ctx.db
      .query("dailyQuestions")
      .withIndex("by_date", (q) => q.eq("activeDate", today))
      .first();
    const question = row?.question ?? QUESTIONS[0];

    const answer = await ctx.db
      .query("dailyAnswers")
      .withIndex("by_profile_date", (q) =>
        q.eq("profileId", me._id).eq("date", today),
      )
      .first();

    return {
      date: today,
      question,
      answer: answer?.answer ?? "",
      shareOnProfile: answer?.shareOnProfile ?? false,
      answered: Boolean(answer),
    };
  },
});

export const saveDailyAnswer = mutation({
  args: {
    date: v.string(),
    question: v.string(),
    answer: v.string(),
    shareOnProfile: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const trimmed = args.answer.trim().slice(0, 300);
    if (!trimmed) throw new Error("Write a short answer first");
    const now = nowMs();
    const existing = await ctx.db
      .query("dailyAnswers")
      .withIndex("by_profile_date", (q) =>
        q.eq("profileId", me._id).eq("date", args.date),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        question: args.question,
        answer: trimmed,
        shareOnProfile: args.shareOnProfile,
        createdAt: now,
      });
    } else {
      await ctx.db.insert("dailyAnswers", {
        profileId: me._id,
        date: args.date,
        question: args.question,
        answer: trimmed,
        shareOnProfile: args.shareOnProfile,
        createdAt: now,
      });
      // Answering the daily question counts toward the streak (once/day).
      try {
        await ctx.runMutation(api.streaks.recordActivity, { type: "answer" });
      } catch {
        /* non-fatal */
      }
    }
    return true;
  },
});

/** A profile's shared answer (shown on their profile when shared). */
export const sharedAnswerFor = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const answers = await ctx.db
      .query("dailyAnswers")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .order("desc")
      .first();
    if (!answers || !answers.shareOnProfile) return null;
    return {
      question: answers.question,
      answer: answers.answer,
      date: answers.date,
    };
  },
});

/** Seed the next N days of questions (idempotent, backend-managed). */
export const seedDailyQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    const start = nowMs();
    let seeded = 0;
    for (let i = 0; i < 60; i++) {
      const day = start + i * DAY_MS;
      const key = dateKey(day);
      const existing = await ctx.db
        .query("dailyQuestions")
        .withIndex("by_date", (q) => q.eq("activeDate", key))
        .first();
      if (!existing) {
        const question = QUESTIONS[i % QUESTIONS.length];
        await ctx.db.insert("dailyQuestions", {
          question,
          activeDate: key,
          lang: "en",
        });
        seeded++;
      }
    }
    return { seeded };
  },
});
