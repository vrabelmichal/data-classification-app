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

    let totalGalaxies: number;
    let classifiedGalaxies: number;
    let totalClassifications: number;

    const paperPayload = await getPaperCountsPayload(ctx, args.paper);

    if (args.paper !== undefined) {
      // Paper-specific totals: use the aggregate count for total galaxies (normalises
      // undefined paper as "") and scan the by_misc_paper index for classification stats.
      totalGalaxies = paperPayload.paperFilter?.galaxies ?? 0;

      // Scan galaxies belonging to this paper to derive classification counts.
      // Note: the by_misc_paper index stores the literal misc.paper value, so galaxies
      // where misc.paper is undefined are NOT matched by q.eq("misc.paper", "").
      // For named (non-empty) papers this is correct; for paper=="" there may be a slight
      // undercount of classified/total vs the aggregate-based galaxy total.
      const galaxiesInPaper = await ctx.db
        .query("galaxies")
        .withIndex("by_misc_paper", (q) => q.eq("misc.paper", args.paper))
        .collect();

      classifiedGalaxies = 0;
      totalClassifications = 0;
      for (const g of galaxiesInPaper) {
        const tc = Number(g.totalClassifications ?? 0);
        if (tc > 0) classifiedGalaxies++;
        totalClassifications += tc;
      }
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
