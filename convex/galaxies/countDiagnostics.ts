import { action, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import {
  classificationsByCreated,
  galaxiesById,
  galaxiesByNumericId,
  galaxyIdsAggregate,
} from "./aggregates";

const diagnosticsTables = [
  "galaxies",
  "galaxyIds",
  "galaxyBlacklist",
  "galaxies_photometry_g",
  "galaxies_photometry_r",
  "galaxies_photometry_i",
  "galaxies_source_extractor",
  "galaxies_thuruthipilly",
  "classifications",
  "skippedGalaxies",
  "userGalaxyClassifications",
] as const;

type DiagnosticsTable = (typeof diagnosticsTables)[number];

type DiagnosticsBatchResult = {
  table: DiagnosticsTable;
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
        blacklistDetails: {
          uniqueExternalIds: 0,
          presentInGalaxies: 0,
          missingFromGalaxies: 0,
        },
        aggregateCounts: {
          galaxyIdsAggregate: null as number | null,
          galaxiesById: null as number | null,
          galaxiesByNumericId: null as number | null,
          classificationsByCreated: null as number | null,
        },
        derivedCounts: {
          eligibleGalaxiesFromAggregate: null as number | null,
          eligibleGalaxyIdsFromAggregate: null as number | null,
        },
        estimatedTableCounts: {
          galaxies: null as number | null,
          galaxyIds: null as number | null,
          galaxyBlacklist: null as number | null,
          galaxies_photometry_g: null as number | null,
          galaxies_photometry_r: null as number | null,
          galaxies_photometry_i: null as number | null,
          galaxies_source_extractor: null as number | null,
          galaxies_thuruthipilly: null as number | null,
          classifications: null as number | null,
          skippedGalaxies: null as number | null,
          userGalaxyClassifications: null as number | null,
        },
      };
    }

    let galaxyIdsAggregateCount: number | null = null;
    let galaxiesByIdCount: number | null = null;
    let galaxiesByNumericIdCount: number | null = null;
    let classificationsByCreatedCount: number | null = null;

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

    try {
      classificationsByCreatedCount = await classificationsByCreated.count(ctx);
    } catch {
      classificationsByCreatedCount = null;
    }

    const blacklistedRows = await ctx.db.query("galaxyBlacklist").collect();
    const blacklistedCount = blacklistedRows.length;

    const blacklistedUniqueExternalIds = new Set(
      blacklistedRows.map((row) => row.galaxyExternalId)
    );

    let blacklistedPresentInGalaxies = 0;
    for (const externalId of blacklistedUniqueExternalIds) {
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", externalId))
        .first();

      if (galaxy) {
        blacklistedPresentInGalaxies += 1;
      }
    }

    const missingFromGalaxies =
      blacklistedUniqueExternalIds.size - blacklistedPresentInGalaxies;

    const eligibleGalaxiesFromAggregate =
      galaxiesByIdCount === null ? null : galaxiesByIdCount - blacklistedPresentInGalaxies;
    const eligibleGalaxyIdsFromAggregate =
      galaxyIdsAggregateCount === null ? null : galaxyIdsAggregateCount - blacklistedPresentInGalaxies;

    return {
      authorized: true,
      blacklistedCount,
      blacklistDetails: {
        uniqueExternalIds: blacklistedUniqueExternalIds.size,
        presentInGalaxies: blacklistedPresentInGalaxies,
        missingFromGalaxies,
      },
      aggregateCounts: {
        galaxyIdsAggregate: galaxyIdsAggregateCount,
        galaxiesById: galaxiesByIdCount,
        galaxiesByNumericId: galaxiesByNumericIdCount,
        classificationsByCreated: classificationsByCreatedCount,
      },
      derivedCounts: {
        eligibleGalaxiesFromAggregate,
        eligibleGalaxyIdsFromAggregate,
      },
      estimatedTableCounts: {
        galaxies: galaxiesByIdCount,
        galaxyIds: galaxyIdsAggregateCount,
        galaxyBlacklist: blacklistedCount,
        galaxies_photometry_g: null,
        galaxies_photometry_r: null,
        galaxies_photometry_i: null,
        galaxies_source_extractor: null,
        galaxies_thuruthipilly: null,
        classifications: classificationsByCreatedCount,
        skippedGalaxies: null,
        userGalaxyClassifications: null,
      },
    };
  },
});

export const getCountDiagnosticsBatch = internalQuery({
  args: {
    table: v.union(
      v.literal("galaxies"),
      v.literal("galaxyIds"),
      v.literal("galaxyBlacklist"),
      v.literal("galaxies_photometry_g"),
      v.literal("galaxies_photometry_r"),
      v.literal("galaxies_photometry_i"),
      v.literal("galaxies_source_extractor"),
      v.literal("galaxies_thuruthipilly"),
      v.literal("classifications"),
      v.literal("skippedGalaxies"),
      v.literal("userGalaxyClassifications")
    ),
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

    if (args.table === "galaxyIds") {
      const result = await ctx.db
        .query("galaxyIds")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxyIds",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxyBlacklist") {
      const result = await ctx.db
        .query("galaxyBlacklist")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxyBlacklist",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxies_photometry_g") {
      const result = await ctx.db
        .query("galaxies_photometry_g")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxies_photometry_g",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxies_photometry_r") {
      const result = await ctx.db
        .query("galaxies_photometry_r")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxies_photometry_r",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxies_photometry_i") {
      const result = await ctx.db
        .query("galaxies_photometry_i")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxies_photometry_i",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxies_source_extractor") {
      const result = await ctx.db
        .query("galaxies_source_extractor")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxies_source_extractor",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "galaxies_thuruthipilly") {
      const result = await ctx.db
        .query("galaxies_thuruthipilly")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "galaxies_thuruthipilly",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "classifications") {
      const result = await ctx.db
        .query("classifications")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "classifications",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    if (args.table === "skippedGalaxies") {
      const result = await ctx.db
        .query("skippedGalaxies")
        .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

      return {
        table: "skippedGalaxies",
        batchCount: result.page.length,
        nextCursor: result.isDone ? null : result.continueCursor,
        isDone: result.isDone,
      };
    }

    const result = await ctx.db
      .query("userGalaxyClassifications")
      .paginate({ numItems: args.batchSize, cursor: args.cursor ?? null });

    return {
      table: "userGalaxyClassifications",
      batchCount: result.page.length,
      nextCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const computeCountDiagnosticsBatch = action({
  args: {
    table: v.union(
      v.literal("galaxies"),
      v.literal("galaxyIds"),
      v.literal("galaxyBlacklist"),
      v.literal("galaxies_photometry_g"),
      v.literal("galaxies_photometry_r"),
      v.literal("galaxies_photometry_i"),
      v.literal("galaxies_source_extractor"),
      v.literal("galaxies_thuruthipilly"),
      v.literal("classifications"),
      v.literal("skippedGalaxies"),
      v.literal("userGalaxyClassifications")
    ),
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
