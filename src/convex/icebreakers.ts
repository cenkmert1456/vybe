import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";

export const GAME_TYPES = [
  "this_or_that",
  "twenty_questions",
  "quick_picks",
  "emoji_challenge",
  "fun_questions",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

const QUESTIONS_PER_GAME = 5;

/** Game content banks (data, not UI chrome). */
const BANKS: Record<GameType, string[]> = {
  this_or_that: [
    "Beach holiday or city break?",
    "Breakfast in bed or fancy dinner out?",
    "Early morning run or midnight snack?",
    "Calling or texting?",
    "Mountains or ocean?",
    "Street food or fine dining?",
    "Spontaneous plans or organized trips?",
    "Sunrise or sunset?",
    "Netflix at home or night out?",
    "Sweet or savory?",
  ],
  twenty_questions: [
    "What's your dream travel destination?",
    "What's the best compliment you've received?",
    "What's your guilty pleasure song?",
    "What's one thing on your bucket list?",
    "What's your ideal lazy Sunday?",
    "What's a skill you're weirdly good at?",
    "What's the best meal you've ever had?",
    "What would you do with a free month?",
    "What's your favorite season and why?",
    "What's a small thing that makes you happy?",
  ],
  quick_picks: [
    "Coffee, tea, or matcha?",
    "Dogs or cats?",
    "Podcasts or playlists?",
    "Window seat or aisle seat?",
    "Summer or winter?",
    "Book or movie first?",
    "Home cooked or takeout?",
    "Beach towel or cozy blanket?",
  ],
  emoji_challenge: [
    "Pick one: ☕ 🍷 🍜",
    "Pick one: 🌊 🏔️ 🌃",
    "Pick one: 🎬 🎮 🎵",
    "Pick one: 🏃 🧘 🎨",
    "Pick one: 🌅 🌙 ⭐",
    "Pick one: ✈️ 🚗 🚲",
    "Pick one: 🍕 🍣 🌮",
    "Pick one: 📚 🎧 🎮",
  ],
  fun_questions: [
    "What's the most spontaneous thing you've done?",
    "What's a conversation you could have forever?",
    "What's your best 'tell me more' story?",
    "What's a talent you're secretly proud of?",
    "What's the last thing that made you laugh out loud?",
    "What's your favorite way to spend a weekend?",
    "What's something you're looking forward to?",
    "What's the best advice you've ever gotten?",
  ],
};

function pickQuestions(type: GameType, count: number): string[] {
  const bank = BANKS[type] ?? BANKS.fun_questions;
  return shuffle(bank).slice(0, Math.min(count, bank.length));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getMatchFor(
  ctx: QueryCtx,
  matchId: Id<"matches">,
  profileId: Id<"profiles">,
) {
  const match = await ctx.db.get(matchId);
  if (!match || match.status !== "active") return null;
  if (!match.participants.includes(profileId)) return null;
  return match;
}

/** Games for a specific match (for the chat / games entry point). */
export const gamesForMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const match = await getMatchFor(ctx, matchId, me._id);
    if (!match) return [];
    const games = await ctx.db
      .query("icebreakerGames")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .order("desc")
      .take(10);
    return games.map((g) => ({
      _id: g._id,
      gameType: g.gameType as GameType,
      status: g.status,
      createdAt: g.createdAt,
      questions: g.questions,
      myAnswers: g.answers.find((a) => a.profileId === me._id)?.answers ?? [],
      theirAnswers: g.answers.find((a) => a.profileId !== me._id)?.answers ?? [],
      otherAnswered: g.answers.some((a) => a.profileId !== me._id),
    }));
  },
});

/** Start a fresh game on a match. One active game per type per match. */
export const startGame = mutation({
  args: {
    matchId: v.id("matches"),
    gameType: v.union(...GAME_TYPES.map((t) => v.literal(t))),
  },
  handler: async (ctx, { matchId, gameType }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const match = await getMatchFor(ctx, matchId, me._id);
    if (!match) throw new Error("Match not available");

    const existing = await ctx.db
      .query("icebreakerGames")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .order("desc")
      .first();
    if (existing && existing.status === "active") {
      throw new Error("A game is already in progress on this match");
    }

    const now = nowMs();
    const id = await ctx.db.insert("icebreakerGames", {
      matchId,
      gameType,
      questions: pickQuestions(gameType, QUESTIONS_PER_GAME),
      answers: [],
      status: "active",
      createdAt: now,
    });
    return { _id: id };
  },
});

/**
 * Submit answers for the current player (one submission per profile; edits
 * allowed while the game is active). When both players have answered the game
 * auto-completes so the UI can point back to the chat.
 */
export const submitAnswer = mutation({
  args: {
    gameId: v.id("icebreakerGames"),
    answers: v.array(v.string()),
  },
  handler: async (ctx, { gameId, answers }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is finished");
    if (game.answers.length >= 2) throw new Error("Game is finished");

    const clean = answers.map((a) => a.trim().slice(0, 200)).filter(Boolean);
    if (clean.length !== game.questions.length) {
      throw new Error("Answer every question first");
    }

    const mine = game.answers.find((a) => a.profileId === me._id);
    let next = game.answers;
    if (mine) {
      next = game.answers.map((a) =>
        a.profileId === me._id ? { ...a, answers: clean } : a,
      );
    } else {
      next = [...game.answers, { profileId: me._id, answers: clean }];
    }
    const completed = next.length >= 2;
    await ctx.db.patch(gameId, {
      answers: next,
      status: completed ? "completed" : "active",
      completedAt: completed ? nowMs() : undefined,
    });
    return { completed };
  },
});

/** Recent completed games shared publicly-ish for a match (for fun stats). */
export const completedCountForMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const games = await ctx.db
      .query("icebreakerGames")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    return games.filter((g) => g.status === "completed").length;
  },
});
