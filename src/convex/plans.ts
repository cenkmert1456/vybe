import { v } from "convex/values";
import { query } from "./_generated/server";
import { getMyProfile } from "./helpers";

/**
 * Central entitlement configuration. All paid-feature limits live here (and in
 * the `subscriptions` table state), so product changes never require a client
 * release. The backend is the source of truth — the client only renders what
 * these queries return.
 */
export const PLANS = {
  free: {
    id: "free",
    name: "VYBE",
    tagline: "Start discovering",
    monthlyPrice: 0,
    annualPrice: 0,
    entitlements: {
      dailyLikeLimit: 20,
      monthlySuperVybes: 2,
      rewindLimit: 0,
      dailyRewinds: 0,
      boostCreditsPerMonth: 0,
      advancedFilters: false,
      likesVisibility: false, // see who liked you
      profileBoosts: false,
      travelMode: false,
      readReceipts: false,
      priorityDiscovery: false,
      profileThemes: false,
      extendedInsights: false,
      incognito: false,
      unlimitedSuperVybess: false,
      // Premium location & distance controls: 1–100 km distance, manual
      // country/city selection. Free users keep their current location.
      locationControls: false,
    },
  },
  silver: {
    id: "silver",
    name: "VYBE Silver",
    tagline: "More of what you love",
    monthlyPrice: 9.99,
    annualPrice: 69.99,
    bestValue: false,
    entitlements: {
      dailyLikeLimit: 60,
      monthlySuperVybes: 8,
      rewindLimit: 3,
      dailyRewinds: 3,
      boostCreditsPerMonth: 1,
      advancedFilters: true,
      likesVisibility: true, // see recently received likes
      profileBoosts: true,
      travelMode: false,
      readReceipts: false,
      priorityDiscovery: false,
      profileThemes: false,
      extendedInsights: true, // see extended profile insights
      incognito: false,
      unlimitedSuperVybess: false,
      locationControls: true,
    },
  },
  gold: {
    id: "gold",
    name: "VYBE Gold",
    tagline: "The best value upgrade",
    monthlyPrice: 19.99,
    annualPrice: 139.99,
    bestValue: true,
    entitlements: {
      dailyLikeLimit: 120,
      monthlySuperVybes: 20,
      rewindLimit: 10,
      dailyRewinds: 10,
      boostCreditsPerMonth: 3,
      advancedFilters: true,
      likesVisibility: true,
      profileBoosts: true,
      travelMode: false,
      readReceipts: true, // enabled by product design
      priorityDiscovery: true,
      profileThemes: true,
      extendedInsights: true,
      incognito: false,
      unlimitedSuperVybess: false,
      locationControls: true,
    },
  },
  platinum: {
    id: "platinum",
    name: "VYBE Platinum",
    tagline: "The full VYBE experience",
    monthlyPrice: 34.99,
    annualPrice: 239.99,
    bestValue: false,
    entitlements: {
      dailyLikeLimit: 300,
      monthlySuperVybes: 60,
      rewindLimit: 25,
      dailyRewinds: 25,
      boostCreditsPerMonth: 6,
      advancedFilters: true,
      likesVisibility: true,
      profileBoosts: true,
      travelMode: true,
      readReceipts: true,
      priorityDiscovery: true,
      profileThemes: true,
      extendedInsights: true,
      incognito: true,
      unlimitedSuperVybess: false, // large but not unlimited — configurable
      locationControls: true,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Entitlements = (typeof PLANS)["free"]["entitlements"];

const ENTITLEMENT_KEYS = Object.keys(
  PLANS.free.entitlements,
) as (keyof Entitlements)[];

/** Merge plan defaults with the user's live subscription state. */
function computeEntitlements(
  planId: PlanId,
  status: string | null,
  now: number,
): Entitlements {
  const base = ((PLANS[planId] ?? PLANS.free).entitlements ??
    PLANS.free.entitlements) as Entitlements;
  const out: Record<string, unknown> = { ...PLANS.free.entitlements };
  for (const key of ENTITLEMENT_KEYS) {
    out[key] = base[key];
  }
  const typedOut = out as Entitlements;
  // Free tier is never reduced by a stale row; expired subscriptions downgrade.
  const expired =
    planId !== "free" &&
    (status === "expired" || status === "canceled");
  if (expired) {
    for (const key of ENTITLEMENT_KEYS) {
      out[key] = PLANS.free.entitlements[key];
    }
  }
  void now;
  return typedOut;
}

/**
 * The signed-in user's live plan + entitlements. The backend derives this from
 * the stored subscription row (written only by verified provider events) and
 * downgrades automatically once the subscription lapses.
 */
export const myEntitlements = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;

    const now = Date.now();
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", me.userId as any))
      .first();

    let plan: PlanId = "free";
    let status: string | null = null;
    let expiresAt: number | null = null;
    let autoRenew = false;

    if (sub) {
      plan = (sub.plan as PlanId) ?? "free";
      status = sub.status;
      expiresAt = sub.expiresAt ?? null;
      autoRenew = sub.autoRenew;
      // Lazy expiration: an "active" row whose window passed is treated as
      // expired without waiting for a background job.
      if (
        sub.status === "active" &&
        sub.expiresAt !== undefined &&
        sub.expiresAt < now
      ) {
        status = "expired";
        plan = "free";
      }
      if (sub.status === "grace_period" && sub.expiresAt !== undefined && sub.expiresAt < now) {
        status = "expired";
        plan = "free";
      }
    }

    return {
      plan,
      planName: PLANS[plan].name,
      status,
      expiresAt,
      autoRenew,
      entitlements: computeEntitlements(plan, status, now),
      refreshedAt: now,
    };
  },
});

/** Plan catalog for the premium screen (prices + feature matrix). */
export const getPlans = query({
  args: {},
  handler: async () => {
    return {
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice,
        bestValue: "bestValue" in p ? p.bestValue : false,
        features: PLAN_FEATURES[p.id as PlanId],
      })),
      features: FEATURE_MATRIX,
    };
  },
});

/** Feature matrix rendered on the premium screen. */
export const FEATURE_MATRIX: {
  key: string;
  label: string;
  plans: Record<PlanId, boolean | string>;
}[] = [
  { key: "dailyLikes", label: "Daily likes", plans: { free: "20", silver: "60", gold: "120", platinum: "300" } },
  { key: "superVybess", label: "Super VYBE / month", plans: { free: "2", silver: "8", gold: "20", platinum: "60" } },
  { key: "rewinds", label: "Rewinds / month", plans: { free: "—", silver: "3", gold: "10", platinum: "25" } },
  { key: "boosts", label: "VYBE Boost / month", plans: { free: "—", silver: "1", gold: "3", platinum: "6" } },
  { key: "advancedFilters", label: "Advanced discovery filters", plans: { free: false, silver: true, gold: true, platinum: true } },
  { key: "likesVisibility", label: "See who liked you", plans: { free: false, silver: "Recent likes", gold: true, platinum: true } },
  { key: "extendedInsights", label: "Extended profile insights", plans: { free: false, silver: true, gold: true, platinum: true } },
  { key: "readReceipts", label: "Read receipts", plans: { free: false, silver: false, gold: true, platinum: true } },
  { key: "priorityDiscovery", label: "Priority discovery placement", plans: { free: false, silver: false, gold: true, platinum: true } },
  { key: "travelMode", label: "Travel mode", plans: { free: false, silver: false, gold: false, platinum: true } },
  { key: "incognito", label: "Incognito / selective discovery", plans: { free: false, silver: false, gold: false, platinum: true } },
  { key: "profileThemes", label: "Premium profile themes", plans: { free: false, silver: false, gold: true, platinum: true } },
  { key: "locationControls", label: "Choose distance & location (1–100 km, any country/city)", plans: { free: false, silver: true, gold: true, platinum: true } },
];

/** Per-plan copy for the plan cards. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: ["20 daily likes", "2 Super VYBE / month", "Basic filters", "Standard discovery", "Current location only"],
  silver: [
    "60 daily likes",
    "8 Super VYBE / month",
    "3 rewinds / month",
    "1 VYBE Boost / month",
    "Advanced discovery filters",
    "See recent likes",
    "Extended profile insights",
    "1–100 km distance + any country/city",
  ],
  gold: [
    "120 daily likes",
    "20 Super VYBE / month",
    "10 rewinds / month",
    "3 VYBE Boosts / month",
    "Read receipts",
    "Priority discovery placement",
    "Premium profile themes",
    "Everything in Silver",
  ],
  platinum: [
    "300 daily likes",
    "60 Super VYBE / month",
    "25 rewinds / month",
    "6 VYBE Boosts / month",
    "Travel mode",
    "Incognito discovery",
    "Read receipts",
    "Priority discovery placement",
    "Everything in Gold",
  ],
};

/** Validator for the feature gate (used by the upgrade sheet). */
export const featureGate = v.union(
  v.literal("dailyLikeLimit"),
  v.literal("monthlySuperVybes"),
  v.literal("rewindLimit"),
  v.literal("dailyRewinds"),
  v.literal("boostCreditsPerMonth"),
  v.literal("advancedFilters"),
  v.literal("likesVisibility"),
  v.literal("profileBoosts"),
  v.literal("travelMode"),
  v.literal("readReceipts"),
  v.literal("priorityDiscovery"),
  v.literal("profileThemes"),
  v.literal("extendedInsights"),
  v.literal("incognito"),
  v.literal("unlimitedSuperVybess"),
  v.literal("locationControls"),
);
