// convex/galaxies/assignmentStats.ts
// Provides paginated galaxy assignment-distribution statistics for the admin UI.
// Does NOT touch any classification or assignment data – read-only analytics only.

import { internalQuery, action, query } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { galaxyIdsAggregate } from "./aggregates";
import { DEFAULT_AVAILABLE_PAPERS } from "../lib/defaults";

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

/** Loads all blacklisted galaxy external IDs in one shot (blacklist is small). */
export const loadBlacklistedIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const rows = await ctx.db.query("galaxyBlacklist").collect();
    return rows.map((r) => r.galaxyExternalId);
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
    // undefined = all papers; array = only these misc.paper values
    // use "" to match galaxies where misc.paper is absent/empty
    paperFilter: v.optional(v.array(v.string())),
    // External IDs to exclude (blacklisted galaxies)
    blacklistedIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: args.batchSize,
        cursor: args.cursor ?? null,
      });

    const paperSet =
      args.paperFilter && args.paperFilter.length > 0
        ? new Set(args.paperFilter)
        : null; // null = no paper filter

    const blacklistSet =
      args.blacklistedIds && args.blacklistedIds.length > 0
        ? new Set(args.blacklistedIds)
        : null;

    // Build a frequency map: totalAssigned value → count of galaxies in this batch
    const counts: Record<number, number> = {};
    let skippedCount = 0;

    for (const doc of result.page) {
      // Blacklist exclusion
      if (blacklistSet && blacklistSet.has(doc.id)) {
        skippedCount++;
        continue;
      }
      // Paper filter – treat absent misc.paper as ""
      if (paperSet !== null) {
        const paper = doc.misc?.paper ?? "";
        if (!paperSet.has(paper)) {
          skippedCount++;
          continue;
        }
      }
      const n = Number(doc.totalAssigned ?? 0);
      counts[n] = (counts[n] ?? 0) + 1;
    }

    return {
      counts,
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
      batchCount: result.page.length,
      skippedCount,
    };
  },
});

// ----------------------------------------------------------------------------
// Public query: quick summary (no heavy scan)
// ----------------------------------------------------------------------------

/**
 * Returns the total galaxy count from the aggregate (cheap, cached),
 * plus the list of available papers from system settings and blacklist size.
 * The caller must be an admin.
 */
export const getAssignmentStatsSummary = query({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      return {
        authorized: false,
        totalGalaxies: null,
        availablePapers: [] as string[],
        blacklistedCount: 0,
      };
    }

    let totalGalaxies: number | null = null;
    try {
      totalGalaxies = await galaxyIdsAggregate.count(ctx);
    } catch {
      /* aggregate may not be built yet */
    }

    const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
    const availablePapers: string[] =
      (settings as any)?.availablePapers ?? DEFAULT_AVAILABLE_PAPERS;

    const blacklistedCount = (await ctx.db.query("galaxyBlacklist").collect()).length;

    return { authorized: true, totalGalaxies, availablePapers, blacklistedCount };
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
  skippedCount: number;
  totalGalaxies: number | null;
  /** Populated on the first call when excludeBlacklisted=true so the caller
   *  can cache and pass it back on subsequent calls to avoid reloading. */
  blacklistedIds?: string[];
};

/**
 * Processes one paginated batch of galaxies and returns per-bucket frequency
 * counts plus a cursor for the next batch.
 *
 * Pass `paperFilter` to restrict to specific misc.paper values (use `""` for
 * galaxies with no paper).  Pass `excludeBlacklisted: true` to skip blacklisted
 * galaxies.  On the first call the blacklist is loaded and returned; subsequent
 * calls should pass `blacklistedIds` directly to avoid reloading.
 */
export const computeHistogramBatch = action({
  args: {
    cursor: v.optional(v.string()),
    /** Max galaxies to process per call.  Capped at 5000 for safety. */
    batchSize: v.optional(v.number()),
    /** Filter to these misc.paper values only.  undefined = all papers. */
    paperFilter: v.optional(v.array(v.string())),
    /** Pre-loaded blacklisted IDs (pass from first-call response onward). */
    blacklistedIds: v.optional(v.array(v.string())),
    /** If true AND blacklistedIds not yet provided, load them on this call. */
    excludeBlacklisted: v.optional(v.boolean()),
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

    // Load blacklist on the first call if requested
    let blacklistedIds: string[] | undefined = args.blacklistedIds;
    if (args.excludeBlacklisted && !blacklistedIds) {
      blacklistedIds = await ctx.runQuery(
        internal.galaxies.assignmentStats.loadBlacklistedIds,
        {}
      );
    }

    const batchSize = Math.min(args.batchSize ?? 5000, 5000);

    const result: {
      counts: Record<number, number>;
      nextCursor: string | null;
      isDone: boolean;
      batchCount: number;
      skippedCount: number;
    } = await ctx.runQuery(internal.galaxies.assignmentStats.getGalaxyStatsBatch, {
      cursor: args.cursor,
      batchSize,
      paperFilter: args.paperFilter,
      blacklistedIds,
    });

    return {
      counts: result.counts as Record<string, number>,
      nextCursor: result.nextCursor,
      isDone: result.isDone,
      batchCount: result.batchCount,
      skippedCount: result.skippedCount,
      totalGalaxies,
      // Return blacklistedIds so the caller can cache and reuse them
      blacklistedIds: args.excludeBlacklisted ? blacklistedIds : undefined,
    };
  },
});
