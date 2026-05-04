import { query, internalQuery, type QueryCtx } from "../../_generated/server";
import { v } from "convex/values";
import { requirePermission } from "../../lib/auth";
import { classificationsByCreated, galaxiesById, galaxiesByTotalClassifications } from "../../galaxies/aggregates";
import { getPaperCountsPayload, getUniqueBlacklistedGalaxyExternalIds } from "./shared";
import { MAX_TARGET_CLASSIFICATIONS, OVERVIEW_BUCKET_COUNT } from "./cacheValidators";

// Batch size for getPaperClassificationStats pagination.
// Kept small enough to stay well under the 1 s query deadline per page.
const PAPER_CLASSIFICATION_PAGE_SIZE = 1000;

type GalaxyClassificationRow = {
  id: string;
  totalClassifications?: number | bigint | null;
};

function clampTargetClassifications(targetClassifications: number) {
  if (!Number.isFinite(targetClassifications)) {
    return 1;
  }

  return Math.min(MAX_TARGET_CLASSIFICATIONS, Math.max(1, Math.floor(targetClassifications)));
}

export function buildClassificationBucketsFromHistogram(
  classificationHistogram: Record<string, number>
) {
  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, () => 0);

  for (const [classificationCountKey, galaxyCount] of Object.entries(classificationHistogram)) {
    const classificationCount = Number(classificationCountKey);
    if (!Number.isFinite(classificationCount) || galaxyCount <= 0) {
      continue;
    }

    if (classificationCount >= MAX_TARGET_CLASSIFICATIONS) {
      buckets[OVERVIEW_BUCKET_COUNT - 1] += galaxyCount;
      continue;
    }

    buckets[Math.max(0, Math.floor(classificationCount))] += galaxyCount;
  }

  return buckets;
}

function bucketIndexForClassificationCount(classificationCount: number) {
  if (!Number.isFinite(classificationCount) || classificationCount <= 0) {
    return 0;
  }

  if (classificationCount >= MAX_TARGET_CLASSIFICATIONS) {
    return OVERVIEW_BUCKET_COUNT - 1;
  }

  return Math.max(0, Math.floor(classificationCount));
}

export function summarizeClassificationRows(
  rows: GalaxyClassificationRow[],
  blacklistedIds?: Iterable<string>
) {
  const blacklistedIdSet = blacklistedIds ? new Set(blacklistedIds) : null;
  let classifiedGalaxies = 0;
  let totalClassifications = 0;
  let processedGalaxies = 0;
  const classificationHistogram: Record<string, number> = {};

  for (const row of rows) {
    if (blacklistedIdSet?.has(row.id)) {
      continue;
    }

    processedGalaxies += 1;
    const tc = Number(row.totalClassifications ?? 0);
    if (tc > 0) {
      classifiedGalaxies += 1;
    }
    totalClassifications += tc;
    const histogramKey = String(tc);
    classificationHistogram[histogramKey] = (classificationHistogram[histogramKey] ?? 0) + 1;
  }

  return {
    classifiedGalaxies,
    totalClassifications,
    processedGalaxies,
    classificationHistogram,
  };
}

async function loadBlacklistedGalaxyRows(
  ctx: any
): Promise<Array<GalaxyClassificationRow>> {
  const blacklistedExternalIds = await getUniqueBlacklistedGalaxyExternalIds(ctx);
  if (blacklistedExternalIds.length === 0) {
    return [];
  }

  const galaxies = await Promise.all(
    blacklistedExternalIds.map(async (externalId) =>
      ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q: any) => q.eq("id", externalId))
        .unique()
    )
  );

  return galaxies
    .filter((galaxy): galaxy is NonNullable<typeof galaxy> => galaxy !== null)
    .map((galaxy) => ({
      id: galaxy.id,
      totalClassifications: galaxy.totalClassifications,
    }));
}

export async function loadGlobalTotals(
  ctx: Parameters<typeof galaxiesById.count>[0]
) {
  const [rawTotalGalaxies, rawClassifiedGalaxies, rawTotalClassifications, blacklistedGalaxies] = await Promise.all([
    galaxiesById.count(ctx),
    galaxiesByTotalClassifications.count(ctx, {
      bounds: {
        lower: { key: 1, inclusive: true },
        upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
      },
    }),
    classificationsByCreated.count(ctx),
    loadBlacklistedGalaxyRows(ctx),
  ]);

  const blacklistedGalaxyCount = blacklistedGalaxies.length;
  const blacklistedClassifiedCount = blacklistedGalaxies.reduce(
    (sum, galaxy) => sum + (Number(galaxy.totalClassifications ?? 0) > 0 ? 1 : 0),
    0
  );
  const blacklistedTotalClassifications = blacklistedGalaxies.reduce(
    (sum, galaxy) => sum + Number(galaxy.totalClassifications ?? 0),
    0
  );

  const totalGalaxies = Math.max(rawTotalGalaxies - blacklistedGalaxyCount, 0);
  const classifiedGalaxies = Math.max(rawClassifiedGalaxies - blacklistedClassifiedCount, 0);
  const totalClassifications = Math.max(
    rawTotalClassifications - blacklistedTotalClassifications,
    0
  );

  const unclassifiedGalaxies = Math.max(totalGalaxies - classifiedGalaxies, 0);
  const progress = totalGalaxies > 0 ? (classifiedGalaxies / totalGalaxies) * 100 : 0;
  const avgClassificationsPerGalaxy = totalGalaxies > 0 ? totalClassifications / totalGalaxies : 0;

  return {
    galaxies: totalGalaxies,
    classifiedGalaxies,
    unclassifiedGalaxies,
    totalClassifications,
    progress,
    avgClassificationsPerGalaxy,
  };
}

export async function loadGlobalClassificationBuckets(
  ctx: Parameters<typeof galaxiesByTotalClassifications.count>[0]
) {
  const [exactCounts, atOrAboveTarget, blacklistedGalaxies] = await Promise.all([
    Promise.all(
    Array.from({ length: MAX_TARGET_CLASSIFICATIONS }, (_, classificationCount) =>
      galaxiesByTotalClassifications
        .count(ctx, { bounds: exactClassificationCountBounds(classificationCount) })
        .then((count) => ({ classificationCount, count }))
    )
    ),
    galaxiesByTotalClassifications.count(ctx, {
      bounds: {
        lower: { key: MAX_TARGET_CLASSIFICATIONS, inclusive: true },
        upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
      },
    }),
    loadBlacklistedGalaxyRows(ctx),
  ]);

  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, () => 0);
  for (const entry of exactCounts) {
    buckets[entry.classificationCount] = entry.count;
  }
  buckets[OVERVIEW_BUCKET_COUNT - 1] = atOrAboveTarget;

  for (const galaxy of blacklistedGalaxies) {
    const bucketIndex = bucketIndexForClassificationCount(
      Number(galaxy.totalClassifications ?? 0)
    );
    buckets[bucketIndex] = Math.max(buckets[bucketIndex] - 1, 0);
  }

  return buckets;
}

export async function queryPaperClassificationStatsPage(
  ctx: QueryCtx,
  args: { paper: string; cursor?: string; blacklistedIds?: string[] }
) {
  const { page, isDone, continueCursor } = await ctx.db
    .query("galaxies")
    .withIndex("by_misc_paper", (q) => q.eq("misc.paper", args.paper))
    .paginate({ numItems: PAPER_CLASSIFICATION_PAGE_SIZE, cursor: args.cursor ?? null });

  const blacklistedIds =
    args.blacklistedIds
    ?? await getUniqueBlacklistedGalaxyExternalIds(ctx);
  const summary = summarizeClassificationRows(page, blacklistedIds);

  return {
    classifiedGalaxies: summary.classifiedGalaxies,
    totalClassifications: summary.totalClassifications,
    processedGalaxies: summary.processedGalaxies,
    classificationHistogram: summary.classificationHistogram,
    isDone,
    continueCursor: isDone ? null : continueCursor,
  };
}

function exactClassificationCountBounds(classificationCount: number) {
  return {
    lower: { key: classificationCount, inclusive: true },
    upper: { key: classificationCount, inclusive: true },
  } as const;
}

export const get = query({
  args: {
    paper: v.optional(v.string()),
  },
  returns: v.object({
    totals: v.object({
      galaxies: v.number(),
      // NOTE: when `paper` is specified, classifiedGalaxies / totalClassifications are
      // always returned as 0. The client must accumulate these via the separate
      // `getPaperClassificationStats` paginated query (see below).
      classifiedGalaxies: v.number(),
      unclassifiedGalaxies: v.number(),
      totalClassifications: v.number(),
      progress: v.number(),
      avgClassificationsPerGalaxy: v.number(),
    }),
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
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewLiveOverviewStatistics", {
      notAuthorizedMessage: "Not authorized",
    });

    let totalGalaxies: number;
    let classifiedGalaxies: number;
    let totalClassifications: number;

    const paperPayload = await getPaperCountsPayload(ctx, args.paper);

    if (args.paper !== undefined) {
      // Paper-specific totals: galaxy count comes from the aggregate (fast, O(log n)).
      // Classification stats (classifiedGalaxies, totalClassifications) are intentionally
      // skipped here — a full table scan via .collect() easily hits the 1 s query
      // deadline for large catalogues.  The client side fetches these incrementally
      // via `getPaperClassificationStats` below and merges them into the display.
      totalGalaxies = paperPayload.paperFilter?.adjusted ?? 0;
      classifiedGalaxies = 0;
      totalClassifications = 0;
    } else {
      const totals = await loadGlobalTotals(ctx);
      totalGalaxies = totals.galaxies;
      classifiedGalaxies = totals.classifiedGalaxies;
      totalClassifications = totals.totalClassifications;
    }

    const unclassifiedGalaxies = Math.max(totalGalaxies - classifiedGalaxies, 0);
    const progress = totalGalaxies > 0 ? (classifiedGalaxies / totalGalaxies) * 100 : 0;
    const avgClassificationsPerGalaxy = totalGalaxies > 0 ? totalClassifications / totalGalaxies : 0;

    return {
      totals: {
        galaxies: totalGalaxies,
        classifiedGalaxies,
        unclassifiedGalaxies,
        totalClassifications,
        progress,
        avgClassificationsPerGalaxy,
      },
      paperCounts: paperPayload.paperCounts,
      availablePapers: paperPayload.availablePapers,
      paperFilter: paperPayload.paperFilter,
      timestamp: Date.now(),
    };
  },
});

/**
 * Paginated query that accumulates per-paper classification statistics one page
 * at a time.  Each call reads at most PAPER_CLASSIFICATION_PAGE_SIZE galaxy
 * documents (only the `totalClassifications` field is used), so it comfortably
 * stays under the 1 s query deadline.
 *
 * The caller is responsible for looping until `isDone === true`, summing the
 * `classifiedGalaxies` and `totalClassifications` fields across all pages.
 *
 * On the frontend, `usePaperClassificationStats` in
 * `src/hooks/usePaperClassificationStats.ts` drives this loop.
 */
export const getPaperClassificationStats = query({
  args: {
    paper: v.string(),
    cursor: v.optional(v.string()),
    blacklistedIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    classifiedGalaxies: v.number(),
    totalClassifications: v.number(),
    processedGalaxies: v.number(),
    classificationHistogram: v.record(v.string(), v.number()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewLiveOverviewStatistics", {
      notAuthorizedMessage: "Not authorized",
    });
    return await queryPaperClassificationStatsPage(ctx, args);
  },
});

export const getPaperClassificationStatsPageInternal = internalQuery({
  args: {
    paper: v.string(),
    cursor: v.optional(v.string()),
    blacklistedIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    classifiedGalaxies: v.number(),
    totalClassifications: v.number(),
    processedGalaxies: v.number(),
    classificationHistogram: v.record(v.string(), v.number()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    return await queryPaperClassificationStatsPage(ctx, args);
  },
});

export const getTargetProgress = query({
  args: {
    targetClassifications: v.number(),
  },
  returns: v.object({
    targetProgress: v.object({
      targetClassifications: v.number(),
      targetClassificationsTotal: v.number(),
      targetCompletionPercent: v.number(),
      galaxiesAtTarget: v.number(),
      galaxiesBelowTarget: v.number(),
      galaxiesWithMultipleClassifications: v.number(),
      repeatClassifications: v.number(),
      remainingClassificationsToTarget: v.number(),
    }),
    classificationBuckets: v.array(v.number()),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewLiveOverviewStatistics", {
      notAuthorizedMessage: "Not authorized",
    });

    const targetClassifications = clampTargetClassifications(args.targetClassifications);

    const [totals, classificationBuckets] = await Promise.all([
      loadGlobalTotals(ctx),
      loadGlobalClassificationBuckets(ctx),
    ]);

    const totalGalaxies = totals.galaxies;
    const classifiedGalaxies = totals.classifiedGalaxies;
    const totalClassifications = totals.totalClassifications;
    const galaxiesWithMultipleClassifications = classificationBuckets
      .slice(2)
      .reduce((sum, count) => sum + count, 0);
    const galaxiesAtTarget = classificationBuckets
      .slice(targetClassifications)
      .reduce((sum, count) => sum + count, 0);

    const targetClassificationsTotal = totalGalaxies * targetClassifications;
    const targetCompletionPercent =
      targetClassificationsTotal > 0
        ? (totalClassifications / targetClassificationsTotal) * 100
        : 0;
    const remainingClassificationsToTarget = classificationBuckets
      .slice(0, targetClassifications)
      .reduce(
        (sum, count, classificationCount) =>
          sum + (targetClassifications - classificationCount) * count,
        0
      );

    return {
      targetProgress: {
        targetClassifications,
        targetClassificationsTotal,
        targetCompletionPercent,
        galaxiesAtTarget,
        galaxiesBelowTarget: Math.max(totalGalaxies - galaxiesAtTarget, 0),
        galaxiesWithMultipleClassifications,
        repeatClassifications: Math.max(totalClassifications - classifiedGalaxies, 0),
        remainingClassificationsToTarget,
      },
      classificationBuckets,
      timestamp: Date.now(),
    };
  },
});
