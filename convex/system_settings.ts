import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";


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

// Public: Get public system settings (for non-admin users)
export const getPublicSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").collect();
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Whitelist of settings that are safe to expose to non-admin users
    const publicSettingsWhitelist = ["allowAnonymous"];

    // Only return whitelisted settings
    const publicSettings: Record<string, any> = {};
    for (const key of publicSettingsWhitelist) {
      if (settingsMap[key] !== undefined) {
        publicSettings[key] = settingsMap[key];
      } else {
        // Set defaults for whitelisted settings that don't exist
        if (key === "allowAnonymous") {
          publicSettings[key] = true;
        }
      }
    }

    return publicSettings;
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
