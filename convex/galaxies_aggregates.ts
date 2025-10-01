import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

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
    let totalBatches = 0;
    if (!args.cursor) {
      const totalGalaxies = await ctx.db.query("galaxies").collect().then(galaxies => galaxies.length);
      totalBatches = Math.ceil(totalGalaxies / REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE);
      console.log(`[rebuildGalaxyAggregates] Starting rebuild operation. Total galaxies: ${totalGalaxies}, Total batches: ${totalBatches}, Batch size: ${REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE}`);
    } else {
      console.log(`[rebuildGalaxyAggregates] Resuming rebuild operation. Cursor: ${args.cursor}, clearOnly: ${args.clearOnly || false}`);
    }

    // Clear existing aggregates only on first run (when no cursor)
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
      // await galaxyIdsAggregate.clear(ctx);
      console.log('[rebuildGalaxyAggregates] Aggregates cleared successfully');
    }

    if (args.clearOnly) {
      console.log('[rebuildGalaxyAggregates] Clear-only operation completed');
      return { message: "Aggregates cleared successfully" };
    }

    // Rebuild aggregates from galaxies in batches
    console.log(`[rebuildGalaxyAggregates] Fetching batch with cursor: ${args.cursor || 'null'}`);
    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: REBUILD_GALAXIES_TABLE_AGGREGATE_BATCH_SIZE,
        cursor: args.cursor || null,
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
      await galaxiesByNumericId.insert(ctx, galaxy);
      processed += 1;
    }

    // Also rebuild galaxyIdsAggregate from galaxyIds table
    // if (!args.cursor) {
    //   console.log('[rebuildGalaxyAggregates] Rebuilding galaxyIdsAggregate...');
    //   const allGalaxyIds = await ctx.db.query("galaxyIds").collect();
    //   for (const galaxyId of allGalaxyIds) {
    //     await galaxyIdsAggregate.insert(ctx, galaxyId);
    //   }
    //   console.log(`[rebuildGalaxyAggregates] Inserted ${allGalaxyIds.length} records into galaxyIdsAggregate`);
    // }

    if (isDone) {
      console.log(`[rebuildGalaxyAggregates] Completed final batch. Total processed in batch: ${processed}`);
    }

    return {
      processed,
      isDone,
      continueCursor,
      message: isDone
        ? `Galaxy aggregates rebuilt successfully. Processed ${processed} galaxies in final batch.`
        : `Processed ${processed} galaxies. Continue with cursor: ${continueCursor}`,
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
      galaxiesByNumericId: {
        count: galaxiesByNumericIdCount,
        min: galaxiesByNumericIdMin,
        max: galaxiesByNumericIdMax,
      },
    };
  },
});

