import { query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { classificationsByCreated, galaxiesById, galaxiesByTotalClassifications } from "../../galaxies/aggregates";
import { getPaperCountsPayload } from "./shared";

export const get = query({
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

    const [
      totalGalaxies,
      classifiedGalaxies,
      totalClassifications,
      paperPayload,
    ] = await Promise.all([
      galaxiesById.count(ctx),
      galaxiesByTotalClassifications.count(ctx, {
        bounds: {
          lower: { key: 1, inclusive: true },
          upper: { key: Number.MAX_SAFE_INTEGER - 1, inclusive: true },
        },
      }),
      classificationsByCreated.count(ctx),
      getPaperCountsPayload(ctx, args.paper),
    ]);

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
