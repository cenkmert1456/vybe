import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUserId, getMyProfile, nowMs } from "./helpers";

/**
 * Push notification infrastructure.
 *
 * - Device tokens are stored per user + platform in `deviceTokens`.
 * - Actual FCM delivery is ONLY attempted when the FCM credentials exist in
 *   the server environment (GOOGLE_APPLICATION_CREDENTIALS / FCM_SERVER_KEY).
 *   Without them every send is a no-op that reports `sent: false,
 *   reason: "not_configured"` — we never fake a delivered notification.
 * - The app keeps working fully with push disabled.
 */

export const registerDeviceToken = mutation({
  args: { token: v.string(), platform: v.optional(v.string()) },
  handler: async (ctx, { token, platform }) => {
    const userId = await currentUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 20) throw new Error("Invalid token");

    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    const now = nowMs();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        platform: platform ?? existing.platform,
        lastSeenAt: now,
      });
      return { registered: true };
    }
    await ctx.db.insert("deviceTokens", {
      userId,
      token: trimmed,
      platform: platform ?? "android",
      createdAt: now,
      lastSeenAt: now,
    });
    return { registered: true };
  },
});

export const unregisterDeviceToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", token.trim()))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { registered: false };
  },
});

/** Is push delivery actually configured for this deployment? (env-gated) */
export const pushStatus = query({
  args: {},
  handler: async () => {
    const serverConfigured = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.FCM_SERVER_KEY ||
        process.env.FIREBASE_PROJECT_ID,
    );
    return { configured: serverConfigured };
  },
});

/** Enable/disable push delivery preference (master switch). */
export const setPushEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    await ctx.db.patch(me._id, {
      notificationPrefs: {
        ...me.notificationPrefs,
        push: enabled,
      },
    });
    return true;
  },
});

/** My device tokens (for the settings screen). */
export const myDevices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("deviceTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => ({
      token: r.token.slice(0, 12) + "…",
      platform: r.platform,
      lastSeenAt: r.lastSeenAt,
    }));
  },
});

/**
 * Honest send helper — used by future server events. Never fakes delivery:
 * without FCM server credentials it returns { sent: false } and the in-app
 * activity feed is the only notification channel.
 */
export async function sendPush(
  _ctx: { db: any },
  params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) return { sent: false, reason: "not_configured" };
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.token,
        notification: { title: params.title, body: params.body },
        data: params.data ?? {},
        priority: "high",
      }),
    });
    if (!res.ok) return { sent: false, reason: `fcm_${res.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: "network_error" };
  }
}
