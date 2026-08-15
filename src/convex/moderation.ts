import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { nowMs } from "./helpers";

/**
 * Shared moderation + abuse protection helpers.
 *
 * All limits are enforced server-side so clients cannot bypass them. Failures
 * surface as normal errors ("Slow down…"), never crashes.
 */

const SLIDING_MS = 10_000;
const MAX_SWIPES_PER_WINDOW = 25;
const MAX_MESSAGES_PER_WINDOW = 20;

/** Increment a rolling counter for a profile + action bucket. */
async function bumpRolling(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  bucket: string,
): Promise<number> {
  const key = `rate:${bucket}:${Math.floor(nowMs() / SLIDING_MS)}`;
  const counter = await ctx.db
    .query("usageCounters")
    .withIndex("by_profile_key", (q) => q.eq("profileId", profileId).eq("key", key))
    .first();
  if (counter) {
    await ctx.db.patch(counter._id, { count: counter.count + 1 });
    return counter.count + 1;
  }
  await ctx.db.insert("usageCounters", { profileId, key, count: 1 });
  return 1;
}

/** Rapid-swipe protection: cap deck actions (like/pass/super/vibe) per window. */
export async function enforceSwipeRate(ctx: MutationCtx, profileId: Id<"profiles">) {
  const count = await bumpRolling(ctx, profileId, "swipe");
  if (count > MAX_SWIPES_PER_WINDOW) {
    throw new Error("You're swiping too fast — take a breath and slow down a moment.");
  }
}

/**
 * Message spam protection (called per message, inside the target match):
 *  - hard cap of messages per 10s window
 *  - duplicate detection: same text twice within 60s is rejected
 *  - link-heavy messages that are mostly URLs are rejected as spam
 */
export async function enforceMessageSpam(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  matchId: Id<"matches">,
  content: string,
) {
  const count = await bumpRolling(ctx, profileId, "msg");
  if (count > MAX_MESSAGES_PER_WINDOW) {
    throw new Error("You're sending messages very quickly — please slow down.");
  }

  const trimmed = content.trim().toLowerCase();
  if (!trimmed) return;

  // Duplicate detection: same text from the same sender in the same match
  // within the last 60 seconds.
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .order("desc")
    .first();
  if (
    recent &&
    recent.senderProfileId === profileId &&
    nowMs() - recent.createdAt < 60_000 &&
    recent.content.trim().toLowerCase() === trimmed
  ) {
    throw new Error("You just sent that — try something new.");
  }

  // Basic malicious-content filter: block messages that are pure link spam.
  const urlCount = (content.match(/https?:\/\/\S+/g) ?? []).length;
  if (urlCount >= 3 && content.replace(/https?:\/\/\S+/g, "").trim().length < 20) {
    throw new Error("Message looks like spam and wasn't sent.");
  }
}

/**
 * Basic content filter for profile bios / comments / messages.
 * Returns the cleaned text with known abusive tokens redacted. This is a
 * light first line of defence — reports remain the primary moderation path.
 */
export function filterContent(text: string): string {
  let out = text;
  const patterns = [
    /\b(fuck|fucking|shit|bitch|whore|nigga|nigger|faggot|cunt)\b/gi,
    /(?:amk|aq|oç|orospu|sikik|anan|avrad)/gi,
  ];
  for (const re of patterns) out = out.replace(re, "•");
  return out;
}

/** Photo-comment rate limits. */
export const PHOTO_COMMENT_DAILY_LIMIT = 20;
export const PHOTO_COMMENT_MIN_INTERVAL_MS = 5000;
