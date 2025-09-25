import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

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

// Aggregate for galaxies sorted by creation time (number)
export const galaxiesByCreationTime = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByCreationTime, {
  sortKey: (doc) => doc._creationTime,
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
    case "_creationTime":
      return galaxiesByCreationTime;
    case "mag":
      return galaxiesByMag;
    case "mean_mue":
      return galaxiesByMeanMue;
    default:
      return galaxiesById; // fallback
  }
}
export const clearGalaxyIdsAggregate = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check if user is admin
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "admin") throw new Error("Not authorized");

    await galaxyIdsAggregate.clear(ctx);
  },
});export const clearGalaxyAggregates = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check if user is admin
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "admin") throw new Error("Not authorized");

    await galaxiesById.clear(ctx);
    await galaxiesByRa.clear(ctx);
    await galaxiesByDec.clear(ctx);
    await galaxiesByReff.clear(ctx);
    await galaxiesByQ.clear(ctx);
    await galaxiesByPa.clear(ctx);
    await galaxiesByNucleus.clear(ctx);
    await galaxiesByCreationTime.clear(ctx);
    await galaxiesByMag.clear(ctx);
    await galaxiesByMeanMue.clear(ctx);
  },
});

const REBUILD_BATCH_SIZE = 50;

export const rebuildGalaxyAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // make sure only admin can call this
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check if user is admin
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "admin") throw new Error("Not authorized");

    // Calculate total batches on first run
    let totalBatches = 0;
    if (!args.cursor) {
      const totalGalaxies = await ctx.db.query("galaxies").collect().then(galaxies => galaxies.length);
      totalBatches = Math.ceil(totalGalaxies / REBUILD_BATCH_SIZE);
      console.log(`[rebuildGalaxyAggregates] Starting rebuild operation. Total galaxies: ${totalGalaxies}, Total batches: ${totalBatches}, Batch size: ${REBUILD_BATCH_SIZE}`);
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
      await galaxiesByCreationTime.clear(ctx);
      await galaxiesByMag.clear(ctx);
      await galaxiesByMeanMue.clear(ctx);
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
        numItems: REBUILD_BATCH_SIZE,
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
      await galaxiesByCreationTime.insert(ctx, galaxy);
      await galaxiesByMag.insert(ctx, galaxy);
      await galaxiesByMeanMue.insert(ctx, galaxy);
      processed += 1;
    }

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
export const galaxyIdsAggregate = new TableAggregate<{
  Key: bigint;
  DataModel: DataModel;
  TableName: "galaxyIds";
}>(components.aggregate, {
  sortKey: (doc) => doc.numericId,
});

