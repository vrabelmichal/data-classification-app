import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import {
  galaxiesById,
  galaxiesByTotalClassifications,
  classificationsByCreated,
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
      topClassifiers,
      timestamp: now,
    };
  },
});
