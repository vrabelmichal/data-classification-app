import { query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { classificationsByCreated, galaxiesById, galaxiesByTotalClassifications } from "../../galaxies/aggregates";
import { getPaperCountsPayload } from "./shared";

// Batch size for getPaperClassificationStats pagination.
// Kept small enough to stay well under the 1 s query deadline per page.
const PAPER_CLASSIFICATION_PAGE_SIZE = 1000;

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
      // Global totals from fast aggregates.
      [totalGalaxies, classifiedGalaxies, totalClassifications] = await Promise.all([
        galaxiesById.count(ctx),
        galaxiesByTotalClassifications.count(ctx, {
          bounds: {
            lower: { key: 1, inclusive: true },
            upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
          },
        }),
        classificationsByCreated.count(ctx),
      ]);
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
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .withIndex("by_misc_paper", (q) => q.eq("misc.paper", args.paper))
      .paginate({ numItems: PAPER_CLASSIFICATION_PAGE_SIZE, cursor: args.cursor ?? null });

    let classifiedGalaxies = 0;
    let totalClassifications = 0;
    for (const g of page) {
      const tc = Number(g.totalClassifications ?? 0);
      if (tc > 0) classifiedGalaxies++;
      totalClassifications += tc;
    }

    return {
      classifiedGalaxies,
      totalClassifications,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});
