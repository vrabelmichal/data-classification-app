import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { Doc } from "../_generated/dataModel";
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
} from "./aggregates";
import {
  galaxiesByTotalClassifications,
  galaxiesByNumAwesomeFlag,
  galaxiesByNumVisibleNucleus,
} from "./aggregates";

/**
 * Safely replace an entry in a galaxy aggregate index.
 * If the old entry is missing (DELETE_MISSING_KEY), fall back to inserting the new entry.
 * This handles cases where galaxies were added before the aggregate was initialized.
 */
async function safeReplaceGalaxyAggregate(
  ctx: any,
  aggregate: typeof galaxiesByTotalClassifications | typeof galaxiesByNumAwesomeFlag | typeof galaxiesByNumVisibleNucleus,
  oldDoc: Doc<"galaxies">,
  newDoc: Doc<"galaxies">
) {
  try {
    await aggregate.replace(ctx, oldDoc, newDoc);
  } catch (error: any) {
    const code = error?.data?.code;
    const message = error?.message ?? "";
    if (code === "DELETE_MISSING_KEY" || message.includes("DELETE_MISSING_KEY")) {
      // Old entry doesn't exist in aggregate - just insert the new one
      await aggregate.insert(ctx, newDoc);
      return;
    }
    throw error;
  }
}

export const UPDATE_BATCH_SIZE = 200;
export const ZERO_OUT_BATCH_SIZE = 1000;
// It seems that 500 is safe for both backfill and rebuild. If errors occur with backfill, consider lowering this value.
const BACKFILL_CLASSIFICATIONS_BATCH_SIZE = 500;
const REBUILD_TOTAL_CLASSIFICATIONS_BATCH_SIZE = 500;
// Fast backfill scans classifications table (typically much smaller than galaxies)
const FAST_BACKFILL_BATCH_SIZE = 500;

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

// Full scan: recompute totalClassifications, numAwesomeFlag, numVisibleNucleus for every galaxy
export const backfillGalaxyClassificationStats = mutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({ numItems: BACKFILL_CLASSIFICATIONS_BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    let updated = 0;

    for (const galaxy of page) {
      const classifications = await ctx.db
        .query("classifications")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxy.id))
        .collect();

      const totalClassifications = BigInt(classifications.length);
      const awesomeCount = BigInt(classifications.filter((c) => c.awesome_flag).length);
      const visibleCount = BigInt(classifications.filter((c) => c.visible_nucleus).length);

      const updates: Partial<Doc<'galaxies'>> = {};

      if ((galaxy.totalClassifications ?? BigInt(0)) !== totalClassifications) {
        updates.totalClassifications = totalClassifications;
      }
      if ((galaxy.numAwesomeFlag ?? BigInt(0)) !== awesomeCount) {
        updates.numAwesomeFlag = awesomeCount;
      }
      if ((galaxy.numVisibleNucleus ?? BigInt(0)) !== visibleCount) {
        updates.numVisibleNucleus = visibleCount;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(galaxy._id, updates);
        const refreshed = await ctx.db.get(galaxy._id);
        if (refreshed) {
          if (updates.totalClassifications !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByTotalClassifications, galaxy, refreshed);
          }
          if (updates.numAwesomeFlag !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshed);
          }
          if (updates.numVisibleNucleus !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshed);
          }
        }
        updated += 1;
      }

      processed += 1;
    }

    return {
      processed,
      updated,
      isDone,
      continueCursor,
      message: isDone
        ? `Backfill complete. Processed ${processed} galaxies, updated ${updated}.`
        : `Processed ${processed}, updated ${updated}. Continue with cursor ${continueCursor}`,
    };
  },
});

export const rebuildTotalClassificationsAggregate = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Clear aggregate on first call (when no cursor)
    if (!args.cursor) {
      console.log('[rebuildTotalClassificationsAggregate] Clearing galaxiesByTotalClassifications aggregate');
      await galaxiesByTotalClassifications.clear(ctx);
      
      if (args.clearOnly) {
        return { 
          processed: 0, 
          isDone: true, 
          continueCursor: null, 
          message: "Cleared galaxiesByTotalClassifications aggregate" 
        };
      }
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .paginate({ numItems: REBUILD_TOTAL_CLASSIFICATIONS_BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;

    for (const galaxy of page) {
      // Simply insert each galaxy into the aggregate based on its existing totalClassifications value.
      // The aggregate sortKey already defaults undefined/null to 0, so no DB patch needed here.
      // If you need to recalculate actual counts, use backfillGalaxyClassificationStats instead.
      await galaxiesByTotalClassifications.insert(ctx, galaxy);
      processed += 1;
    }

    if (isDone) {
      console.log(`[rebuildTotalClassificationsAggregate] Completed. Total processed in final batch: ${processed}`);
    }

    return {
      processed,
      isDone,
      continueCursor,
      message: isDone
        ? `Rebuild complete. Processed ${processed} galaxies in final batch.`
        : `Processed ${processed} galaxies. Continue with cursor: ${continueCursor}`,
    };
  },
});

/**
 * Fast backfill: Scans the `classifications` table (typically much smaller than galaxies)
 * and computes totalClassifications, numAwesomeFlag, numVisibleNucleus per galaxy. Only
 * updates galaxies that have at least one classification.
 * 
 * This is MUCH faster than `backfillGalaxyClassificationStats` when:
 * - You have many more galaxies than classifications
 * - Most galaxies have 0 classifications
 * 
 * Trade-off: This does NOT reset galaxies with 0 classifications. If a galaxy previously
 * had classifications that were deleted, its count won't be reset to 0. Use the full
 * backfill or zero-out first if you need to handle that case.
 */
export const fastBackfillGalaxyClassificationStats = mutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Paginate through classifications table
    const { page, isDone, continueCursor } = await ctx.db
      .query("classifications")
      .paginate({ numItems: FAST_BACKFILL_BATCH_SIZE, cursor: args.cursor ?? null });

    // Group classifications by galaxyExternalId in this batch
    const countsByGalaxy = new Map<string, number>();
    for (const classification of page) {
      const current = countsByGalaxy.get(classification.galaxyExternalId) ?? 0;
      countsByGalaxy.set(classification.galaxyExternalId, current + 1);
    }

    let processed = page.length;
    let galaxiesUpdated = 0;
    let uniqueGalaxies = countsByGalaxy.size;

    // For each unique galaxy in this batch, we need to get the FULL count
    // (not just what's in this batch) and update it
    for (const [galaxyExternalId] of countsByGalaxy) {
      // Get the galaxy document
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) continue;

      // Count ALL classifications for this galaxy (not just this batch)
      const allClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .collect();

      const totalClassifications = BigInt(allClassifications.length);
      const awesomeCount = BigInt(allClassifications.filter((c) => c.awesome_flag).length);
      const visibleCount = BigInt(allClassifications.filter((c) => c.visible_nucleus).length);

      const updates: Partial<Doc<'galaxies'>> = {};

      if ((galaxy.totalClassifications ?? BigInt(0)) !== totalClassifications) {
        updates.totalClassifications = totalClassifications;
      }
      if ((galaxy.numAwesomeFlag ?? BigInt(0)) !== awesomeCount) {
        updates.numAwesomeFlag = awesomeCount;
      }
      if ((galaxy.numVisibleNucleus ?? BigInt(0)) !== visibleCount) {
        updates.numVisibleNucleus = visibleCount;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(galaxy._id, updates);
        const refreshed = await ctx.db.get(galaxy._id);
        if (refreshed) {
          if (updates.totalClassifications !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByTotalClassifications, galaxy, refreshed);
          }
          if (updates.numAwesomeFlag !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshed);
          }
          if (updates.numVisibleNucleus !== undefined) {
            await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshed);
          }
        }
        galaxiesUpdated += 1;
      }
    }

    return {
      processed,
      uniqueGalaxies,
      galaxiesUpdated,
      isDone,
      continueCursor,
      message: isDone
        ? `Fast backfill complete. Processed ${processed} classifications, updated ${galaxiesUpdated} galaxies.`
        : `Processed ${processed} classifications (${uniqueGalaxies} unique galaxies, ${galaxiesUpdated} updated). Continue...`,
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
