import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

export const createUserProfile = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.insert("userProfiles", {
      userId: args.targetUserId,
      role: "user",
      isActive: true,
      isConfirmed: true,
      classificationsCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      sequenceGenerated: false,
    });

    return { success: true };
  },
});
