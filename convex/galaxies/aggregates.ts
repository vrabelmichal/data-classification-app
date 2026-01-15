import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

// Labeling effort aggregates
export const classificationsByCreated = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "classifications";
}>(components.classificationsByCreated, {
  sortKey: (doc) => doc._creationTime,
});

export const userProfilesByClassificationsCount = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "userProfiles";
}>(components.userProfilesByClassificationsCount, {
  sortKey: (doc) => doc.classificationsCount ?? 0,
});

export const userProfilesByLastActive = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "userProfiles";
}>(components.userProfilesByLastActive, {
  sortKey: (doc) => doc.lastActiveAt ?? 0,
});

export const galaxyIdsAggregate = new TableAggregate<{
  Key: bigint;
  DataModel: DataModel;
  TableName: "galaxyIds";
}>(components.aggregate, {
  sortKey: (doc) => doc.numericId,
});

// Aggregate for galaxies sorted by ID (string)
export const galaxiesById = new TableAggregate<{
  Key: string;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesById, {
  sortKey: (doc) => doc.id,
});

// Aggregate for galaxies sorted by RA (number)
export const galaxiesByRa = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByRa, {
  sortKey: (doc) => doc.ra,
});

// Aggregate for galaxies sorted by Dec (number)
export const galaxiesByDec = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByDec, {
  sortKey: (doc) => doc.dec,
});

// Aggregate for galaxies sorted by effective radius (number)
export const galaxiesByReff = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByReff, {
  sortKey: (doc) => doc.reff,
});

// Aggregate for galaxies sorted by axis ratio (number)
export const galaxiesByQ = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByQ, {
  sortKey: (doc) => doc.q,
});

// Aggregate for galaxies sorted by position angle (number)
export const galaxiesByPa = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByPa, {
  sortKey: (doc) => doc.pa,
});

// Aggregate for galaxies sorted by nucleus (boolean)
export const galaxiesByNucleus = new TableAggregate<{
  Key: boolean;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByNucleus, {
  sortKey: (doc) => doc.nucleus,
});

// Aggregate for galaxies sorted by magnitude (number, optional)
export const galaxiesByMag = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByMag, {
  sortKey: (doc) => doc.mag ?? Number.MAX_SAFE_INTEGER, // Use max value for undefined to sort at end
});

// Aggregate for galaxies sorted by mean surface brightness (number, optional)
export const galaxiesByMeanMue = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByMeanMue, {
  sortKey: (doc) => doc.mean_mue ?? Number.MAX_SAFE_INTEGER, // Use max value for undefined to sort at end
});

// Aggregate for galaxies sorted by totalClassifications (number, optional)
export const galaxiesByTotalClassifications = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByTotalClassifications, {
  sortKey: (doc) => Number(doc.totalClassifications ?? 0), // Convert bigint to number, default to 0
});

// Aggregate for galaxies sorted by numVisibleNucleus (number, optional)
export const galaxiesByNumVisibleNucleus = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByNumVisibleNucleus, {
  sortKey: (doc) => Number(doc.numVisibleNucleus ?? 0), // Convert bigint to number, default to 0
});

// Aggregate for galaxies sorted by numAwesomeFlag (number, optional)
export const galaxiesByNumAwesomeFlag = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByNumAwesomeFlag, {
  sortKey: (doc) => Number(doc.numAwesomeFlag ?? 0), // Convert bigint to number, default to 0
});

// Aggregate for galaxies sorted by totalAssigned (number, optional)
export const galaxiesByTotalAssigned = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByTotalAssigned, {
  sortKey: (doc) => Number(doc.totalAssigned ?? 0), // Convert bigint to number, default to 0
});

// Aggregate for galaxies sorted by numericId (bigint)
export const galaxiesByNumericId = new TableAggregate<{
  Key: bigint;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByNumericId, {
  sortKey: (doc) => doc.numericId ?? BigInt(Number.MAX_SAFE_INTEGER),
});

// Helper function to get the appropriate aggregate based on sort field
export function getGalaxiesAggregate(sortBy: string) {
  switch (sortBy) {
    case "id":
      return galaxiesById;
    case "ra":
      return galaxiesByRa;
    case "dec":
      return galaxiesByDec;
    case "reff":
      return galaxiesByReff;
    case "q":
      return galaxiesByQ;
    case "pa":
      return galaxiesByPa;
    case "nucleus":
      return galaxiesByNucleus;
    case "mag":
      return galaxiesByMag;
    case "mean_mue":
      return galaxiesByMeanMue;
    case "numericId":
      return galaxiesByNumericId;
    default:
      return galaxiesById; // fallback
  }
}


// galaxyIds table aggregate

const REBUILD_GALAXY_IDS_AGGREGATE_BATCH_SIZE = 100; // Number of galaxies to process per batch

export const clearGalaxyIdsAggregate = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    await galaxyIdsAggregate.clear(ctx);
  },
});


export const rebuildGalaxyIdsAggregate = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });
    
    // Calculate total batches on first run
    let totalBatches = 0;
    if (!args.cursor) {
      const totalGalaxyIds = await ctx.db.query("galaxyIds").collect().then(galaxyIds => galaxyIds.length);
      totalBatches = Math.ceil(totalGalaxyIds / REBUILD_GALAXY_IDS_AGGREGATE_BATCH_SIZE);
      console.log(`[rebuildGalaxyIdsAggregate] Starting rebuild operation. Total galaxyIds: ${totalGalaxyIds}, Total batches: ${totalBatches}, Batch size: ${REBUILD_GALAXY_IDS_AGGREGATE_BATCH_SIZE}`);
    }
    else {
      console.log(`[rebuildGalaxyIdsAggregate] Resuming rebuild operation. Cursor: ${args.cursor}, clearOnly: ${args.clearOnly || false}`);
    }
    
    // Clear existing aggregate only on first run (when no cursor)
    if (!args.cursor) {
      console.log('[rebuildGalaxyIdsAggregate] Clearing existing aggregate...');
      await galaxyIdsAggregate.clear(ctx);
      console.log('[rebuildGalaxyIdsAggregate] Aggregate cleared successfully');
    }
    
    if (args.clearOnly) {
      console.log('[rebuildGalaxyIdsAggregate] Clear-only operation completed');
      return { message: "Aggregate cleared successfully" };
    }
    // Rebuild aggregate from galaxyIds in batches
    console.log(`[rebuildGalaxyIdsAggregate] Fetching batch with cursor: ${args.cursor || 'null'}`);
    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxyIds")
      .paginate({
        numItems: REBUILD_GALAXY_IDS_AGGREGATE_BATCH_SIZE,
        cursor: args.cursor || null,
      });
    
    console.log(`[rebuildGalaxyIdsAggregate] Retrieved ${page.length} galaxyIds for processing. isDone: ${isDone}, continueCursor: ${continueCursor || 'null'}`);
    
    let processed = 0;
    for (const galaxyId of page) {
      // Insert into aggregate sequentially to reduce memory pressure
      await galaxyIdsAggregate.insert(ctx, galaxyId);
      processed += 1;
    }
    
    if (isDone) {
      console.log(`[rebuildGalaxyIdsAggregate] Completed final batch. Total processed in batch: ${processed}`);
    }
    
    return {
      processed,
      isDone,
      continueCursor,
      message: isDone
        ? `GalaxyIds aggregate rebuilt successfully. Processed ${processed} galaxyIds in final batch.`
        : `Processed ${processed} galaxyIds. Continue with cursor: ${continueCursor}`,
    };
  },
});


// galaxies table aggregates
const REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE = 50;


export const clearGalaxyAggregates = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    await galaxiesById.clear(ctx);
    await galaxiesByRa.clear(ctx);
    await galaxiesByDec.clear(ctx);
    await galaxiesByReff.clear(ctx);
    await galaxiesByQ.clear(ctx);
    await galaxiesByPa.clear(ctx);
    await galaxiesByNucleus.clear(ctx);
    await galaxiesByMag.clear(ctx);
    await galaxiesByMeanMue.clear(ctx);
    await galaxiesByTotalClassifications.clear(ctx);
    await galaxiesByNumVisibleNucleus.clear(ctx);
    await galaxiesByNumAwesomeFlag.clear(ctx);
    await galaxiesByTotalAssigned.clear(ctx);
    await galaxiesByNumericId.clear(ctx);
    // await galaxyIdsAggregate.clear(ctx);
  },
});


export const rebuildGalaxyAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Calculate total batches on first run
    let totalGalaxies: number | undefined = undefined;
    let totalBatches: number | undefined = undefined;
    let batchNumber = 0;
    if (!args.cursor) {
      try {
        totalGalaxies = await galaxyIdsAggregate.count(ctx);
        totalBatches = Math.ceil(totalGalaxies / REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE);
        console.log(`[rebuildGalaxyAggregates] Starting rebuild operation. Total galaxies: ${totalGalaxies}, Total batches: ${totalBatches}, Batch size: ${REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE}`);
      } catch (error) {
        console.log(`[rebuildGalaxyAggregates] Starting rebuild operation. Unable to determine total galaxies from aggregate (may not be built yet). Batch size: ${REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE}`);
      }
    } else {
      console.log(`[rebuildGalaxyAggregates] Resuming rebuild operation. Cursor: ${args.cursor}, clearOnly: ${args.clearOnly || false}`);
    }

    if (args.clearOnly) {
      console.log('[rebuildGalaxyAggregates] Clear-only operation completed');
      return { message: "Clear-only operation completed" };
    }

    // If no cursor, clear aggregates and return, indicating clearing is done
    if (!args.cursor) {
      console.log('[rebuildGalaxyAggregates] Clearing existing aggregates...');
      await galaxiesById.clear(ctx);
      await galaxiesByRa.clear(ctx);
      await galaxiesByDec.clear(ctx);
      await galaxiesByReff.clear(ctx);
      await galaxiesByQ.clear(ctx);
      await galaxiesByPa.clear(ctx);
      await galaxiesByNucleus.clear(ctx);
      await galaxiesByMag.clear(ctx);
      await galaxiesByMeanMue.clear(ctx);
      await galaxiesByTotalClassifications.clear(ctx);
      await galaxiesByNumVisibleNucleus.clear(ctx);
      await galaxiesByNumAwesomeFlag.clear(ctx);
      await galaxiesByTotalAssigned.clear(ctx);
      await galaxiesByNumericId.clear(ctx);
      console.log('[rebuildGalaxyAggregates] Aggregates cleared successfully. Ready to start processing.');
      
      return {
        processed: 0,
        isDone: false,
        continueCursor: "start_processing",
        totalGalaxies,
        totalBatches,
        batchNumber: 0,
        message: "Galaxy aggregates cleared successfully. Ready to start rebuilding.",
      };
    }

    // If cursor is "start_processing", start processing the first batch
    let actualCursor: string | null = null;
    if (args.cursor === "start_processing") {
      actualCursor = null;
    } else {
      actualCursor = args.cursor;
    }

    // Rebuild aggregates from galaxies in batches
    console.log(`[rebuildGalaxyAggregates] Fetching batch with cursor: ${actualCursor || 'null'}`);
    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE,
        cursor: actualCursor,
      });

    console.log(`[rebuildGalaxyAggregates] Retrieved ${page.length} galaxies for processing. isDone: ${isDone}, continueCursor: ${continueCursor || 'null'}`);

    let processed = 0;
    for (const galaxy of page) {
      // Insert into aggregates sequentially to reduce memory pressure
      await galaxiesById.insert(ctx, galaxy);
      await galaxiesByRa.insert(ctx, galaxy);
      await galaxiesByDec.insert(ctx, galaxy);
      await galaxiesByReff.insert(ctx, galaxy);
      await galaxiesByQ.insert(ctx, galaxy);
      await galaxiesByPa.insert(ctx, galaxy);
      await galaxiesByNucleus.insert(ctx, galaxy);
      await galaxiesByMag.insert(ctx, galaxy);
      await galaxiesByMeanMue.insert(ctx, galaxy);
      await galaxiesByTotalClassifications.insert(ctx, galaxy);
      await galaxiesByNumVisibleNucleus.insert(ctx, galaxy);
      await galaxiesByNumAwesomeFlag.insert(ctx, galaxy);
      await galaxiesByTotalAssigned.insert(ctx, galaxy);
      await galaxiesByNumericId.insert(ctx, galaxy);
      processed += 1;
    }

    // Log progress for intermediate batches (not first or last, and every 5th batch)
    if (args.cursor !== "start_processing" && !isDone && batchNumber > 0 && batchNumber % 5 === 0) {
      console.log(`[rebuildGalaxyAggregates] Progress: Processed batch ${batchNumber}/${totalBatches}, ${processed} galaxies in this batch`);
    }

    if (isDone) {
      console.log(`[rebuildGalaxyAggregates] Completed final batch. Total processed in batch: ${processed}`);
    }

    return {
      processed,
      isDone,
      continueCursor,
      totalGalaxies,
      totalBatches,
      batchNumber: batchNumber || undefined,
      message: isDone
        ? `Galaxy aggregates rebuilt successfully. Processed ${processed} galaxies in final batch.`
        : `Processed ${processed} galaxies. Continue with cursor: ${continueCursor}`,
    };
  },
});

// Labeling aggregates rebuild/clear
const REBUILD_CLASSIFICATIONS_AGGREGATE_BATCH_SIZE = 200;
const REBUILD_USER_PROFILES_AGGREGATE_BATCH_SIZE = 200;

export const clearLabelingAggregates = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    await classificationsByCreated.clear(ctx);
    await userProfilesByClassificationsCount.clear(ctx);
    await userProfilesByLastActive.clear(ctx);
  },
});

export const rebuildClassificationAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    if (!args.cursor) {
      console.log("[rebuildClassificationAggregates] Clearing classification aggregates");
      await classificationsByCreated.clear(ctx);
      if (args.clearOnly) {
        return { processed: 0, isDone: true, continueCursor: null, message: "Cleared classification aggregates" };
      }
    } else {
      console.log(`[rebuildClassificationAggregates] Resuming with cursor ${args.cursor}`);
    }

    if (args.clearOnly) {
      return { processed: 0, isDone: true, continueCursor: null, message: "Clear-only operation complete" };
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("classifications")
      .paginate({ numItems: REBUILD_CLASSIFICATIONS_AGGREGATE_BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const classification of page) {
      await classificationsByCreated.insert(ctx, classification);
      processed += 1;
    }

    if (isDone) {
      console.log(`[rebuildClassificationAggregates] Completed final batch of ${processed}`);
    }

    return {
      processed,
      isDone,
      continueCursor,
      message: isDone
        ? `Classification aggregates rebuilt. Processed ${processed} records in final batch.`
        : `Processed ${processed} classifications. Continue with cursor: ${continueCursor}`,
    };
  },
});

export const rebuildUserProfileAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    if (!args.cursor) {
      console.log("[rebuildUserProfileAggregates] Clearing user profile aggregates");
      await userProfilesByClassificationsCount.clear(ctx);
      await userProfilesByLastActive.clear(ctx);
      if (args.clearOnly) {
        return { processed: 0, isDone: true, continueCursor: null, message: "Cleared user profile aggregates" };
      }
    } else {
      console.log(`[rebuildUserProfileAggregates] Resuming with cursor ${args.cursor}`);
    }

    if (args.clearOnly) {
      return { processed: 0, isDone: true, continueCursor: null, message: "Clear-only operation complete" };
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("userProfiles")
      .paginate({ numItems: REBUILD_USER_PROFILES_AGGREGATE_BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const profile of page) {
      await userProfilesByClassificationsCount.insert(ctx, profile);
      await userProfilesByLastActive.insert(ctx, profile);
      processed += 1;
    }

    if (isDone) {
      console.log(`[rebuildUserProfileAggregates] Completed final batch of ${processed}`);
    }

    return {
      processed,
      isDone,
      continueCursor,
      message: isDone
        ? `User profile aggregates rebuilt. Processed ${processed} records in final batch.`
        : `Processed ${processed} user profiles. Continue with cursor: ${continueCursor}`,
    };
  },
});

export const getAggregateInfo = query({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Get counts for all aggregates
    const [
      galaxyIdsCount,
      galaxiesByIdCount,
      galaxiesByRaCount,
      galaxiesByDecCount,
      galaxiesByReffCount,
      galaxiesByQCount,
      galaxiesByPaCount,
      galaxiesByNucleusCount,
      galaxiesByMagCount,
      galaxiesByMeanMueCount,
      galaxiesByTotalClassificationsCount,
      galaxiesByNumVisibleNucleusCount,
      galaxiesByNumAwesomeFlagCount,
      galaxiesByTotalAssignedCount,
      galaxiesByNumericIdCount,
    ] = await Promise.all([
      galaxyIdsAggregate.count(ctx),
      galaxiesById.count(ctx),
      galaxiesByRa.count(ctx),
      galaxiesByDec.count(ctx),
      galaxiesByReff.count(ctx),
      galaxiesByQ.count(ctx),
      galaxiesByPa.count(ctx),
      galaxiesByNucleus.count(ctx),
      galaxiesByMag.count(ctx),
      galaxiesByMeanMue.count(ctx),
      galaxiesByTotalClassifications.count(ctx),
      galaxiesByNumVisibleNucleus.count(ctx),
      galaxiesByNumAwesomeFlag.count(ctx),
      galaxiesByTotalAssigned.count(ctx),
      galaxiesByNumericId.count(ctx),
    ]);

    // Get min/max values for numeric aggregates
    const [
      galaxyIdsMin,
      galaxyIdsMax,
      galaxiesByRaMin,
      galaxiesByRaMax,
      galaxiesByDecMin,
      galaxiesByDecMax,
      galaxiesByReffMin,
      galaxiesByReffMax,
      galaxiesByQMin,
      galaxiesByQMax,
      galaxiesByPaMin,
      galaxiesByPaMax,
      galaxiesByMagMin,
      galaxiesByMagMax,
      galaxiesByMeanMueMin,
      galaxiesByMeanMueMax,
      galaxiesByTotalClassificationsMin,
      galaxiesByTotalClassificationsMax,
      galaxiesByNumVisibleNucleusMin,
      galaxiesByNumVisibleNucleusMax,
      galaxiesByNumAwesomeFlagMin,
      galaxiesByNumAwesomeFlagMax,
      galaxiesByTotalAssignedMin,
      galaxiesByTotalAssignedMax,
      galaxiesByNumericIdMin,
      galaxiesByNumericIdMax,
    ] = await Promise.all([
      galaxyIdsAggregate.min(ctx).then(item => item?.key),
      galaxyIdsAggregate.max(ctx).then(item => item?.key),
      galaxiesByRa.min(ctx).then(item => item?.key),
      galaxiesByRa.max(ctx).then(item => item?.key),
      galaxiesByDec.min(ctx).then(item => item?.key),
      galaxiesByDec.max(ctx).then(item => item?.key),
      galaxiesByReff.min(ctx).then(item => item?.key),
      galaxiesByReff.max(ctx).then(item => item?.key),
      galaxiesByQ.min(ctx).then(item => item?.key),
      galaxiesByQ.max(ctx).then(item => item?.key),
      galaxiesByPa.min(ctx).then(item => item?.key),
      galaxiesByPa.max(ctx).then(item => item?.key),
      galaxiesByMag.min(ctx).then(item => item?.key),
      galaxiesByMag.max(ctx).then(item => item?.key),
      galaxiesByMeanMue.min(ctx).then(item => item?.key),
      galaxiesByMeanMue.max(ctx).then(item => item?.key),
      galaxiesByTotalClassifications.min(ctx).then(item => item?.key),
      galaxiesByTotalClassifications.max(ctx).then(item => item?.key),
      galaxiesByNumVisibleNucleus.min(ctx).then(item => item?.key),
      galaxiesByNumVisibleNucleus.max(ctx).then(item => item?.key),
      galaxiesByNumAwesomeFlag.min(ctx).then(item => item?.key),
      galaxiesByNumAwesomeFlag.max(ctx).then(item => item?.key),
      galaxiesByTotalAssigned.min(ctx).then(item => item?.key),
      galaxiesByTotalAssigned.max(ctx).then(item => item?.key),
      galaxiesByNumericId.min(ctx).then(item => item?.key),
      galaxiesByNumericId.max(ctx).then(item => item?.key),
    ]);

    // Get nucleus counts (true/false)
    const nucleusTrueCount = await galaxiesByNucleus.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } }
    });
    const nucleusFalseCount = await galaxiesByNucleus.count(ctx, {
      bounds: { lower: { key: false, inclusive: true }, upper: { key: false, inclusive: true } }
    });

    return {
      galaxyIds: {
        count: galaxyIdsCount,
        min: galaxyIdsMin,
        max: galaxyIdsMax,
      },
      galaxiesById: {
        count: galaxiesByIdCount,
      },
      galaxiesByRa: {
        count: galaxiesByRaCount,
        min: galaxiesByRaMin,
        max: galaxiesByRaMax,
      },
      galaxiesByDec: {
        count: galaxiesByDecCount,
        min: galaxiesByDecMin,
        max: galaxiesByDecMax,
      },
      galaxiesByReff: {
        count: galaxiesByReffCount,
        min: galaxiesByReffMin,
        max: galaxiesByReffMax,
      },
      galaxiesByQ: {
        count: galaxiesByQCount,
        min: galaxiesByQMin,
        max: galaxiesByQMax,
      },
      galaxiesByPa: {
        count: galaxiesByPaCount,
        min: galaxiesByPaMin,
        max: galaxiesByPaMax,
      },
      galaxiesByNucleus: {
        count: galaxiesByNucleusCount,
        trueCount: nucleusTrueCount,
        falseCount: nucleusFalseCount,
      },
      galaxiesByMag: {
        count: galaxiesByMagCount,
        min: galaxiesByMagMin,
        max: galaxiesByMagMax,
      },
      galaxiesByMeanMue: {
        count: galaxiesByMeanMueCount,
        min: galaxiesByMeanMueMin,
        max: galaxiesByMeanMueMax,
      },
      galaxiesByTotalClassifications: {
        count: galaxiesByTotalClassificationsCount,
        min: galaxiesByTotalClassificationsMin,
        max: galaxiesByTotalClassificationsMax,
      },
      galaxiesByNumVisibleNucleus: {
        count: galaxiesByNumVisibleNucleusCount,
        min: galaxiesByNumVisibleNucleusMin,
        max: galaxiesByNumVisibleNucleusMax,
      },
      galaxiesByNumAwesomeFlag: {
        count: galaxiesByNumAwesomeFlagCount,
        min: galaxiesByNumAwesomeFlagMin,
        max: galaxiesByNumAwesomeFlagMax,
      },
      galaxiesByTotalAssigned: {
        count: galaxiesByTotalAssignedCount,
        min: galaxiesByTotalAssignedMin,
        max: galaxiesByTotalAssignedMax,
      },
      galaxiesByNumericId: {
        count: galaxiesByNumericIdCount,
        min: galaxiesByNumericIdMin,
        max: galaxiesByNumericIdMax,
      },
    };
  },
});

