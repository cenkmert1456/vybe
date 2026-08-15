import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  ageFromDateOfBirth,
  distanceKm,
  getMyProfile,
  nowMs,
} from "./helpers";
import { entitlementsForUser } from "./entitlements";
import { enforceSwipeRate } from "./moderation";

export const DISCOVER_PAGE_SIZE = 10;

const PAGE_SIZE = DISCOVER_PAGE_SIZE;

/**
 * Paginated discovery deck. Excludes profiles the user already swiped,
 * blocked profiles (either direction), hidden/incomplete profiles and the
 * user's own profile. Applies age / gender / distance preferences, advanced
 * (entitlement-gated) filters, travel mode and Boost priority ordering.
 * All filtering happens server-side — clients never receive the full dataset.
 */
export const discover = query({
  args: {
    cursor: v.optional(v.id("profiles")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getMyProfile(ctx);
    if (!me || !me.onboardingCompleted || me.profileHidden) {
      return { profiles: [], cursor: null, hasMore: false };
    }

    const limit = Math.min(args.limit ?? PAGE_SIZE, 20);

    // Exclusions.
    const mySwipes = await ctx.db
      .query("swipes")
      .withIndex("by_from", (q) => q.eq("fromProfileId", me._id))
      .collect();
    const swipedIds = new Set(mySwipes.map((s) => s.toProfileId.toString()));

    const blockedByMe = await ctx.db
      .query("blocks")
      .withIndex("by_blocker", (q) => q.eq("blockerProfileId", me._id))
      .collect();
    const blockedMe = await ctx.db
      .query("blocks")
      .withIndex("by_blocked", (q) => q.eq("blockedProfileId", me._id))
      .collect();
    const blockedIds = new Set<string>();
    for (const b of blockedByMe) blockedIds.add(b.blockedProfileId.toString());
    for (const b of blockedMe) blockedIds.add(b.blockerProfileId.toString());

    // Entitlements: advanced filters only for paid tiers.
    const ent = await entitlementsForUser(ctx, me.userId);
    const canAdvanced = ent?.entitlements.advancedFilters ?? false;

    // Resolve discovery origin: travel mode overrides physical location.
    const now = nowMs();
    const travelActive =
      me.travel?.enabled &&
      (me.travel.expiresAt === undefined || me.travel.expiresAt > now);
    const originLat = travelActive ? (me.travel?.lat ?? me.approxLat) : me.approxLat;
    const originLng = travelActive ? (me.travel?.lng ?? me.approxLng) : me.approxLng;
    const originCountry = travelActive ? me.travel?.countryCode : me.countryCode;

    const myIdStr = me._id.toString();
    const prefs = me.discoveryPrefs;
    const wantGenders = new Set(prefs.genders);
    const myGender = me.gender;

    // Boosted profiles surface first (priority discovery, backend-ordered).
    const boosted = await ctx.db
      .query("boosts")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .first();
    void boosted;
    const activeBoostIds = new Set<string>();
    const boostRows = await ctx.db.query("boosts").collect();
    for (const b of boostRows) {
      if (b.status === "active" && b.expiresAt > now) {
        activeBoostIds.add(b.profileId.toString());
      }
    }

    let afterCursor = true; // skip until we pass the cursor doc
    const out: typeof me[] = [];
    // Today's shared vibe answer per profile (shown on the card).
    const todayVibes: Record<string, { question: string; answer: string } | null> = {};
    // Active mood per candidate (mood matching: similar moods surface first).
    const moods: Record<string, string> = {};
    let myMood: string | null = null;
    {
      const myMoodRow = await ctx.db
        .query("moods")
        .withIndex("by_profile", (q) => q.eq("profileId", me._id))
        .first();
      if (myMoodRow && myMoodRow.expiresAt > now) myMood = myMoodRow.mood;
    }
    const allMoods = await ctx.db.query("moods").collect();
    const moodByProfile = new Map<string, string>();
    for (const m of allMoods) {
      if (m.expiresAt > now) moodByProfile.set(m.profileId.toString(), m.mood);
    }
    let lastSeenId: string | null = null;

    const all = await ctx.db.query("profiles").order("asc").collect();
    for (const p of all) {
      const idStr = p._id.toString();
      if (args.cursor) {
        if (afterCursor) {
          if (idStr === args.cursor.toString()) afterCursor = false;
          continue;
        }
      }
      lastSeenId = idStr;

      if (idStr === myIdStr) continue;
      if (swipedIds.has(idStr)) continue;
      if (blockedIds.has(idStr)) continue;
      if (p.profileHidden || !p.onboardingCompleted || !p.showInDiscovery)
        continue;
      if (p.isDemo === false && p.userId === undefined) continue;

      const age = ageFromDateOfBirth(p.dateOfBirth);
      if (age < prefs.ageMin || age > prefs.ageMax) continue;

      // Gender preference: candidate must match my interest AND I must match theirs.
      if (wantGenders.size > 0 && !wantGenders.has(p.gender)) continue;
      if (p.interestedIn.length > 0 && !p.interestedIn.includes(myGender))
        continue;

      // Advanced filters (paid).
      if (canAdvanced) {
        if (prefs.verifiedOnly && !p.verified) continue;
        if (prefs.interests && prefs.interests.length > 0) {
          if (!prefs.interests.some((i) => p.interests.includes(i))) continue;
        }
        if (prefs.languages && prefs.languages.length > 0) {
          if (!prefs.languages.some((l) => p.languages.includes(l))) continue;
        }
        if (prefs.lifestyle && prefs.lifestyle.length > 0) {
          if (!prefs.lifestyle.some((l) => p.lifestyle.includes(l))) continue;
        }
        if (prefs.intentions && prefs.intentions.length > 0) {
          if (!prefs.intentions.some((i) => p.relationshipIntentions.includes(i)))
            continue;
        }
        if (prefs.recentlyActiveDays && prefs.recentlyActiveDays > 0) {
          if (p.lastActiveAt < now - prefs.recentlyActiveDays * 24 * 60 * 60 * 1000)
            continue;
        }
      }

      // Distance filter using the resolved origin (travel-aware).
      if (
        originLat !== undefined &&
        originLng !== undefined &&
        p.approxLat !== undefined &&
        p.approxLng !== undefined
      ) {
        const d = distanceKm(originLat, originLng, p.approxLat, p.approxLng);
        if (d > prefs.distanceKm) continue;
      } else if (travelActive && originCountry) {
        // Traveling without exact coords: prefer the same country.
        if (p.countryCode && p.countryCode !== originCountry) continue;
      }

      out.push(p);
      moods[idStr] = moodByProfile.get(idStr) ?? "";
      // Attach the profile's latest shared Daily Vibe answer (if any).
      const latestAnswer = await ctx.db
        .query("dailyAnswers")
        .withIndex("by_profile", (q) => q.eq("profileId", p._id))
        .order("desc")
        .first();
      todayVibes[idStr] =
        latestAnswer && latestAnswer.shareOnProfile
          ? { question: latestAnswer.question, answer: latestAnswer.answer }
          : null;
      if (out.length >= limit) break;
    }

    // Priority ordering: boosted profiles first, then matching-mood profiles,
    // then recency. Mood matching never *filters* — it only surfaces similar
    // moods earlier in the deck.
    out.sort((a, b) => {
      const aId = a._id.toString();
      const bId = b._id.toString();
      const aBoost = activeBoostIds.has(aId) ? 1 : 0;
      const bBoost = activeBoostIds.has(bId) ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      const aMoodMatch = myMood && moods[aId] === myMood ? 1 : 0;
      const bMoodMatch = myMood && moods[bId] === myMood ? 1 : 0;
      if (aMoodMatch !== bMoodMatch) return bMoodMatch - aMoodMatch;
      return b.lastActiveAt - a.lastActiveAt;
    });

    const hasMore = out.length >= limit;
    return {
      profiles: out,
      todayVibes,
      moods,
      cursor: hasMore ? out[out.length - 1]._id : null,
      hasMore,
      lastSeenId,
    };
  },
});

/**
 * The core interaction. Records the swipe and — only when the other profile
 * has already liked the swiper — atomically creates a match.
 */
export const swipe = mutation({
  args: {
    toProfileId: v.id("profiles"),
    action: v.union(v.literal("like"), v.literal("pass"), v.literal("superLike")),
  },
  handler: async (ctx, { toProfileId, action }) => {
    const me = await getMyProfile(ctx);
    if (!me || !me.onboardingCompleted)
      throw new Error("Complete onboarding first");

    // Rapid-swipe protection (server-side).
    await enforceSwipeRate(ctx, me._id);

    const target = await ctx.db.get(toProfileId);
    if (!target) throw new Error("Profile not found");
    if (target.profileHidden || !target.showInDiscovery)
      throw new Error("Profile is not available");

    // Blocks make discovery impossible in both directions; guard anyway.
    const blockedPair = await ctx.db
      .query("blocks")
      .withIndex("by_pair", (q) =>
        q
          .eq("blockerProfileId", me._id)
          .eq("blockedProfileId", toProfileId),
      )
      .first();
    if (blockedPair) throw new Error("Profile is not available");

    const now = nowMs();

    // Prevent duplicate swipe records.
    const existing = await ctx.db
      .query("swipes")
      .withIndex("by_from_to", (q) =>
        q.eq("fromProfileId", me._id).eq("toProfileId", toProfileId),
      )
      .first();
    if (existing) {
      return { matched: false, alreadySwiped: true, matchId: null };
    }

    // Daily like limit (backend source of truth).
    const ent = await entitlementsForUser(ctx, me.userId);
    const dailyLimit = ent?.entitlements.dailyLikeLimit ?? 20;
    if (action === "like" || action === "superLike") {
      const d = new Date(now);
      const dayKey = d.toISOString().slice(0, 10);
      const counter = await ctx.db
        .query("usageCounters")
        .withIndex("by_profile_key", (q) =>
          q.eq("profileId", me._id).eq("key", `like:${dayKey}`),
        )
        .first();
      if ((counter?.count ?? 0) >= dailyLimit) {
        throw new Error("You've reached today's likes");
      }
      if (counter) {
        await ctx.db.patch(counter._id, { count: counter.count + 1 });
      } else {
        await ctx.db.insert("usageCounters", {
          profileId: me._id,
          key: `like:${dayKey}`,
          count: 1,
        });
      }
    }

    // Super VYBE monthly allowance.
    if (action === "superLike") {
      const monthlySuper = ent?.entitlements.monthlySuperVybes ?? 2;
      const d = new Date(now);
      const monthKey = d.toISOString().slice(0, 7);
      const counter = await ctx.db
        .query("usageCounters")
        .withIndex("by_profile_key", (q) =>
          q.eq("profileId", me._id).eq("key", `super:${monthKey}`),
        )
        .first();
      if ((counter?.count ?? 0) >= monthlySuper) {
        throw new Error("You've used all your Super VYBE this month");
      }
      if (counter) {
        await ctx.db.patch(counter._id, { count: counter.count + 1 });
      } else {
        await ctx.db.insert("usageCounters", {
          profileId: me._id,
          key: `super:${monthKey}`,
          count: 1,
        });
      }
    }

    await ctx.db.insert("swipes", {
      fromProfileId: me._id,
      toProfileId,
      action,
      createdAt: now,
    });

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event:
        action === "superLike"
          ? "super_vybe_sent"
          : action === "like"
            ? "profile_liked"
            : "profile_passed",
      metadata: { toProfileId: toProfileId.toString() },
      createdAt: now,
    });

    let matchId: Id<"matches"> | null = null;

    if (action === "like" || action === "superLike") {
      // Did the target already like me?
      const reverse = await ctx.db
        .query("swipes")
        .withIndex("by_from_to", (q) =>
          q.eq("fromProfileId", toProfileId).eq("toProfileId", me._id),
        )
        .first();

      if (reverse && (reverse.action === "like" || reverse.action === "superLike")) {
        // Prevent duplicate matches.
        const existingMatches = await ctx.db
          .query("matches")
          .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
          .collect();
        const dup = existingMatches.find(
          (m) =>
            m.status === "active" && m.participants.includes(toProfileId),
        );
        if (!dup) {
          const id = await ctx.db.insert("matches", {
            participants: [me._id, toProfileId],
            status: "active",
            createdAt: now,
          });
          matchId = id;

          // Activity for both (demo profiles simply never read theirs).
          await ctx.db.insert("activity", {
            profileId: me._id,
            type: "match",
            fromProfileId: toProfileId,
            matchId,
            title: `You and ${target.firstName} caught the same VYBE`,
            createdAt: now,
          });
          if (target.userId !== undefined) {
            await ctx.db.insert("activity", {
              profileId: toProfileId,
              type: "match",
              fromProfileId: me._id,
              matchId,
              title: `You and ${me.firstName} caught the same VYBE`,
              createdAt: now,
            });
          }
          await ctx.db.insert("analytics", {
            profileId: me._id,
            event: "match_created",
            metadata: { matchId: id.toString() },
            createdAt: now,
          });
        } else {
          matchId = dup._id;
        }
      } else {
        // Let the target know they got a like (only real users have a feed).
        if (target.userId !== undefined) {
          await ctx.db.insert("activity", {
            profileId: toProfileId,
            type: "like",
            fromProfileId: me._id,
            title:
              action === "superLike"
                ? `${me.firstName} sent you a Super VYBE ✨`
                : `${me.firstName} liked you`,
            createdAt: now,
          });
        }
      }
    }

    // Keep "last active" fresh.
    await ctx.db.patch(me._id, { lastActiveAt: now });

    return { matched: !!matchId, alreadySwiped: false, matchId };
  },
});

/**
 * Rewind: undo the most recent eligible pass. Only the latest action can be
 * undone, only if it's a pass, and only within the entitlement's rewind
 * allowance. The swipe record is removed server-side so the profile returns to
 * the deck without duplicate state.
 */
export const rewindLast = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");

    const ent = await entitlementsForUser(ctx, me.userId);
    const rewindLimit = ent?.entitlements.rewindLimit ?? 0;
    if (rewindLimit <= 0) throw new Error("Rewind requires a paid membership");

    const now = nowMs();
    const d = new Date(now);
    const dayKey = d.toISOString().slice(0, 10);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `rewind:${dayKey}`),
      )
      .first();
    if ((counter?.count ?? 0) >= rewindLimit) {
      throw new Error("You've used all your rewinds for today");
    }

    const mySwipes = await ctx.db
      .query("swipes")
      .withIndex("by_from", (q) => q.eq("fromProfileId", me._id))
      .collect();
    const latest = mySwipes.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!latest) throw new Error("Nothing to rewind");

    // Only a pass can be undone, and only if no match/conversation followed.
    if (latest.action !== "pass") {
      throw new Error("Only your most recent pass can be rewound");
    }
    const target = await ctx.db.get(latest.toProfileId);
    const laterActivity = await ctx.db
      .query("activity")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const conflicting = laterActivity.some(
      (a) =>
        a.createdAt > latest.createdAt &&
        (a.type === "match" || a.type === "message") &&
        a.fromProfileId === latest.toProfileId,
    );
    if (conflicting) throw new Error("This action can no longer be rewound");

    // Full snapshot so the client can drop the profile straight back on top of
    // the deck (matches the discover query's public shape, never raw coords).
    const restored = target
      ? {
          _id: target._id.toString(),
          firstName: target.firstName,
          dateOfBirth: target.dateOfBirth,
          gender: target.gender,
          bio: target.bio,
          photos: target.photos,
          interests: target.interests,
          languages: target.languages,
          city: target.city,
          approxLat: target.approxLat,
          approxLng: target.approxLng,
          verified: target.verified,
          lastActiveAt: target.lastActiveAt,
        }
      : null;

    await ctx.db.delete(latest._id);

    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        profileId: me._id,
        key: `rewind:${dayKey}`,
        count: 1,
      });
    }

    await ctx.db.insert("analytics", {
      profileId: me._id,
      event: "rewind_used",
      metadata: { toProfileId: latest.toProfileId.toString() },
      createdAt: now,
    });

    return { restored, remaining: rewindLimit - (counter?.count ?? 0) - 1 };
  },
});

/** Remaining rewind allowance for today (non-consuming). */
export const rewindAllowance = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return { remaining: 0, limit: 0 };
    const ent = await entitlementsForUser(ctx, me.userId);
    const limit = ent?.entitlements.rewindLimit ?? 0;
    if (limit <= 0) return { remaining: 0, limit };
    const d = new Date(nowMs());
    const dayKey = d.toISOString().slice(0, 10);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `rewind:${dayKey}`),
      )
      .first();
    return { remaining: Math.max(0, limit - (counter?.count ?? 0)), limit };
  },
});

/** Profiles that have liked me and I have not yet responded to. */
export const likedMe = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];

    const incoming = await ctx.db
      .query("swipes")
      .withIndex("by_to", (q) => q.eq("toProfileId", me._id))
      .collect();
    const likes = incoming.filter(
      (s) => s.action === "like" || s.action === "superLike",
    );

    const mySwipes = await ctx.db
      .query("swipes")
      .withIndex("by_from", (q) => q.eq("fromProfileId", me._id))
      .collect();
    const responded = new Set(mySwipes.map((s) => s.toProfileId.toString()));

    const results: {
      profile: {
        _id: string;
        firstName: string;
        photos: string[];
        verified: boolean;
        city?: string;
      };
      action: "like" | "superLike";
      createdAt: number;
      responded: boolean;
    }[] = [];

    for (const s of likes) {
      const profile = await ctx.db.get(s.fromProfileId);
      if (!profile) continue;
      results.push({
        profile: {
          _id: profile._id.toString(),
          firstName: profile.firstName,
          photos: profile.photos,
          verified: profile.verified,
          city: profile.city,
        },
        action: s.action as "like" | "superLike",
        createdAt: s.createdAt,
        responded: responded.has(s.fromProfileId.toString()),
      });
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Have I already swiped this profile? (used to disable repeat actions) */
export const alreadySwiped = query({
  args: { toProfileId: v.id("profiles") },
  handler: async (ctx, { toProfileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    return await ctx.db
      .query("swipes")
      .withIndex("by_from_to", (q) =>
        q.eq("fromProfileId", me._id).eq("toProfileId", toProfileId),
      )
      .first();
  },
});
