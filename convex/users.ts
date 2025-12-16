import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireAdmin, requireUserId, requireUserProfile } from "./lib/auth";
import { getDefaultImageQuality } from "./lib/settings";
import { sendPasswordResetEmail } from "./ResendOTPPasswordReset";
import { api } from "./_generated/api";
// adminSetUserPassword removed: we now only support email-based reset flow.

// Get user preferences
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    const defaultQuality = await getDefaultImageQuality(ctx);
    
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // console.log("[convex:getUserPreferences]", {
    //   userId,
    //   hasPrefs: !!prefs,
    //   prefsImageQuality: prefs?.imageQuality,
    //   defaultQuality,
    // });

    return prefs || {
      imageQuality: defaultQuality,
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
    const userId = await requireUserId(ctx);
    const defaultQuality = await getDefaultImageQuality(ctx);

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // console.log("[convex:updatePreferences]", {
    //   userId,
    //   args,
    //   hasExisting: !!existing,
    //   defaultQuality,
    // });

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        imageQuality: args.imageQuality || defaultQuality,
        theme: args.theme || "auto",
        contrast: args.contrast || 1.0,
      });
    }

    // console.log("[convex:updatePreferences] success");
    return { success: true };
  },
});

// Initialize user profile
export const initializeUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

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
    const userId = await getOptionalUserId(ctx);
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
    const userId = await getOptionalUserId(ctx);
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

// Admin: Get user by ID
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db.get(args.userId);
  },
});

// Admin: Get user profile by userId
export const getUserProfileById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return profile;
  },
});

// Admin: Get all users
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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

    // Delete the user from the users table
    await ctx.db.delete(args.targetUserId);

    return { success: true };
  },
});

// Admin: Reset user password (send reset email)
// export const resetUserPassword = action({
//   args: { targetUserId: v.id("users") },
//   handler: async (ctx, args) => {
//     const adminUserId = await getAuthUserId(ctx);
//     if (!adminUserId) throw new Error("Not authenticated");

//     // Check admin permissions using runQuery
//     const adminProfile = await ctx.runQuery(api.users.getUserProfileById, { userId: adminUserId });
//     if (!adminProfile || adminProfile.role !== "admin") {
//       throw new Error("Admin access required");
//     }

//     // Get target user data using runQuery
//     const targetUser = await ctx.runQuery(api.users.getUserById, { userId: args.targetUserId });
//     if (!targetUser?.email) {
//       throw new Error("Target user has no email to send reset");
//     }

//     // Get settings using runQuery
//     const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
//     const emailFrom = settings.emailFrom || "noreply@galaxies.michalvrabel.sk";
//     const appName = settings.appName || "Galaxy Classification App";

//     // Send password reset email
//     await sendPasswordResetEmail(targetUser.email, `${appName} <${emailFrom}>`);

//     return {
//       success: true,
//       message: "Password reset email sent successfully.",
//     };
//   },
// });

// Debug: Allow user to become admin (for debugging purposes)
export const becomeAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireUserProfile(ctx, {
      missingProfileMessage: "User profile not found",
    });

    // Check if debug admin mode is enabled
    const settings = await ctx.db.query("systemSettings").collect();
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    if (!settingsMap.debugAdminMode) {
      throw new Error("Debug admin mode is not enabled");
    }

    // Update user role to admin
    await ctx.db.patch(profile._id, { role: "admin" });

    return { success: true };
  },
});

// Update user name
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    await ctx.db.patch(userId, { name: args.name });

    return { success: true };
  },
});
