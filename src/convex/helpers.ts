import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/** Gender validator shared between schema and functions. */
export const genderV = v.union(
  v.literal("woman"),
  v.literal("man"),
  v.literal("nonbinary"),
  v.literal("other"),
);
export type GenderValue = "woman" | "man" | "nonbinary" | "other";

/** Resolve the signed-in auth user id, or null. */
export const currentUserId = async (ctx: QueryCtx) => {
  return await getAuthUserId(ctx);
};

/**
 * Get the current user's profile document. Returns null when signed out or
 * when the profile has not been created yet (onboarding not completed).
 */
export const getMyProfile = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
};

export const MILE_PER_KM = 0.621371;

/** Haversine distance between two coordinates in kilometers. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Age in whole years from a ms timestamp birthday. */
export function ageFromDateOfBirth(ms: number): number {
  const dob = new Date(ms);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export const nowMs = () => Date.now();

/** Validator used by public profile queries. */
export const publicProfileFields = {
  _id: v.id("profiles"),
  firstName: v.string(),
  dateOfBirth: v.number(),
  gender: genderV,
  interestedIn: v.array(genderV),
  bio: v.string(),
  photos: v.array(v.string()),
  interests: v.array(v.string()),
  languages: v.array(v.string()),
  city: v.optional(v.string()),
  approxLat: v.optional(v.number()),
  approxLng: v.optional(v.number()),
  lifestyle: v.array(v.string()),
  prompts: v.array(v.object({ question: v.string(), answer: v.string() })),
  verified: v.boolean(),
  verificationStatus: v.union(
    v.literal("none"),
    v.literal("in_progress"),
    v.literal("verified"),
    v.literal("failed"),
  ),
  showInDiscovery: v.boolean(),
  profileHidden: v.boolean(),
  onboardingCompleted: v.boolean(),
  completedAt: v.optional(v.number()),
  lastActiveAt: v.number(),
  isDemo: v.boolean(),
};

export type PublicProfile = {
  _id: string;
  firstName: string;
  dateOfBirth: number;
  gender: GenderValue;
  interestedIn: GenderValue[];
  bio: string;
  photos: string[];
  interests: string[];
  languages: string[];
  city?: string;
  approxLat?: number;
  approxLng?: number;
  lifestyle: string[];
  prompts: { question: string; answer: string }[];
  verified: boolean;
  verificationStatus: "none" | "in_progress" | "verified" | "failed";
  showInDiscovery: boolean;
  profileHidden: boolean;
  onboardingCompleted: boolean;
  completedAt?: number;
  lastActiveAt: number;
  isDemo: boolean;
};
