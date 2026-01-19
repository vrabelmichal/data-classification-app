import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import {
  galaxiesById,
  galaxiesByTotalClassifications,
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

async function getTopClassifiers(ctx: any, limit: number) {
  const totalProfiles = await userProfilesByClassificationsCount.count(ctx);
  const take = Math.min(limit, totalProfiles);
  const results: Array<{
    userId: Id<"users">;
    profileId: Id<"userProfiles">;
    name?: string | null;
    email?: string | null;
    classifications: number;
    lastActiveAt?: number;
  }> = [];

  for (let i = 0; i < take; i++) {
    const item = await userProfilesByClassificationsCount.at(ctx, totalProfiles - 1 - i);
    const profile = await ctx.db.get(item.id as Id<"userProfiles">);
    if (!profile) continue;
    const user = await ctx.db.get(profile.userId);
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
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;
    const oneDayAgo = now - DAY_MS;

    const [
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
    ] = await Promise.all([
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

    const unclassifiedGalaxies = Math.max(totalGalaxies - classifiedGalaxies, 0);
    const progress = totalGalaxies > 0 ? (classifiedGalaxies / totalGalaxies) * 100 : 0;
    const avgClassificationsPerGalaxy = totalGalaxies > 0 ? totalClassifications / totalGalaxies : 0;
    const avgClassificationsPerActiveUser = activeClassifiers > 0 ? totalClassifications / activeClassifiers : 0;

    const dailyCounts = await Promise.all(
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

    const topClassifiers = await getTopClassifiers(ctx, 5);

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
