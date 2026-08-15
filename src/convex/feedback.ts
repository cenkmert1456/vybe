import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getMyProfile, nowMs } from "./helpers";

export const submitFeedback = mutation({
  args: {
    type: v.union(v.literal("problem"), v.literal("guidance")),
    category: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, { type, category, message }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    if (!message.trim()) throw new Error("Please describe the issue");
    await ctx.db.insert("feedback", {
      profileId: me._id,
      type,
      category,
      message: message.slice(0, 3000),
      createdAt: nowMs(),
    });
    return true;
  },
});
