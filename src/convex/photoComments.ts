import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";
import { filterContent, PHOTO_COMMENT_DAILY_LIMIT, PHOTO_COMMENT_MIN_INTERVAL_MS } from "./moderation";

/**
 * Photo comments: matched users can leave a comment or emoji reaction on a
 * specific photo. Visible only to the photo owner and their matches.
 * Spam-protected: daily cap + minimum interval between comments.
 */

/** Who may see comments on this profile: the owner and their active matches. */
async function canSeeComments(
  ctx: QueryCtx,
  viewerId: Id<"profiles">,
  ownerId: Id<"profiles">,
): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const matches = await ctx.db
    .query("matches")
    .withIndex("by_participants", (q) => q.eq("participants", [viewerId]))
    .collect();
  return matches.some(
    (m) => m.status === "active" && m.participants.includes(ownerId),
  );
}

export const addPhotoComment = mutation({
  args: {
    profileId: v.id("profiles"),
    photoIndex: v.number(),
    text: v.string(),
  },
  handler: async (ctx, { profileId, photoIndex, text }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    if (me._id === profileId) throw new Error("You can't comment on your own photo");
    const owner = await ctx.db.get(profileId);
    if (!owner) throw new Error("Profile not found");
    if (photoIndex < 0 || photoIndex >= owner.photos.length)
      throw new Error("Photo not found");

    if (!(await canSeeComments(ctx, me._id, profileId)))
      throw new Error("You can only comment on your matches' photos");

    const trimmed = filterContent(text.trim().slice(0, 300));
    if (!trimmed) throw new Error("Write a comment first");

    const now = nowMs();

    // Daily cap.
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `photoComment:${dayKey}`),
      )
      .first();
    if ((counter?.count ?? 0) >= PHOTO_COMMENT_DAILY_LIMIT) {
      throw new Error("You've left a lot of comments today — take a break");
    }

    // Minimum interval between comments.
    const recent = await ctx.db
      .query("photoComments")
      .withIndex("by_commenter", (q) => q.eq("commenterProfileId", me._id))
      .order("desc")
      .first();
    if (recent && now - recent.createdAt < PHOTO_COMMENT_MIN_INTERVAL_MS) {
      throw new Error("Whoa, slow down — one comment at a time");
    }

    const id = await ctx.db.insert("photoComments", {
      profileId,
      commenterProfileId: me._id,
      photoIndex,
      text: trimmed,
      createdAt: now,
      deleted: false,
    });

    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        profileId: me._id,
        key: `photoComment:${dayKey}`,
        count: 1,
      });
    }

    // Notify the photo owner (real users only).
    if (owner.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId,
        type: "like",
        fromProfileId: me._id,
        title: `${me.firstName} commented on your photo`,
        createdAt: now,
      });
    }

    return { commentId: id.toString() };
  },
});

export const deletePhotoComment = mutation({
  args: { commentId: v.id("photoComments") },
  handler: async (ctx, { commentId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.commenterProfileId !== me._id && comment.profileId !== me._id)
      throw new Error("You can only delete your own comments");
    await ctx.db.patch(commentId, { deleted: true });
    return true;
  },
});

export const reactToPhotoComment = mutation({
  args: { commentId: v.id("photoComments"), emoji: v.string() },
  handler: async (ctx, { commentId, emoji }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const comment = await ctx.db.get(commentId);
    if (!comment || comment.deleted) throw new Error("Comment not found");
    if (!(await canSeeComments(ctx, me._id, comment.profileId)))
      throw new Error("Not available");
    if (!emoji || emoji.length > 8) throw new Error("Invalid reaction");

    const existing = await ctx.db
      .query("photoCommentReactions")
      .withIndex("by_comment_profile", (q) =>
        q.eq("commentId", commentId).eq("profileId", me._id),
      )
      .filter((q) => q.eq(q.field("emoji"), emoji))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { active: false };
    }
    await ctx.db.insert("photoCommentReactions", {
      commentId,
      profileId: me._id,
      emoji,
      createdAt: nowMs(),
    });
    return { active: true };
  },
});

export const listPhotoComments = query({
  args: { profileId: v.id("profiles"), photoIndex: v.number() },
  handler: async (ctx, { profileId, photoIndex }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    if (!(await canSeeComments(ctx, me._id, profileId))) return [];

    const rows = await ctx.db
      .query("photoComments")
      .withIndex("by_profile_photo", (q) =>
        q.eq("profileId", profileId).eq("photoIndex", photoIndex),
      )
      .order("desc")
      .collect();

    const out: {
      _id: string;
      text: string;
      createdAt: number;
      mine: boolean;
      commenter: { _id: string; firstName: string; photos: string[] };
      reactions: { emoji: string; count: number; mine: boolean }[];
    }[] = [];

    for (const c of rows) {
      if (c.deleted) continue;
      const commenter = await ctx.db.get(c.commenterProfileId);
      if (!commenter) continue;
      const reactions = await ctx.db
        .query("photoCommentReactions")
        .withIndex("by_comment", (q) => q.eq("commentId", c._id))
        .collect();
      const map = new Map<string, { count: number; mine: boolean }>();
      for (const r of reactions) {
        const cur = map.get(r.emoji) ?? { count: 0, mine: false };
        cur.count += 1;
        if (r.profileId === me._id) cur.mine = true;
        map.set(r.emoji, cur);
      }
      out.push({
        _id: c._id.toString(),
        text: c.text,
        createdAt: c.createdAt,
        mine: c.commenterProfileId === me._id,
        commenter: {
          _id: commenter._id.toString(),
          firstName: commenter.firstName,
          photos: commenter.photos,
        },
        reactions: [...map.entries()].map(([emoji, s]) => ({
          emoji,
          count: s.count,
          mine: s.mine,
        })),
      });
    }
    return out;
  },
});

/** Recent comments on MY photos (for the profile “comments” entry point). */
export const myPhotoComments = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const rows: {
      _id: string;
      text: string;
      photoIndex: number;
      createdAt: number;
      commenter: { _id: string; firstName: string; photos: string[] };
    }[] = [];
    // Scan each photo slot (max 6 photos per profile).
    for (let i = 0; i < 6; i++) {
      const byPhoto = await ctx.db
        .query("photoComments")
        .withIndex("by_profile_photo", (q) =>
          q.eq("profileId", me._id).eq("photoIndex", i),
        )
        .order("desc")
        .collect();
      for (const c of byPhoto) {
        if (c.deleted) continue;
        const commenter = await ctx.db.get(c.commenterProfileId);
        if (!commenter) continue;
        rows.push({
          _id: c._id.toString(),
          text: c.text,
          photoIndex: c.photoIndex,
          createdAt: c.createdAt,
          commenter: {
            _id: commenter._id.toString(),
            firstName: commenter.firstName,
            photos: commenter.photos,
          },
        });
      }
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  },
});
