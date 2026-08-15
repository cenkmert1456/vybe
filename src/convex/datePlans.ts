import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getMyProfile, nowMs } from "./helpers";

/**
 * Date Planner: real date plans between matched profiles, stored in Convex.
 *
 * Statuses: pending → accepted / declined → completed / cancelled.
 * Alternatives are chained via `alternativeOf` so a declined plan can be
 * replaced without losing the conversation history.
 */

async function insertPlan(
  ctx: MutationCtx,
  args: {
    matchId: Id<"matches">;
    eventId?: Id<"events">;
    title: string;
    venue?: string;
    city?: string;
    dateMs: number;
    notes?: string;
  },
) {
  const me = await getMyProfile(ctx);
  if (!me) throw new Error("Not authenticated");

    const match = await ctx.db.get(args.matchId);
    if (!match || !match.participants.includes(me._id))
      throw new Error("Match not found");
    if (match.status !== "active")
      throw new Error("This conversation is closed");

    const title = args.title.trim().slice(0, 120);
    if (!title) throw new Error("Add a title for the plan");
    if (args.dateMs < nowMs() - 60 * 60 * 1000)
      throw new Error("Pick a date in the future");

    const otherId = match.participants.find((p) => p !== me._id);
    const other = otherId ? await ctx.db.get(otherId) : null;

    const now = nowMs();
    const planId = await ctx.db.insert("datePlans", {
      matchId: args.matchId,
      eventId: args.eventId,
      creatorProfileId: me._id,
      title,
      venue: args.venue?.trim().slice(0, 120) || undefined,
      city: args.city?.trim().slice(0, 80) || undefined,
      dateMs: args.dateMs,
      notes: args.notes?.trim().slice(0, 500) ?? "",
      status: "pending",
      createdAt: now,
    });

    // Notify the other person (real users only).
    if (other && other.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId: other._id,
        type: "system",
        fromProfileId: me._id,
        matchId: args.matchId,
        title: `${me.firstName} invited you to: ${title}`,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.matchId, {
      lastMessageAt: now,
      lastMessagePreview: `📅 ${me.firstName} invited you to: ${title}`,
      lastMessageSender: me._id,
    });

    return { planId: planId.toString() };
}

export const createDatePlan = mutation({
  args: {
    matchId: v.id("matches"),
    eventId: v.optional(v.id("events")),
    title: v.string(),
    venue: v.optional(v.string()),
    city: v.optional(v.string()),
    dateMs: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await insertPlan(ctx, args);
  },
});

/** Send an event from the Events screen to a match as a date-plan invitation. */
export const inviteToEvent = mutation({
  args: { matchId: v.id("matches"), eventId: v.id("events"), note: v.optional(v.string()) },
  handler: async (ctx, { matchId, eventId, note }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");

    return await insertPlan(ctx, {
      matchId,
      eventId,
      title: event.title,
      venue: event.venue,
      city: event.city,
      dateMs: event.startsAt,
      notes: note ?? `From VYBE Events · ${event.description.slice(0, 120)}`,
    });
  },
});

export const respondToDatePlan = mutation({
  args: {
    planId: v.id("datePlans"),
    action: v.union(
      v.literal("accept"),
      v.literal("decline"),
      v.literal("complete"),
      v.literal("cancel"),
    ),
  },
  handler: async (ctx, { planId, action }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");

    const match = await ctx.db.get(plan.matchId);
    if (!match || !match.participants.includes(me._id))
      throw new Error("Match not found");

    const now = nowMs();
    const otherId = match.participants.find((p) => p !== me._id);
    const other = otherId ? await ctx.db.get(otherId) : null;

    if (action === "accept") {
      if (plan.status !== "pending")
        throw new Error("Only pending plans can be accepted");
      await ctx.db.patch(planId, { status: "accepted", respondedAt: now });
      if (other && other.userId !== undefined) {
        await ctx.db.insert("activity", {
          profileId: other._id,
          type: "system",
          matchId: plan.matchId,
          title: `${me.firstName} accepted your plan: ${plan.title}`,
          createdAt: now,
        });
      }
      await ctx.db.patch(plan.matchId, {
        lastMessageAt: now,
        lastMessagePreview: `✅ ${me.firstName} accepted: ${plan.title}`,
        lastMessageSender: me._id,
      });
      return { status: "accepted" as const };
    }

    if (action === "decline") {
      if (plan.status !== "pending")
        throw new Error("Only pending plans can be declined");
      await ctx.db.patch(planId, { status: "declined", respondedAt: now });
      if (other && other.userId !== undefined) {
        await ctx.db.insert("activity", {
          profileId: other._id,
          type: "system",
          matchId: plan.matchId,
          title: `${me.firstName} declined: ${plan.title} — suggest an alternative!`,
          createdAt: now,
        });
      }
      return { status: "declined" as const };
    }

    if (action === "complete") {
      if (plan.status !== "accepted")
        throw new Error("Only accepted plans can be completed");
      await ctx.db.patch(planId, { status: "completed", respondedAt: now });
      if (other && other.userId !== undefined) {
        await ctx.db.insert("activity", {
          profileId: other._id,
          type: "system",
          matchId: plan.matchId,
          title: `You and ${me.firstName} marked "${plan.title}" as done 💜`,
          createdAt: now,
        });
      }
      return { status: "completed" as const };
    }

    // cancel
    if (plan.status === "completed" || plan.status === "cancelled")
      throw new Error("This plan is already closed");
    await ctx.db.patch(planId, {
      status: "cancelled",
      respondedAt: now,
      cancelledBy: me._id,
    });
    if (other && other.userId !== undefined) {
      await ctx.db.insert("activity", {
        profileId: other._id,
        type: "system",
        matchId: plan.matchId,
        title: `${me.firstName} cancelled: ${plan.title}`,
        createdAt: now,
      });
    }
    return { status: "cancelled" as const };
  },
});

/** All plans for the signed-in user across their matches (with peer info). */
export const myDatePlans = query({
  args: { matchId: v.optional(v.id("matches")) },
  handler: async (ctx, { matchId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];

    const matches = matchId
      ? [await ctx.db.get(matchId)].filter((m): m is NonNullable<typeof m> => Boolean(m))
      : await ctx.db
          .query("matches")
          .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
          .collect();

    const out: {
      _id: string;
      matchId: string;
      status: string;
      title: string;
      venue?: string;
      city?: string;
      dateMs: number;
      notes: string;
      creatorProfileId: string;
      eventId?: string;
      eventImage?: string;
      createdAt: number;
      respondedAt?: number;
      other: { _id: string; firstName: string; photos: string[] };
    }[] = [];

    for (const m of matches) {
      if (!m || !m.participants.includes(me._id)) continue;
      if (m.status !== "active") continue;
      const plans = await ctx.db
        .query("datePlans")
        .withIndex("by_match", (q) => q.eq("matchId", m._id))
        .order("desc")
        .collect();
      const otherId = m.participants.find((p) => p !== me._id);
      const other = otherId ? await ctx.db.get(otherId) : null;
      if (!other) continue;

      for (const p of plans) {
        let eventImage: string | undefined;
        if (p.eventId) {
          const ev = await ctx.db.get(p.eventId);
          eventImage = ev?.imageUrl;
        }
        out.push({
          _id: p._id.toString(),
          matchId: m._id.toString(),
          status: p.status,
          title: p.title,
          venue: p.venue,
          city: p.city,
          dateMs: p.dateMs,
          notes: p.notes,
          creatorProfileId: p.creatorProfileId.toString(),
          eventId: p.eventId?.toString(),
          eventImage,
          createdAt: p.createdAt,
          respondedAt: p.respondedAt,
          other: {
            _id: other._id.toString(),
            firstName: other.firstName,
            photos: other.photos,
          },
        });
      }
    }

    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});
