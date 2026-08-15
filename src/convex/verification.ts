import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUserId, getMyProfile, nowMs } from "./helpers";

/**
 * Free, automatic, on-device profile liveness verification.
 *
 * The camera + face analysis runs entirely on the device using MediaPipe.
 * No external verification provider or API key is required.
 *
 * The backend owns the authoritative verification state transition.
 * No video or camera frames are uploaded or stored.
 */

const CHALLENGES = [
  "blink",
  "turn_left",
  "turn_right",
  "look_up",
  "look_down",
  "smile",
] as const;

type Challenge = (typeof CHALLENGES)[number];

/** Minimum confidence score required for verification. */
export const MIN_LIVENESS_SCORE = 65;

/** Minimum analyzed frames required. */
export const MIN_FRAMES = 60;

/** Maximum retries per user. */
export const MAX_RETRIES = 8;

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = out[i];
    out[i] = out[j];
    out[j] = current;
  }

  return out;
}

function isChallenge(value: string): value is Challenge {
  return (CHALLENGES as readonly string[]).includes(value);
}

/**
 * Normalizes client results.
 *
 * The client may occasionally report duplicate detections while the same
 * challenge remains visible for multiple camera frames. Only challenges that
 * belong to the active server session are accepted, and duplicates are removed.
 *
 * Results are returned in the exact order expected by the active session.
 */
function normalizeResults(
  results: string[],
  sequence: readonly string[],
): string[] {
  const received = new Set<string>();

  for (const result of results) {
    if (isChallenge(result) && sequence.includes(result)) {
      received.add(result);
    }
  }

  return sequence.filter((challenge) => received.has(challenge));
}

/**
 * Returns true only when every challenge generated for the active session
 * has been completed.
 */
function hasCompletedSequence(
  normalizedResults: readonly string[],
  sequence: readonly string[],
): boolean {
  if (sequence.length === 0) {
    return false;
  }

  const completed = new Set<string>(normalizedResults);

  return sequence.every((challenge) => completed.has(challenge));
}

/**
 * Current verification state for the signed-in user.
 */
export const myVerification = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);

    if (!me) {
      return null;
    }

    if (me.verified) {
      return {
        status: "verified" as const,
        verified: true,
        score: me.verificationMeta?.score ?? null,
        verifiedAt: me.verificationMeta?.verifiedAt ?? null,
      };
    }

    const row = await ctx.db
      .query("verifications")
      .withIndex("by_user_latest", (q) =>
        q.eq("userId", me.userId as any),
      )
      .order("desc")
      .first();

    if (!row || row.status === "failed") {
      return {
        status: row?.status === "failed"
          ? ("failed" as const)
          : ("unverified" as const),
        verified: false,
      };
    }

    return {
      status: "in_progress" as const,
      verified: false,
      retryCount: row.retryCount,
    };
  },
});

/**
 * Begin a fresh verification session with a randomized challenge order.
 */
export const startVerification = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const me = await getMyProfile(ctx);

    if (!me) {
      throw new Error("Complete onboarding first");
    }

    if (me.verified) {
      throw new Error("Already verified");
    }

    const sequence = shuffle(CHALLENGES).slice(0, 3);
    const now = nowMs();

    const id = await ctx.db.insert("verifications", {
      userId,
      profileId: me._id,
      provider: "on_device",
      status: "in_progress",
      challengeSequence: sequence,
      challengeResults: [],
      createdAt: now,
      retryCount: 0,
    });

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "verification_started",
      createdAt: now,
    });

    return {
      sessionId: id.toString(),
      challengeSequence: sequence,
    };
  },
});

/**
 * Submit the completed on-device liveness verification.
 *
 * Client-side duplicate results are normalized instead of causing an
 * "Incomplete verification" server exception.
 *
 * Verification still requires:
 * - every server-generated challenge to be completed,
 * - a sufficient liveness score,
 * - enough analyzed camera frames.
 */
export const submitLiveness = mutation({
  args: {
    sessionId: v.id("verifications"),
    results: v.array(v.string()),
    capturedAt: v.array(v.number()),
    score: v.number(),
    frames: v.number(),
    durationMs: v.number(),
  },

  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);

    if (!me) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);

    if (!session || session.userId !== me.userId) {
      throw new Error("Session not found");
    }

    if (session.status !== "in_progress") {
      throw new Error("Session is not active");
    }

    if (me.verified) {
      throw new Error("Already verified");
    }

    const sequence = session.challengeSequence;

    /**
     * Normalize duplicate and out-of-order client detections.
     *
     * This replaces the old strict length comparison that was causing:
     * "Incomplete verification at handler"
     */
    const normalizedResults = normalizeResults(args.results, sequence);

    const completedAllChallenges = hasCompletedSequence(
      normalizedResults,
      sequence,
    );

    const safeScore = Math.max(
      0,
      Math.min(100, Math.round(args.score)),
    );

    const safeFrames = Math.max(
      0,
      Math.round(args.frames),
    );

    const safeDurationMs = Math.max(
      0,
      Math.round(args.durationMs),
    );

    const passed =
      completedAllChallenges &&
      safeScore >= MIN_LIVENESS_SCORE &&
      safeFrames >= MIN_FRAMES;

    const now = nowMs();

    let failureReason: string | undefined;

    if (!completedAllChallenges) {
      failureReason = "incomplete";
    } else if (safeScore < MIN_LIVENESS_SCORE) {
      failureReason = "low_confidence";
    } else if (safeFrames < MIN_FRAMES) {
      failureReason = "insufficient_frames";
    }

    /**
     * Store only the normalized expected challenge results.
     * Camera frames and video are never uploaded.
     */
    await ctx.db.patch(session._id, {
      status: passed ? "verified" : "failed",
      challengeResults: normalizedResults,
      score: safeScore,
      frames: safeFrames,
      durationMs: safeDurationMs,
      completedAt: now,
      failureReason: passed ? undefined : failureReason,
    });

    if (passed) {
      await ctx.db.patch(me._id, {
        verified: true,
        verificationStatus: "verified",
        verificationMeta: {
          verifiedAt: now,
          method: "on_device_liveness",
          score: safeScore,
        },
      });

      await ctx.db.insert("analytics", {
        profileId: me._id,
        event: "verification_completed",
        createdAt: now,
      });
    } else {
      await ctx.db.patch(me._id, {
        verificationStatus: "failed",
      });

      await ctx.db.insert("analytics", {
        profileId: me._id,
        event: "verification_failed",
        createdAt: now,
      });
    }

    return {
      status: passed ? ("verified" as const) : ("failed" as const),
      score: safeScore,
      completedChallenges: normalizedResults.length,
      totalChallenges: sequence.length,
      failureReason: passed ? null : failureReason,
    };
  },
});

/**
 * Retry verification after a failure.
 *
 * A completely new session and randomized challenge sequence are created.
 */
export const retryVerification = mutation({
  args: {},

  handler: async (ctx) => {
    const userId = await currentUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const me = await getMyProfile(ctx);

    if (!me) {
      throw new Error("Complete onboarding first");
    }

    if (me.verified) {
      throw new Error("Already verified");
    }

    const latest = await ctx.db
      .query("verifications")
      .withIndex("by_user_latest", (q) =>
        q.eq("userId", userId),
      )
      .order("desc")
      .first();

    const retryCount = (latest?.retryCount ?? 0) + 1;

    if (retryCount > MAX_RETRIES) {
      throw new Error(
        "You've tried verification many times. Please contact support so we can help you directly.",
      );
    }

    const sequence = shuffle(CHALLENGES).slice(0, 3);
    const now = nowMs();

    const id = await ctx.db.insert("verifications", {
      userId,
      profileId: me._id,
      provider: "on_device",
      status: "in_progress",
      challengeSequence: sequence,
      challengeResults: [],
      createdAt: now,
      retryCount,
    });

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "verification_started",
      createdAt: now,
    });

    return {
      sessionId: id.toString(),
      challengeSequence: sequence,
      retryCount,
    };
  },
});
