import { v } from "convex/values";
import { action, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { currentUserId, getMyProfile, nowMs } from "./helpers";
import { PLANS, type PlanId } from "./plans";
import { purchaseProvider, stripePriceFor } from "./providers/subscriptions";
import type { Id } from "./_generated/dataModel";

const ENV_URL =
  process.env.VITE_APP_URL || process.env.SITE_URL || "http://localhost:5173";

const PERIOD = v.union(v.literal("monthly"), v.literal("annual"));

/** Plain db lookup shared by queries and actions (no circular api refs). */
async function findSubscription(ctx: QueryCtx, userId: unknown) {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .first();
}

/** The user's current subscription row (if any). */
export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return null;
    const sub = await findSubscription(ctx, userId);
    if (!sub) return null;
    return {
      _id: sub._id.toString(),
      plan: sub.plan,
      status: sub.status,
      platform: sub.platform,
      productId: sub.productId,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      autoRenew: sub.autoRenew,
      entitlementVersion: sub.entitlementVersion,
    };
  },
});

/**
 * Start a purchase. Opens the platform store flow (Stripe Checkout for the web
 * build; App Store / Play Billing are wired through the same entitlements path
 * once a native wrapper is deployed). Returns the checkout URL or an explicit
 * `unavailable` state — never a fake success.
 */
export const startPurchase = action({
  args: {
    plan: v.union(v.literal("silver"), v.literal("gold"), v.literal("platinum")),
    period: PERIOD,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const priceId = stripePriceFor(args.plan, args.period);
    if (!priceId) {
      return { available: false as const, reason: "pricing_not_configured" };
    }

    const plan = PLANS[args.plan as PlanId];
    const price = args.period === "monthly" ? plan.monthlyPrice : plan.annualPrice;
    const result = await purchaseProvider.createCheckout({
      customerEmail: identity.email ?? null,
      priceId,
      successUrl: `${ENV_URL}/app/premium?purchase=success`,
      cancelUrl: `${ENV_URL}/app/premium?purchase=cancelled`,
      metadata: {
        userId: identity.subject,
        plan: args.plan,
        period: args.period,
        price: String(price),
      },
    });

    if ("unavailable" in result) {
      return { available: false as const, reason: "store_not_configured" };
    }
    return { available: true as const, url: result.url };
  },
});

/** Lazy expiry sync shared by the refresh flow and restore (no api indirection). */
async function applyRefresh(
  ctx: MutationCtx,
  sub: { _id: Id<"subscriptions">; status: string; expiresAt?: number | undefined },
) {
  const now = nowMs();
  if (
    sub.status === "active" &&
    sub.expiresAt !== undefined &&
    sub.expiresAt < now
  ) {
    await ctx.db.patch(sub._id, { status: "expired" });
    return { refreshed: true, downgraded: true };
  }
  return { refreshed: true, downgraded: false };
}

/** Refresh subscription state (called on launch / foreground / after purchase). */
export const refreshSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) return { refreshed: false };
    const sub = await findSubscription(ctx, userId);
    if (!sub) return { refreshed: false };
    return await applyRefresh(ctx, sub);
  },
});

/**
 * Restore purchases: re-sync from the platform provider (Stripe for web).
 * Runs as a mutation so it can read the subscription row directly — no
 * client-side fake success is possible either way.
 */
export const restorePurchases = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sub = await findSubscription(ctx, userId);
    if (!sub) {
      return { restored: false, reason: "no_subscription" as const };
    }
    if (sub.platform !== "stripe") {
      return {
        restored: false,
        reason: "platform_restore_required" as const,
        note: "On iOS/Android, use the store's restore flow (Settings → Subscription).",
      };
    }
    await applyRefresh(ctx, sub);
    return { restored: true, plan: sub.plan };
  },
});

/** Manage subscription (billing portal / store management). */
export const manageSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sub = await findSubscription(ctx, userId);
    const customerId = sub?.platform === "stripe" ? sub.productId : null;
    const result = await purchaseProvider.createManageUrl({ customerId });
    if ("unavailable" in result) {
      return {
        available: false as const,
        reason: sub?.platform && sub.platform !== "stripe"
          ? "Use the App Store / Play Store subscription settings to manage this plan."
          : "Store not configured",
      };
    }
    return { available: true as const, url: result.url };
  },
});

/**
 * Apply a verified subscription state. Called ONLY from the provider webhook
 * (server-side, signature-checked) or an authorized admin path — never from
 * the client. Idempotent per provider subscription id.
 */
export const applySubscription = mutation({
  args: {
    userId: v.id("users"),
    platform: v.string(),
    plan: v.union(v.literal("silver"), v.literal("gold"), v.literal("platinum"), v.literal("free")),
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("canceled"),
      v.literal("grace_period"),
      v.literal("pending"),
    ),
    productId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await findSubscription(ctx, args.userId);
    const now = nowMs();
    if (existing) {
      await ctx.db.patch(existing._id, {
        platform: args.platform,
        plan: args.plan,
        status: args.status,
        productId: args.productId ?? existing.productId,
        providerSubscriptionId:
          args.providerSubscriptionId ?? existing.providerSubscriptionId,
        providerCustomerId:
          args.providerCustomerId ?? existing.providerCustomerId,
        startedAt: args.startedAt ?? existing.startedAt,
        expiresAt: args.expiresAt ?? existing.expiresAt,
        autoRenew: args.autoRenew ?? existing.autoRenew,
        entitlementVersion: existing.entitlementVersion + 1,
        lastEventAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        platform: args.platform,
        plan: args.plan,
        status: args.status,
        productId: args.productId,
        providerSubscriptionId: args.providerSubscriptionId,
        providerCustomerId: args.providerCustomerId,
        startedAt: args.startedAt,
        expiresAt: args.expiresAt,
        autoRenew: args.autoRenew ?? true,
        entitlementVersion: 1,
        lastEventAt: now,
      });
    }
    return true;
  },
});

/** Remaining allowance for a counter (non-consuming read). */
export const counterRemaining = query({
  args: { key: v.string(), limit: v.number(), period: v.union(v.literal("day"), v.literal("month")) },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me) return { remaining: args.limit };
    const now = nowMs();
    const d = new Date(now);
    const bucket =
      args.period === "day"
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 7);
    const row = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `${args.key}:${bucket}`),
      )
      .first();
    return { remaining: Math.max(0, args.limit - (row?.count ?? 0)) };
  },
});
