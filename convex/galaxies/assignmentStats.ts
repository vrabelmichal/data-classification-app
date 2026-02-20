// convex/galaxies/assignmentStats.ts
// Provides paginated galaxy assignment-distribution statistics for the admin UI.
// Does NOT touch any classification or assignment data – read-only analytics only.

import { internalQuery, action, query } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { galaxyIdsAggregate } from "./aggregates";

// ----------------------------------------------------------------------------
// Internal helpers (not directly callable from the browser)
// ----------------------------------------------------------------------------

/** Returns the total number of galaxies from the galaxyIds aggregate. */
export const getTotalGalaxyCount = internalQuery({
  args: {},
  handler: async (ctx): Promise<number | null> => {
    try {
      return await galaxyIdsAggregate.count(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * Paginates through the galaxies table and returns per-totalAssigned counts
 * for the current batch plus a cursor for the next call.
 *
 * Results are ordered by Convex's default _creationTime ordering –
 * this is stable and covers every galaxy in the table.
 */
export const getGalaxyStatsBatch = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: args.batchSize,
        cursor: args.cursor ?? null,
      });

    // Build a frequency map: totalAssigned value → count of galaxies in this batch
    const counts: Record<number, number> = {};
    for (const doc of result.page) {
      const n = Number(doc.totalAssigned ?? 0);
      counts[n] = (counts[n] ?? 0) + 1;
    }

    return {
      counts,
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
      batchCount: result.page.length,
    };
  },
});

// ----------------------------------------------------------------------------
// Public query: quick summary (no heavy scan)
// ----------------------------------------------------------------------------

/**
 * Returns the total galaxy count from the aggregate (cheap, cached).
 * The caller must be an admin.
 */
export const getAssignmentStatsSummary = query({
  args: {},
  handler: async (ctx) => {
    // Use the users helper to determine role – avoids importing requireAdmin
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      return { authorized: false, totalGalaxies: null };
    }

    let totalGalaxies: number | null = null;
    try {
      totalGalaxies = await galaxyIdsAggregate.count(ctx);
    } catch {
      /* aggregate may not be built yet */
    }

    return { authorized: true, totalGalaxies };
  },
});

// ----------------------------------------------------------------------------
// Public action: one batch of the histogram computation
// ----------------------------------------------------------------------------

type HistogramBatchResult = {
  counts: Record<string, number>;
  nextCursor: string | null;
  isDone: boolean;
  batchCount: number;
  totalGalaxies: number | null;
};

/**
 * Processes one paginated batch of galaxies and returns the per-bucket
 * frequency counts plus a cursor for the next batch and overall progress info.
 *
 * Call this action repeatedly from the frontend, passing `nextCursor` from
 * the previous call.  When `isDone` is true the full histogram is complete.
 */
export const computeHistogramBatch = action({
  args: {
    cursor: v.optional(v.string()),
    /** Max galaxies to process per call.  Capped at 5000 for safety. */
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<HistogramBatchResult> => {
    // Admin guard
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Cheap total count for progress display
    const totalGalaxies: number | null = await ctx.runQuery(
      internal.galaxies.assignmentStats.getTotalGalaxyCount,
      {}
    );

    const batchSize = Math.min(args.batchSize ?? 5000, 5000);

    const result: {
      counts: Record<number, number>;
      nextCursor: string | null;
      isDone: boolean;
      batchCount: number;
    } = await ctx.runQuery(
      internal.galaxies.assignmentStats.getGalaxyStatsBatch,
      { cursor: args.cursor, batchSize }
    );

    return {
      counts: result.counts as Record<string, number>,
      nextCursor: result.nextCursor,
      isDone: result.isDone,
      batchCount: result.batchCount,
      totalGalaxies,
    };
  },
});
