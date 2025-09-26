import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
// Aggregates are not used in this implementation; we rely on Convex indexes + paginate


// Browse galaxies with offset-based pagination for proper page navigation

export const browseGalaxies = query({
  args: {
    // Keep offset for backward-compat, but pagination now uses a cursor
    offset: v.number(),
    numItems: v.number(),
    cursor: v.optional(v.string()),
    sortBy: v.optional(v.union(
      v.literal("id"),
      v.literal("ra"),
      v.literal("dec"),
      v.literal("reff"),
      v.literal("q"),
      v.literal("pa"),
      v.literal("mag"),
      v.literal("mean_mue"),
      v.literal("nucleus"),
      v.literal("numericId")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified")
    )),
    searchTerm: v.optional(v.string()), // Keep for backward compatibility
    searchId: v.optional(v.string()),
    searchRaMin: v.optional(v.string()),
    searchRaMax: v.optional(v.string()),
    searchDecMin: v.optional(v.string()),
    searchDecMax: v.optional(v.string()),
    searchReffMin: v.optional(v.string()),
    searchReffMax: v.optional(v.string()),
    searchQMin: v.optional(v.string()),
    searchQMax: v.optional(v.string()),
    searchPaMin: v.optional(v.string()),
    searchPaMax: v.optional(v.string()),
    searchMagMin: v.optional(v.string()),
    searchMagMax: v.optional(v.string()),
    searchMeanMueMin: v.optional(v.string()),
    searchMeanMueMax: v.optional(v.string()),
    searchNucleus: v.optional(v.boolean()),
    searchTotalClassificationsMin: v.optional(v.string()),
    searchTotalClassificationsMax: v.optional(v.string()),
    searchNumVisibleNucleusMin: v.optional(v.string()),
    searchNumVisibleNucleusMax: v.optional(v.string()),
    searchNumAwesomeFlagMin: v.optional(v.string()),
    searchNumAwesomeFlagMax: v.optional(v.string()),
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        galaxies: [],
        total: 0,
        hasNext: false,
        hasPrevious: false,
        totalPages: 0,
        aggregatesPopulated: false,
        currentBounds: {
          ra: { min: null, max: null },
          dec: { min: null, max: null },
          reff: { min: null, max: null },
          q: { min: null, max: null },
          pa: { min: null, max: null },
          mag: { min: null, max: null },
          mean_mue: { min: null, max: null },
          nucleus: { hasNucleus: false, totalCount: 0 },
        },
        cursor: null as any,
        isDone: true,
      };
    }
    const {
      cursor = null,
      numItems = 100,
      sortBy = "numericId",
      sortOrder = "asc",
      filter,
      searchTerm,
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
      searchAwesome,
      searchValidRedshift,
      searchVisibleNucleus,
    } = args;

    type Sortable = "numericId" | "id" | "ra" | "dec" | "reff" | "q" | "pa" | "mag" | "mean_mue" | "nucleus";
    const allowedSort: Record<Sortable, { index: string; field: string }> = {
      numericId: { index: "by_numeric_id", field: "numericId" },
      id: { index: "by_external_id", field: "id" },
      ra: { index: "by_ra", field: "ra" },
      dec: { index: "by_dec", field: "dec" },
      reff: { index: "by_reff", field: "reff" },
      q: { index: "by_q", field: "q" },
      pa: { index: "by_pa", field: "pa" },
      mag: { index: "by_mag", field: "mag" },
      mean_mue: { index: "by_mean_mue", field: "mean_mue" },
      nucleus: { index: "by_nucleus", field: "nucleus" },
    };
    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    // Pick best index starting with the sort key and optionally second fields based on filters
    let indexName = allowedSort[requestedSort].index;
    let indexBuilder: ((qb: any) => any) | undefined = undefined;

    const applyRange = (qb: any, field: string, min?: string, max?: string) => {
      let out = qb;
      if (min) out = out.gte(field, parseFloat(min));
      if (max) out = out.lte(field, parseFloat(max));
      return out;
    };

    switch (requestedSort) {
      case "numericId":
        if (searchNucleus !== undefined) {
          indexName = "by_numericId_nucleus";
          indexBuilder = (qb) => qb.eq("nucleus", !!searchNucleus);
        } else if (searchMagMin || searchMagMax) {
          indexName = "by_numericId_mag";
        } else if (searchMeanMueMin || searchMeanMueMax) {
          indexName = "by_numericId_mean_mue";
        } else if (searchQMin || searchQMax) {
          indexName = "by_numericId_q";
        } else if (searchReffMin || searchReffMax) {
          indexName = "by_numericId_reff";
        }
        break;
      case "ra":
        if (searchDecMin || searchDecMax) {
          indexName = "by_ra_dec";
          indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
        } else if (searchRaMin || searchRaMax) {
          indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
        }
        break;
      case "reff":
        if (searchMeanMueMin || searchMeanMueMax) {
          indexName = "by_reff_mean_mue";
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        } else if (searchMagMin || searchMagMax) {
          indexName = "by_reff_mag";
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        } else if (searchReffMin || searchReffMax) {
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        }
        break;
      case "mag":
        if (searchReffMin || searchReffMax) {
          indexName = "by_mag_reff";
          indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
        } else if (searchMagMin || searchMagMax) {
          indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
        }
        break;
      case "mean_mue":
        if (searchReffMin || searchReffMax) {
          indexName = "by_mean_mue_reff";
          indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
        } else if (searchMeanMueMin || searchMeanMueMax) {
          indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
        }
        break;
      case "q":
        if (searchReffMin || searchReffMax) {
          indexName = "by_q_reff";
          indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
        } else if (searchQMin || searchQMax) {
          indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
        }
        break;
      case "nucleus":
        if (searchNucleus !== undefined) {
          indexBuilder = (qb) => qb.eq("nucleus", !!searchNucleus);
          if (searchMagMin || searchMagMax) indexName = "by_nucleus_mag";
          else if (searchMeanMueMin || searchMeanMueMax) indexName = "by_nucleus_mean_mue";
          else if (searchQMin || searchQMax) indexName = "by_nucleus_q";
        }
        break;
      case "id":
        if (searchId) {
          indexBuilder = (qb) => qb.eq("id", searchId.trim());
        }
        break;
      case "dec":
        if (searchDecMin || searchDecMax) {
          indexBuilder = (qb) => applyRange(qb, "dec", searchDecMin, searchDecMax);
        }
        break;
      case "pa":
        if (searchPaMin || searchPaMax) {
          indexBuilder = (qb) => applyRange(qb, "pa", searchPaMin, searchPaMax);
        }
        break;
    }

    // Start query with index and sort order
    let qBase = ctx.db.query("galaxies");
    let q: any = indexBuilder
      ? qBase.withIndex(indexName as any, indexBuilder as any)
      : qBase.withIndex(indexName as any);
    q = q.order(sortOrder as any);

    // Apply additional filters via chained .filter calls
  if (searchId) q = q.filter((f: any) => f.eq(f.field("id"), searchId.trim()));
  if (searchRaMin) q = q.filter((f: any) => f.gte(f.field("ra"), parseFloat(searchRaMin)));
  if (searchRaMax) q = q.filter((f: any) => f.lte(f.field("ra"), parseFloat(searchRaMax)));
  if (searchDecMin) q = q.filter((f: any) => f.gte(f.field("dec"), parseFloat(searchDecMin)));
  if (searchDecMax) q = q.filter((f: any) => f.lte(f.field("dec"), parseFloat(searchDecMax)));
  if (searchReffMin) q = q.filter((f: any) => f.gte(f.field("reff"), parseFloat(searchReffMin)));
  if (searchReffMax) q = q.filter((f: any) => f.lte(f.field("reff"), parseFloat(searchReffMax)));
  if (searchQMin) q = q.filter((f: any) => f.gte(f.field("q"), parseFloat(searchQMin)));
  if (searchQMax) q = q.filter((f: any) => f.lte(f.field("q"), parseFloat(searchQMax)));
  if (searchPaMin) q = q.filter((f: any) => f.gte(f.field("pa"), parseFloat(searchPaMin)));
  if (searchPaMax) q = q.filter((f: any) => f.lte(f.field("pa"), parseFloat(searchPaMax)));
  if (searchMagMin) q = q.filter((f: any) => f.gte(f.field("mag"), parseFloat(searchMagMin)));
  if (searchMagMax) q = q.filter((f: any) => f.lte(f.field("mag"), parseFloat(searchMagMax)));
  if (searchMeanMueMin) q = q.filter((f: any) => f.gte(f.field("mean_mue"), parseFloat(searchMeanMueMin)));
  if (searchMeanMueMax) q = q.filter((f: any) => f.lte(f.field("mean_mue"), parseFloat(searchMeanMueMax)));
  if (searchNucleus !== undefined) q = q.filter((f: any) => f.eq(f.field("nucleus"), !!searchNucleus));

    const { page, isDone, continueCursor } = await q.paginate({ numItems, cursor: cursor || null });
    let galaxies: any[] = page;

    // We rely on server-side filtering above; no additional in-memory filtering/pagination here
    let searchFilteredTotal = 0;
    
    if (filter === "classified") {
      galaxies = galaxies.filter(g => (g.totalClassifications || 0) > 0);
      // Get total count of classified galaxies (those with totalClassifications > 0)
      // For simplicity, set to length; in future, could compute total
      
    }
    else if (filter === "unclassified") {
      galaxies = galaxies.filter(g => (g.totalClassifications || 0) === 0);
      // Total unknown without full scan; leave as 0
      
    }
    else if (filter === "my_sequence") {
      // Get user's sequence
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      if (userSequence && userSequence.galaxyExternalIds) {
        const sequenceIds = new Set(userSequence.galaxyExternalIds);
        galaxies = galaxies.filter(g => sequenceIds.has(g.id));
        
      } else {
        // No sequence found, return empty array
        galaxies = [];
        
      }
    }

    // Apply classification-based search filters
    if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
      galaxies = galaxies.filter(g => {
        const total = g.totalClassifications || 0;
        if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
        if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
        return true;
      });
      
      // Update total count for classification searches
    }

    // Apply numVisibleNucleus search filters
    if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
      galaxies = galaxies.filter(g => {
        const total = g.numVisibleNucleus || 0;
        if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
        if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
        return true;
      });
    }

    // Apply numAwesomeFlag search filters
    if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
      galaxies = galaxies.filter(g => {
        const total = g.numAwesomeFlag || 0;
        if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
        if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
        return true;
      });
    }

    // Apply totalAssigned search filters
    if (searchTotalAssignedMin || searchTotalAssignedMax) {
      galaxies = galaxies.filter(g => {
        const total = g.totalAssigned || 0;
        if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
        if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
        return true;
      });
    }

    searchFilteredTotal = galaxies.length;

    // Get total count for pagination info
    const total = searchFilteredTotal; // unknown overall; 0 unless a specific narrow search was performed
    const totalPages = 0;
    const hasNext = !isDone;
    const hasPrevious = false; // client tracks previous cursors

    // Calculate bounds of current result set for placeholders

    const raValues = galaxies.map(g => g.ra).filter(v => !isNaN(v));
    const decValues = galaxies.map(g => g.dec).filter(v => !isNaN(v));
    const reffValues = galaxies.map(g => g.reff).filter(v => !isNaN(v));
    const qValues = galaxies.map(g => g.q).filter(v => !isNaN(v));
    const paValues = galaxies.map(g => g.pa).filter(v => !isNaN(v));
    const magValues = galaxies.map(g => g.mag).filter(v => v !== undefined && !isNaN(v));
    const meanMueValues = galaxies.map(g => g.mean_mue).filter(v => v !== undefined && !isNaN(v));
    const nucleusCount = galaxies.filter(g => g.nucleus === true).length;

    const currentBounds = {
      ra: {
        min: raValues.length > 0 ? Math.min(...raValues) : null,
        max: raValues.length > 0 ? Math.max(...raValues) : null,
      },
      dec: {
        min: decValues.length > 0 ? Math.min(...decValues) : null,
        max: decValues.length > 0 ? Math.max(...decValues) : null,
      },
      reff: {
        min: reffValues.length > 0 ? Math.min(...reffValues) : null,
        max: reffValues.length > 0 ? Math.max(...reffValues) : null,
      },
      q: {
        min: qValues.length > 0 ? Math.min(...qValues) : null,
        max: qValues.length > 0 ? Math.max(...qValues) : null,
      },
      pa: {
        min: paValues.length > 0 ? Math.min(...paValues) : null,
        max: paValues.length > 0 ? Math.max(...paValues) : null,
      },
      mag: {
        min: magValues.length > 0 ? Math.min(...(magValues as number[])) : null,
        max: magValues.length > 0 ? Math.max(...(magValues as number[])) : null,
      },
      mean_mue: {
        min: meanMueValues.length > 0 ? Math.min(...(meanMueValues as number[])) : null,
        max: meanMueValues.length > 0 ? Math.max(...(meanMueValues as number[])) : null,
      },
      nucleus: {
        hasNucleus: nucleusCount > 0,
        totalCount: galaxies.length,
      },
    };

    return {
      galaxies: galaxies,
      total,
      hasNext,
      hasPrevious,
      totalPages,
      aggregatesPopulated: false,
      cursor: continueCursor,
      isDone,
      currentBounds,
    };
  },
});

// Get min/max values for search field prefill
export const getGalaxySearchBounds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ra: { min: null, max: null },
        dec: { min: null, max: null },
        reff: { min: null, max: null },
        q: { min: null, max: null },
        pa: { min: null, max: null },
        mag: { min: null, max: null },
        mean_mue: { min: null, max: null },
        nucleus: { hasNucleus: false, totalCount: 0 },
        totalClassifications: { min: null, max: null },
        numVisibleNucleus: { min: null, max: null },
        numAwesomeFlag: { min: null, max: null },
        totalAssigned: { min: null, max: null },
      };
    }

    // Get all galaxies to calculate bounds
    const allGalaxies = await ctx.db.query("galaxies").collect();

    if (allGalaxies.length === 0) {
      return {
        ra: { min: null, max: null },
        dec: { min: null, max: null },
        reff: { min: null, max: null },
        q: { min: null, max: null },
        pa: { min: null, max: null },
        mag: { min: null, max: null },
        mean_mue: { min: null, max: null },
        nucleus: { hasNucleus: false, totalCount: 0 },
        totalClassifications: { min: null, max: null },
        numVisibleNucleus: { min: null, max: null },
        numAwesomeFlag: { min: null, max: null },
        totalAssigned: { min: null, max: null },
      };
    }

    // Calculate min/max for numeric fields
    const raValues = allGalaxies.map(g => g.ra).filter(v => !isNaN(v));
    const decValues = allGalaxies.map(g => g.dec).filter(v => !isNaN(v));
    const reffValues = allGalaxies.map(g => g.reff).filter(v => !isNaN(v));
    const qValues = allGalaxies.map(g => g.q).filter(v => !isNaN(v));
    const paValues = allGalaxies.map(g => g.pa).filter(v => !isNaN(v));
    const magValues = allGalaxies.map(g => g.mag).filter(v => v !== undefined && !isNaN(v));
    const meanMueValues = allGalaxies.map(g => g.mean_mue).filter(v => v !== undefined && !isNaN(v));
    const totalClassificationsValues = allGalaxies.map(g => Number(g.totalClassifications || 0)).filter(v => v >= 0);
    const numVisibleNucleusValues = allGalaxies.map(g => Number(g.numVisibleNucleus || 0)).filter(v => v >= 0);
    const numAwesomeFlagValues = allGalaxies.map(g => Number(g.numAwesomeFlag || 0)).filter(v => v >= 0);
    const totalAssignedValues = allGalaxies.map(g => Number(g.totalAssigned || 0)).filter(v => v >= 0);

    // Count galaxies with nucleus
    const nucleusCount = allGalaxies.filter(g => g.nucleus === true).length;

    return {
      ra: {
        min: raValues.length > 0 ? Math.min(...raValues) : null,
        max: raValues.length > 0 ? Math.max(...raValues) : null,
      },
      dec: {
        min: decValues.length > 0 ? Math.min(...decValues) : null,
        max: decValues.length > 0 ? Math.max(...decValues) : null,
      },
      reff: {
        min: reffValues.length > 0 ? Math.min(...reffValues) : null,
        max: reffValues.length > 0 ? Math.max(...reffValues) : null,
      },
      q: {
        min: qValues.length > 0 ? Math.min(...qValues) : null,
        max: qValues.length > 0 ? Math.max(...qValues) : null,
      },
      pa: {
        min: paValues.length > 0 ? Math.min(...paValues) : null,
        max: paValues.length > 0 ? Math.max(...paValues) : null,
      },
      mag: {
        min: magValues.length > 0 ? Math.min(...(magValues as number[])) : null,
        max: magValues.length > 0 ? Math.max(...(magValues as number[])) : null,
      },
      mean_mue: {
        min: meanMueValues.length > 0 ? Math.min(...(meanMueValues as number[])) : null,
        max: meanMueValues.length > 0 ? Math.max(...(meanMueValues as number[])) : null,
      },
      nucleus: {
        hasNucleus: nucleusCount > 0,
        totalCount: allGalaxies.length,
      },
      totalClassifications: {
        min: totalClassificationsValues.length > 0 ? Math.min(...totalClassificationsValues) : null,
        max: totalClassificationsValues.length > 0 ? Math.max(...totalClassificationsValues) : null,
      },
      numVisibleNucleus: {
        min: numVisibleNucleusValues.length > 0 ? Math.min(...numVisibleNucleusValues) : null,
        max: numVisibleNucleusValues.length > 0 ? Math.max(...numVisibleNucleusValues) : null,
      },
      numAwesomeFlag: {
        min: numAwesomeFlagValues.length > 0 ? Math.min(...numAwesomeFlagValues) : null,
        max: numAwesomeFlagValues.length > 0 ? Math.max(...numAwesomeFlagValues) : null,
      },
      totalAssigned: {
        min: totalAssignedValues.length > 0 ? Math.min(...totalAssignedValues) : null,
        max: totalAssignedValues.length > 0 ? Math.max(...totalAssignedValues) : null,
      },
    };
  },
});// Get unique classification values for search dropdowns
export const getClassificationSearchOptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        lsbClasses: [],
        morphologies: [],
      };
    }

    // Get all classifications for this user
    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Extract unique values
    const lsbClasses = [...new Set(classifications.map(c => c.lsb_class).filter(Boolean))].sort();
    const morphologies = [...new Set(classifications.map(c => c.morphology).filter(Boolean))].sort();

    return {
      lsbClasses,
      morphologies,
    };
  },
});
