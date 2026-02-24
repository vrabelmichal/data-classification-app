import { action, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { galaxiesById, galaxiesByNumericId, galaxyIdsAggregate } from "./aggregates";

type DiagnosticsBatchResult = {
  table: "galaxies" | "galaxyIds";
  batchCount: number;
  nextCursor: string | null;
  isDone: boolean;
  missingNumericIdInBatch?: number;
};

export const getGalaxyCountDiagnosticsSummary = query({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      return {
        authorized: false,
        blacklistedCount: 0,
        aggregateCounts: {
          galaxyIdsAggregate: null as number | null,
          galaxiesById: null as number | null,
          galaxiesByNumericId: null as number | null,
        },
      };
    }

    let galaxyIdsAggregateCount: number | null = null;
    let galaxiesByIdCount: number | null = null;
    let galaxiesByNumericIdCount: number | null = null;

    try {
      galaxyIdsAggregateCount = await galaxyIdsAggregate.count(ctx);
    } catch {
      galaxyIdsAggregateCount = null;
    }

    try {
      galaxiesByIdCount = await galaxiesById.count(ctx);
    } catch {
      galaxiesByIdCount = null;
    }

    try {
      galaxiesByNumericIdCount = await galaxiesByNumericId.count(ctx);
    } catch {
      galaxiesByNumericIdCount = null;
    }

    const blacklistedCount = (await ctx.db.query("galaxyBlacklist").collect()).length;

    return {
      authorized: true,
      blacklistedCount,
      aggregateCounts: {
        galaxyIdsAggregate: galaxyIdsAggregateCount,
        galaxiesById: galaxiesByIdCount,
        galaxiesByNumericId: galaxiesByNumericIdCount,
      },
    };
  },
});

export const getCountDiagnosticsBatch = internalQuery({
  args: {
    table: v.union(v.literal("galaxies"), v.literal("galaxyIds")),
    cursor: v.optional(v.string()),
    batchSize: v.number(),
  },
  handler: async (ctx, args): Promise<DiagnosticsBatchResult> => {
    if (args.table === "galaxies") {
      const result = await ctx.db
        .query("galaxies")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      let missingNumericIdInBatch = 0;
      for (const row of result.page) {
        if (row.numericId === undefined || row.numericId === null) {
          missingNumericIdInBatch += 1;
        }
      }

      return {
        table: "galaxies",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
        missingNumericIdInBatch,
      };
    }

    const result = await ctx.db
      .query("galaxyIds")
      .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

    return {
      table: "galaxyIds",
      batchCount: result.page.length,
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const computeCountDiagnosticsBatch = action({
  args: {
    table: v.union(v.literal("galaxies"), v.literal("galaxyIds")),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DiagnosticsBatchResult> => {
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      throw new Error("Not authorized");
    }

    const batchSize = Math.min(args.batchSize ?? 5000, 5000);

    const result: DiagnosticsBatchResult = await ctx.runQuery(
      internal.galaxies.countDiagnostics.getCountDiagnosticsBatch,
      {
        table: args.table,
        cursor: args.cursor,
        batchSize,
      }
    );

    return result;
  },
});
