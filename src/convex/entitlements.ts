import { QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { PLANS, type Entitlements, type PlanId } from "./plans";

/**
 * Shared backend helper: derive a user's live plan + entitlements directly
 * from their subscription row. Used by swipes/boosts/profiles/etc. instead of
 * `ctx.runQuery(api.subscriptions.entitlementForUser)` to avoid circular
 * module references. The backend remains the source of truth.
 */
export async function entitlementsForUser(
  ctx: QueryCtx,
  userId: Id<"users"> | null | undefined,
): Promise<{ plan: PlanId; status: string | null; entitlements: Entitlements }> {
  if (!userId) {
    return { plan: "free", status: null, entitlements: PLANS.free.entitlements };
  }
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const now = Date.now();
  let plan: PlanId = "free";
  let status: string | null = null;
  if (sub) {
    plan = (sub.plan as PlanId) ?? "free";
    status = sub.status;
    if (
      (sub.status === "active" || sub.status === "grace_period") &&
      sub.expiresAt !== undefined &&
      sub.expiresAt < now
    ) {
      plan = "free";
      status = "expired";
    }
    if (sub.status === "expired" || sub.status === "canceled") {
      plan = "free";
    }
  }
  return { plan, status, entitlements: PLANS[plan].entitlements as Entitlements };
}

export type { Entitlements, PlanId };
