import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireAdmin, requireUserId, requireUserProfile } from "./lib/auth";
import { getDefaultImageQuality } from "./lib/settings";
import { sendPasswordResetEmail } from "./ResendOTPPasswordReset";
import { api } from "./_generated/api";
import {
  classificationsByCreated,
  classificationsByAwesomeFlag,
  classificationsByVisibleNucleus,
  classificationsByFailedFitting,
  classificationsByValidRedshift,
  classificationsByLsbClass,
  classificationsByMorphology,
  userProfilesByClassificationsCount,
  userProfilesByLastActive,
} from "./galaxies/aggregates";

async function insertUserProfileAggregates(ctx: any, profile: any) {
  await userProfilesByClassificationsCount.insertIfDoesNotExist(ctx, profile);
  await userProfilesByLastActive.insertIfDoesNotExist(ctx, profile);
}

async function replaceUserProfileAggregates(ctx: any, oldProfile: any, newProfile: any) {
  await userProfilesByClassificationsCount.replace(ctx, oldProfile, newProfile);
  await userProfilesByLastActive.replace(ctx, oldProfile, newProfile);
}
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
      await insertUserProfileAggregates(ctx, existing);
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
    const createdProfile = await ctx.db.get(profileId);
    if (createdProfile) {
      await insertUserProfileAggregates(ctx, createdProfile);
    }

    return createdProfile;
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

/**
 * Toggle to switch between user stats calculation methods:
 * - false: Use filter/reduce on classifications table (original method, accurate but slower)
 * - true: Use pre-computed counters from userProfiles table (fast method, relies on counters being up-to-date)
 * 
 * Set to true for production performance, false for debugging/cross-checking accuracy.
 */
const USE_PROFILE_COUNTERS_FOR_STATS = true;

// Get user statistics
// If targetUserId is provided, requires admin access to view other users' stats
export const getUserStats = query({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getOptionalUserId(ctx);
    if (!currentUserId) return null;

    // Determine which user's stats to fetch
    let userId = currentUserId;
    
    if (args.targetUserId && args.targetUserId !== currentUserId) {
      // Viewing another user's stats requires admin access
      await requireAdmin(ctx, { notAdminMessage: "Only admins can view other users' statistics" });
      userId = args.targetUserId;
    }

    // Get user profile (needed for both methods, and always available)
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (USE_PROFILE_COUNTERS_FOR_STATS && profile) {
      // Fast method: Use pre-computed counters from userProfiles
      const total = profile.classificationsCount ?? 0;
      
      // For "this week", we still need to query classifications (no counter for this)
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("_creationTime"), oneWeekAgo))
        .collect();
      const thisWeek = recentClassifications.length;

      // For average time, we still need to compute from classifications
      const allClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const averageTime = allClassifications.length > 0
        ? allClassifications.reduce((sum, c) => sum + c.timeSpent, 0) / allClassifications.length
        : 0;

      // LSB counts: combine lsb0 as nonLSB, lsb1 as LSB (lsbNeg1 is legacy/failed fitting)
      const lsbClassCounts = {
        nonLSB: (profile.lsb0Count ?? 0) + (profile.lsbNeg1Count ?? 0),
        LSB: profile.lsb1Count ?? 0,
      };

      // Morphology counts from profile
      const morphologyCounts = {
        featureless: profile.morphNeg1Count ?? 0,
        irregular: profile.morph0Count ?? 0,
        spiral: profile.morph1Count ?? 0,
        elliptical: profile.morph2Count ?? 0,
      };

      return {
        total,
        thisWeek,
        byLsbClass: lsbClassCounts,
        byMorphology: morphologyCounts,
        averageTime: Math.round(averageTime / 1000), // Convert to seconds
        awesomeCount: profile.awesomeCount ?? 0,
        validRedshiftCount: profile.validRedshiftCount ?? 0,
        visibleNucleusCount: profile.visibleNucleusCount ?? 0,
        failedFittingCount: profile.failedFittingCount ?? 0,
        // Include raw profile counters for debugging/comparison
        _source: "profile" as const,
      };
    }

    // Original method: Filter and reduce on classifications table
    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const recentClassifications = classifications
      .filter(c => c._creationTime > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .length;

    // Count by LSB class - binary (0 = nonLSB, 1 = LSB)
    // lsb_class values: 0 = nonLSB, 1 = LSB (failed fitting is now a separate flag)
    const lsbClassCounts = classifications.reduce((acc, c) => {
      const key = c.lsb_class === 1 ? "LSB" : "nonLSB";
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
    const failedFittingCount = classifications.filter(c => c.failed_fitting).length;

    return {
      total: classifications.length,
      thisWeek: recentClassifications,
      byLsbClass: lsbClassCounts,
      byMorphology: morphologyCounts,
      averageTime: Math.round(averageTime / 1000), // Convert to seconds
      awesomeCount,
      validRedshiftCount,
      visibleNucleusCount,
      failedFittingCount,
      _source: "classifications" as const,
    };
  },
});

// Admin: Get list of users for dropdown selection (lightweight version)
export const getUsersForSelection = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Only admins can access user list" });

    const allUsers = await ctx.db.query("users").collect();
    
    const usersWithProfiles = await Promise.all(
      allUsers.map(async (user) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();

        return {
          userId: user._id,
          email: (user as any).email ?? null,
          name: (user as any).name ?? null,
          classificationsCount: profile?.classificationsCount ?? 0,
          role: profile?.role ?? "user",
        };
      })
    );

    // Sort by classifications count descending, then by name/email
    return usersWithProfiles.sort((a, b) => {
      if (b.classificationsCount !== a.classificationsCount) {
        return b.classificationsCount - a.classificationsCount;
      }
      const aName = a.name || a.email || "";
      const bName = b.name || b.email || "";
      return aName.localeCompare(bName);
    });
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
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: args.isActive,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) await insertUserProfileAggregates(ctx, newProfile);
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isActive: args.isActive,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

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
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: true,
        isConfirmed: args.isConfirmed,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) await insertUserProfileAggregates(ctx, newProfile);
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isConfirmed: args.isConfirmed,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

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
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: args.role,
        isActive: true,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) await insertUserProfileAggregates(ctx, newProfile);
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      role: args.role,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

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

    // Avoid hard failures when aggregate entries are missing for older data
    const safeAggregateDelete = async (label: string, op: () => Promise<void>) => {
      try {
        await op();
      } catch (error: any) {
        const message: string | undefined = error?.message;
        const code: string | undefined = error?.data?.code;
        if (code === "DELETE_MISSING_KEY" || message?.includes("DELETE_MISSING_KEY")) {
          console.warn(`[users:deleteUser] missing aggregate entry for ${label}, skipping delete`);
          return;
        }
        throw error;
      }
    };

    // Delete user profile
    const targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (targetProfile) {
      await safeAggregateDelete("userProfilesByClassificationsCount", () =>
        userProfilesByClassificationsCount.delete(ctx, targetProfile)
      );
      await safeAggregateDelete("userProfilesByLastActive", () =>
        userProfilesByLastActive.delete(ctx, targetProfile)
      );
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
      await safeAggregateDelete("classificationsByCreated", () =>
        classificationsByCreated.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByAwesomeFlag", () =>
        classificationsByAwesomeFlag.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByVisibleNucleus", () =>
        classificationsByVisibleNucleus.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByFailedFitting", () =>
        classificationsByFailedFitting.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByValidRedshift", () =>
        classificationsByValidRedshift.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByLsbClass", () =>
        classificationsByLsbClass.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByMorphology", () =>
        classificationsByMorphology.delete(ctx, classification)
      );
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
