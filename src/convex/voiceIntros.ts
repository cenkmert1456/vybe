import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

const MAX_DURATION_SEC = 30;

/** Save (or replace) my voice intro from an uploaded storage file. */
export const saveVoiceIntro = mutation({
  args: { storageId: v.id("_storage"), durationSec: v.number() },
  handler: async (ctx, { storageId, durationSec }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    if (durationSec < 1 || durationSec > MAX_DURATION_SEC)
      throw new Error(`Voice intro must be 1–${MAX_DURATION_SEC} seconds`);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Upload failed");
    await ctx.db.patch(me._id, {
      voiceIntro: {
        url,
        durationSec: Math.round(durationSec),
        createdAt: nowMs(),
      },
      lastActiveAt: nowMs(),
    });
    return { url };
  },
});

/** Remove my voice intro. */
export const removeVoiceIntro = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not authenticated");
    await ctx.db.patch(me._id, { voiceIntro: undefined, lastActiveAt: nowMs() });
    return true;
  },
});

/** My current voice intro (for playback + recording UI). */
export const myVoiceIntro = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    return me.voiceIntro ?? null;
  },
});

/** Another profile's voice intro (only visible to matches). */
export const profileVoiceIntro = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await getMyProfile(ctx);
    if (!me) return null;
    const target = await ctx.db.get(profileId);
    if (!target || !target.voiceIntro) return null;
    if (me._id === profileId) return target.voiceIntro;
    // Only matches may hear it.
    const match = await ctx.db
      .query("matches")
      .withIndex("by_participants", (q) => q.eq("participants", [me._id]))
      .collect();
    const isMatch = match.some(
      (m) =>
        m.status === "active" && m.participants.includes(profileId),
    );
    return isMatch ? target.voiceIntro : null;
  },
});
