import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

export const MOODS = [
  "chill",
  "social",
  "romantic",
  "adventurous",
  "chatty",
  "quiet",
  "creative",
  "active",
] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_DURATIONS_MS = {
  "2h": 2 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
} as const;
export type MoodDuration = keyof typeof MOOD_DURATIONS_MS;

/** The user's active mood (null when unset or expired). */
export const myMood = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const now = nowMs();
    const row = await ctx.db
      .query("moods")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .first();
    if (!row || row.expiresAt <= now) return null;
    return {
      mood: row.mood as Mood,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  },
});

/** Any profile's active mood (used on cards / profile detail). */
export const moodFor = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const now = nowMs();
    const row = await ctx.db
      .query("moods")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .first();
    if (!row || row.expiresAt <= now) return null;
    return { mood: row.mood as Mood, expiresAt: row.expiresAt };
  },
});

/** Set (or replace) the current mood. Returns the new mood state. */
export const setMood = mutation({
  args: {
    mood: v.union(...MOODS.map((m) => v.literal(m))),
    duration: v.union(
      v.literal("2h"),
      v.literal("6h"),
      v.literal("12h"),
      v.literal("24h"),
      v.literal("3d"),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const now = nowMs();
    const expiresAt = now + MOOD_DURATIONS_MS[args.duration];
    const existing = await ctx.db
      .query("moods")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        mood: args.mood,
        expiresAt,
        createdAt: now,
      });
    } else {
      await ctx.db.insert("moods", {
        profileId: me._id,
        mood: args.mood,
        expiresAt,
        createdAt: now,
      });
    }
    return { mood: args.mood, expiresAt };
  },
});

/** Clear the current mood. Never fails if there is none. */
export const clearMood = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const existing = await ctx.db
      .query("moods")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return true;
  },
});
