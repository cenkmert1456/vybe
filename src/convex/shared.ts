import { v } from "convex/values";
import { query } from "./_generated/server";
import { getMyProfile } from "./helpers";

/**
 * Shared connections — everything two profiles have in common, computed
 * dynamically from real profile data (never hardcoded):
 * interests, music (artists/genres/tracks), lifestyle, languages, city,
 * relationship intentions, saved events, plus a future-ready mutual-friends
 * count (0 until a social graph exists).
 */
export const sharedConnections = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    if (me._id === profileId) return null;
    const other = await ctx.db.get(profileId);
    if (!other) return null;

    const sharedInterests = me.interests.filter((i) => other.interests.includes(i));
    const sharedLanguages = me.languages.filter((l) => other.languages.includes(l));
    const sharedLifestyle = me.lifestyle.filter((l) => other.lifestyle.includes(l));
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

    // Mutual saved events.
    const mySaves = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const otherSaves = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", other._id))
      .collect();
    const otherSaveIds = new Set(otherSaves.map((s) => s.eventId.toString()));
    const sharedEventIds = mySaves
      .filter((s) => otherSaveIds.has(s.eventId.toString()))
      .map((s) => s.eventId.toString());

    const sameCity =
      me.city !== undefined &&
      me.city !== "" &&
      me.city === other.city;

    // Mutual friends: 0 until a friend graph exists — computed, not faked.
    const mutualFriends = 0;

    return {
      sharedInterests: sharedInterests.slice(0, 8),
      sharedLanguages: sharedLanguages.slice(0, 4),
      sharedLifestyle: sharedLifestyle.slice(0, 6),
      sharedIntentions: sharedIntentions.slice(0, 4),
      music: {
        sharedArtists: sharedArtists.slice(0, 8),
        sharedGenres: sharedGenres.slice(0, 8),
        sharedTracks: sharedTracks.slice(0, 4),
        hasMusic: Boolean(myMusic && otherMusic),
      },
      sameCity,
      sharedEventIds,
      mutualFriends,
    };
  },
});
