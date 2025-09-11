import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
// adminSetUserPassword removed: we now only support email-based reset flow.

// Get user preferences
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return prefs || {
      imageQuality: "medium" as const,
      theme: "auto" as const,
      contrast: 1.0,
    };
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    imageQuality: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("auto"))),
    contrast: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        imageQuality: args.imageQuality || "medium",
        theme: args.theme || "auto",
        contrast: args.contrast || 1.0,
      });
    }

    return { success: true };
  },
});

// Initialize user profile
export const initializeUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return existing;
    }

    // Check if anonymous users are allowed
    const anonymousAllowed = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowAnonymous"))
      .unique();

    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      role: "user",
      isActive: true,
      isConfirmed: anonymousAllowed?.value === true || false, // Auto-confirm if anonymous allowed
      classificationsCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      sequenceGenerated: false,
    });

    return await ctx.db.get(profileId);
  },
});

// Get user profile
export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    return {
      user,
      ...profile,
    };
  },
});

// Get user statistics
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const recentClassifications = classifications
      .filter(c => c._creationTime > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .length;

    // Count by LSB class
    const lsbClassCounts = classifications.reduce((acc, c) => {
      const key = c.lsb_class === -1 ? "failed" : c.lsb_class === 0 ? "nonLSB" : "LSB";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by morphology
    const morphologyCounts = classifications.reduce((acc, c) => {
      const key = c.morphology === -1 ? "featureless" : 
                  c.morphology === 0 ? "irregular" :
                  c.morphology === 1 ? "spiral" : "elliptical";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageTime = classifications.length > 0
      ? classifications.reduce((sum, c) => sum + c.timeSpent, 0) / classifications.length
      : 0;

    const awesomeCount = classifications.filter(c => c.awesome_flag).length;
    const validRedshiftCount = classifications.filter(c => c.valid_redshift).length;
    const visibleNucleusCount = classifications.filter(c => c.visible_nucleus).length;

    return {
      total: classifications.length,
      thisWeek: recentClassifications,
      byLsbClass: lsbClassCounts,
      byMorphology: morphologyCounts,
      averageTime: Math.round(averageTime / 1000), // Convert to seconds
      awesomeCount,
      validRedshiftCount,
      visibleNucleusCount,
    };
  },
});

// Admin: Get all users
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Get all users from the users table
    const allUsers = await ctx.db.query("users").collect();
    
    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        // Try to find existing profile
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();

        // If no profile exists, create a temporary one for display
        if (!profile) {
          return {
            _id: `temp_${user._id}` as any,
            userId: user._id,
            role: "user" as const,
            isActive: false,
            isConfirmed: false,
            classificationsCount: 0,
            joinedAt: user._creationTime,
            lastActiveAt: user._creationTime,
            sequenceGenerated: false,
            user,
          };
        }

        return {
          ...profile,
          user,
        };
      })
    );

    return usersWithDetails;
  },
});

// Admin: Update user status
export const updateUserStatus = mutation({
  args: {
    targetUserId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: args.isActive,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isActive: args.isActive,
    });

    return { success: true };
  },
});

// Admin: Confirm user account
export const confirmUser = mutation({
  args: {
    targetUserId: v.id("users"),
    isConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: true,
        isConfirmed: args.isConfirmed,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isConfirmed: args.isConfirmed,
    });

    return { success: true };
  },
});

// Admin: Update user role
export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: args.role,
        isActive: true,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      role: args.role,
    });

    return { success: true };
  },
});

// Admin: Delete user
export const deleteUser = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Delete user profile
    const targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (targetProfile) {
      await ctx.db.delete(targetProfile._id);
    }

    // Delete user preferences
    const userPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (userPrefs) {
      await ctx.db.delete(userPrefs._id);
    }

    // Delete user classifications
    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const classification of classifications) {
      await ctx.db.delete(classification._id);
    }

    // Delete user skipped galaxies
    const skipped = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const skip of skipped) {
      await ctx.db.delete(skip._id);
    }

    // Delete user galaxy sequences
    const sequences = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const sequence of sequences) {
      await ctx.db.delete(sequence._id);
    }

    return { success: true };
  },
});

// Admin: Get system settings
export const getSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    const settings = await ctx.db.query("systemSettings").collect();
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Set defaults if not exists
    if (!settingsMap.allowAnonymous) {
      settingsMap.allowAnonymous = true;
    }

    return settingsMap;
  },
});

// Admin: Update system settings
export const updateSystemSettings = mutation({
  args: {
    allowAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    if (args.allowAnonymous !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "allowAnonymous"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.allowAnonymous });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "allowAnonymous",
          value: args.allowAnonymous,
        });
      }
    }

    return { success: true };
  },
});

// Admin: Reset a user's password (Password provider)
export const resetUserPassword = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const adminUserId = await getAuthUserId(ctx);
    if (!adminUserId) throw new Error("Not authenticated");

    const adminProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", adminUserId))
      .unique();

    if (!adminProfile || adminProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Fetch the target user's email
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser?.email) {
      throw new Error("Target user has no email to send reset");
    }

    // Insert a password reset token doc (consumed by auth provider flow when user submits code)
    // The provider's ResendOTPPasswordReset will generate & email a code when the user initiates
    // the flow. Here we can optionally pre-create a marker or send a notification email.
    // Simplicity: we just return success; admin instructs user to use the 'Forgot password' form.

    return {
      success: true,
      message: "Password reset email can be requested by the user via the reset form.",
    };
  },
});
