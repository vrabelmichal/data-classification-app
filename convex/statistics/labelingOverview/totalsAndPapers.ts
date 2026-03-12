import { query, internalQuery, type QueryCtx } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { classificationsByCreated, galaxiesById, galaxiesByTotalClassifications } from "../../galaxies/aggregates";
import { getPaperCountsPayload } from "./shared";
import { MAX_TARGET_CLASSIFICATIONS, OVERVIEW_BUCKET_COUNT } from "./cacheValidators";

// Batch size for getPaperClassificationStats pagination.
// Kept small enough to stay well under the 1 s query deadline per page.
const PAPER_CLASSIFICATION_PAGE_SIZE = 1000;
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

export async function loadGlobalTotals(
  ctx: Parameters<typeof galaxiesById.count>[0]
) {
  const [totalGalaxies, classifiedGalaxies, totalClassifications] = await Promise.all([
    galaxiesById.count(ctx),
    galaxiesByTotalClassifications.count(ctx, {
      bounds: {
        lower: { key: 1, inclusive: true },
        upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
      },
    }),
    classificationsByCreated.count(ctx),
  ]);

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
  const exactCounts = await Promise.all(
    Array.from({ length: MAX_TARGET_CLASSIFICATIONS }, (_, classificationCount) =>
      galaxiesByTotalClassifications
        .count(ctx, { bounds: exactClassificationCountBounds(classificationCount) })
        .then((count) => ({ classificationCount, count }))
    )
  );

  const atOrAboveTarget = await galaxiesByTotalClassifications.count(ctx, {
    bounds: {
      lower: { key: MAX_TARGET_CLASSIFICATIONS, inclusive: true },
      upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
    },
  });

  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, () => 0);
  for (const entry of exactCounts) {
    buckets[entry.classificationCount] = entry.count;
  }
  buckets[OVERVIEW_BUCKET_COUNT - 1] = atOrAboveTarget;
  return buckets;
}

export async function queryPaperClassificationStatsPage(
  ctx: QueryCtx,
  args: { paper: string; cursor?: string }
) {
  const { page, isDone, continueCursor } = await ctx.db
    .query("galaxies")
    .withIndex("by_misc_paper", (q) => q.eq("misc.paper", args.paper))
    .paginate({ numItems: PAPER_CLASSIFICATION_PAGE_SIZE, cursor: args.cursor ?? null });

  let classifiedGalaxies = 0;
  let totalClassifications = 0;
  const classificationHistogram: Record<string, number> = {};
  for (const g of page) {
    const tc = Number(g.totalClassifications ?? 0);
    if (tc > 0) classifiedGalaxies++;
    totalClassifications += tc;
    const histogramKey = String(tc);
    classificationHistogram[histogramKey] = (classificationHistogram[histogramKey] ?? 0) + 1;
  }

  return {
    classifiedGalaxies,
    totalClassifications,
    processedGalaxies: page.length,
    classificationHistogram,
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
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

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
      totalGalaxies = paperPayload.paperFilter?.galaxies ?? 0;
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
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });
    return await queryPaperClassificationStatsPage(ctx, args);
  },
});

export const getPaperClassificationStatsPageInternal = internalQuery({
  args: {
    paper: v.string(),
    cursor: v.optional(v.string()),
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
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

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
