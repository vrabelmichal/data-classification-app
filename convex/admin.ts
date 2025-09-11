import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Make current user admin (for initial setup)
export const makeCurrentUserAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Create user profile if doesn't exist
    await ctx.db.insert("userProfiles", {
      userId,
      role: "admin",
      isActive: true,
      isConfirmed: true,
      classificationsCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      sequenceGenerated: false,
    });

    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      // Create profile if it doesn't exist
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        role: "admin",
        isActive: true,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      profile = await ctx.db.get(profileId);
    } else {
      // Update existing profile to admin
      await ctx.db.patch(profile._id, {
        role: "admin",
        isConfirmed: true,
        isActive: true,
      });
    }

    return { success: true, message: "You are now an admin!" };
  },
});

export const createUserProfile = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
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
