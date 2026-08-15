import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

const MAX_PHOTOS = 6;

/** Client uploads the file to this URL, then calls saveProfilePhoto. */
export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveProfilePhoto = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Complete onboarding first");
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Upload failed");
    if (me.photos.length >= MAX_PHOTOS)
      throw new Error(`You can have up to ${MAX_PHOTOS} photos`);
    const photos = [...me.photos, url];
    await ctx.db.patch(me._id, { photos, lastActiveAt: nowMs() });
    return url;
  },
});

export const removeProfilePhoto = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (me.photos.length <= 1)
      throw new Error("Keep at least one photo on your profile");
    const photos = me.photos.filter((p) => p !== url);
    if (photos.length === me.photos.length)
      throw new Error("Photo not found");
    await ctx.db.patch(me._id, { photos, lastActiveAt: nowMs() });
    return true;
  },
});

export const reorderPhotos = mutation({
  args: { orderedUrls: v.array(v.string()) },
  handler: async (ctx, { orderedUrls }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const current = new Set(me.photos);
    if (
      orderedUrls.length !== me.photos.length ||
      orderedUrls.some((u) => !current.has(u))
    ) {
      throw new Error("Invalid photo order");
    }
    await ctx.db.patch(me._id, { photos: orderedUrls, lastActiveAt: nowMs() });
    return true;
  },
});

/** Store a chat image upload reference so it can be sent as a message. */
export const imageUrl = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Upload failed");
    return url;
  },
});
