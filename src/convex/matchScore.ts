import { v } from "convex/values";
import { query } from "./_generated/server";
import { distanceKm, getMyProfile } from "./helpers";

/**
 * VYBE Match Score — an original compatibility indicator with a transparent
 * per-category breakdown (interests / lifestyle / values / music / proximity),
 * all computed live from real profile data. Soft copy, never pseudo-science.
 */
export const matchScore = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    if (me._id === profileId) return null;
    const other = await ctx.db.get(profileId);
    if (!other) return null;

    const sharedInterests = me.interests.filter((i) =>
      other.interests.includes(i),
    );
    const sharedLanguages = me.languages.filter((l) =>
      other.languages.includes(l),
    );
    const sharedLifestyle = me.lifestyle.filter((l) =>
      other.lifestyle.includes(l),
    );
    const sharedIntentions = me.relationshipIntentions.filter((i) =>
      other.relationshipIntentions.includes(i),
    );

    const myMusic = me.music;
    const otherMusic = other.music;
    const sharedArtists =
      myMusic && otherMusic
        ? myMusic.topArtists.filter((a) => otherMusic.topArtists.includes(a))
        : [];
    const sharedGenres =
      myMusic && otherMusic
        ? myMusic.genres.filter((g) => otherMusic.genres.includes(g))
        : [];
    const sharedTracks =
      myMusic && otherMusic
        ? myMusic.topTracks.filter((t) => otherMusic.topTracks.includes(t))
        : [];

    // Shared profile-prompt themes (rough semantic overlap on keywords).
    const myPromptWords = new Set(
      me.prompts.flatMap((p) => p.answer.toLowerCase().split(/\W+/)),
    );
    const otherPromptWords = new Set(
      other.prompts.flatMap((p) => p.answer.toLowerCase().split(/\W+/)),
    );
    let promptOverlap = 0;
    for (const w of myPromptWords) {
      if (w.length > 3 && otherPromptWords.has(w)) promptOverlap++;
    }

    let proximity = 0;
    let sameCity = false;
    if (
      me.approxLat !== undefined &&
      me.approxLng !== undefined &&
      other.approxLat !== undefined &&
      other.approxLng !== undefined
    ) {
      const km = distanceKm(me.approxLat, me.approxLng, other.approxLat, other.approxLng);
      sameCity = me.city !== undefined && me.city === other.city;
      proximity = sameCity ? 1 : km < 100 ? 1 : km < 400 ? 0.5 : 0;
    }

    const maxInterests = Math.max(1, Math.max(me.interests.length, other.interests.length));
    const maxLifestyle = Math.max(1, Math.max(me.lifestyle.length, other.lifestyle.length));
    const maxMusic = Math.max(
      1,
      Math.max(
        (myMusic?.topArtists.length ?? 0) + (myMusic?.genres.length ?? 0),
        (otherMusic?.topArtists.length ?? 0) + (otherMusic?.genres.length ?? 0),
      ),
    );
    const maxPrompts = Math.max(1, Math.max(me.prompts.length, other.prompts.length));

    const interestScore = Math.min(1, sharedInterests.length / Math.min(6, maxInterests));
    const lifestyleScore = Math.min(1, sharedLifestyle.length / Math.min(4, maxLifestyle));
    const intentionScore =
      sharedIntentions.length > 0
        ? 1
        : me.relationshipIntentions.length === 0 &&
            other.relationshipIntentions.length === 0
          ? 0.5
          : 0;
    const musicScore =
      myMusic && otherMusic
        ? Math.min(
            1,
            (sharedArtists.length * 2 + sharedGenres.length + sharedTracks.length * 2) /
              Math.min(8, maxMusic),
          )
        : 0.5; // no music data yet — neutral, never a penalty
    const valuesScore = Math.min(
      1,
      (intentionScore * 0.6 + Math.min(1, promptOverlap / Math.min(3, maxPrompts)) * 0.4),
    );

    // Category breakdown (shown as % in the compatibility UI).
    const breakdown = [
      { key: "interests", score: Math.round(interestScore * 100) },
      { key: "lifestyle", score: Math.round(lifestyleScore * 100) },
      { key: "values", score: Math.round(valuesScore * 100) },
      { key: "music", score: Math.round(musicScore * 100) },
      { key: "proximity", score: Math.round((sameCity ? 1 : proximity > 0 ? 0.7 : 0.25) * 100) },
    ];

    // Overall: weighted blend of the categories.
    const raw =
      interestScore * 0.32 +
      lifestyleScore * 0.16 +
      valuesScore * 0.22 +
      musicScore * 0.15 +
      proximity * 0.15;

    const score = Math.round(Math.min(100, Math.max(18, raw * 100)));

    const level =
      score >= 70 ? "strong" : score >= 45 ? "good" : "open";
    const summary =
      level === "strong"
        ? "You share a strong VYBE."
        : level === "good"
          ? "You have a lot in common."
          : "Plenty of room to discover each other.";

    return {
      score,
      level,
      summary,
      breakdown,
      sharedInterests: sharedInterests.slice(0, 6),
      sharedLanguages: sharedLanguages.slice(0, 3),
      sameCity,
      music: {
        sharedArtists: sharedArtists.slice(0, 6),
        sharedGenres: sharedGenres.slice(0, 6),
        sharedTracks: sharedTracks.slice(0, 3),
        hasMusic: Boolean(myMusic && otherMusic),
      },
      note: "Based on your shared interests, lifestyle, values, music and location — a light indicator, not a scientific claim.",
    };
  },
});
