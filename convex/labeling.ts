import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import { DEFAULT_AVAILABLE_PAPERS } from "./lib/defaults";
import {
  galaxiesById,
  galaxiesByTotalClassifications,
  galaxiesByPaper,
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

const DAY_MS = 24 * 60 * 60 * 1000;
const BLACKLIST_LOOKUP_BATCH_SIZE = 200;

async function mapBlacklistedIdsToPaper(
  ctx: any,
  externalIds: string[]
): Promise<Record<string, string>> {
  const paperByExternalId: Record<string, string> = {};

  for (let i = 0; i < externalIds.length; i += BLACKLIST_LOOKUP_BATCH_SIZE) {
    const batch = externalIds.slice(i, i + BLACKLIST_LOOKUP_BATCH_SIZE);
    const resolved = await Promise.all(
      batch.map(async (externalId) => {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q: any) => q.eq("id", externalId))
          .unique();
        return {
          externalId,
          paper: galaxy ? (galaxy.misc?.paper ?? "") : "",
        };
      })
    );

    for (const entry of resolved) {
      paperByExternalId[entry.externalId] = entry.paper;
    }
  }

  return paperByExternalId;
}

async function getTopClassifiers(ctx: any, limit: number) {
  const totalProfiles = await userProfilesByClassificationsCount.count(ctx);
  const take = Math.min(limit, totalProfiles);
  if (take <= 0) {
    return [];
  }

  const profileSlots = await Promise.all(
    Array.from({ length: take }, (_, idx) =>
      userProfilesByClassificationsCount.at(ctx, totalProfiles - 1 - idx)
    )
  );

  const profiles = await Promise.all(
    profileSlots.map((item) => ctx.db.get(item.id as Id<"userProfiles">))
  );

  const users = await Promise.all(
    profiles.map((profile) => (profile ? ctx.db.get(profile.userId) : null))
  );

  const results: Array<{
    userId: Id<"users">;
    profileId: Id<"userProfiles">;
    name?: string | null;
    email?: string | null;
    classifications: number;
    lastActiveAt?: number;
  }> = [];

  for (let i = 0; i < take; i++) {
    const profile = profiles[i];
    if (!profile) continue;
    const user = users[i];
    results.push({
      userId: profile.userId,
      profileId: profile._id,
      name: (user as any)?.name ?? null,
      email: (user as any)?.email ?? null,
      classifications: profile.classificationsCount,
      lastActiveAt: profile.lastActiveAt,
    });
  }

  return results;
}

export const getLabelingOverview = query({
  args: {
    paper: v.optional(v.string()),
  },
  returns: v.object({
    totals: v.object({
      galaxies: v.number(),
      classifiedGalaxies: v.number(),
      unclassifiedGalaxies: v.number(),
      totalClassifications: v.number(),
      progress: v.number(),
      avgClassificationsPerGalaxy: v.number(),
    }),
    recency: v.object({
      classificationsLast7d: v.number(),
      classificationsLast24h: v.number(),
      activeClassifiers: v.number(),
      activePast7d: v.number(),
      avgClassificationsPerActiveUser: v.number(),
      dailyCounts: v.array(v.object({
        start: v.number(),
        end: v.number(),
        count: v.number(),
      })),
    }),
    classificationStats: v.object({
      flags: v.object({
        awesome: v.number(),
        visibleNucleus: v.number(),
        failedFitting: v.number(),
        validRedshift: v.number(),
      }),
      lsbClass: v.object({
        nonLSB: v.number(),
        LSB: v.number(),
      }),
      morphology: v.object({
        featureless: v.number(),
        irregular: v.number(),
        spiral: v.number(),
        elliptical: v.number(),
      }),
    }),
    topClassifiers: v.array(v.object({
      userId: v.string(),
      profileId: v.string(),
      name: v.optional(v.union(v.string(), v.null())),
      email: v.optional(v.union(v.string(), v.null())),
      classifications: v.number(),
      lastActiveAt: v.optional(v.number()),
    })),
    timestamp: v.number(),
    paperCounts: v.record(v.string(), v.object({
      total: v.number(),
      blacklisted: v.number(),
      adjusted: v.number(),
    })),
    availablePapers: v.array(v.string()),
    paperFilter: v.union(v.object({
      paper: v.string(),
      galaxies: v.number(),
      blacklisted: v.number(),
      adjusted: v.number(),
    }), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;
    const oneDayAgo = now - DAY_MS;

    const coreCountsPromise = Promise.all([
      galaxiesById.count(ctx),
      galaxiesByTotalClassifications.count(ctx, {
        bounds: {
          lower: { key: 1, inclusive: true },
          upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
        },
      }),
      classificationsByCreated.count(ctx),
      classificationsByCreated.count(ctx, {
        bounds: {
          lower: { key: sevenDaysAgo, inclusive: true },
          upper: { key: now, inclusive: true },
        },
      }),
      classificationsByCreated.count(ctx, {
        bounds: {
          lower: { key: oneDayAgo, inclusive: true },
          upper: { key: now, inclusive: true },
        },
      }),
      userProfilesByClassificationsCount.count(ctx, {
        bounds: { lower: { key: 1, inclusive: true } },
      }),
      userProfilesByLastActive.count(ctx, {
        bounds: { lower: { key: sevenDaysAgo, inclusive: true } },
      }),
      // Classification flag aggregates
      classificationsByAwesomeFlag.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByVisibleNucleus.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByFailedFitting.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByValidRedshift.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      // LSB class aggregates (0 = nonLSB, 1 = LSB)
      classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: 0, inclusive: true }, upper: { key: 0, inclusive: true } },
      }),
      classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: 1, inclusive: true }, upper: { key: 1, inclusive: true } },
      }),
      // Morphology aggregates (-1 = featureless, 0 = irregular, 1 = spiral, 2 = elliptical)
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: -1, inclusive: true }, upper: { key: -1, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 0, inclusive: true }, upper: { key: 0, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 1, inclusive: true }, upper: { key: 1, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 2, inclusive: true }, upper: { key: 2, inclusive: true } },
      }),
    ]);

    const availablePapersSettingPromise = ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "availablePapers"))
      .unique();

    const blacklistRowsPromise = ctx.db.query("galaxyBlacklist").collect();

    const dailyCountsPromise = Promise.all(
      Array.from({ length: 7 }, (_, idx) => {
        const start = now - (idx + 1) * DAY_MS;
        const end = now - idx * DAY_MS;
        return classificationsByCreated.count(ctx, {
          bounds: {
            lower: { key: start, inclusive: true },
            upper: { key: end, inclusive: false },
          },
        }).then((count) => ({ start, end, count }));
      })
    );

    const topClassifiersPromise = getTopClassifiers(ctx, 5);

    const [
      [
        totalGalaxies,
        classifiedGalaxies,
        totalClassifications,
        classificationsLast7d,
        classificationsLast24h,
        activeClassifiers,
        activePast7d,
        // Classification flag counts
        awesomeFlagCount,
        visibleNucleusCount,
        failedFittingCount,
        validRedshiftCount,
        // LSB class counts (binary: 0 = nonLSB, 1 = LSB)
        lsbClassNonLSB,
        lsbClassLSB,
        // Morphology counts
        morphologyFeatureless,
        morphologyIrregular,
        morphologySpiral,
        morphologyElliptical,
      ],
      availablePapersSetting,
      blacklistRows,
      dailyCounts,
      topClassifiers,
    ] = await Promise.all([
      coreCountsPromise,
      availablePapersSettingPromise,
      blacklistRowsPromise,
      dailyCountsPromise,
      topClassifiersPromise,
    ]);

    const unclassifiedGalaxies = Math.max(totalGalaxies - classifiedGalaxies, 0);
    const progress = totalGalaxies > 0 ? (classifiedGalaxies / totalGalaxies) * 100 : 0;
    const avgClassificationsPerGalaxy = totalGalaxies > 0 ? totalClassifications / totalGalaxies : 0;
    const avgClassificationsPerActiveUser = activeClassifiers > 0 ? totalClassifications / activeClassifiers : 0;

    // Always compute per-paper galaxy counts using the aggregate (O(log n) each).
    // We also count blacklisted galaxies per paper once — blacklist is small.
    const availablePapers: string[] = Array.isArray((availablePapersSetting as any)?.value)
      ? (((availablePapersSetting as any).value as unknown[]).filter((p): p is string => typeof p === "string"))
      : DEFAULT_AVAILABLE_PAPERS;
    // Ensure "" (unassigned) is always included so every galaxy is accounted for.
    const allPapers = availablePapers.includes("") ? availablePapers : ["", ...availablePapers];

    // Load blacklist once, then resolve paper values in deduped batched lookups.
    const uniqueBlacklistedExternalIds = Array.from(
      new Set(blacklistRows.map((row) => row.galaxyExternalId))
    );
    const paperByBlacklistedExternalId = await mapBlacklistedIdsToPaper(
      ctx,
      uniqueBlacklistedExternalIds
    );

    const blacklistedPerPaper: Record<string, number> = {};
    for (const row of blacklistRows) {
      const paper = paperByBlacklistedExternalId[row.galaxyExternalId] ?? "";
      blacklistedPerPaper[paper] = (blacklistedPerPaper[paper] ?? 0) + 1;
    }

    // Count galaxies per paper via aggregate.
    const paperCountsRaw = await Promise.all(
      allPapers.map(async (paper) => {
        const total = await galaxiesByPaper.count(ctx, {
          bounds: {
            lower: { key: paper, inclusive: true },
            upper: { key: paper, inclusive: true },
          },
        });
        const blacklisted = blacklistedPerPaper[paper] ?? 0;
        return { paper, total, blacklisted, adjusted: Math.max(total - blacklisted, 0) };
      })
    );
    const paperCounts: Record<string, { total: number; blacklisted: number; adjusted: number }> = {};
    for (const entry of paperCountsRaw) {
      paperCounts[entry.paper] = { total: entry.total, blacklisted: entry.blacklisted, adjusted: entry.adjusted };
    }

    // Paper-specific filter (when a paper is actively selected in the UI).
    let paperFilter: {
      paper: string;
      galaxies: number;
      blacklisted: number;
      adjusted: number;
    } | null = null;

    if (args.paper !== undefined) {
      const paperStr = args.paper;
      // Reuse the counts we already computed if this paper is in allPapers,
      // otherwise do a fresh aggregate lookup.
      const cached = paperCounts[paperStr];
      if (cached) {
        paperFilter = { paper: paperStr, galaxies: cached.total, blacklisted: cached.blacklisted, adjusted: cached.adjusted };
      } else {
        const count = await galaxiesByPaper.count(ctx, {
          bounds: { lower: { key: paperStr, inclusive: true }, upper: { key: paperStr, inclusive: true } },
        });
        const bl = blacklistedPerPaper[paperStr] ?? 0;
        paperFilter = { paper: paperStr, galaxies: count, blacklisted: bl, adjusted: Math.max(count - bl, 0) };
      }
    }

    return {
      totals: {
        galaxies: totalGalaxies,
        classifiedGalaxies,
        unclassifiedGalaxies,
        totalClassifications,
        progress,
        avgClassificationsPerGalaxy,
      },
      recency: {
        classificationsLast7d,
        classificationsLast24h,
        activeClassifiers,
        activePast7d,
        avgClassificationsPerActiveUser,
        dailyCounts: dailyCounts.reverse(),
      },
      classificationStats: {
        flags: {
          awesome: awesomeFlagCount,
          visibleNucleus: visibleNucleusCount,
          failedFitting: failedFittingCount,
          validRedshift: validRedshiftCount,
        },
        lsbClass: {
          nonLSB: lsbClassNonLSB,
          LSB: lsbClassLSB,
        },
        morphology: {
          featureless: morphologyFeatureless,
          irregular: morphologyIrregular,
          spiral: morphologySpiral,
          elliptical: morphologyElliptical,
        },
      },
      topClassifiers,
      timestamp: now,
      paperCounts,
      availablePapers: allPapers,
      paperFilter,
    };
  },
});

// Fast counts for classification flags and categorical fields
export const getClassificationStats = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const globalAwesome = await classificationsByAwesomeFlag.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalVisible = await classificationsByVisibleNucleus.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalFailed = await classificationsByFailedFitting.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalValidRedshift = await classificationsByValidRedshift.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });

    const lsbValues = [-1, 0, 1];
    const morphologyValues = [-1, 0, 1, 2];

    const lsbCounts: Record<number, number> = {};
    for (const val of lsbValues) {
      lsbCounts[val] = await classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const morphologyCounts: Record<number, number> = {};
    for (const val of morphologyValues) {
      morphologyCounts[val] = await classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const totalClassifications = await classificationsByCreated.count(ctx);

    let perUser: null | {
      userId: typeof args.userId;
      total: number;
      awesome: number;
      visibleNucleus: number;
      failedFitting: number;
      validRedshift: number;
      lsb: Record<number, number>;
      morphology: Record<number, number>;
    } = null;

    if (args.userId) {
      const userId = args.userId; // narrow for TS

      const userClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const userLsb: Record<number, number> = { [-1]: 0, 0: 0, 1: 0 };
      const userMorph: Record<number, number> = { [-1]: 0, 0: 0, 1: 0, 2: 0 };

      let awesome = 0;
      let visible = 0;
      let failed = 0;
      let validRedshift = 0;

      for (const c of userClassifications) {
        if (c.awesome_flag) awesome += 1;
        if (c.visible_nucleus) visible += 1;
        if (c.failed_fitting) failed += 1;
        if (c.valid_redshift) validRedshift += 1;
        if (userLsb[c.lsb_class] !== undefined) {
          userLsb[c.lsb_class] += 1;
        }
        if (userMorph[c.morphology] !== undefined) {
          userMorph[c.morphology] += 1;
        }
      }

      perUser = {
        userId,
        total: userClassifications.length,
        awesome,
        visibleNucleus: visible,
        failedFitting: failed,
        validRedshift,
        lsb: userLsb,
        morphology: userMorph,
      };
    }

    return {
      global: {
        total: totalClassifications,
        awesome: globalAwesome,
        visibleNucleus: globalVisible,
        failedFitting: globalFailed,
        validRedshift: globalValidRedshift,
        lsb: lsbCounts,
        morphology: morphologyCounts,
      },
      perUser,
      timestamp: Date.now(),
    };
  },
});
