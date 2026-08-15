import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

export const listActivity = query({
  args: { cursor: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { cursor, limit }) => {
    const me = await getMyProfile(ctx);
    if (!me) return { items: [], hasMore: false, cursor: null };

    const pageSize = Math.min(limit ?? 30, 50);
    const all = await ctx.db
      .query("activity")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);

    let start = 0;
    if (cursor !== undefined) {
      const idx = sorted.findIndex((a) => a.createdAt < cursor);
      start = idx === -1 ? sorted.length : idx;
    }
    const page = sorted.slice(start, start + pageSize);
    const hasMore = start + page.length < sorted.length;

    const items = [];
    for (const a of page) {
      let from: {
        _id: string;
        firstName: string;
        photos: string[];
        verified: boolean;
        city?: string;
      } | null = null;
      if (a.fromProfileId) {
        const p = await ctx.db.get(a.fromProfileId);
        if (p) {
          from = {
            _id: p._id.toString(),
            firstName: p.firstName,
            photos: p.photos,
            verified: p.verified,
            city: p.city,
          };
        }
      }
      items.push({
        _id: a._id.toString(),
        type: a.type,
        title: a.title,
        createdAt: a.createdAt,
        readAt: a.readAt ?? null,
        matchId: a.matchId?.toString() ?? null,
        from,
      });
    }

    return {
      items,
      hasMore,
      cursor: hasMore ? page[page.length - 1].createdAt : null,
    };
  },
});

export const unreadActivityCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return 0;
    const all = await ctx.db
      .query("activity")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    return all.filter((a) => a.readAt === undefined).length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return;
    const all = await ctx.db
      .query("activity")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const now = nowMs();
    for (const a of all) {
      if (a.readAt === undefined) await ctx.db.patch(a._id, { readAt: now });
    }
  },
});
