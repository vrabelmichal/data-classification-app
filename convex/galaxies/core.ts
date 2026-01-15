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

// Fields that should NOT be overwritten during updates (classification/assignment related)
const PROTECTED_GALAXY_FIELDS = [
  '_id',
  '_creationTime',
  'id',  // external ID should not change
  'numericId',  // internal ID should not change
  'totalClassifications',
  'numVisibleNucleus',
  'numAwesomeFlag',
  'totalAssigned',
  'perUser',
  'lastAssignedAt',
] as const;

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

/**
 * Helper to deep merge objects, preserving existing values when new value is undefined.
 * Only overwrites with non-undefined new values.
 */
function deepMerge<T extends Record<string, any>>(existing: T, updates: Partial<T>): T {
  const result = { ...existing };
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const newValue = updates[key];
    if (newValue === undefined) {
      // Skip undefined values - keep existing
      continue;
    }
    if (
      newValue !== null &&
      typeof newValue === 'object' &&
      !Array.isArray(newValue) &&
      existing[key] !== null &&
      typeof existing[key] === 'object' &&
      !Array.isArray(existing[key])
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(existing[key] as Record<string, any>, newValue as Record<string, any>) as T[keyof T];
    } else {
      result[key] = newValue as T[keyof T];
    }
  }
  return result;
}

/**
 * Update an existing galaxy by external ID.
 * Protected fields (id, numericId, classification stats) are preserved.
 * Only updates fields that are provided and non-undefined.
 * 
 * Returns the updated galaxy's _id, or null if the galaxy was not found.
 */
export async function updateGalaxy(
  ctx: MutationCtx,
  externalId: string,
  galaxyUpdates: Partial<Omit<Doc<'galaxies'>, '_id' | '_creationTime'>>,
  photometryBand?: { sersic: any } | null,
  photometryBandR?: { sersic?: any } | null,
  photometryBandI?: { sersic?: any } | null,
  sourceExtractor?: { g: any; r: any; i: any; y?: any; z?: any } | null,
  thuruthipilly?: any | null,
): Promise<Id<'galaxies'> | null> {
  // Find existing galaxy by external ID
  const existingGalaxy = await ctx.db
    .query("galaxies")
    .withIndex("by_external_id", (q) => q.eq("id", externalId))
    .unique();

  if (!existingGalaxy) {
    return null;
  }

  const galaxyRef = existingGalaxy._id;

  // Build the update object, excluding protected fields
  const filteredUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(galaxyUpdates)) {
    if (PROTECTED_GALAXY_FIELDS.includes(key as any)) {
      continue; // Skip protected fields
    }
    if (value !== undefined) {
      filteredUpdates[key] = value;
    }
  }

  // Handle misc field specially - deep merge to preserve existing misc values
  if (filteredUpdates.misc && existingGalaxy.misc) {
    filteredUpdates.misc = deepMerge(existingGalaxy.misc, filteredUpdates.misc);
  }

  // Update mag and mean_mue from photometryBand if provided and not already in updates
  if (photometryBand?.sersic?.mag !== undefined && filteredUpdates.mag === undefined) {
    filteredUpdates.mag = photometryBand.sersic.mag;
  }
  if (photometryBand?.sersic?.mean_mue !== undefined && filteredUpdates.mean_mue === undefined) {
    filteredUpdates.mean_mue = photometryBand.sersic.mean_mue;
  }

  // Check if any aggregate-affecting fields changed
  const aggregateFields = ['id', 'ra', 'dec', 'reff', 'q', 'pa', 'nucleus', 'mag', 'mean_mue', 'numericId'] as const;
  const aggregateFieldsChanged = aggregateFields.some(
    field => filteredUpdates[field] !== undefined && filteredUpdates[field] !== existingGalaxy[field]
  );

  // If aggregate fields changed, we need to update aggregates
  if (aggregateFieldsChanged) {
    // Remove from aggregates with old values
    await galaxiesById.delete(ctx, existingGalaxy);
    await galaxiesByRa.delete(ctx, existingGalaxy);
    await galaxiesByDec.delete(ctx, existingGalaxy);
    await galaxiesByReff.delete(ctx, existingGalaxy);
    await galaxiesByQ.delete(ctx, existingGalaxy);
    await galaxiesByPa.delete(ctx, existingGalaxy);
    await galaxiesByNucleus.delete(ctx, existingGalaxy);
    await galaxiesByMag.delete(ctx, existingGalaxy);
    await galaxiesByMeanMue.delete(ctx, existingGalaxy);
    await galaxiesByNumericId.delete(ctx, existingGalaxy);
  }

  // Apply updates to the galaxy
  if (Object.keys(filteredUpdates).length > 0) {
    await ctx.db.patch(galaxyRef, filteredUpdates);
  }

  // Re-insert into aggregates with new values if they changed
  if (aggregateFieldsChanged) {
    const updatedGalaxy = await ctx.db.get(galaxyRef);
    if (!updatedGalaxy) {
      throw new Error(`Failed to retrieve updated galaxy (ref: ${galaxyRef})`);
    }
    await galaxiesById.insert(ctx, updatedGalaxy);
    await galaxiesByRa.insert(ctx, updatedGalaxy);
    await galaxiesByDec.insert(ctx, updatedGalaxy);
    await galaxiesByReff.insert(ctx, updatedGalaxy);
    await galaxiesByQ.insert(ctx, updatedGalaxy);
    await galaxiesByPa.insert(ctx, updatedGalaxy);
    await galaxiesByNucleus.insert(ctx, updatedGalaxy);
    await galaxiesByMag.insert(ctx, updatedGalaxy);
    await galaxiesByMeanMue.insert(ctx, updatedGalaxy);
    await galaxiesByNumericId.insert(ctx, updatedGalaxy);
  }

  // Update photometry tables
  if (photometryBand !== undefined) {
    const existingPhotG = await ctx.db
      .query("galaxies_photometry_g")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxyRef))
      .unique();
    
    if (photometryBand === null) {
      // Explicitly delete
      if (existingPhotG) {
        await ctx.db.delete(existingPhotG._id);
      }
    } else if (existingPhotG) {
      // Update existing
      const mergedSersic = deepMerge(existingPhotG.sersic || {}, photometryBand.sersic || {});
      await ctx.db.patch(existingPhotG._id, { sersic: mergedSersic });
    } else {
      // Insert new
      await ctx.db.insert("galaxies_photometry_g", { galaxyRef, band: "g", ...photometryBand });
    }
  }

  if (photometryBandR !== undefined) {
    const existingPhotR = await ctx.db
      .query("galaxies_photometry_r")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxyRef))
      .unique();
    
    if (photometryBandR === null) {
      if (existingPhotR) {
        await ctx.db.delete(existingPhotR._id);
      }
    } else if (existingPhotR) {
      const mergedSersic = photometryBandR.sersic 
        ? deepMerge(existingPhotR.sersic || {}, photometryBandR.sersic)
        : existingPhotR.sersic;
      await ctx.db.patch(existingPhotR._id, { sersic: mergedSersic });
    } else {
      await ctx.db.insert("galaxies_photometry_r", { galaxyRef, band: "r", ...photometryBandR });
    }
  }

  if (photometryBandI !== undefined) {
    const existingPhotI = await ctx.db
      .query("galaxies_photometry_i")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxyRef))
      .unique();
    
    if (photometryBandI === null) {
      if (existingPhotI) {
        await ctx.db.delete(existingPhotI._id);
      }
    } else if (existingPhotI) {
      const mergedSersic = photometryBandI.sersic 
        ? deepMerge(existingPhotI.sersic || {}, photometryBandI.sersic)
        : existingPhotI.sersic;
      await ctx.db.patch(existingPhotI._id, { sersic: mergedSersic });
    } else {
      await ctx.db.insert("galaxies_photometry_i", { galaxyRef, band: "i", ...photometryBandI });
    }
  }

  // Update source extractor
  if (sourceExtractor !== undefined) {
    const existingSE = await ctx.db
      .query("galaxies_source_extractor")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxyRef))
      .unique();
    
    if (sourceExtractor === null) {
      if (existingSE) {
        await ctx.db.delete(existingSE._id);
      }
    } else if (existingSE) {
      // Merge each band separately
      const mergedSE: Record<string, any> = {};
      for (const band of ['g', 'r', 'i', 'y', 'z'] as const) {
        if (sourceExtractor[band] !== undefined) {
          const existingBand = (existingSE as any)[band] || {};
          mergedSE[band] = deepMerge(existingBand, sourceExtractor[band] || {});
        }
      }
      if (Object.keys(mergedSE).length > 0) {
        await ctx.db.patch(existingSE._id, mergedSE);
      }
    } else {
      const hasData = Object.values(sourceExtractor).some(v => v && Object.keys(v).length > 0);
      if (hasData) {
        await ctx.db.insert("galaxies_source_extractor", { galaxyRef, ...sourceExtractor });
      }
    }
  }

  // Update thuruthipilly
  if (thuruthipilly !== undefined) {
    const existingThur = await ctx.db
      .query("galaxies_thuruthipilly")
      .withIndex("by_galaxy", (q) => q.eq("galaxyRef", galaxyRef))
      .unique();
    
    if (thuruthipilly === null) {
      if (existingThur) {
        await ctx.db.delete(existingThur._id);
      }
    } else if (existingThur) {
      // Merge thuruthipilly fields, excluding galaxyRef
      const { galaxyRef: _, ...existingFields } = existingThur;
      const mergedThur = deepMerge(existingFields, thuruthipilly);
      // Remove _id and _creationTime from merged result before patching
      delete (mergedThur as any)._id;
      delete (mergedThur as any)._creationTime;
      await ctx.db.patch(existingThur._id, mergedThur);
    } else if (Object.keys(thuruthipilly).length > 0) {
      await ctx.db.insert("galaxies_thuruthipilly", { galaxyRef, ...thuruthipilly });
    }
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
