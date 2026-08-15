import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Verify a Stripe webhook signature (t=...,v1=...) using HMAC-SHA256 via the
 * Web Crypto API (available in the Convex V8 runtime) with a constant-time
 * comparison. Equivalent to the SDK's constructEvent without the dependency.
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    parts.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const timestamp = parts.get("t");
  const v1 = parts.get("v1");
  if (!timestamp || !v1) return false;

  // Reject signatures older than ~5 minutes (replay protection).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  const expected = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Stripe subscription webhook. Signature-verified, then calls the internal
 * applySubscription mutation to update entitlements. The client can never
 * grant itself premium access.
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      return new Response("Webhook not configured", { status: 503 });
    }
    const raw = await request.text();

    if (!(await verifyStripeSignature(raw, signature, secret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    let payload: { type: string; data?: { object?: Record<string, unknown> } };
    try {
      payload = JSON.parse(raw) as {
        type: string;
        data?: { object?: Record<string, unknown> };
      };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const obj = payload.data?.object as
      | (Record<string, unknown> & {
          id?: string;
          customer?: string;
          status?: string;
          current_period_end?: number;
          metadata?: Record<string, unknown>;
          items?: { data?: { price?: { id?: string } }[] };
        })
      | undefined;
    if (!obj) return new Response("No object", { status: 200 });

    // Map Stripe status → VYBE status.
    const statusMap: Record<string, "active" | "expired" | "canceled" | "grace_period" | "pending"> = {
      active: "active",
      trialing: "grace_period",
      past_due: "grace_period",
      incomplete: "pending",
      incomplete_expired: "expired",
      canceled: "canceled",
      unpaid: "canceled",
    };

    // Only verified events touch entitlements.
    const allowedTypes = new Set([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "checkout.session.completed",
      "invoice.paid",
      "invoice.payment_failed",
    ]);
    if (!allowedTypes.has(payload.type)) {
      return new Response("Ignored", { status: 200 });
    }

    const userId = obj.metadata?.userId as string | undefined;
    const priceId = obj.items?.data?.[0]?.price?.id;
    let plan: "silver" | "gold" | "platinum" | "free" = "free";
    if (obj.metadata?.plan === "silver" || obj.metadata?.plan === "gold" || obj.metadata?.plan === "platinum") {
      plan = obj.metadata.plan;
    } else if (priceId) {
      const silver = [process.env.STRIPE_PRICE_SILVER_MONTHLY, process.env.STRIPE_PRICE_SILVER_ANNUAL];
      const gold = [process.env.STRIPE_PRICE_GOLD_MONTHLY, process.env.STRIPE_PRICE_GOLD_ANNUAL];
      const platinum = [process.env.STRIPE_PRICE_PLATINUM_MONTHLY, process.env.STRIPE_PRICE_PLATINUM_ANNUAL];
      if (silver.includes(priceId)) plan = "silver";
      else if (gold.includes(priceId)) plan = "gold";
      else if (platinum.includes(priceId)) plan = "platinum";
    }

    if (!userId) return new Response("No user metadata", { status: 200 });

    const stripeStatus = (obj.status ?? "active") as string;
    const status = statusMap[stripeStatus] ?? "pending";

    await ctx.runMutation(api.subscriptions.applySubscription, {
      userId: userId as any,
      platform: "stripe",
      plan,
      status,
      productId: typeof obj.id === "string" ? obj.id : undefined,
      providerSubscriptionId: typeof obj.id === "string" ? obj.id : undefined,
      providerCustomerId:
        typeof obj.customer === "string" ? obj.customer : undefined,
      expiresAt:
        typeof obj.current_period_end === "number"
          ? obj.current_period_end * 1000
          : undefined,
      autoRenew: status === "active",
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
