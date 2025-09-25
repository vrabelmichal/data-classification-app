import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getGalaxiesAggregate } from "./galaxies_aggregates";


// Browse galaxies with offset-based pagination for proper page navigation

export const browseGalaxies = query({
  args: {
    offset: v.number(),
    numItems: v.number(),
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
      v.literal("_creationTime")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
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
    searchClassificationStatus: v.optional(v.union(
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
    )),
    searchLsbClass: v.optional(v.string()),
    searchMorphology: v.optional(v.string()),
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
      };
    }

        const { offset = 0, numItems = 100, sortBy = "id", sortOrder = "asc", filter, searchTerm, searchId, searchRaMin, searchRaMax, searchDecMin, searchDecMax, searchReffMin, searchReffMax, searchQMin, searchQMax, searchPaMin, searchPaMax, searchMagMin, searchMagMax, searchMeanMueMin, searchMeanMueMax, searchNucleus, searchClassificationStatus, searchLsbClass, searchMorphology, searchAwesome, searchValidRedshift, searchVisibleNucleus } = args;

    const aggregate = getGalaxiesAggregate(sortBy);

    // Get total count first to check if aggregates are populated
    const aggregateCount = await aggregate.count(ctx);
    
    let galaxies: any[] = [];
    let actualTotal = aggregateCount;

    if (aggregateCount === 0) {
      // Aggregates are empty, fall back to collecting all galaxies and sorting in memory
      // This handles the case where aggregates haven't been built yet
      const allGalaxies = await ctx.db.query("galaxies").collect();
      
      let sortedGalaxies: any[] = [];
      switch (sortBy) {
        case "id":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
          );
          break;
        case "ra":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.ra - b.ra : b.ra - a.ra
          );
          break;
        case "dec":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.dec - b.dec : b.dec - a.dec
          );
          break;
        case "reff":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.reff - b.reff : b.reff - a.reff
          );
          break;
        case "q":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.q - b.q : b.q - a.q
          );
          break;
        case "pa":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a.pa - b.pa : b.pa - a.pa
          );
          break;
        case "mag":
          sortedGalaxies = allGalaxies.sort((a, b) => {
            const aVal = a.mag ?? Number.MAX_VALUE;
            const bVal = b.mag ?? Number.MAX_VALUE;
            return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
          });
          break;
        case "mean_mue":
          sortedGalaxies = allGalaxies.sort((a, b) => {
            const aVal = a.mean_mue ?? Number.MAX_VALUE;
            const bVal = b.mean_mue ?? Number.MAX_VALUE;
            return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
          });
          break;
        case "nucleus":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? (a.nucleus ? 1 : 0) - (b.nucleus ? 1 : 0) : (b.nucleus ? 1 : 0) - (a.nucleus ? 1 : 0)
          );
          break;
        case "_creationTime":
          sortedGalaxies = allGalaxies.sort((a, b) => 
            sortOrder === "asc" ? a._creationTime - b._creationTime : b._creationTime - a._creationTime
          );
          break;
      }
      
      // Apply offset and limit
      galaxies = sortedGalaxies.slice(offset, offset + numItems);
      
      // Get actual total count
      actualTotal = allGalaxies.length;
    } else {
      // Use aggregates for efficient pagination
      try {
        // Get the key at the specified offset
        const { key } = await aggregate.at(ctx, offset);

        // Build query based on sort field
        switch (sortBy) {
          case "id":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_external_id", q => q.gte("id", key as string))
              .order(sortOrder)
              .take(numItems);
            break;
          case "ra":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_ra", q => q.gte("ra", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "dec":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_dec", q => q.gte("dec", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "reff":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_reff", q => q.gte("reff", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "q":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_q", q => q.gte("q", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "pa":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_pa", q => q.gte("pa", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "mag":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_mag", q => q.gte("mag", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "mean_mue":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_mean_mue", q => q.gte("mean_mue", key as number))
              .order(sortOrder)
              .take(numItems);
            break;
          case "nucleus":
            galaxies = await ctx.db.query("galaxies")
              .withIndex("by_nucleus", q => q.gte("nucleus", key as boolean))
              .order(sortOrder)
              .take(numItems);
            break;
          case "_creationTime":
            // For _creationTime, we need to collect all and sort in memory since no index supports gte on _creationTime
            const allGalaxies = await ctx.db.query("galaxies").collect();
            const sortedByCreationTime = allGalaxies
              .sort((a, b) => sortOrder === "asc" ? a._creationTime - b._creationTime : b._creationTime - a._creationTime)
              .slice(offset, offset + numItems);
            galaxies = sortedByCreationTime;
            break;
        }
      } catch (error) {
        // If aggregate fails for any reason, fall back to regular pagination
        console.warn("Aggregate query failed, falling back to regular pagination:", error);
        const fallbackResult = await ctx.db.query("galaxies")
          .withIndex("by_external_id")
          .order(sortOrder)
          .paginate({ numItems, cursor: null });
        galaxies = fallbackResult.page;
        actualTotal = await ctx.db.query("galaxies").collect().then(g => g.length);
      }
    }

    // Apply search filtering if needed (range-based search)
    let searchFilteredGalaxies: any[] = [];
    let searchFilteredTotal = actualTotal;
    
    if (searchId || searchRaMin || searchRaMax || searchDecMin || searchDecMax || searchReffMin || searchReffMax || searchQMin || searchQMax || searchPaMin || searchPaMax || searchMagMin || searchMagMax || searchMeanMueMin || searchMeanMueMax || searchNucleus !== undefined || searchTerm || searchClassificationStatus || searchLsbClass || searchMorphology || searchAwesome !== undefined || searchValidRedshift !== undefined || searchVisibleNucleus !== undefined) {
      // When searching, we need to filter the entire dataset before pagination
      // Fall back to collecting all galaxies and filtering in memory
      const allGalaxies = await ctx.db.query("galaxies").collect();
      
      searchFilteredGalaxies = allGalaxies.filter(g => {
        // Check each search field for range or exact match
        if (searchId && g.id !== searchId.trim()) return false;
        
        // RA range search
        if (searchRaMin && g.ra < parseFloat(searchRaMin)) return false;
        if (searchRaMax && g.ra > parseFloat(searchRaMax)) return false;
        
        // Dec range search
        if (searchDecMin && g.dec < parseFloat(searchDecMin)) return false;
        if (searchDecMax && g.dec > parseFloat(searchDecMax)) return false;
        
        // Reff range search
        if (searchReffMin && g.reff < parseFloat(searchReffMin)) return false;
        if (searchReffMax && g.reff > parseFloat(searchReffMax)) return false;
        
        // Q range search
        if (searchQMin && g.q < parseFloat(searchQMin)) return false;
        if (searchQMax && g.q > parseFloat(searchQMax)) return false;
        
        // PA range search
        if (searchPaMin && g.pa < parseFloat(searchPaMin)) return false;
        if (searchPaMax && g.pa > parseFloat(searchPaMax)) return false;
        
        // Mag range search
        if (searchMagMin && g.mag !== undefined && g.mag < parseFloat(searchMagMin)) return false;
        if (searchMagMax && g.mag !== undefined && g.mag > parseFloat(searchMagMax)) return false;
        
        // Mean Mue range search
        if (searchMeanMueMin && g.mean_mue !== undefined && g.mean_mue < parseFloat(searchMeanMueMin)) return false;
        if (searchMeanMueMax && g.mean_mue !== undefined && g.mean_mue > parseFloat(searchMeanMueMax)) return false;
        
        // Nucleus boolean search
        if (searchNucleus !== undefined) {
          if (searchNucleus === true && g.nucleus !== true) return false;
          if (searchNucleus === false && g.nucleus === true) return false;
        }
        
        // Backward compatibility: fuzzy search on old searchTerm field
        if (searchTerm && searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          return g.id.toLowerCase().includes(term) ||
                 g.ra.toString().includes(term) ||
                 g.dec.toString().includes(term);
        }
        
        return true;
      });
      
      searchFilteredTotal = searchFilteredGalaxies.length;
      
      // Apply sorting to search results
      searchFilteredGalaxies = searchFilteredGalaxies.sort((a, b) => {
        switch (sortBy) {
          case "id":
            return sortOrder === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
          case "ra":
            return sortOrder === "asc" ? a.ra - b.ra : b.ra - a.ra;
          case "dec":
            return sortOrder === "asc" ? a.dec - b.dec : b.dec - a.dec;
          case "reff":
            return sortOrder === "asc" ? a.reff - b.reff : b.reff - a.reff;
          case "q":
            return sortOrder === "asc" ? a.q - b.q : b.q - a.q;
          case "pa":
            return sortOrder === "asc" ? a.pa - b.pa : b.pa - a.pa;
          case "mag":
            const aMag = a.mag ?? Number.MAX_VALUE;
            const bMag = b.mag ?? Number.MAX_VALUE;
            return sortOrder === "asc" ? aMag - bMag : bMag - aMag;
          case "mean_mue":
            const aMue = a.mean_mue ?? Number.MAX_VALUE;
            const bMue = b.mean_mue ?? Number.MAX_VALUE;
            return sortOrder === "asc" ? aMue - bMue : bMue - aMue;
          case "nucleus":
            return sortOrder === "asc" ? (a.nucleus ? 1 : 0) - (b.nucleus ? 1 : 0) : (b.nucleus ? 1 : 0) - (a.nucleus ? 1 : 0);
          case "_creationTime":
            return sortOrder === "asc" ? a._creationTime - b._creationTime : b._creationTime - a._creationTime;
          default:
            return 0;
        }
      });
      
      // Apply pagination to search results
      searchFilteredGalaxies = searchFilteredGalaxies.slice(offset, offset + numItems);
    }

    // Enrich with classification and skip data
    const galaxiesToEnrich = searchFilteredGalaxies.length > 0 ? searchFilteredGalaxies : galaxies;
    const enriched = await Promise.all(galaxiesToEnrich.map(async (galaxy) => {
      const classification = await ctx.db
        .query("classifications")
        .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxy.id))
        .unique();
      const skipped = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxy.id))
        .unique();
      const status = classification ? "classified" : skipped ? "skipped" : "unclassified";
      return { ...galaxy, classification, isSkipped: !!skipped, status };
    }));

    // Apply status filters
    let finalGalaxies = enriched;
    
    if (filter === "classified") {
      finalGalaxies = enriched.filter(g => g.status === "classified");
      // Get total count of user's classifications
      const classificationCount = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
        .then(classifications => classifications.length);
      searchFilteredTotal = classificationCount;
    }
    else if (filter === "unclassified") {
      finalGalaxies = enriched.filter(g => g.status === "unclassified");
      // Get total count of galaxies that are not classified or skipped by this user
      const [classificationCount, skippedCount] = await Promise.all([
        ctx.db.query("classifications")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
          .then(classifications => classifications.length),
        ctx.db.query("skippedGalaxies")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
          .then(skipped => skipped.length)
      ]);
      searchFilteredTotal = actualTotal - classificationCount - skippedCount;
    }
    else if (filter === "skipped") {
      finalGalaxies = enriched.filter(g => g.status === "skipped");
      // Get total count of user's skipped galaxies
      const skippedCount = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
        .then(skipped => skipped.length);
      searchFilteredTotal = skippedCount;
    }
    else if (filter === "my_sequence") {
      // Get user's sequence
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      if (userSequence && userSequence.galaxyExternalIds) {
        const sequenceIds = new Set(userSequence.galaxyExternalIds);
        finalGalaxies = enriched.filter(g => sequenceIds.has(g.id));
        searchFilteredTotal = userSequence.galaxyExternalIds.length;
      } else {
        // No sequence found, return empty array
        finalGalaxies = [];
        searchFilteredTotal = 0;
      }
    }

    // Apply classification-based search filters
    if (searchClassificationStatus || searchLsbClass || searchMorphology || searchAwesome !== undefined || searchValidRedshift !== undefined || searchVisibleNucleus !== undefined) {
      finalGalaxies = finalGalaxies.filter(g => {
        // Classification status search
        if (searchClassificationStatus && g.status !== searchClassificationStatus) return false;
        
        // Only apply classification field searches if galaxy has a classification
        if (!g.classification) {
          // If searching for specific classification fields but galaxy has no classification, exclude it
          if (searchLsbClass || searchMorphology || searchAwesome !== undefined || searchValidRedshift !== undefined || searchVisibleNucleus !== undefined) {
            return false;
          }
          return true;
        }
        
        // LSB class search
        if (searchLsbClass && g.classification.lsb_class !== searchLsbClass) return false;
        
        // Morphology search
        if (searchMorphology && g.classification.morphology !== searchMorphology) return false;
        
        // Awesome flag search
        if (searchAwesome !== undefined && g.classification.awesome_flag !== searchAwesome) return false;
        
        // Valid redshift search
        if (searchValidRedshift !== undefined && g.classification.valid_redshift !== searchValidRedshift) return false;
        
        // Visible nucleus search
        if (searchVisibleNucleus !== undefined && g.classification.visible_nucleus !== searchVisibleNucleus) return false;
        
        return true;
      });
      
      // Update total count for classification searches
      searchFilteredTotal = finalGalaxies.length;
    }

    // Get total count for pagination info
    const total = searchFilteredTotal;
    const totalPages = Math.ceil(total / numItems);
    const hasNext = offset + numItems < total;
    const hasPrevious = offset > 0;

    // Calculate bounds of current result set for placeholders
    const resultGalaxies = finalGalaxies;
    const raValues = resultGalaxies.map(g => g.ra).filter(v => !isNaN(v));
    const decValues = resultGalaxies.map(g => g.dec).filter(v => !isNaN(v));
    const reffValues = resultGalaxies.map(g => g.reff).filter(v => !isNaN(v));
    const qValues = resultGalaxies.map(g => g.q).filter(v => !isNaN(v));
    const paValues = resultGalaxies.map(g => g.pa).filter(v => !isNaN(v));
    const magValues = resultGalaxies.map(g => g.mag).filter(v => v !== undefined && !isNaN(v));
    const meanMueValues = resultGalaxies.map(g => g.mean_mue).filter(v => v !== undefined && !isNaN(v));
    const nucleusCount = resultGalaxies.filter(g => g.nucleus === true).length;

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
        totalCount: resultGalaxies.length,
      },
    };

    return {
      galaxies: finalGalaxies,
      total,
      hasNext,
      hasPrevious,
      totalPages,
      aggregatesPopulated: aggregateCount > 0,
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
