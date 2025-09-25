import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
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
  galaxiesByCreationTime,
  galaxiesByMag,
  galaxiesByMeanMue,
  galaxyIdsAggregate
} from "./galaxies_aggregates";


export const deleteAllGalaxies = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check if user is admin
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "admin") throw new Error("Not authorized");

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
    
    // Delete galaxyAssignmentStats
    await ctx.db.query("galaxyAssignmentStats").collect().then(docs => 
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
    await galaxiesByCreationTime.clear(ctx);
    await galaxiesByMag.clear(ctx);
    await galaxiesByMeanMue.clear(ctx);
    
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

  // Insert core row first
  const galaxyRef = await ctx.db.insert("galaxies", galaxy);
  const galaxyDoc = await ctx.db.get(galaxyRef);
  if (!galaxyDoc) throw new Error("Failed to insert galaxy");

  // Maintain galaxy aggregates (run in parallel for better performance)
  await Promise.all([
    galaxiesById.insert(ctx, galaxyDoc),
    galaxiesByRa.insert(ctx, galaxyDoc),
    galaxiesByDec.insert(ctx, galaxyDoc),
    galaxiesByReff.insert(ctx, galaxyDoc),
    galaxiesByQ.insert(ctx, galaxyDoc),
    galaxiesByPa.insert(ctx, galaxyDoc),
    galaxiesByNucleus.insert(ctx, galaxyDoc),
    galaxiesByCreationTime.insert(ctx, galaxyDoc),
    galaxiesByMag.insert(ctx, galaxyDoc),
    galaxiesByMeanMue.insert(ctx, galaxyDoc),
  ]);

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

  // Maintain galaxyIds aggregate table
  const galaxyId_id = await ctx.db.insert("galaxyIds", { id: galaxy.id, galaxyRef, numericId: resolvedNumericId });
  const galaxyId_doc = await ctx.db.get(galaxyId_id);
  if (galaxyId_doc) {
    await galaxyIdsAggregate.insert(ctx, galaxyId_doc);
  }

  // Insert galaxyAssignmentStats
  await ctx.db.insert("galaxyAssignmentStats", {
    galaxyExternalId: galaxy.id,
    numericId: resolvedNumericId,
    totalAssigned: 0,
    perUser: {},
    lastAssignedAt: undefined,
  });

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

export const fillGalaxyMagAndMeanMue = mutation({
  args: {
    maxToUpdate: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Admin only
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

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
