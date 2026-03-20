import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { DEFAULT_SYSTEM_SETTINGS } from "./lib/defaults";

type SettingsContext = QueryCtx | MutationCtx;

export async function loadMergedSystemSettings(ctx: SettingsContext) {
  const settings = await ctx.db.query("systemSettings").collect();

  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key as keyof typeof DEFAULT_SYSTEM_SETTINGS] = setting.value;
    return acc;
  }, {} as Partial<typeof DEFAULT_SYSTEM_SETTINGS>);

  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...settingsMap,
  } as typeof DEFAULT_SYSTEM_SETTINGS;
}


// Admin: Get system settings
export const getSystemSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await loadMergedSystemSettings(ctx);
  },
});

// Public: Get public system settings (for non-admin users)
export const getPublicSystemSettings = query({
  args: {},
  returns: v.object({
    allowAnonymous: v.boolean(),
    appName: v.string(),
    debugAdminMode: v.boolean(),
    appVersion: v.string(),
    failedFittingMode: v.union(v.literal("checkbox"), v.literal("legacy")),
    failedFittingFallbackLsbClass: v.number(),
    showAwesomeFlag: v.boolean(),
    showValidRedshift: v.boolean(),
    showVisibleNucleus: v.boolean(),
    defaultImageQuality: v.union(v.literal("high"), v.literal("low")),
    galaxyBrowserImageQuality: v.union(v.literal("high"), v.literal("low")),
    allowPublicOverview: v.boolean(),
    userExportLimit: v.number(),
    cloudflareCachePurgeEnabled: v.boolean(),
    maintenanceDisableClassifications: v.boolean(),
    overviewDefaultPaper: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const mergedSettings = await loadMergedSystemSettings(ctx);

    // Return only the whitelisted subset with explicit fields so TypeScript
    // preserves the narrow per-key types required by the `returns` validator.
    return {
      allowAnonymous: mergedSettings.allowAnonymous,
      appName: mergedSettings.appName,
      debugAdminMode: mergedSettings.debugAdminMode,
      appVersion: mergedSettings.appVersion,
      failedFittingMode: mergedSettings.failedFittingMode,
      failedFittingFallbackLsbClass: mergedSettings.failedFittingFallbackLsbClass,
      showAwesomeFlag: mergedSettings.showAwesomeFlag,
      showValidRedshift: mergedSettings.showValidRedshift,
      showVisibleNucleus: mergedSettings.showVisibleNucleus,
      defaultImageQuality: mergedSettings.defaultImageQuality,
      galaxyBrowserImageQuality: mergedSettings.galaxyBrowserImageQuality,
      allowPublicOverview: mergedSettings.allowPublicOverview,
      userExportLimit: mergedSettings.userExportLimit,
      cloudflareCachePurgeEnabled: mergedSettings.cloudflareCachePurgeEnabled,
      maintenanceDisableClassifications: mergedSettings.maintenanceDisableClassifications,
      overviewDefaultPaper: mergedSettings.overviewDefaultPaper,
    };
  },
});

// Admin: Update system settings

export const updateSystemSettings = mutation({
  returns: v.object({ success: v.boolean() }),
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
    overviewDefaultPaper: v.optional(v.union(v.string(), v.null())),
    userExportLimit: v.optional(v.number()),
    cloudflareCachePurgeEnabled: v.optional(v.boolean()),
    cloudflareZoneId: v.optional(v.string()),
    cloudflareApiToken: v.optional(v.string()),
    // Maintenance mode flags
    maintenanceDisableClassifications: v.optional(v.boolean()),
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

    if (args.cloudflareCachePurgeEnabled !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "cloudflareCachePurgeEnabled"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.cloudflareCachePurgeEnabled });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "cloudflareCachePurgeEnabled",
          value: args.cloudflareCachePurgeEnabled,
        });
      }
    }

    if (args.cloudflareZoneId !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "cloudflareZoneId"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.cloudflareZoneId });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "cloudflareZoneId",
          value: args.cloudflareZoneId,
        });
      }
    }

    if (args.cloudflareApiToken !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "cloudflareApiToken"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.cloudflareApiToken });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "cloudflareApiToken",
          value: args.cloudflareApiToken,
        });
      }
    }

    if (args.maintenanceDisableClassifications !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "maintenanceDisableClassifications"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.maintenanceDisableClassifications });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "maintenanceDisableClassifications",
          value: args.maintenanceDisableClassifications,
        });
      }
    }

    if (args.overviewDefaultPaper !== undefined) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", "overviewDefaultPaper"))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { value: args.overviewDefaultPaper });
      } else {
        await ctx.db.insert("systemSettings", {
          key: "overviewDefaultPaper",
          value: args.overviewDefaultPaper,
        });
      }
    }

    return { success: true };
  },
});
