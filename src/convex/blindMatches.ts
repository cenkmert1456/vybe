import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { ageFromDateOfBirth, getMyProfile, nowMs } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Blind Match: profiles are matched without photos. The reveal state lives
 * entirely on the backend — the client can only request a reveal; the backend
 * decides whether both sides have accepted (or forces a mutual window).
 */

/** List the current user's blind matches (photos always hidden here). */
export const myBlindMatches = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me || !me.onboardingCompleted) return [];
    const now = nowMs();
    const mine = [
      ...(await ctx.db
        .query("blindMatches")
        .withIndex("by_profileA", (q) => q.eq("profileA", me._id))
        .order("desc")
        .take(30)),
      ...(await ctx.db
        .query("blindMatches")
        .withIndex("by_profileB", (q) => q.eq("profileB", me._id))
        .order("desc")
        .take(30)),
    ];
    const seen = new Set<string>();
    const out: {
      _id: Id<"blindMatches">;
      status: string;
      createdAt: number;
      updatedAt: number;
      other: {
        _id: Id<"profiles">;
        firstName: string;
        age: number;
        bio: string;
        interests: string[];
        city?: string;
        verified: boolean;
        voiceIntro?: { durationSec: number } | null;
        sharedInterests: number;
        photos: string[];
      } | null;
      canReveal: boolean; // both sides accepted
      revealed: boolean; // reveal window already used
      revealedByMe: boolean;
    }[] = [];
    for (const row of mine) {
      if (seen.has(row._id.toString())) continue;
      seen.add(row._id.toString());
      if (row.status === "declined" && row.updatedAt < now - 7 * DAY_MS)
        continue; // stale declined rows fall away
      const otherId = row.profileA === me._id ? row.profileB : row.profileA;
      const other = await ctx.db.get(otherId);
      if (!other || other.profileHidden) continue;
      const sharedInterests = other.interests.filter((i) =>
        me.interests.includes(i),
      ).length;
      out.push({
        _id: row._id,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        other: {
          _id: other._id,
          firstName: other.firstName,
          age: ageFromDateOfBirth(other.dateOfBirth),
          bio: other.bio,
          interests: other.interests,
          city: other.city,
          verified: other.verified,
          voiceIntro: other.voiceIntro
            ? { durationSec: other.voiceIntro.durationSec }
            : null,
          sharedInterests,
          // Photos are only ever sent after both sides revealed — the reveal
          // state lives in the backend, so the client cannot bypass it.
          photos: row.status === "revealed" ? other.photos : [],
        },
        canReveal:
          (row.status === "pending" || row.status === "mutual") &&
          !(row.profileA === me._id ? row.revealA : row.revealB),
        revealed: row.status === "revealed",
        revealedByMe: row.profileA === me._id ? row.revealA : row.revealB,
      });
    }
    return out;
  },
});

/**
 * Start a new blind match with a compatible random profile (no photos).
 * The picked profile must be discoverable and not previously blind-matched.
 */
export const startBlindMatch = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me || !me.onboardingCompleted)
      throw new Error("Complete onboarding first");
    const now = nowMs();

    // Daily cap (3) — backend enforced.
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_profile_key", (q) =>
        q.eq("profileId", me._id).eq("key", `blind:${dayKey}`),
      )
      .first();
    if ((counter?.count ?? 0) >= 3) {
      throw new Error("You've used today's blind matches");
    }

    // Known pairs (both directions) so we never re-pair.
    const existingA = await ctx.db
      .query("blindMatches")
      .withIndex("by_profileA", (q) => q.eq("profileA", me._id))
      .collect();
    const existingB = await ctx.db
      .query("blindMatches")
      .withIndex("by_profileB", (q) => q.eq("profileB", me._id))
      .collect();
    const known = new Set<string>();
    for (const r of [...existingA, ...existingB]) {
      known.add(r.profileA.toString());
      known.add(r.profileB.toString());
    }

    const wantGenders = new Set(me.discoveryPrefs.genders);
    const candidates = await ctx.db.query("profiles").collect();
    let picked: (typeof candidates)[number] | null = null;
    for (const p of candidates) {
      if (p._id === me._id) continue;
      if (p.profileHidden || !p.showInDiscovery || !p.onboardingCompleted)
        continue;
      if (known.has(p._id.toString())) continue;
      const age = ageFromDateOfBirth(p.dateOfBirth);
      if (
        age < me.discoveryPrefs.ageMin ||
        age > me.discoveryPrefs.ageMax
      )
        continue;
      if (wantGenders.size > 0 && !wantGenders.has(p.gender)) continue;
      if (p.interestedIn.length > 0 && !p.interestedIn.includes(me.gender))
        continue;
      picked = p;
      break;
    }
    if (!picked) throw new Error("No one is available for a blind match right now");

    // Rate counter + insert. Ordering is deterministic (A < B by id string).
    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
    } else {
      await ctx.db.insert("usageCounters", {
        profileId: me._id,
        key: `blind:${dayKey}`,
        count: 1,
      });
    }
    const [a, b] =
      me._id.toString() < picked._id.toString()
        ? [me._id, picked._id]
        : [picked._id, me._id];
    await ctx.db.insert("blindMatches", {
      profileA: a,
      profileB: b,
      status: "pending",
      revealA: false,
      revealB: false,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/**
 * Accept the reveal for one side. When both sides accept, photos unlock for
 * both (backend sets status → revealed). Declining marks the whole pair
 * declined — the other side sees a friendly "passed" state.
 */
export const respondToReveal = mutation({
  args: { blindMatchId: v.id("blindMatches"), accept: v.boolean() },
  handler: async (ctx, { blindMatchId, accept }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const row = await ctx.db.get(blindMatchId);
    if (!row) throw new Error("Blind match not found");
    if (row.profileA !== me._id && row.profileB !== me._id)
      throw new Error("Not your blind match");
    if (row.status === "revealed") throw new Error("Already revealed");

    const isA = row.profileA === me._id;
    const now = nowMs();

    if (!accept) {
      await ctx.db.patch(blindMatchId, {
        status: "declined",
        updatedAt: now,
      });
      return { status: "declined" };
    }

    // Accepting my side.
    if (row.status === "pending") {
      // Both accept within the same session window → reveal immediately.
      await ctx.db.patch(blindMatchId, {
        status: "mutual",
        [isA ? "revealA" : "revealB"]: true,
        updatedAt: now,
      });
      return { status: "mutual", waiting: true };
    }

    // mutual state: one side already accepted; this is the second accept.
    const otherAccepted = isA ? row.revealB : row.revealA;
    await ctx.db.patch(blindMatchId, {
      status: otherAccepted ? "revealed" : "mutual",
      [isA ? "revealA" : "revealB"]: true,
      updatedAt: now,
    });
    return { status: otherAccepted ? "revealed" : "mutual" };
  },
});
