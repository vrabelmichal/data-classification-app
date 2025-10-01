import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";


// Admin: Get system settings
export const getSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const settings = await ctx.db.query("systemSettings").collect();

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Set defaults if not exists
    if (settingsMap.allowAnonymous === undefined) {
      settingsMap.allowAnonymous = true;
    }
    if (settingsMap.emailFrom === undefined) {
      settingsMap.emailFrom = "noreply@galaxies.michalvrabel.sk";
    }
    if (settingsMap.appName === undefined) {
      settingsMap.appName = "Galaxy Classification App";
    }
    if (settingsMap.debugAdminMode === undefined) {
      settingsMap.debugAdminMode = false;
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
    const publicSettingsWhitelist = ["allowAnonymous", "appName", "debugAdminMode", "appVersion"];

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
        if (key === "appName") {
          publicSettings[key] = "Galaxy Classification App";
        }
        // if (key === "emailFrom") {
        //   publicSettings[key] = "noreply@galaxies.michalvrabel.sk";
        // }
        if (key === "debugAdminMode") {
          publicSettings[key] = false;
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
    emailFrom: v.optional(v.string()),
    appName: v.optional(v.string()),
    debugAdminMode: v.optional(v.boolean()),
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

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

    if (args.emailFrom !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "emailFrom"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.emailFrom });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "emailFrom",
          value: args.emailFrom,
        });
      }
    }

    if (args.appName !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "appName"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.appName });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "appName",
          value: args.appName,
        });
      }
    }

    if (args.debugAdminMode !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "debugAdminMode"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.debugAdminMode });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "debugAdminMode",
          value: args.debugAdminMode,
        });
      }
    }

    if (args.appVersion !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "appVersion"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.appVersion });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "appVersion",
          value: args.appVersion,
        });
      }
    }

    return { success: true };
  },
});
