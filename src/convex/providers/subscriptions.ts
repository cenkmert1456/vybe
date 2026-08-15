/**
 * Subscription provider abstraction.
 *
 * The mobile/web app never touches payment credentials. Purchases go through
 * the platform store (iOS App Store / Google Play / Stripe Checkout), and the
 * backend verifies the purchase server-side before granting entitlements.
 *
 * `stripeConfigured` is false until `STRIPE_SECRET_KEY` is set in the project
 * keys, in which case checkout returns an explicit "unavailable" state instead
 * of faking a purchase.
 *
 * The Stripe implementation talks to the Stripe REST API directly (fetch) so
 * the project has no server-side SDK dependency; credentials stay in env vars.
 */

export interface PurchaseProvider {
  readonly id: string;
  readonly configured: boolean;
  /** Create a hosted checkout session; returns the URL to open. */
  createCheckout(params: {
    customerEmail?: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ url: string } | { unavailable: true }>;
  /** Build the customer portal / manage-subscription URL. */
  createManageUrl(params: {
    customerId?: string | null;
  }): Promise<{ url: string } | { unavailable: true }>;
}

const STRIPE_API = "https://api.stripe.com/v1";

const secret = () => process.env.STRIPE_SECRET_KEY || "";

function stripePriceIds() {
  return {
    silverMonthly: process.env.STRIPE_PRICE_SILVER_MONTHLY || "",
    silverAnnual: process.env.STRIPE_PRICE_SILVER_ANNUAL || "",
    goldMonthly: process.env.STRIPE_PRICE_GOLD_MONTHLY || "",
    goldAnnual: process.env.STRIPE_PRICE_GOLD_ANNUAL || "",
    platinumMonthly: process.env.STRIPE_PRICE_PLATINUM_MONTHLY || "",
    platinumAnnual: process.env.STRIPE_PRICE_PLATINUM_ANNUAL || "",
  };
}

export function stripeConfigured(): boolean {
  return Boolean(secret());
}

/** Resolve the Stripe price id for a plan + billing period. */
export function stripePriceFor(plan: string, period: "monthly" | "annual"): string {
  const map = stripePriceIds();
  return map[`${plan}${period === "annual" ? "Annual" : "Monthly"}` as keyof typeof map] || "";
}

async function stripePost(
  path: string,
  body: Record<string, string>,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false }> {
  const form = new URLSearchParams();
  for (const [k, val] of Object.entries(body)) {
    if (val === undefined || val === null || val === "") continue;
    form.append(k, val);
  }
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) return { ok: false };
  return { ok: true, json: (await res.json()) as Record<string, unknown> };
}

class StripeProvider implements PurchaseProvider {
  readonly id = "stripe";
  get configured() {
    return stripeConfigured();
  }

  async createCheckout(params: {
    customerEmail?: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }) {
    if (!this.configured) return { unavailable: true as const };
    const body: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: "true",
    };
    if (params.customerEmail) body.customer_email = params.customerEmail;
    for (const [k, val] of Object.entries(params.metadata)) {
      body[`metadata[${k}]`] = val;
    }
    const res = await stripePost("/checkout/sessions", body);
    if (!res.ok || typeof res.json.url !== "string") {
      return { unavailable: true as const };
    }
    return { url: res.json.url };
  }

  async createManageUrl(params: { customerId?: string | null }) {
    if (!this.configured || !params.customerId) {
      return { unavailable: true as const };
    }
    const res = await stripePost("/billing_portal/sessions", {
      customer: params.customerId,
    });
    if (!res.ok || typeof res.json.url !== "string") {
      return { unavailable: true as const };
    }
    return { url: res.json.url };
  }
}

export const purchaseProvider: PurchaseProvider = new StripeProvider();
