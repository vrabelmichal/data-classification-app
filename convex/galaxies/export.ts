import { v } from "convex/values";
import { query } from "../_generated/server";
import { getOptionalUserId } from "../lib/auth";
import { DEFAULT_SYSTEM_SETTINGS } from "../lib/defaults";

/**
 * Export galaxies with pagination for batch export.
 * Returns galaxies in batches for client-side CSV generation.
 * Simpler than browseGalaxies - only handles "all" filter with basic search.
 */
export const exportGalaxiesBatch = query({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
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
      v.literal("numericId"),
      v.literal("totalClassifications"),
      v.literal("numVisibleNucleus"),
      v.literal("numAwesomeFlag"),
      v.literal("numFailedFitting"),
      v.literal("totalAssigned")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
    )),
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
    searchNumFailedFittingMin: v.optional(v.string()),
    searchNumFailedFittingMax: v.optional(v.string()),
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
    // For limiting exports
    offset: v.optional(v.number()),
    totalExportedSoFar: v.optional(v.number()),
    maxExportLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return {
        galaxies: [],
        cursor: null,
        isDone: true,
        error: "Not authenticated",
      };
    }

    // Get user profile to check admin status
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const isAdmin = userProfile?.role === "admin";
    
    // Get user export limit from system settings
    const settingsRows = await ctx.db.query("systemSettings").collect();
    const settingsMap = settingsRows.reduce((acc, setting) => {
      acc[setting.key as string] = setting.value;
      return acc;
    }, {} as Record<string, unknown>);
    const userExportLimit = (settingsMap.userExportLimit as number) ?? DEFAULT_SYSTEM_SETTINGS.userExportLimit;

    // For non-admins, enforce export limit; for admins, respect requested limit if provided
    const requestedLimit = args.maxExportLimit;
    const hardLimit = isAdmin ? undefined : userExportLimit;
    const effectiveMaxLimit =
      hardLimit !== undefined && hardLimit >= 0
        ? requestedLimit !== undefined
          ? Math.min(requestedLimit, hardLimit)
          : hardLimit
        : requestedLimit;
    const totalExportedSoFar = args.totalExportedSoFar ?? 0;

    // Check if we've already hit the limit
    if (effectiveMaxLimit !== undefined && effectiveMaxLimit >= 0 && totalExportedSoFar >= effectiveMaxLimit) {
      return {
        galaxies: [],
        cursor: null,
        isDone: true,
        limitReached: true,
      };
    }

    const {
      cursor = null,
      batchSize = 500,
      sortBy = "numericId",
      sortOrder = "asc",
      filter = "all",
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
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    } = args;

    // Calculate how many more we can fetch based on limit
    let remainingToFetch = batchSize;
    if (effectiveMaxLimit !== undefined && effectiveMaxLimit > 0) {
      remainingToFetch = Math.min(batchSize, effectiveMaxLimit - totalExportedSoFar);
      if (remainingToFetch <= 0) {
        return {
          galaxies: [],
          cursor: null,
          isDone: true,
          limitReached: true,
        };
      }
    }

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

    type Sortable =
      | "numericId"
      | "id"
      | "ra"
      | "dec"
      | "reff"
      | "q"
      | "pa"
      | "mag"
      | "mean_mue"
      | "nucleus"
      | "totalClassifications"
      | "numVisibleNucleus"
      | "numAwesomeFlag"
      | "numFailedFitting"
      | "totalAssigned";

    const allowedSort: Record<Sortable, { index: string }> = {
      numericId: { index: "by_numeric_id" },
      id: { index: "by_external_id" },
      ra: { index: "by_ra" },
      dec: { index: "by_dec" },
      reff: { index: "by_reff" },
      q: { index: "by_q" },
      pa: { index: "by_pa" },
      mag: { index: "by_mag" },
      mean_mue: { index: "by_mean_mue" },
      nucleus: { index: "by_nucleus" },
      totalClassifications: { index: "by_totalClassifications" },
      numVisibleNucleus: { index: "by_numVisibleNucleus" },
      numAwesomeFlag: { index: "by_numAwesomeFlag" },
      numFailedFitting: { index: "by_numFailedFitting" },
      totalAssigned: { index: "by_totalAssigned_numericId" },
    };
    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    // Handle special filter cases - for export, we simplify and do post-filtering
    if (filter === "skipped" || filter === "my_sequence" || filter === "classified" || filter === "unclassified") {
      // For these filters, use offset-based pagination (simpler for export)
      const baseOffset = args.offset ?? 0;
      const offsetFromCursor = cursor ? parseInt(cursor, 10) : baseOffset;

      let galaxyExternalIds: string[] = [];

      if (filter === "skipped") {
        const skippedRecords = await ctx.db
          .query("skippedGalaxies")
          .withIndex("by_user", (q: any) => q.eq("userId", userId))
          .collect();
        galaxyExternalIds = skippedRecords.map((r) => r.galaxyExternalId);
      } else if (filter === "my_sequence") {
        const sequence = await ctx.db
          .query("galaxySequences")
          .withIndex("by_user", (q: any) => q.eq("userId", userId))
          .unique();
        galaxyExternalIds = sequence?.galaxyExternalIds ?? [];
      } else if (filter === "classified") {
        const classifications = await ctx.db
          .query("classifications")
          .withIndex("by_user", (q: any) => q.eq("userId", userId))
          .collect();
        galaxyExternalIds = classifications.map((c) => c.galaxyExternalId);
      } else if (filter === "unclassified") {
        // For unclassified, process in streaming batches without accumulating all IDs
        const classifications = await ctx.db
          .query("classifications")
          .withIndex("by_user", (q: any) => q.eq("userId", userId))
          .collect();
        const classifiedIds = new Set(classifications.map((c) => c.galaxyExternalId));

        // Use cursor-based pagination directly on galaxies table
        const galaxyCursor = cursor || null;
        const page = await ctx.db.query("galaxies").paginate({
          cursor: galaxyCursor,
          numItems: remainingToFetch * 2, // Fetch extra to account for filtering
        });

        const galaxies: any[] = [];
        for (const galaxy of page.page) {
          if (classifiedIds.has(galaxy.id)) continue; // Skip classified
          // Apply search filters
          if (applySearchFilters(galaxy, {
            searchId, searchRaMin, searchRaMax, searchDecMin, searchDecMax,
            searchReffMin, searchReffMax, searchQMin, searchQMax,
            searchPaMin, searchPaMax, searchMagMin, searchMagMax,
            searchMeanMueMin, searchMeanMueMax, searchNucleus,
            searchTotalClassificationsMin, searchTotalClassificationsMax,
            searchNumVisibleNucleusMin, searchNumVisibleNucleusMax,
            searchNumAwesomeFlagMin, searchNumAwesomeFlagMax,
            searchNumFailedFittingMin, searchNumFailedFittingMax,
            searchTotalAssignedMin, searchTotalAssignedMax,
          })) {
            galaxies.push(galaxy);
            if (galaxies.length >= remainingToFetch) break;
          }
        }

        const limitReached = effectiveMaxLimit !== undefined &&
          (totalExportedSoFar + galaxies.length) >= effectiveMaxLimit;

        return {
          galaxies: galaxies.map(formatGalaxyForExport),
          cursor: page.isDone || limitReached ? null : page.continueCursor,
          isDone: page.isDone || limitReached,
          limitReached,
        };
      }

      // Fetch galaxies by external IDs with offset pagination
      const startIdx = offsetFromCursor;
      const endIdx = Math.min(startIdx + remainingToFetch, galaxyExternalIds.length);
      const idsToFetch = galaxyExternalIds.slice(startIdx, endIdx);

      const galaxies: any[] = [];
      for (const externalId of idsToFetch) {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q: any) => q.eq("id", externalId))
          .unique();
        if (galaxy) {
          // Apply search filters
          if (applySearchFilters(galaxy, {
            searchId, searchRaMin, searchRaMax, searchDecMin, searchDecMax,
            searchReffMin, searchReffMax, searchQMin, searchQMax,
            searchPaMin, searchPaMax, searchMagMin, searchMagMax,
            searchMeanMueMin, searchMeanMueMax, searchNucleus,
            searchTotalClassificationsMin, searchTotalClassificationsMax,
            searchNumVisibleNucleusMin, searchNumVisibleNucleusMax,
            searchNumAwesomeFlagMin, searchNumAwesomeFlagMax,
            searchNumFailedFittingMin, searchNumFailedFittingMax,
            searchTotalAssignedMin, searchTotalAssignedMax,
          })) {
            galaxies.push(galaxy);
          }
        }
      }

      const newOffset = endIdx;
      const isDone = newOffset >= galaxyExternalIds.length;
      const limitReached = effectiveMaxLimit !== undefined &&
        (totalExportedSoFar + galaxies.length) >= effectiveMaxLimit;

      return {
        galaxies: galaxies.map(formatGalaxyForExport),
        cursor: isDone || limitReached ? null : String(newOffset),
        isDone: isDone || limitReached,
        limitReached,
      };
    }

    // Default: all galaxies with standard pagination
    const indexName = allowedSort[requestedSort].index;
    let queryBuilder: any = ctx.db.query("galaxies").withIndex(indexName as any);
    queryBuilder = queryBuilder.order(normalizedSortOrder as any);

    // Handle offset: if this is the first batch (no cursor) and offset is specified, skip items
    const baseOffset = args.offset ?? 0;
    const shouldSkipForOffset = !cursor && baseOffset > 0;
    const numItemsToFetch = shouldSkipForOffset ? remainingToFetch + baseOffset : remainingToFetch;

    const paginationResult = await queryBuilder.paginate({
      cursor: cursor as any ?? null,
      numItems: numItemsToFetch,
    });

    // If we fetched extra items for offset, skip them
    const pageResults = shouldSkipForOffset ? paginationResult.page.slice(baseOffset) : paginationResult.page;

    // Apply search filters
    const filteredGalaxies = pageResults.filter((g: any) => 
      applySearchFilters(g, {
        searchId, searchRaMin, searchRaMax, searchDecMin, searchDecMax,
        searchReffMin, searchReffMax, searchQMin, searchQMax,
        searchPaMin, searchPaMax, searchMagMin, searchMagMax,
        searchMeanMueMin, searchMeanMueMax, searchNucleus,
        searchTotalClassificationsMin, searchTotalClassificationsMax,
        searchNumVisibleNucleusMin, searchNumVisibleNucleusMax,
        searchNumAwesomeFlagMin, searchNumAwesomeFlagMax,
        searchNumFailedFittingMin, searchNumFailedFittingMax,
        searchTotalAssignedMin, searchTotalAssignedMax,
      })
    );

    const limitReached = effectiveMaxLimit !== undefined &&
      (totalExportedSoFar + filteredGalaxies.length) >= effectiveMaxLimit;

    return {
      galaxies: filteredGalaxies.map(formatGalaxyForExport),
      cursor: paginationResult.isDone || limitReached ? null : paginationResult.continueCursor,
      isDone: paginationResult.isDone || limitReached,
      limitReached,
    };
  },
});

/**
 * Format galaxy for export (subset of fields)
 */
function formatGalaxyForExport(g: any) {
  return {
    id: g.id,
    numericId: g.numericId ? String(g.numericId) : null,
    ra: g.ra,
    dec: g.dec,
    reff: g.reff,
    q: g.q,
    pa: g.pa,
    mag: g.mag,
    mean_mue: g.mean_mue,
    nucleus: g.nucleus,
    totalClassifications: g.totalClassifications ? Number(g.totalClassifications) : 0,
    numVisibleNucleus: g.numVisibleNucleus ? Number(g.numVisibleNucleus) : 0,
    numAwesomeFlag: g.numAwesomeFlag ? Number(g.numAwesomeFlag) : 0,
    numFailedFitting: g.numFailedFitting ? Number(g.numFailedFitting) : 0,
    totalAssigned: g.totalAssigned ? Number(g.totalAssigned) : 0,
  };
}

/**
 * Check if a galaxy passes search filters
 */
function applySearchFilters(g: any, filters: {
  searchId?: string;
  searchRaMin?: string;
  searchRaMax?: string;
  searchDecMin?: string;
  searchDecMax?: string;
  searchReffMin?: string;
  searchReffMax?: string;
  searchQMin?: string;
  searchQMax?: string;
  searchPaMin?: string;
  searchPaMax?: string;
  searchMagMin?: string;
  searchMagMax?: string;
  searchMeanMueMin?: string;
  searchMeanMueMax?: string;
  searchNucleus?: boolean;
  searchTotalClassificationsMin?: string;
  searchTotalClassificationsMax?: string;
  searchNumVisibleNucleusMin?: string;
  searchNumVisibleNucleusMax?: string;
  searchNumAwesomeFlagMin?: string;
  searchNumAwesomeFlagMax?: string;
  searchNumFailedFittingMin?: string;
  searchNumFailedFittingMax?: string;
  searchTotalAssignedMin?: string;
  searchTotalAssignedMax?: string;
}): boolean {
  // ID filter (exact match or partial)
  if (filters.searchId) {
    const searchIdLower = filters.searchId.toLowerCase().trim();
    if (!g.id?.toLowerCase().includes(searchIdLower)) return false;
  }

  // Range filters
  if (filters.searchRaMin && g.ra !== undefined && g.ra < parseFloat(filters.searchRaMin)) return false;
  if (filters.searchRaMax && g.ra !== undefined && g.ra > parseFloat(filters.searchRaMax)) return false;
  if (filters.searchDecMin && g.dec !== undefined && g.dec < parseFloat(filters.searchDecMin)) return false;
  if (filters.searchDecMax && g.dec !== undefined && g.dec > parseFloat(filters.searchDecMax)) return false;
  if (filters.searchReffMin && g.reff !== undefined && g.reff < parseFloat(filters.searchReffMin)) return false;
  if (filters.searchReffMax && g.reff !== undefined && g.reff > parseFloat(filters.searchReffMax)) return false;
  if (filters.searchQMin && g.q !== undefined && g.q < parseFloat(filters.searchQMin)) return false;
  if (filters.searchQMax && g.q !== undefined && g.q > parseFloat(filters.searchQMax)) return false;
  if (filters.searchPaMin && g.pa !== undefined && g.pa < parseFloat(filters.searchPaMin)) return false;
  if (filters.searchPaMax && g.pa !== undefined && g.pa > parseFloat(filters.searchPaMax)) return false;
  if (filters.searchMagMin && g.mag !== undefined && g.mag < parseFloat(filters.searchMagMin)) return false;
  if (filters.searchMagMax && g.mag !== undefined && g.mag > parseFloat(filters.searchMagMax)) return false;
  if (filters.searchMeanMueMin && g.mean_mue !== undefined && g.mean_mue < parseFloat(filters.searchMeanMueMin)) return false;
  if (filters.searchMeanMueMax && g.mean_mue !== undefined && g.mean_mue > parseFloat(filters.searchMeanMueMax)) return false;

  // Boolean filters
  if (filters.searchNucleus !== undefined && g.nucleus !== filters.searchNucleus) return false;

  // Aggregate filters
  const totalClassifications = g.totalClassifications ? Number(g.totalClassifications) : 0;
  if (filters.searchTotalClassificationsMin && totalClassifications < parseInt(filters.searchTotalClassificationsMin)) return false;
  if (filters.searchTotalClassificationsMax && totalClassifications > parseInt(filters.searchTotalClassificationsMax)) return false;

  const numVisibleNucleus = g.numVisibleNucleus ? Number(g.numVisibleNucleus) : 0;
  if (filters.searchNumVisibleNucleusMin && numVisibleNucleus < parseInt(filters.searchNumVisibleNucleusMin)) return false;
  if (filters.searchNumVisibleNucleusMax && numVisibleNucleus > parseInt(filters.searchNumVisibleNucleusMax)) return false;

  const numAwesomeFlag = g.numAwesomeFlag ? Number(g.numAwesomeFlag) : 0;
  if (filters.searchNumAwesomeFlagMin && numAwesomeFlag < parseInt(filters.searchNumAwesomeFlagMin)) return false;
  if (filters.searchNumAwesomeFlagMax && numAwesomeFlag > parseInt(filters.searchNumAwesomeFlagMax)) return false;

  const numFailedFitting = g.numFailedFitting ? Number(g.numFailedFitting) : 0;
  if (filters.searchNumFailedFittingMin && numFailedFitting < parseInt(filters.searchNumFailedFittingMin)) return false;
  if (filters.searchNumFailedFittingMax && numFailedFitting > parseInt(filters.searchNumFailedFittingMax)) return false;

  const totalAssigned = g.totalAssigned ? Number(g.totalAssigned) : 0;
  if (filters.searchTotalAssignedMin && totalAssigned < parseInt(filters.searchTotalAssignedMin)) return false;
  if (filters.searchTotalAssignedMax && totalAssigned > parseInt(filters.searchTotalAssignedMax)) return false;

  return true;
}
