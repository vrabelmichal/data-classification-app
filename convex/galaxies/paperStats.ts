// convex/galaxies/paperStats.ts
// Reusable per-paper galaxy statistics for admin widgets/pages.

import { action, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { galaxyIdsAggregate } from "./aggregates";
import { DEFAULT_AVAILABLE_PAPERS } from "../lib/defaults";

type PaperStatsBatchResult = {
  countsAll: Record<string, number>;
  countsExcludingBlacklisted: Record<string, number>;
  nextCursor: string | null;
  isDone: boolean;
  batchCount: number;
  totalGalaxies: number | null;
  blacklistedIds?: string[];
};

/** Loads all blacklisted galaxy external IDs in one shot (blacklist is small). */
export const loadBlacklistedIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const rows = await ctx.db.query("galaxyBlacklist").collect();
    return rows.map((r) => r.galaxyExternalId);
  },
});

/**
 * Paginates through galaxies and returns per-paper counts for this batch,
 * both including and excluding blacklisted galaxies.
 */
export const getPaperStatsBatch = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
    blacklistedIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: args.batchSize,
        cursor: args.cursor ?? null,
      });

    const blacklistSet =
      args.blacklistedIds && args.blacklistedIds.length > 0
        ? new Set(args.blacklistedIds)
        : null;

    const countsAll: Record<string, number> = {};
    const countsExcludingBlacklisted: Record<string, number> = {};

    for (const doc of result.page) {
      const paper = doc.misc?.paper ?? "";
      countsAll[paper] = (countsAll[paper] ?? 0) + 1;

      if (!blacklistSet || !blacklistSet.has(doc.id)) {
        countsExcludingBlacklisted[paper] =
          (countsExcludingBlacklisted[paper] ?? 0) + 1;
      }
    }

    return {
      countsAll,
      countsExcludingBlacklisted,
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
      batchCount: result.page.length,
    };
  },
});

/**
 * Lightweight summary for per-paper widget bootstrap.
 * Does not scan galaxies.
 */
export const getPaperStatsSummary = query({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      return {
        authorized: false,
        totalGalaxies: null,
        availablePapers: [] as string[],
        blacklistedCount: 0,
        paperTotals: {} as Record<string, number>,
        paperTotalsExcludingBlacklisted: {} as Record<string, number>,
        paperStatsComputed: false,
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

    return {
      authorized: true,
      totalGalaxies,
      availablePapers,
      blacklistedCount,
      paperTotals: {} as Record<string, number>,
      paperTotalsExcludingBlacklisted: {} as Record<string, number>,
      paperStatsComputed: false,
    };
  },
});

/**
 * Computes one paginated batch of per-paper totals, with and without blacklist exclusion.
 */
export const computePaperStatsBatch = action({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    blacklistedIds: v.optional(v.array(v.string())),
    excludeBlacklisted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<PaperStatsBatchResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    let totalGalaxies: number | null = null;
    try {
      totalGalaxies = await galaxyIdsAggregate.count(ctx);
    } catch {
      /* aggregate may not be built yet */
    }

    let blacklistedIds: string[] | undefined = args.blacklistedIds;
    if (args.excludeBlacklisted && !blacklistedIds) {
      blacklistedIds = await ctx.runQuery(internal.galaxies.paperStats.loadBlacklistedIds, {});
    }

    const batchSize = Math.min(args.batchSize ?? 5000, 5000);

    const result: {
      countsAll: Record<string, number>;
      countsExcludingBlacklisted: Record<string, number>;
      nextCursor: string | null;
      isDone: boolean;
      batchCount: number;
    } = await ctx.runQuery(internal.galaxies.paperStats.getPaperStatsBatch, {
      cursor: args.cursor,
      batchSize,
      blacklistedIds,
    });

    return {
      countsAll: result.countsAll,
      countsExcludingBlacklisted: result.countsExcludingBlacklisted,
      nextCursor: result.nextCursor,
      isDone: result.isDone,
      batchCount: result.batchCount,
      totalGalaxies,
      blacklistedIds: args.excludeBlacklisted ? blacklistedIds : undefined,
    };
  },
});
