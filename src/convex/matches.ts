import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

type MatchSummary = {
  matchId: string;
  status: string;
  createdAt: number;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  lastMessageSender?: string;
  unreadCount: number;
  other: {
    _id: string;
    firstName: string;
    photos: string[];
    verified: boolean;
    city?: string;
    lastActiveAt: number;
    interests: string[];
    music?: { topArtists: string[]; topTracks: string[]; genres: string[] };
  };
};

/** All matches involving me, enriched with the other profile and unread count. */
export const listMatches = query({
  args: {},
  handler: async (ctx): Promise<MatchSummary[]> => {
    const me = await getMyProfile(ctx);
    if (!me) return [];

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
      .collect();

    const summaries: MatchSummary[] = [];
    for (const m of matches) {
      const otherId = m.participants.find((p) => p !== me._id);
      if (!otherId) continue;
      const other = await ctx.db.get(otherId);
      if (!other) continue;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_match", (q) => q.eq("matchId", m._id))
        .collect();
      const unread = messages.filter(
        (msg) =>
          msg.senderProfileId !== me._id && msg.readAt === undefined,
      ).length;

      summaries.push({
        matchId: m._id.toString(),
        status: m.status,
        createdAt: m.createdAt,
        lastMessageAt: m.lastMessageAt,
        lastMessagePreview: m.lastMessagePreview,
        lastMessageSender: m.lastMessageSender?.toString(),
        unreadCount: unread,
        other: {
          _id: other._id.toString(),
          firstName: other.firstName,
          photos: other.photos,
          verified: other.verified,
          city: other.city,
          lastActiveAt: other.lastActiveAt,
          interests: other.interests,
          music: other.music,
        },
      });
    }

    summaries.sort((a, b) => {
      const at = a.lastMessageAt ?? a.createdAt;
      const bt = b.lastMessageAt ?? b.createdAt;
      return bt - at;
    });
    return summaries;
  },
});

/** A single match with both participants (for chat headers and match moments). */
export const getMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const match = await ctx.db.get(matchId);
    if (!match || !match.participants.includes(me._id)) return null;
    const otherId = match.participants.find((p) => p !== me._id);
    const other = otherId ? await ctx.db.get(otherId) : null;
    return { match, other };
  },
});

/** My active match with this profile, if any (null when not matched). */
export const matchWith = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
      .collect();
    const found = matches.find(
      (m) => m.status === "active" && m.participants.includes(profileId),
    );
    return found ? found._id.toString() : null;
  },
});

/** Total unread message count across all matches (tab badge). */
export const totalUnread = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return 0;
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
      .collect();
    let total = 0;
    for (const m of matches) {
      if (m.status !== "active") continue;
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_match", (q) => q.eq("matchId", m._id))
        .collect();
      total += messages.filter(
        (msg) => msg.senderProfileId !== me._id && msg.readAt === undefined,
      ).length;
    }
    return total;
  },
});

/** Unmatch: conversation is closed, profile stays discoverable. */
export const unmatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const match = await ctx.db.get(matchId);
    if (!match || !match.participants.includes(me._id))
      throw new Error("Match not found");
    await ctx.db.patch(matchId, {
      status: "unmatched",
      unmatchedBy: me._id,
      lastMessageAt: nowMs(),
      lastMessagePreview: undefined,
      lastMessageSender: undefined,
    });
    return true;
  },
});
