import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";
import { enforceMessageSpam, filterContent } from "./moderation";
import { api } from "./_generated/api";

const MESSAGES_PAGE = 40;

type ReactionSummary = { emoji: string; count: number; mine: boolean };

/** Aggregate reactions for a single message. */
async function reactionsFor(
  ctx: QueryCtx,
  messageId: Id<"messages">,
  myProfileId: Id<"profiles">,
): Promise<ReactionSummary[]> {
  const rows = await ctx.db
    .query("messageReactions")
    .withIndex("by_message", (q) => q.eq("messageId", messageId))
    .collect();
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.profileId === myProfileId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.entries()].map(([emoji, s]) => ({
    emoji,
    count: s.count,
    mine: s.mine,
  }));
}

export const listMessages = query({
  args: {
    matchId: v.id("matches"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { matchId, cursor, limit }) => {
    const me = await getMyProfile(ctx);
    if (!me) return { messages: [], hasMore: false, cursor: null };

    const match = await ctx.db.get(matchId);
    if (!match || !match.participants.includes(me._id))
      return { messages: [], hasMore: false, cursor: null };

    const pageSize = Math.min(limit ?? MESSAGES_PAGE, 60);
    const all = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();

    // Newest first, skip past the cursor, take a page, then reverse to ascending.
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
    let start = 0;
    if (cursor !== undefined) {
      const idx = sorted.findIndex((m) => m.createdAt < cursor);
      start = idx === -1 ? sorted.length : idx;
    }
    const page = sorted.slice(start, start + pageSize);
    const hasMore = start + page.length < sorted.length;
    const lastCursor = page.length ? page[page.length - 1].createdAt : null;

    // Attach reactions + quoted reply previews.
    const reactions = new Map<string, ReactionSummary[]>();
    const quoted = new Map<string, { sender: string; preview: string }>();
    for (const m of page) {
      reactions.set(m._id.toString(), await reactionsFor(ctx, m._id, me._id));
      if (m.replyTo) {
        const target = await ctx.db.get(m.replyTo);
        if (target) {
          const sender = await ctx.db.get(target.senderProfileId);
          quoted.set(m._id.toString(), {
            sender: sender?.firstName ?? "",
            preview:
              target.type === "image"
                ? "📷 Photo"
                : target.content.slice(0, 80),
          });
        }
      }
    }

    return {
      messages: page.reverse().map((m) => ({
        _id: m._id,
        matchId: m.matchId,
        senderProfileId: m.senderProfileId,
        type: m.type,
        content: m.content,
        createdAt: m.createdAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        replyTo: m.replyTo?.toString(),
        replyPreview: quoted.get(m._id.toString()),
        reactions: reactions.get(m._id.toString()) ?? [],
      })),
      hasMore,
      cursor: hasMore ? lastCursor : null,
    };
  },
});

/** Shared insert logic for text and image messages. */
async function insertMessage(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  content: string,
  type: "text" | "image",
  replyTo?: Id<"messages">,
): Promise<string> {
  const me = await getMyProfile(ctx);
  if (!me) throw new Error("Complete onboarding first");

  const match = await ctx.db.get(matchId);
  if (!match || !match.participants.includes(me._id))
    throw new Error("Match not found");
  if (match.status !== "active")
    throw new Error("This conversation is closed");

  const trimmed = content.trim();
  if (type === "text" && !trimmed) throw new Error("Message is empty");
  if (type === "text" && trimmed.length > 4000)
    throw new Error("Message is too long");

  // Spam + duplicate-message protection (server-side, never bypassable).
  if (type === "text") {
    await enforceMessageSpam(ctx, me._id, matchId, trimmed);
  }

  if (replyTo) {
    const quoted = await ctx.db.get(replyTo);
    if (!quoted || quoted.matchId !== matchId)
      throw new Error("Message not found in this chat");
  }

  const now = nowMs();
  const safeContent = type === "text" ? filterContent(trimmed) : content;
  const id = await ctx.db.insert("messages", {
    matchId,
    senderProfileId: me._id,
    type,
    content: safeContent,
    createdAt: now,
    deliveredAt: now,
    replyTo,
  });

  // Daily message counter + streak (max one progression per day).
  const d = new Date(now);
  const dayKey = d.toISOString().slice(0, 10);
  const msgCounter = await ctx.db
    .query("usageCounters")
    .withIndex("by_profile_key", (q) =>
      q.eq("profileId", me._id).eq("key", `msg:${dayKey}`),
    )
    .first();
  if (msgCounter) {
    await ctx.db.patch(msgCounter._id, { count: msgCounter.count + 1 });
  } else {
    await ctx.db.insert("usageCounters", {
      profileId: me._id,
      key: `msg:${dayKey}`,
      count: 1,
    });
    try {
      await ctx.runMutation(api.streaks.recordActivity, { type: "message" });
    } catch {
      /* non-fatal */
    }
  }

  await ctx.db.patch(matchId, {
    lastMessageAt: now,
    lastMessagePreview:
      type === "image" ? "📷 Photo" : trimmed.slice(0, 120),
    lastMessageSender: me._id,
  });

  const otherId = match.participants.find((p) => p !== me._id);
  if (otherId) {
    const other = await ctx.db.get(otherId);
    if (other && other.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId: otherId,
        type: "message",
        fromProfileId: me._id,
        matchId,
        title: `${me.firstName} sent you a message`,
        createdAt: now,
      });
    }
  }

  return id.toString();
}

export const sendMessage = mutation({
  args: {
    matchId: v.id("matches"),
    content: v.string(),
    type: v.optional(v.union(v.literal("text"), v.literal("image"))),
    replyTo: v.optional(v.id("messages")),
  },
  handler: async (ctx, { matchId, content, type, replyTo }) => {
    return await insertMessage(ctx, matchId, content, type ?? "text", replyTo);
  },
});

/** Toggle an emoji reaction on a message (adds or removes the reactor's). */
export const reactToMessage = mutation({
  args: {
    matchId: v.id("matches"),
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, { matchId, messageId, emoji }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Complete onboarding first");

    const match = await ctx.db.get(matchId);
    if (!match || !match.participants.includes(me._id))
      throw new Error("Match not found");
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.matchId !== matchId) throw new Error("Message not found");
    if (!emoji || emoji.length > 8) throw new Error("Invalid reaction");

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_profile", (q) =>
        q.eq("messageId", messageId).eq("profileId", me._id),
      )
      .filter((q) => q.eq(q.field("emoji"), emoji))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { active: false };
    }
    await ctx.db.insert("messageReactions", {
      matchId,
      messageId,
      profileId: me._id,
      emoji,
      createdAt: nowMs(),
    });
    return { active: true };
  },
});

export const sendImageMessage = mutation({
  args: { matchId: v.id("matches"), storageId: v.id("_storage") },
  handler: async (ctx, { matchId, storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Upload failed");
    return await insertMessage(ctx, matchId, url, "image");
  },
});

/** Mark all messages from the other participant as read. */
export const markRead = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return;
    const match = await ctx.db.get(matchId);
    if (!match || !match.participants.includes(me._id)) return;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    const now = nowMs();
    for (const msg of messages) {
      if (msg.senderProfileId !== me._id && msg.readAt === undefined) {
        await ctx.db.patch(msg._id, { readAt: now });
      }
    }
  },
});

/** Canned replies used by demo profiles so conversations feel alive. */
const DEMO_REPLIES = [
  "Haha love that 😄 What are you up to this weekend?",
  "Okay that's actually a great point. Tell me more 👀",
  "I was literally just thinking the same thing!",
  "You have the best energy. This is refreshing ✨",
  "Hmm, tough one. Coffee first, we can debate after ☕",
  "Sending you a virtual high five 🙌",
  "I'd say yes, but only if you bring snacks.",
  "You're making my day honestly. What's your favorite song right now?",
  "That sounds amazing. When are we doing it? 😏",
  "I love how you think. Also — cute photo 👀",
];

export const simulateReply = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match || match.status !== "active") return null;

    const me = await getMyProfile(ctx);
    if (!me) return null;
    const otherId = match.participants.find((p) => p !== me._id);
    if (!otherId) return null;
    const other = await ctx.db.get(otherId);
    if (!other || !other.isDemo) return null;

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    const fromMe = existing.filter((m) => m.senderProfileId === me._id).length;

    const reply =
      DEMO_REPLIES[fromMe % DEMO_REPLIES.length] ?? DEMO_REPLIES[0];

    const now = nowMs();
    await ctx.db.insert("messages", {
      matchId,
      senderProfileId: otherId,
      type: "text",
      content: reply,
      createdAt: now,
      deliveredAt: now,
    });
    await ctx.db.patch(matchId, {
      lastMessageAt: now,
      lastMessagePreview: reply,
      lastMessageSender: otherId,
    });
    await ctx.db.insert("activity", {
      profileId: me._id,
      type: "message",
      fromProfileId: otherId,
      matchId,
      title: `${other.firstName} sent you a message`,
      createdAt: now,
    });
    return reply;
  },
});
