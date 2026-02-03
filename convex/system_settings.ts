import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { DEFAULT_SYSTEM_SETTINGS } from "./lib/defaults";


// Admin: Get system settings
export const getSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const settings = await ctx.db.query("systemSettings").collect();

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key as keyof typeof DEFAULT_SYSTEM_SETTINGS] = setting.value;
      return acc;
    }, {} as Partial<typeof DEFAULT_SYSTEM_SETTINGS>);

    const mergedSettings: typeof DEFAULT_SYSTEM_SETTINGS = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...settingsMap,
    };
    return mergedSettings;
  },
});

// Public: Get public system settings (for non-admin users)
export const getPublicSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").collect();

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key as keyof typeof DEFAULT_SYSTEM_SETTINGS] = setting.value;
      return acc;
    }, {} as Partial<typeof DEFAULT_SYSTEM_SETTINGS>);

    const mergedSettings: typeof DEFAULT_SYSTEM_SETTINGS = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...settingsMap,
    };

    // Whitelist of settings that are safe to expose to non-admin users
    const publicSettingsWhitelist = [
      "allowAnonymous",
      "appName",
      "debugAdminMode",
      "appVersion",
      "failedFittingMode",
      "failedFittingFallbackLsbClass",
      "showAwesomeFlag",
      "showValidRedshift",
      "showVisibleNucleus",
      "defaultImageQuality",
      "galaxyBrowserImageQuality",
      "allowPublicOverview",
      "userExportLimit",
    ] as const;

    type PublicSettingKey = (typeof publicSettingsWhitelist)[number];

    // Only return whitelisted settings
    const publicSettings = publicSettingsWhitelist.reduce(
      (acc, key) => {
        acc[key] = mergedSettings[key];
        return acc;
      },
      {} as Record<PublicSettingKey, (typeof DEFAULT_SYSTEM_SETTINGS)[PublicSettingKey]>,
    );

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
    allowPublicOverview: v.optional(v.boolean()),
    appVersion: v.optional(v.string()),
    failedFittingMode: v.optional(v.union(v.literal("checkbox"), v.literal("legacy"))),
    failedFittingFallbackLsbClass: v.optional(v.number()),
    showAwesomeFlag: v.optional(v.boolean()),
    showValidRedshift: v.optional(v.boolean()),
    showVisibleNucleus: v.optional(v.boolean()),
    defaultImageQuality: v.optional(v.union(v.literal("high"), v.literal("low"))),
    galaxyBrowserImageQuality: v.optional(v.union(v.literal("high"), v.literal("low"))),
    availablePapers: v.optional(v.array(v.string())),
    userExportLimit: v.optional(v.number()),
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

    if (args.allowPublicOverview !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "allowPublicOverview"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.allowPublicOverview });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "allowPublicOverview",
          value: args.allowPublicOverview,
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

    if (args.defaultImageQuality !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "defaultImageQuality"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.defaultImageQuality });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "defaultImageQuality",
          value: args.defaultImageQuality,
        });
      }
    }

    if (args.galaxyBrowserImageQuality !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "galaxyBrowserImageQuality"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.galaxyBrowserImageQuality });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "galaxyBrowserImageQuality",
          value: args.galaxyBrowserImageQuality,
        });
      }
    }

    if (args.availablePapers !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "availablePapers"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.availablePapers });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "availablePapers",
          value: args.availablePapers,
        });
      }
    }

    if (args.userExportLimit !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "userExportLimit"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.userExportLimit });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "userExportLimit",
          value: args.userExportLimit,
        });
      }
    }

    return { success: true };
  },
});
