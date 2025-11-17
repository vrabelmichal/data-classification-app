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
    if (settingsMap.failedFittingMode === undefined) {
      settingsMap.failedFittingMode = "checkbox"; // "checkbox" or "legacy"
    }
    if (settingsMap.failedFittingFallbackLsbClass === undefined) {
      settingsMap.failedFittingFallbackLsbClass = 0; // Default to Non-LSB (0)
    }
    if (settingsMap.showAwesomeFlag === undefined) {
      settingsMap.showAwesomeFlag = true;
    }
    if (settingsMap.showValidRedshift === undefined) {
      settingsMap.showValidRedshift = true;
    }
    if (settingsMap.showVisibleNucleus === undefined) {
      settingsMap.showVisibleNucleus = true;
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
    const publicSettingsWhitelist = ["allowAnonymous", "appName", "debugAdminMode", "appVersion", "failedFittingMode", "failedFittingFallbackLsbClass", "showAwesomeFlag", "showValidRedshift", "showVisibleNucleus"];

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
        if (key === "failedFittingMode") {
          publicSettings[key] = "checkbox";
        }
        if (key === "failedFittingFallbackLsbClass") {
          publicSettings[key] = 0;
        }
        if (key === "showAwesomeFlag") {
          publicSettings[key] = true;
        }
        if (key === "showValidRedshift") {
          publicSettings[key] = true;
        }
        if (key === "showVisibleNucleus") {
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
    emailFrom: v.optional(v.string()),
    appName: v.optional(v.string()),
    debugAdminMode: v.optional(v.boolean()),
    appVersion: v.optional(v.string()),
    failedFittingMode: v.optional(v.union(v.literal("checkbox"), v.literal("legacy"))),
    failedFittingFallbackLsbClass: v.optional(v.number()),
    showAwesomeFlag: v.optional(v.boolean()),
    showValidRedshift: v.optional(v.boolean()),
    showVisibleNucleus: v.optional(v.boolean()),
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

    if (args.failedFittingMode !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "failedFittingMode"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.failedFittingMode });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "failedFittingMode",
          value: args.failedFittingMode,
        });
      }
    }

    if (args.failedFittingFallbackLsbClass !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "failedFittingFallbackLsbClass"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.failedFittingFallbackLsbClass });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "failedFittingFallbackLsbClass",
          value: args.failedFittingFallbackLsbClass,
        });
      }
    }

    if (args.showAwesomeFlag !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "showAwesomeFlag"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.showAwesomeFlag });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "showAwesomeFlag",
          value: args.showAwesomeFlag,
        });
      }
    }

    if (args.showValidRedshift !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "showValidRedshift"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.showValidRedshift });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "showValidRedshift",
          value: args.showValidRedshift,
        });
      }
    }

    if (args.showVisibleNucleus !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "showVisibleNucleus"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.showVisibleNucleus });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "showVisibleNucleus",
          value: args.showVisibleNucleus,
        });
      }
    }

    return { success: true };
  },
});
