import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";
import { enforceMessageSpam, filterContent } from "./moderation";

export const ROOM_CATEGORIES = [
  "music",
  "gaming",
  "travel",
  "movies",
  "coffee",
  "fitness",
  "books",
  "local",
] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

async function memberOf(
  ctx: QueryCtx,
  roomId: Id<"rooms">,
  profileId: Id<"profiles">,
) {
  return await ctx.db
    .query("roomMembers")
    .withIndex("by_room_profile", (q) =>
      q.eq("roomId", roomId).eq("profileId", profileId),
    )
    .first();
}

/** All rooms with member counts + my membership status. */
export const listRooms = query({
  args: { category: v.optional(v.union(...ROOM_CATEGORIES.map((c) => v.literal(c)))) },
  handler: async (ctx, { category }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    let rooms;
    if (category) {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .take(50);
    } else {
      rooms = await ctx.db.query("rooms").order("desc").take(50);
    }
    const out = [];
    for (const room of rooms) {
      const members = await ctx.db
        .query("roomMembers")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      out.push({
        _id: room._id,
        name: room.name,
        category: room.category as RoomCategory,
        description: room.description,
        createdAt: room.createdAt,
        memberCount: members.length,
        joined: members.some((m) => m.profileId === me._id),
      });
    }
    return out;
  },
});

export const roomDetail = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const joined = Boolean(await memberOf(ctx, roomId, me._id));
    const members = await ctx.db
      .query("roomMembers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .take(50);
    const memberProfiles = [];
    for (const m of members) {
      const p = await ctx.db.get(m.profileId);
      if (p) {
        memberProfiles.push({
          _id: p._id,
          firstName: p.firstName,
          photos: p.photos,
          verified: p.verified,
        });
      }
    }
    return {
      _id: room._id,
      name: room.name,
      category: room.category as RoomCategory,
      description: room.description,
      createdAt: room.createdAt,
      joined,
      memberCount: members.length,
      members: memberProfiles,
    };
  },
});

/** Room chat history (only members see messages). */
export const roomMessages = query({
  args: { roomId: v.id("rooms"), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    if (!(await memberOf(ctx, roomId, me._id))) return [];
    const rows = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(Math.min(limit ?? 40, 80));
    const out = [];
    for (const row of rows.reverse()) {
      if (row.deleted) {
        out.push({
          _id: row._id,
          deleted: true,
          createdAt: row.createdAt,
        });
        continue;
      }
      const p = await ctx.db.get(row.profileId);
      out.push({
        _id: row._id,
        content: row.content,
        createdAt: row.createdAt,
        profile: p
          ? {
              _id: p._id,
              firstName: p.firstName,
              photos: p.photos,
              verified: p.verified,
            }
          : null,
      });
    }
    return out;
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    category: v.union(...ROOM_CATEGORIES.map((c) => v.literal(c))),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const name = filterContent(args.name.trim().slice(0, 40));
    const description = filterContent(args.description.trim().slice(0, 160));
    if (!name) throw new Error("Room name is required");
    const now = nowMs();
    const roomId = await ctx.db.insert("rooms", {
      name,
      category: args.category,
      description,
      createdBy: me._id,
      createdAt: now,
    });
    await ctx.db.insert("roomMembers", {
      roomId,
      profileId: me._id,
      joinedAt: now,
    });
    return { _id: roomId };
  },
});

export const joinRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (await memberOf(ctx, roomId, me._id)) return { joined: true };
    await ctx.db.insert("roomMembers", {
      roomId,
      profileId: me._id,
      joinedAt: nowMs(),
    });
    return { joined: true };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const row = await memberOf(ctx, roomId, me._id);
    if (row) await ctx.db.delete(row._id);
    return { joined: false };
  },
});

/** Send a room message. Spam-protected and content-filtered server-side. */
export const sendRoomMessage = mutation({
  args: { roomId: v.id("rooms"), content: v.string() },
  handler: async (ctx, { roomId, content }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (!(await memberOf(ctx, roomId, me._id))) {
      throw new Error("Join the room to chat");
    }
    // Reuse the shared rolling rate limit (10s window) for rooms too.
    await enforceMessageSpam(ctx, me._id, roomId as unknown as Id<"matches">, content);
    const clean = filterContent(content.trim().slice(0, 500));
    if (!clean) throw new Error("Empty message");

    // Duplicate detection for rooms: same text twice within 60s is rejected.
    const last = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();
    if (
      last &&
      !last.deleted &&
      last.profileId === me._id &&
      nowMs() - last.createdAt < 60_000 &&
      last.content.trim().toLowerCase() === clean.toLowerCase()
    ) {
      throw new Error("You just sent that — try something new.");
    }

    await ctx.db.insert("roomMessages", {
      roomId,
      profileId: me._id,
      content: clean,
      createdAt: nowMs(),
      deleted: false,
    });
    return true;
  },
});

/** Members can delete their own room messages. */
export const deleteRoomMessage = mutation({
  args: { messageId: v.id("roomMessages") },
  handler: async (ctx, { messageId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const row = await ctx.db.get(messageId);
    if (!row || row.profileId !== me._id) throw new Error("Not allowed");
    await ctx.db.patch(messageId, { deleted: true });
    return true;
  },
});
