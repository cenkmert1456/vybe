import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

export const reportUser = mutation({
  args: {
    reportedProfileId: v.id("profiles"),
    category: v.union(
      v.literal("fake_profile"),
      v.literal("harassment"),
      v.literal("inappropriate"),
      v.literal("spam"),
      v.literal("underage"),
      v.literal("other"),
    ),
    description: v.string(),
  },
  handler: async (ctx, { reportedProfileId, category, description }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (me._id === reportedProfileId)
      throw new Error("You cannot report yourself");
    const target = await ctx.db.get(reportedProfileId);
    if (!target) throw new Error("Profile not found");

    await ctx.db.insert("reports", {
      reporterProfileId: me._id,
      reportedProfileId,
      category,
      description: description.slice(0, 2000),
      createdAt: nowMs(),
      status: "open",
    });
    return true;
  },
});

/** Block a profile: hides them from discovery and closes any active match. */
export const blockUser = mutation({
  args: { blockedProfileId: v.id("profiles") },
  handler: async (ctx, { blockedProfileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (me._id === blockedProfileId) throw new Error("Cannot block yourself");
    const target = await ctx.db.get(blockedProfileId);
    if (!target) throw new Error("Profile not found");

    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) =>
        q
          .eq("blockerProfileId", me._id)
          .eq("blockedProfileId", blockedProfileId),
      )
      .first();
    if (!existing) {
      await ctx.db.insert("blocks", {
        blockerProfileId: me._id,
        blockedProfileId,
        createdAt: nowMs(),
      });
    }

    // Close any active conversation.
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
      .collect();
    for (const m of matches) {
      if (m.participants.includes(blockedProfileId) && m.status === "active") {
        await ctx.db.patch(m._id, {
          status: "blocked",
          blockedBy: me._id,
        });
      }
    }
    return true;
  },
});

export const unblockUser = mutation({
  args: { blockedProfileId: v.id("profiles") },
  handler: async (ctx, { blockedProfileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const block = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) =>
        q
          .eq("blockerProfileId", me._id)
          .eq("blockedProfileId", blockedProfileId),
      )
      .first();
    if (block) await ctx.db.delete(block._id);
    return true;
  },
});

export const blockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_blocker", (q) => q.eq("blockerProfileId", me._id))
      .collect();
    const out: {
      _id: string;
      firstName: string;
      photos: string[];
      city?: string;
      blockedAt: number;
    }[] = [];
    for (const b of blocks) {
      const p = await ctx.db.get(b.blockedProfileId);
      if (!p) continue;
      out.push({
        _id: p._id.toString(),
        firstName: p.firstName,
        photos: p.photos,
        city: p.city,
        blockedAt: b.createdAt,
      });
    }
    return out;
  },
});

export const myReports = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterProfileId", me._id))
      .collect();
    const out: { _id: string; category: string; createdAt: number; status: string }[] = [];
    for (const r of reports) {
      out.push({
        _id: r._id.toString(),
        category: r.category,
        createdAt: r.createdAt,
        status: r.status,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});
