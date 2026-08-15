import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

/** Allow-listed product events. No private message content is ever tracked. */
const ALLOWED_EVENTS = new Set([
  "onboarding_started",
  "onboarding_completed",
  "profile_completed",
  "verification_started",
  "verification_completed",
  "verification_failed",
  "profile_viewed",
  "profile_liked",
  "profile_passed",
  "super_vybe_sent",
  "match_created",
  "message_sent",
  "boost_started",
  "boost_completed",
  "subscription_screen_viewed",
  "purchase_started",
  "purchase_completed",
  "purchase_failed",
  "moment_created",
  "moment_deleted",
  "daily_question_answered",
  "rewind_used",
  "travel_mode_enabled",
  "language_changed",
]);

export const track = mutation({
  args: {
    event: v.string(),
    metadata: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) return;
    if (!ALLOWED_EVENTS.has(args.event)) return; // reject unknown events
    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: args.event,
      metadata: args.metadata,
      createdAt: nowMs(),
    });
  },
});

/** Track a profile view (used by Boost results + discovery insights). */
export const recordProfileView = mutation({
  args: { viewedProfileId: v.id("profiles") },
  handler: async (ctx, { viewedProfileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return;
    if (me._id === viewedProfileId) return;
    await ctx.db.insert("profileViews", {
      viewerProfileId: me._id,
      viewedProfileId,
      createdAt: nowMs(),
    });
    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "profile_viewed",
      metadata: { viewedProfileId: viewedProfileId.toString() },
      createdAt: nowMs(),
    });
  },
});
