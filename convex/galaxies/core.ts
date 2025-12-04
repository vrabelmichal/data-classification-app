import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
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

// helper function to properly insert a galaxy into galaxies, galaxiesAggregate, and galaxyIds
// IMPORTANT: This function must be called within a mutation context.
// All inserts are part of the same transaction - if any fails, all are rolled back.
export async function insertGalaxy(
  ctx: MutationCtx,
  galaxy: Omit<Doc<'galaxies'>, '_id'>,
  photometryBand?: { sersic: any }, // g band required object shape if present
  photometryBandR?: { sersic?: any },
  photometryBandI?: { sersic?: any },
  sourceExtractor?: { g: any; r: any; i: any; y?: any; z?: any },
  thuruthipilly?: any,
  numericId?: bigint,
): Promise<Id<'galaxies'>> {
  // Validate required fields
  if (!galaxy.id) {
    throw new Error("Galaxy must have an 'id' field (external ID)");
  }

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

  // Resolve numericId: use provided value or compute from aggregate
  let resolvedNumericId: bigint;
  if (numericId !== undefined) {
    resolvedNumericId = numericId;
  } else {
    const maxNumericIdFromAgg = await galaxyIdsAggregate.max(ctx);
    resolvedNumericId = maxNumericIdFromAgg !== null ? maxNumericIdFromAgg.key + BigInt(1) : BigInt(1);
  }

  // Set the numericId in the galaxy object before inserting
  galaxy.numericId = resolvedNumericId;

  // 1. Insert core galaxy row
  const galaxyRef = await ctx.db.insert("galaxies", galaxy);
  const insertedGalaxy = await ctx.db.get(galaxyRef);
  if (!insertedGalaxy) {
    throw new Error(`Failed to retrieve inserted galaxy (ref: ${galaxyRef})`);
  }

  // 2. Insert into galaxyIds table - this MUST succeed for consistency
  const galaxyIdDocId = await ctx.db.insert("galaxyIds", { 
    id: galaxy.id, 
    galaxyRef, 
    numericId: resolvedNumericId 
  });
  const galaxyIdDoc = await ctx.db.get(galaxyIdDocId);
  if (!galaxyIdDoc) {
    throw new Error(`Failed to retrieve inserted galaxyIds entry (ref: ${galaxyIdDocId})`);
  }

  // 3. Maintain all aggregates - these must all succeed
  // Galaxy aggregates
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
  
  // GalaxyIds aggregate
  await galaxyIdsAggregate.insert(ctx, galaxyIdDoc);

  // 4. Insert optional related data (photometry, source extractor, thuruthipilly)
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
    const misc = galaxy.misc;
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
      misc,
    };
  },
});
