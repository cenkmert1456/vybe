import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";
import { MOMENT_VISIBILITY } from "./schema";

export const MOMENT_TTL_MS = 24 * 60 * 60 * 1000; // default: 24 hours

export const myMoments = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const now = nowMs();
    const rows = await ctx.db
      .query("moments")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .collect();
    return rows
      .filter((m) => !m.deleted && m.expiresAt > now)
      .map((m) => ({
        _id: m._id.toString(),
        image: m.image,
        caption: m.caption ?? "",
        mood: m.mood ?? "",
        visibility: m.visibility,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
      }));
  },
});

/** A profile's visible moments (visibility-aware, expiry-aware). */
export const profileMoments = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const target = await ctx.db.get(profileId);
    if (!target) return [];

    // Only moments visible to this viewer.
    let visibleScope = false;
    if (target._id === me._id) visibleScope = true;
    else {
      const matches = await ctx.db
        .query("matches")
        .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
        .collect();
      const isMatched = matches.some(
        (m) =>
          m.participants.includes(profileId) && m.status === "active",
      );
      visibleScope = isMatched;
    }

    const now = nowMs();
    const rows = await ctx.db
      .query("moments")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .order("desc")
      .collect();

    return rows
      .filter((m) => !m.deleted && m.expiresAt > now)
      .filter((m) => {
        if (m.visibility === "public") return visibleScope || true; // public moments are on the public profile
        return visibleScope; // "matches" only for matches/self
      })
      .map((m) => ({
        _id: m._id.toString(),
        image: m.image,
        caption: m.caption ?? "",
        mood: m.mood ?? "",
        visibility: m.visibility,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
      }));
  },
});

export const createMoment = mutation({
  args: {
    image: v.string(),
    caption: v.optional(v.string()),
    mood: v.optional(v.string()),
    visibility: v.optional(v.union(...MOMENT_VISIBILITY.map((m) => v.literal(m)))),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Complete onboarding first");
    const caption = (args.caption ?? "").trim().slice(0, 160);
    const mood = (args.mood ?? "").trim().slice(0, 40);
    const now = nowMs();

    // Cap: keep the feed lightweight (5 live moments max).
    const existing = await ctx.db
      .query("moments")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const live = existing.filter((m) => !m.deleted && m.expiresAt > now);
    if (live.length >= 5)
      throw new Error("You can have up to 5 live moments");

    await ctx.db.insert("moments", {
      profileId: me._id,
      image: args.image,
      caption: caption || undefined,
      mood: mood || undefined,
      visibility: args.visibility ?? "matches",
      expiresAt: now + MOMENT_TTL_MS,
      createdAt: now,
      deleted: false,
    });
    return true;
  },
});

export const deleteMoment = mutation({
  args: { momentId: v.id("moments") },
  handler: async (ctx, { momentId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const moment = await ctx.db.get(momentId);
    if (!moment || moment.profileId !== me._id)
      throw new Error("Moment not found");
    await ctx.db.patch(moment._id, { deleted: true });
    return true;
  },
});

/** Report a moment (abuse). Records to the reports table via reportUser. */
export const reportMoment = mutation({
  args: {
    momentId: v.id("moments"),
    category: v.union(
      v.literal("fake_profile"),
      v.literal("harassment"),
      v.literal("inappropriate"),
      v.literal("spam"),
      v.literal("underage"),
      v.literal("other"),
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const moment = await ctx.db.get(args.momentId);
    if (!moment || moment.deleted) throw new Error("Moment not found");
    await ctx.db.insert("reports", {
      reporterProfileId: me._id,
      reportedProfileId: moment.profileId,
      category: args.category,
      description: `Moment report: ${(args.description ?? "").slice(0, 500)}`,
      createdAt: nowMs(),
      status: "open",
    });
    return true;
  },
});
