import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  galaxiesById,
  galaxiesByRa,
  galaxiesByDec,
  galaxiesByReff,
  galaxiesByQ,
  galaxiesByPa,
  galaxiesByNucleus,
  galaxiesByMag,
  galaxiesByMeanMue,
  galaxyIdsAggregate,
  galaxiesByNumericId
} from "./galaxies_aggregates";


export const deleteAllGalaxies = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Delete all documents from galaxy-related tables
    // Note: We need to delete in the correct order due to foreign key references
    
    // First, delete related tables that reference galaxies
    await ctx.db.query("galaxies_photometry_g").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    await ctx.db.query("galaxies_photometry_r").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    await ctx.db.query("galaxies_photometry_i").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    await ctx.db.query("galaxies_source_extractor").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    await ctx.db.query("galaxies_thuruthipilly").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    
    // Delete galaxyIds table
    await ctx.db.query("galaxyIds").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    
    // Finally, delete the main galaxies table
    await ctx.db.query("galaxies").collect().then(docs => 
      Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
    );
    
    // Clear all galaxy aggregates
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
    
    // Clear the aggregate
    await galaxyIdsAggregate.clear(ctx);
    
    return { message: "All galaxy data has been deleted successfully" };
  },
});


// helper function to properly insert a galaxy into galaxies, galaxiesAggregate, and galaxyIds
// Helper function to properly insert a galaxy into galaxies, galaxiesAggregate, and galaxyIds
export async function insertGalaxy(
  ctx: MutationCtx,
  galaxy: Omit<Doc<'galaxies'>, '_id'>,
  photometryBand?: { sersic: any }, // g band required object shape if present
  photometryBandR?: { sersic?: any },
  photometryBandI?: { sersic?: any },
  sourceExtractor?: { g: any; r: any; i: any; y?: any; z?: any },
  thuruthipilly?: any,
  numbericId?: bigint,
): Promise<Id<'galaxies'>> {
  // Populate mag and mean_mue from photometryBand if not already set
  if (galaxy.mag === undefined && photometryBand?.sersic?.mag !== undefined) {
    galaxy.mag = photometryBand.sersic.mag;
  }
  if (galaxy.mean_mue === undefined && photometryBand?.sersic?.mean_mue !== undefined) {
    galaxy.mean_mue = photometryBand.sersic.mean_mue;
  }

  // Set default assignment stats
  galaxy.totalAssigned = galaxy.totalAssigned ?? BigInt(0);
  galaxy.perUser = galaxy.perUser ?? {};
  galaxy.lastAssignedAt = galaxy.lastAssignedAt ?? undefined;

  // if numericId is not provided, find the max numericId and increment or set to 1 if none exist, 
  //   use galaxyIdsAggregate to find max value of numericId
  let resolvedNumericId : bigint;
  if (!numbericId) {
    const maxNumericIdFromAgg = await galaxyIdsAggregate.max(ctx);
    console.log("Max numericId from aggregate:", maxNumericIdFromAgg);
    resolvedNumericId = maxNumericIdFromAgg !== null ? maxNumericIdFromAgg.key + BigInt(1) : BigInt(1);
  } else {
    resolvedNumericId = numbericId;
  }

  // Set the numericId in the galaxy object before inserting
  galaxy.numericId = resolvedNumericId;

  // Insert core row first
  const galaxyRef = await ctx.db.insert("galaxies", galaxy);
  const insertedGalaxy = await ctx.db.get(galaxyRef);
  if (!insertedGalaxy) throw new Error("Failed to insert galaxy");

  // Maintain galaxy aggregates
  await galaxiesById.insert(ctx, insertedGalaxy);
  await galaxiesByRa.insert(ctx, insertedGalaxy);
  await galaxiesByDec.insert(ctx, insertedGalaxy);
  await galaxiesByReff.insert(ctx, insertedGalaxy);
  await galaxiesByQ.insert(ctx, insertedGalaxy);
  await galaxiesByPa.insert(ctx, insertedGalaxy);
  await galaxiesByNucleus.insert(ctx, insertedGalaxy);
  await galaxiesByMag.insert(ctx, insertedGalaxy);
  await galaxiesByMeanMue.insert(ctx, insertedGalaxy);
  await galaxiesByNumericId.insert(ctx, insertedGalaxy);

  // Maintain galaxyIds aggregate table
  const galaxyId_id = await ctx.db.insert("galaxyIds", { id: galaxy.id, galaxyRef, numericId: resolvedNumericId });
  const galaxyId_doc = await ctx.db.get(galaxyId_id);
  if (galaxyId_doc) {
    await galaxyIdsAggregate.insert(ctx, galaxyId_doc);
  }

  // Per-band photometry tables
  if (photometryBand) {
    await ctx.db.insert("galaxies_photometry_g", { galaxyRef, band: "g", ...photometryBand });
  }
  if (photometryBandR) {
    await ctx.db.insert("galaxies_photometry_r", { galaxyRef, band: "r", ...photometryBandR });
  }
  if (photometryBandI) {
    await ctx.db.insert("galaxies_photometry_i", { galaxyRef, band: "i", ...photometryBandI });
  }

  if (sourceExtractor) {
    // Only insert if at least one band has some data
    const hasData = Object.values(sourceExtractor).some(v => v && Object.keys(v).length > 0);
    if (hasData) {
      await ctx.db.insert("galaxies_source_extractor", { galaxyRef, ...sourceExtractor });
    }
  }

  if (thuruthipilly && Object.keys(thuruthipilly).length > 0) {
    await ctx.db.insert("galaxies_thuruthipilly", { galaxyRef, ...thuruthipilly });
  }

  return galaxyRef;
}


// Query to fetch additional galaxy details by externalGalaxyId (id column)
export const getAdditionalGalaxyDetailsByExternalId = mutation({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    // Find galaxy by external id
    const galaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", externalId))
      .unique();
    if (!galaxy) return null;

    // Example: fetch photometry, source extractor, thuruthipilly, etc.
    const photometry_g = await ctx.db
      .query("galaxies_photometry_g")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxy._id))
      .unique();
    const photometry_r = await ctx.db
      .query("galaxies_photometry_r")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxy._id))
      .unique();
    const photometry_i = await ctx.db
      .query("galaxies_photometry_i")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxy._id))
      .unique();
    const source_extractor = await ctx.db
      .query("galaxies_source_extractor")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxy._id))
      .unique();
    const thuruthipilly = await ctx.db
      .query("galaxies_thuruthipilly")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxy._id))
      .unique();

    return {
      photometry_g,
      photometry_r,
      photometry_i,
      source_extractor,
      thuruthipilly,
    };
  },
});

export const UPDATE_BATCH_SIZE = 200;
export const ZERO_OUT_BATCH_SIZE = 1000;

export const rebuildGalaxyIdsTable = mutation({
  args: {
    cursor: v.optional(v.string()),
    startNumericId: v.optional(v.int64()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let cursor = args.cursor || null;
    let processed = 0;
    let startNumericId = args.startNumericId || BigInt(1);

    // On first call (no cursor), clear the table
    if (!cursor) {
      await ctx.db.query("galaxyIds").collect().then(docs => 
        Promise.all(docs.map(doc => ctx.db.delete(doc._id)))
      );
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: UPDATE_BATCH_SIZE,
        cursor,
      });

    for (const galaxy of page) {
      const numericId = startNumericId + BigInt(processed);
      
      await ctx.db.insert("galaxyIds", {
        id: galaxy.id,
        galaxyRef: galaxy._id,
        numericId,
      });
      
      processed += 1;
    }

    const nextStartNumericId = startNumericId + BigInt(processed);

    return {
      processed,
      cursor: continueCursor,
      isDone,
      nextStartNumericId,
      message: processed > 0 ? `Processed ${processed} galaxies` : "No galaxies to process",
    };
  },
});

export const fillGalaxyMagAndMeanMue = mutation({
  args: {
    maxToUpdate: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.maxToUpdate ? Math.max(1, Math.floor(args.maxToUpdate)) : UPDATE_BATCH_SIZE;
    let updated = 0;
    let cursor = args.cursor || null;

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies_photometry_g")
      .paginate({
        numItems: limit,
        cursor,
      });

    for (const photometry of page) {
      // Get the galaxy
      const galaxy = await ctx.db.get(photometry.galaxyRef);
      if (!galaxy) continue;

      // Check if we need to update
      const needsUpdate = (galaxy.mag === undefined && photometry.sersic?.mag !== undefined) ||
                         (galaxy.mean_mue === undefined && photometry.sersic?.mean_mue !== undefined);

      if (needsUpdate) {
        const update: Partial<Doc<'galaxies'>> = {};
        if (galaxy.mag === undefined && photometry.sersic?.mag !== undefined) {
          update.mag = photometry.sersic.mag;
        }
        if (galaxy.mean_mue === undefined && photometry.sersic?.mean_mue !== undefined) {
          update.mean_mue = photometry.sersic.mean_mue;
        }
        await ctx.db.patch(galaxy._id, update);
        updated += 1;
      }
    }

    return {
      updated,
      limit,
      cursor: continueCursor,
      isDone,
      message: updated > 0 ? `Updated ${updated} galaxies with mag/mean_mue` : "No galaxies needed updating",
    };
  },
});

export const fillGalaxyNumericId = mutation({
  args: {
    maxToUpdate: v.optional(v.number()),
    cursor: v.optional(v.string()),
    startNumericId: v.optional(v.int64()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.maxToUpdate ? Math.max(1, Math.floor(args.maxToUpdate)) : UPDATE_BATCH_SIZE;
    let updated = 0;
    let cursor = args.cursor || null;
    let startNumericId = args.startNumericId || BigInt(1);

    // Clear aggregate on first call
    if (!cursor) {
      console.log(`[fillGalaxyNumericId] Starting fillGalaxyNumericId with startNumericId: ${startNumericId}`);
      await galaxiesByNumericId.clear(ctx);
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: limit,
        cursor,
      });

    // Sort by _creationTime to assign numericId in creation order
    page.sort((a, b) => a._creationTime - b._creationTime);

    for (const galaxy of page) {
      const numericId = startNumericId + BigInt(updated);
      
      await ctx.db.patch(galaxy._id, { numericId });
      const updatedGalaxy = { ...galaxy, numericId };
      await galaxiesByNumericId.insert(ctx, updatedGalaxy);
      updated += 1;
    }

    console.log(`[fillGalaxyNumericId] Processed batch. Updated: ${updated} galaxies, startNumericId: ${startNumericId}, cursor: ${continueCursor || 'null'}, isDone: ${isDone}`);

    if (isDone) {
      console.log(`[fillGalaxyNumericId] Completed fillGalaxyNumericId. Total updated: ${updated}`);
    }

    const nextStartNumericId = startNumericId + BigInt(updated);

    return {
      updated,
      limit,
      cursor: continueCursor,
      isDone,
      nextStartNumericId,
      message: updated > 0 ? `Updated ${updated} galaxies with sequential numericId starting from ${startNumericId}` : "No galaxies to process",
    };
  },
});

export const zeroOutGalaxyStatistics = mutation({
  args: {
    maxToUpdate: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.maxToUpdate ? Math.max(1, Math.floor(args.maxToUpdate)) : ZERO_OUT_BATCH_SIZE;
    let updated = 0;
    let cursor = args.cursor || null;
    let totalProcessed = 0; // Track total across all batches

    // Log start of operation
    if (!cursor) {
      console.log(`[zeroOutGalaxyStatistics] Starting zero-out of galaxy statistics`);
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({
        numItems: limit,
        cursor,
      });

    for (const galaxy of page) {
      // Always update to ensure all statistics are zero
      const update: Partial<Doc<'galaxies'>> = {
        totalClassifications: BigInt(0),
        numVisibleNucleus: BigInt(0),
        numAwesomeFlag: BigInt(0),
      };
      await ctx.db.patch(galaxy._id, update);
      updated += 1;
      totalProcessed += 1;
    }

    // Log progress occasionally (every 10 batches, but not first or last)
    if (!isDone && cursor && totalProcessed > 0 && (totalProcessed / limit) % 10 === 0) {
      console.log(`[zeroOutGalaxyStatistics] Processed ${totalProcessed} galaxies so far`);
    }

    // Log completion
    if (isDone) {
      console.log(`[zeroOutGalaxyStatistics] Completed zero-out of galaxy statistics for ${totalProcessed} total galaxies`);
    }

    return {
      updated,
      limit,
      cursor: continueCursor,
      isDone,
      totalProcessed,
      message: updated > 0 ? `Zeroed out statistics for ${updated} galaxies` : "No galaxies to process",
    };
  },
});


