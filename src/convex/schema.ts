// VYBE database schema. The src/convex/_generated/ directory is regenerated
// from this file by `convex dev --once` (Convex codegen) and is gitignored.
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const GENDERS = ["woman", "man", "nonbinary", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const SWIPE_ACTIONS = ["like", "pass", "superLike"] as const;
export type SwipeAction = (typeof SWIPE_ACTIONS)[number];

export const MATCH_STATUSES = ["active", "unmatched", "blocked"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MESSAGE_TYPES = ["text", "image"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REPORT_CATEGORIES = [
  "fake_profile",
  "harassment",
  "inappropriate",
  "spam",
  "underage",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ["open", "reviewed", "resolved"] as const;

export const ACTIVITY_TYPES = [
  "like",
  "match",
  "message",
  "verify",
  "system",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "in_progress",
  "verified",
  "failed",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Status of the badge on a profile (distinct from session status). */
export const PROFILE_VERIFICATION_STATUSES = [
  "none",
  "in_progress",
  "verified",
  "failed",
] as const;
export type ProfileVerificationStatus = (typeof PROFILE_VERIFICATION_STATUSES)[number];

export const PLANS = ["free", "silver", "gold", "platinum"] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "expired",
  "canceled",
  "grace_period",
  "pending",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const MOMENT_VISIBILITY = ["matches", "public"] as const;
export type MomentVisibility = (typeof MOMENT_VISIBILITY)[number];

export const EVENT_CATEGORIES = [
  "coffee",
  "dinner",
  "walk",
  "concert",
  "exhibition",
  "cinema",
  "park",
  "activity",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const DATE_PLAN_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export type DatePlanStatus = (typeof DATE_PLAN_STATUSES)[number];

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // =========================================================================
    // VYBE tables
    // =========================================================================

    /**
     * A person's public-facing profile. Every participant — real signed-in
     * users (userId set) and demo profiles used for development (userId null) —
     * is represented here, so discovery, matching and messaging all operate on
     * a single entity type.
     */
    profiles: defineTable({
      userId: v.optional(v.id("users")), // set for real users only
      firstName: v.string(),
      dateOfBirth: v.number(), // ms timestamp
      gender: v.union(...GENDERS.map((g) => v.literal(g))),
      interestedIn: v.array(
        v.union(...GENDERS.map((g) => v.literal(g))),
      ),
      bio: v.string(),
      photos: v.array(v.string()), // urls
      interests: v.array(v.string()),
      languages: v.array(v.string()),
      city: v.optional(v.string()),
      // Global discovery: standardized country + city identifiers.
      countryCode: v.optional(v.string()), // ISO 3166-1 alpha-2
      countryName: v.optional(v.string()),
      cityId: v.optional(v.string()),
      approxLat: v.optional(v.number()),
      approxLng: v.optional(v.number()),
      lifestyle: v.array(v.string()),
      relationshipIntentions: v.array(v.string()),
      education: v.optional(v.string()),
      // Travel / passport mode: discover people in a future location.
      travel: v.optional(
        v.object({
          enabled: v.boolean(),
          countryCode: v.string(),
          cityName: v.string(),
          lat: v.optional(v.number()),
          lng: v.optional(v.number()),
          expiresAt: v.optional(v.number()),
        }),
      ),
      prompts: v.array(
        v.object({ question: v.string(), answer: v.string() }),
      ),
      verified: v.boolean(),
      verificationStatus: v.union(
        ...PROFILE_VERIFICATION_STATUSES.map((s) => v.literal(s)),
      ),
      // On-device liveness metadata — the only data stored about a check.
      verificationMeta: v.optional(
        v.object({
          verifiedAt: v.number(),
          method: v.string(), // "on_device_liveness"
          score: v.number(),
        }),
      ),
      // Music: manual entries + optional Spotify connection flag.
      music: v.optional(
        v.object({
          topArtists: v.array(v.string()),
          topTracks: v.array(v.string()),
          genres: v.array(v.string()),
          spotifyConnected: v.boolean(),
        }),
      ),
      // Referrals: unique invite code + who invited this user (if any).
      referralCode: v.optional(v.string()),
      referredByCode: v.optional(v.string()),
      // Voice intro: short recorded greeting (max 30s) stored in Convex storage.
      voiceIntro: v.optional(
        v.object({
          url: v.string(),
          durationSec: v.number(),
          createdAt: v.number(),
        }),
      ),
      showInDiscovery: v.boolean(),
      profileHidden: v.boolean(),
      onboardingCompleted: v.boolean(),
      completedAt: v.optional(v.number()),
      lastActiveAt: v.number(),
      isDemo: v.boolean(),
      discoveryPrefs: v.object({
        ageMin: v.number(),
        ageMax: v.number(),
        distanceKm: v.number(),
        genders: v.array(v.union(...GENDERS.map((g) => v.literal(g)))),
        // Advanced filters (premium): optional refinement of the deck.
        interests: v.optional(v.array(v.string())),
        languages: v.optional(v.array(v.string())),
        lifestyle: v.optional(v.array(v.string())),
        intentions: v.optional(v.array(v.string())),
        verifiedOnly: v.optional(v.boolean()),
        recentlyActiveDays: v.optional(v.number()),
      }),
      notificationPrefs: v.object({
        matches: v.boolean(),
        messages: v.boolean(),
        likes: v.boolean(),
        activity: v.boolean(),
        events: v.boolean(),
        promotions: v.boolean(),
        push: v.boolean(), // push delivery master switch
      }),
      privacyPrefs: v.object({
        readReceipts: v.boolean(),
        onlineStatus: v.boolean(),
        locationPrivacy: v.boolean(),
        verificationPrivacy: v.boolean(),
      }),
    })
      .index("by_user", ["userId"])
      .index("by_isDemo", ["isDemo"])
      .index("by_country", ["countryCode"])
      .index("by_city", ["cityId"]),

    /** A swipe decision from one profile toward another. */
    swipes: defineTable({
      fromProfileId: v.id("profiles"),
      toProfileId: v.id("profiles"),
      action: v.union(...SWIPE_ACTIONS.map((a) => v.literal(a))),
      createdAt: v.number(),
    })
      .index("by_from", ["fromProfileId"])
      .index("by_from_to", ["fromProfileId", "toProfileId"])
      .index("by_to", ["toProfileId"]),

    /** A mutual match between two profiles. */
    matches: defineTable({
      participants: v.array(v.id("profiles")), // exactly 2, indexed for lookups
      status: v.union(...MATCH_STATUSES.map((s) => v.literal(s))),
      createdAt: v.number(),
      lastMessageAt: v.optional(v.number()),
      lastMessagePreview: v.optional(v.string()),
      lastMessageSender: v.optional(v.id("profiles")),
      unmatchedBy: v.optional(v.id("profiles")),
      blockedBy: v.optional(v.id("profiles")),
    })
      .index("by_participants", ["participants"])
      .index("by_status", ["status"]),

    /** Messages within a match. */
    messages: defineTable({
      matchId: v.id("matches"),
      senderProfileId: v.id("profiles"),
      type: v.union(...MESSAGE_TYPES.map((t) => v.literal(t))),
      content: v.string(),
      createdAt: v.number(),
      deliveredAt: v.optional(v.number()),
      readAt: v.optional(v.number()),
      // Reply-to: the message this one answers (both directions may quote).
      replyTo: v.optional(v.id("messages")),
    })
      .index("by_match", ["matchId", "createdAt"])
      .index("by_match_read", ["matchId", "readAt"]),

    /**
     * Lightweight vibe reactions — a quick, playful signal sent to a profile
     * that is NOT a like (it never creates a match on its own). Kept separate
     * from swipes so a vibe can be sent to profiles the user has already
     * decided on, without affecting discovery or like limits.
     */
    vibes: defineTable({
      fromProfileId: v.id("profiles"),
      toProfileId: v.id("profiles"),
      type: v.string(), // e.g. "energetic" | "music" | "coffee" | "travel"
      createdAt: v.number(),
      readAt: v.optional(v.number()),
    })
      .index("by_from", ["fromProfileId", "createdAt"])
      .index("by_to", ["toProfileId", "createdAt"]),

    /** Emoji reactions on messages (one row per reactor + emoji). */
    messageReactions: defineTable({
      matchId: v.id("matches"),
      messageId: v.id("messages"),
      profileId: v.id("profiles"),
      emoji: v.string(),
      createdAt: v.number(),
    })
      .index("by_message", ["messageId"])
      .index("by_message_profile", ["messageId", "profileId"]),

    /** Safety reports. */
    reports: defineTable({
      reporterProfileId: v.id("profiles"),
      reportedProfileId: v.id("profiles"),
      category: v.union(...REPORT_CATEGORIES.map((c) => v.literal(c))),
      description: v.string(),
      createdAt: v.number(),
      status: v.union(...REPORT_STATUSES.map((s) => v.literal(s))),
    }).index("by_reporter", ["reporterProfileId"]),

    /** Blocks. Blocked users never appear in each other's discovery. */
    blocks: defineTable({
      blockerProfileId: v.id("profiles"),
      blockedProfileId: v.id("profiles"),
      createdAt: v.number(),
    })
      .index("by_blocker", ["blockerProfileId"])
      .index("by_blocked", ["blockedProfileId"])
      .index("by_pair", ["blockerProfileId", "blockedProfileId"]),

    /** In-app activity feed / notifications. */
    activity: defineTable({
      profileId: v.id("profiles"), // recipient
      type: v.union(...ACTIVITY_TYPES.map((t) => v.literal(t))),
      fromProfileId: v.optional(v.id("profiles")),
      matchId: v.optional(v.id("matches")),
      messageId: v.optional(v.id("messages")),
      title: v.string(), // localized by the client; stored text is the source string
      createdAt: v.number(),
      readAt: v.optional(v.number()),
    })
      .index("by_profile", ["profileId", "createdAt"])
      .index("by_profile_unread", ["profileId", "readAt"]),

    /** Support / in-app feedback submissions. */
    feedback: defineTable({
      profileId: v.id("profiles"),
      type: v.union(v.literal("problem"), v.literal("guidance")),
      category: v.optional(v.string()),
      message: v.string(),
      createdAt: v.number(),
    }).index("by_profile", ["profileId"]),

    // =========================================================================
    // Monetization & production features
    // =========================================================================

    /**
     * Subscriptions. The backend is the source of truth for entitlements;
     * rows are created/updated by verified provider webhooks (Stripe) or
     * platform purchase verification, never by the client directly.
     */
    subscriptions: defineTable({
      userId: v.id("users"),
      platform: v.string(), // "stripe" | "ios" | "android" | "manual"
      productId: v.optional(v.string()),
      plan: v.union(...PLANS.map((p) => v.literal(p))),
      status: v.union(...SUBSCRIPTION_STATUSES.map((s) => v.literal(s))),
      startedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      autoRenew: v.boolean(),
      entitlementVersion: v.number(),
      providerSubscriptionId: v.optional(v.string()),
      providerCustomerId: v.optional(v.string()),
      lastEventAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    /** Profile verification sessions (live liveness). */
    verifications: defineTable({
      userId: v.id("users"),
      profileId: v.optional(v.id("profiles")),
      provider: v.string(), // e.g. "passage" | "incode" | "unconfigured"
      providerSessionId: v.optional(v.string()),
      status: v.union(...VERIFICATION_STATUSES.map((s) => v.literal(s))),
      challengeSequence: v.array(v.string()),
      challengeResults: v.optional(v.array(v.string())),
      // Minimal metrics — no frames, no video, ever.
      score: v.optional(v.number()),
      frames: v.optional(v.number()),
      durationMs: v.optional(v.number()),
      failureReason: v.optional(v.string()),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
      retryCount: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_latest", ["userId", "createdAt"]),

    /** Profile promotion: VYBE Boost. */
    boosts: defineTable({
      profileId: v.id("profiles"),
      startedAt: v.number(),
      expiresAt: v.number(),
      status: v.union(v.literal("active"), v.literal("completed")),
      baseViews: v.number(),
      endedAt: v.optional(v.number()),
      result: v.optional(
        v.object({
          views: v.number(),
          likes: v.number(),
          matches: v.number(),
        }),
      ),
    }).index("by_profile", ["profileId", "startedAt"]),

    /** Temporary VYBE Moments (expire after a configurable period). */
    moments: defineTable({
      profileId: v.id("profiles"),
      image: v.string(),
      caption: v.optional(v.string()),
      mood: v.optional(v.string()),
      visibility: v.union(...MOMENT_VISIBILITY.map((m) => v.literal(m))),
      expiresAt: v.number(),
      createdAt: v.number(),
      deleted: v.boolean(),
    })
      .index("by_profile", ["profileId", "createdAt"])
      .index("by_expiry", ["expiresAt"]),

    /** Rotating Question of the Day content (backend-managed). */
    dailyQuestions: defineTable({
      question: v.string(),
      activeDate: v.string(), // "2026-08-12"
      lang: v.string(), // "en" — English source; client renders its own copy
    }).index("by_date", ["activeDate"]),

    /** A user's answer to a daily question. */
    dailyAnswers: defineTable({
      profileId: v.id("profiles"),
      date: v.string(),
      question: v.string(),
      answer: v.string(),
      shareOnProfile: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_profile_date", ["profileId", "date"])
      .index("by_profile", ["profileId"]),

    /** Privacy-conscious product analytics events. */
    analytics: defineTable({
      profileId: v.id("profiles"),
      event: v.string(),
      metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
      createdAt: v.number(),
    })
      .index("by_profile", ["profileId", "createdAt"])
      .index("by_event", ["event", "createdAt"]),

    /** Profile view events (used for Boost results + insights). */
    profileViews: defineTable({
      viewerProfileId: v.id("profiles"),
      viewedProfileId: v.id("profiles"),
      createdAt: v.number(),
    })
      .index("by_viewed", ["viewedProfileId", "createdAt"])
      .index("by_viewer", ["viewerProfileId", "createdAt"]),

    /**
     * Server-side usage counters for daily / monthly entitlements
     * (e.g. "rewind:2026-08-12", "superVybe:2026-08-12", "boost:2026-08").
     * The backend enforces limits here so clients cannot bypass them.
     */
    usageCounters: defineTable({
      profileId: v.id("profiles"),
      key: v.string(),
      count: v.number(),
    })
      .index("by_profile_key", ["profileId", "key"])
      .index("by_key", ["key"]),

    // =========================================================================
    // Events, date plans, music, referrals, streaks, push & photo comments
    // =========================================================================

    /**
     * Nearby events / date ideas. Rows are seeded demo data until an external
     * events provider is configured (see events.ts) — the app never depends
     * on a third-party API.
     */
    events: defineTable({
      title: v.string(),
      category: v.union(...EVENT_CATEGORIES.map((c) => v.literal(c))),
      city: v.string(),
      countryCode: v.string(),
      venue: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      startsAt: v.number(),
      endsAt: v.optional(v.number()),
      imageUrl: v.optional(v.string()),
      description: v.string(),
      source: v.string(), // "demo" | "external"
      externalId: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_city", ["city", "startsAt"])
      .index("by_category", ["category", "startsAt"]),

    /** Saved events ("I'm in" / bookmark). */
    eventSaves: defineTable({
      profileId: v.id("profiles"),
      eventId: v.id("events"),
      createdAt: v.number(),
    })
      .index("by_profile", ["profileId", "createdAt"])
      .index("by_event", ["eventId"]),

    /** Liked events ("this looks fun"). */
    eventLikes: defineTable({
      profileId: v.id("profiles"),
      eventId: v.id("events"),
      createdAt: v.number(),
    })
      .index("by_profile", ["profileId", "createdAt"])
      .index("by_event", ["eventId"]),

    /**
     * Date plans between matched profiles. Statuses: pending → accepted /
     * declined → completed / cancelled. Alternatives chain via alternativeOf.
     */
    datePlans: defineTable({
      matchId: v.id("matches"),
      eventId: v.optional(v.id("events")),
      creatorProfileId: v.id("profiles"),
      title: v.string(),
      venue: v.optional(v.string()),
      city: v.optional(v.string()),
      dateMs: v.number(),
      notes: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      alternativeOf: v.optional(v.id("datePlans")),
      createdAt: v.number(),
      respondedAt: v.optional(v.number()),
      cancelledBy: v.optional(v.id("profiles")),
    })
      .index("by_match", ["matchId", "createdAt"])
      .index("by_creator", ["creatorProfileId", "createdAt"])
      .index("by_status", ["status", "dateMs"]),

    /** Comments on profile photos (visible only to the owner + their matches). */
    photoComments: defineTable({
      profileId: v.id("profiles"), // photo owner
      commenterProfileId: v.id("profiles"),
      photoIndex: v.number(),
      text: v.string(),
      createdAt: v.number(),
      deleted: v.boolean(),
    })
      .index("by_profile_photo", ["profileId", "photoIndex", "createdAt"])
      .index("by_commenter", ["commenterProfileId", "createdAt"]),

    /** Emoji reactions on photo comments. */
    photoCommentReactions: defineTable({
      commentId: v.id("photoComments"),
      profileId: v.id("profiles"),
      emoji: v.string(),
      createdAt: v.number(),
    })
      .index("by_comment", ["commentId"])
      .index("by_comment_profile", ["commentId", "profileId"]),

    /** Referral records. Reward granting is infra-ready but not auto-awarded. */
    referrals: defineTable({
      referrerProfileId: v.id("profiles"),
      referredProfileId: v.id("profiles"),
      code: v.string(),
      status: v.union(v.literal("pending"), v.literal("rewarded")),
      createdAt: v.number(),
      rewardedAt: v.optional(v.number()),
    })
      .index("by_referrer", ["referrerProfileId", "createdAt"])
      .index("by_referred", ["referredProfileId"])
      .index("by_code", ["code"]),

    /** Registered push notification device tokens (per user + platform). */
    deviceTokens: defineTable({
      userId: v.id("users"),
      token: v.string(),
      platform: v.string(), // "android" | "ios" | "web"
      createdAt: v.number(),
      lastSeenAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_token", ["token"]),

    /** Per-user streak state. Max one progression per calendar day. */
    streaks: defineTable({
      profileId: v.id("profiles"),
      current: v.number(),
      longest: v.number(),
      lastDate: v.string(), // "2026-08-12"
      lastType: v.string(),
      updatedAt: v.number(),
    })
      .index("by_profile", ["profileId"])
      .index("by_streak", ["current"]),

    /** Daily activity log (which daily tasks were completed on which day). */
    dailyActivity: defineTable({
      profileId: v.id("profiles"),
      date: v.string(),
      activities: v.array(v.string()),
      createdAt: v.number(),
    })
      .index("by_profile_date", ["profileId", "date"])
      .index("by_profile", ["profileId"]),

    // =========================================================================
    // Mood matching, blind matches, icebreakers, rooms, daily vibe reactions
    // =========================================================================

    /**
     * A user's current mood (optional, time-limited). Expired moods are
     * ignored by discovery, so the row can safely outlive its window.
     */
    moods: defineTable({
      profileId: v.id("profiles"),
      mood: v.union(
        v.literal("chill"),
        v.literal("social"),
        v.literal("romantic"),
        v.literal("adventurous"),
        v.literal("chatty"),
        v.literal("quiet"),
        v.literal("creative"),
        v.literal("active"),
      ),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_profile", ["profileId"])
      .index("by_mood", ["mood", "expiresAt"]),

    /**
     * Blind match: photos are hidden until both sides mutually accept a
     * reveal. The backend owns the reveal state — the client can never flip
     * it on its own.
     */
    blindMatches: defineTable({
      profileA: v.id("profiles"),
      profileB: v.id("profiles"),
      status: v.union(
        v.literal("pending"),
        v.literal("mutual"),
        v.literal("declined"),
        v.literal("revealed"),
      ),
      revealA: v.boolean(), // A revealed B (accepted the reveal)
      revealB: v.boolean(), // B revealed A
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_profileA", ["profileA", "createdAt"])
      .index("by_profileB", ["profileB", "createdAt"]),

    /** Icebreaker game sessions between matched profiles. */
    icebreakerGames: defineTable({
      matchId: v.id("matches"),
      gameType: v.union(
        v.literal("this_or_that"),
        v.literal("twenty_questions"),
        v.literal("quick_picks"),
        v.literal("emoji_challenge"),
        v.literal("fun_questions"),
      ),
      questions: v.array(v.string()),
      answers: v.array(
        v.object({
          profileId: v.id("profiles"),
          answers: v.array(v.string()),
        }),
      ),
      status: v.union(v.literal("active"), v.literal("completed")),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    })
      .index("by_match", ["matchId", "createdAt"])
      .index("by_status", ["status", "createdAt"]),

    /** Vybe Rooms: interest-based social rooms. */
    rooms: defineTable({
      name: v.string(),
      category: v.union(
        v.literal("music"),
        v.literal("gaming"),
        v.literal("travel"),
        v.literal("movies"),
        v.literal("coffee"),
        v.literal("fitness"),
        v.literal("books"),
        v.literal("local"),
      ),
      description: v.string(),
      createdBy: v.id("profiles"),
      createdAt: v.number(),
    })
      .index("by_category", ["category", "createdAt"])
      .index("by_created", ["createdBy", "createdAt"]),

    roomMembers: defineTable({
      roomId: v.id("rooms"),
      profileId: v.id("profiles"),
      joinedAt: v.number(),
    })
      .index("by_room", ["roomId", "joinedAt"])
      .index("by_profile", ["profileId"])
      .index("by_room_profile", ["roomId", "profileId"]),

    roomMessages: defineTable({
      roomId: v.id("rooms"),
      profileId: v.id("profiles"),
      content: v.string(),
      createdAt: v.number(),
      deleted: v.boolean(),
    })
      .index("by_room", ["roomId", "createdAt"])
      .index("by_profile", ["profileId", "createdAt"]),

    /** Reactions on Daily Vibe answers (emoji, one per reactor + emoji). */
    dailyVibeReactions: defineTable({
      answerId: v.id("dailyAnswers"),
      profileId: v.id("profiles"),
      emoji: v.string(),
      createdAt: v.number(),
    })
      .index("by_answer", ["answerId"])
      .index("by_answer_profile", ["answerId", "profileId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
