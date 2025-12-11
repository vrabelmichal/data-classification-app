import { v } from "convex/values";
import { query } from "../_generated/server";
import { getOptionalUserId } from "../lib/auth";

/**
 * Count total galaxies matching the current filter/search criteria.
 * Returns a single page of results with count and continuation cursor.
 * Client will call this repeatedly to get the full count.
 */
export const countFilteredGalaxiesBatch = query({
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
      v.literal("numericId")
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
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return { count: 0, cursor: null, isDone: true };
    }

    const {
      cursor: paginationCursor = null,
      batchSize = 500,
      sortBy = "numericId",
      sortOrder = "asc",
      filter,
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
    } = args;

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

    type Sortable = "numericId" | "id" | "ra" | "dec" | "reff" | "q" | "pa" | "mag" | "mean_mue" | "nucleus";
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
    };

    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    // Special handling for skipped filter - load all at once since it's typically small
    if (filter === "skipped") {
      const skippedGalaxies = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();

      const skippedIds = new Set(skippedGalaxies.map((sg: any) => sg.galaxyExternalId));
      let allGalaxies = await ctx.db.query("galaxies").collect();
      
      allGalaxies = allGalaxies.filter((g: any) => skippedIds.has(g.id));

      // Apply search filters
      if (searchId) allGalaxies = allGalaxies.filter((g: any) => g.id === searchId.trim());
      if (searchRaMin) allGalaxies = allGalaxies.filter((g: any) => g.ra >= parseFloat(searchRaMin));
      if (searchRaMax) allGalaxies = allGalaxies.filter((g: any) => g.ra <= parseFloat(searchRaMax));
      if (searchDecMin) allGalaxies = allGalaxies.filter((g: any) => g.dec >= parseFloat(searchDecMin));
      if (searchDecMax) allGalaxies = allGalaxies.filter((g: any) => g.dec <= parseFloat(searchDecMax));
      if (searchReffMin) allGalaxies = allGalaxies.filter((g: any) => g.reff >= parseFloat(searchReffMin));
      if (searchReffMax) allGalaxies = allGalaxies.filter((g: any) => g.reff <= parseFloat(searchReffMax));
      if (searchQMin) allGalaxies = allGalaxies.filter((g: any) => g.q >= parseFloat(searchQMin));
      if (searchQMax) allGalaxies = allGalaxies.filter((g: any) => g.q <= parseFloat(searchQMax));
      if (searchPaMin) allGalaxies = allGalaxies.filter((g: any) => g.pa >= parseFloat(searchPaMin));
      if (searchPaMax) allGalaxies = allGalaxies.filter((g: any) => g.pa <= parseFloat(searchPaMax));
      if (searchMagMin) allGalaxies = allGalaxies.filter((g: any) => (g.mag ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMagMin));
      if (searchMagMax) allGalaxies = allGalaxies.filter((g: any) => (g.mag ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMagMax));
      if (searchMeanMueMin) allGalaxies = allGalaxies.filter((g: any) => (g.mean_mue ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMeanMueMin));
      if (searchMeanMueMax) allGalaxies = allGalaxies.filter((g: any) => (g.mean_mue ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMeanMueMax));
      if (searchNucleus !== undefined) allGalaxies = allGalaxies.filter((g: any) => g.nucleus === searchNucleus);

      if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalClassifications || 0;
          if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
          if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
          return true;
        });
      }

      if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numVisibleNucleus || 0;
          if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
          if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
          return true;
        });
      }

      if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numAwesomeFlag || 0;
          if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
          if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
          return true;
        });
      }

      if (searchTotalAssignedMin || searchTotalAssignedMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalAssigned || 0;
          if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
          if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
          return true;
        });
      }

      return { count: allGalaxies.length, cursor: null, isDone: true };
    }

    // For other filters, use single paginated query
    const indexName = allowedSort[requestedSort].index;

    // Get user sequence if needed
    let sequenceIds: Set<string> | null = null;
    if (filter === "my_sequence") {
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .unique();
      
      if (userSequence && userSequence.galaxyExternalIds) {
        sequenceIds = new Set(userSequence.galaxyExternalIds);
      } else {
        // No sequence, return 0
        return { count: 0, cursor: null, isDone: true };
      }
    }

    // Single paginated query
    const q = ctx.db
      .query("galaxies")
      .withIndex(indexName as any)
      .order(normalizedSortOrder as any);

    const { page, isDone, continueCursor } = await q.paginate({
      numItems: batchSize,
      cursor: paginationCursor,
    });

    let filteredPage = page;

    // Apply search filters
    if (searchId) filteredPage = filteredPage.filter((g: any) => g.id === searchId.trim());
    if (searchRaMin) filteredPage = filteredPage.filter((g: any) => g.ra >= parseFloat(searchRaMin));
    if (searchRaMax) filteredPage = filteredPage.filter((g: any) => g.ra <= parseFloat(searchRaMax));
    if (searchDecMin) filteredPage = filteredPage.filter((g: any) => g.dec >= parseFloat(searchDecMin));
    if (searchDecMax) filteredPage = filteredPage.filter((g: any) => g.dec <= parseFloat(searchDecMax));
    if (searchReffMin) filteredPage = filteredPage.filter((g: any) => g.reff >= parseFloat(searchReffMin));
    if (searchReffMax) filteredPage = filteredPage.filter((g: any) => g.reff <= parseFloat(searchReffMax));
    if (searchQMin) filteredPage = filteredPage.filter((g: any) => g.q >= parseFloat(searchQMin));
    if (searchQMax) filteredPage = filteredPage.filter((g: any) => g.q <= parseFloat(searchQMax));
    if (searchPaMin) filteredPage = filteredPage.filter((g: any) => g.pa >= parseFloat(searchPaMin));
    if (searchPaMax) filteredPage = filteredPage.filter((g: any) => g.pa <= parseFloat(searchPaMax));
    if (searchMagMin) filteredPage = filteredPage.filter((g: any) => (g.mag ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMagMin));
    if (searchMagMax) filteredPage = filteredPage.filter((g: any) => (g.mag ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMagMax));
    if (searchMeanMueMin) filteredPage = filteredPage.filter((g: any) => (g.mean_mue ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMeanMueMin));
    if (searchMeanMueMax) filteredPage = filteredPage.filter((g: any) => (g.mean_mue ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMeanMueMax));
    if (searchNucleus !== undefined) filteredPage = filteredPage.filter((g: any) => g.nucleus === searchNucleus);

    // Apply filter-specific logic
    if (filter === "classified") {
      filteredPage = filteredPage.filter((g: any) => (g.totalClassifications || 0) > 0);
    } else if (filter === "unclassified") {
      filteredPage = filteredPage.filter((g: any) => (g.totalClassifications || 0) === 0);
    } else if (filter === "my_sequence" && sequenceIds) {
      filteredPage = filteredPage.filter((g: any) => sequenceIds!.has(g.id));
    }

    // Apply classification-based search filters
    if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalClassifications || 0;
        if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
        if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
        return true;
      });
    }

    if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numVisibleNucleus || 0;
        if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
        if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
        return true;
      });
    }

    if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numAwesomeFlag || 0;
        if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
        if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
        return true;
      });
    }

    if (searchTotalAssignedMin || searchTotalAssignedMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalAssigned || 0;
        if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
        if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
        return true;
      });
    }

    return { 
      count: filteredPage.length, 
      cursor: continueCursor, 
      isDone 
    };
  },
});
