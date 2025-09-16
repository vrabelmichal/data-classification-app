import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";


// Browse galaxies with pagination and sorting

export const browseGalaxies = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sortBy: v.optional(v.union(
      v.literal("id"),
      v.literal("ra"),
      v.literal("dec"),
      v.literal("reff"),
      v.literal("q"),
      v.literal("pa"),
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
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      const { sortBy = "id", sortOrder = "asc", filter = "all" } = args;
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        sortBy,
        sortOrder,
        filter,
      } as any; // satisfy paginated query typing
    }

    const { sortBy = "id", sortOrder = "asc", filter = "all", searchTerm } = args;

    // Base query with sorting using index when possible.
    // For id we leverage by_external_id index.
    type GalaxyIndex = "by_external_id" | "by_ra" | "by_dec" | "by_reff" | "by_q" | "by_pa" | "by_nucleus";
    const sortableIndexMap: Record<string, GalaxyIndex> = {
      id: "by_external_id",
      ra: "by_ra",
      dec: "by_dec",
      reff: "by_reff",
      q: "by_q",
      pa: "by_pa",
      nucleus: "by_nucleus",
    };

    const indexName = sortableIndexMap[sortBy];
    const baseQuery = indexName ? ctx.db.query("galaxies").withIndex(indexName) : ctx.db.query("galaxies");

    const paginated = await baseQuery.order(sortOrder === "asc" ? "asc" : "desc").paginate(args.paginationOpts);

    // Apply lightweight filtering on current page only (best-effort without full scan)
    let pageDocs = paginated.page;
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      pageDocs = pageDocs.filter(g =>
        g.id.toLowerCase().includes(term) ||
        g.ra.toString().includes(term) ||
        g.dec.toString().includes(term)
      );
    }
    // Classification-dependent filters handled after enrichment
    const enriched = await Promise.all(pageDocs.map(async (galaxy) => {
      const classification = await ctx.db
        .query("classifications")
        .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id))
        .unique();
      const skipped = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id))
        .unique();
      const status = classification ? "classified" : skipped ? "skipped" : "unclassified";
      return { ...galaxy, classification, isSkipped: !!skipped, status };
    }));

    let finalPage = enriched;
    if (filter === "classified") finalPage = enriched.filter(g => g.status === "classified");
    else if (filter === "unclassified") finalPage = enriched.filter(g => g.status === "unclassified");
    else if (filter === "skipped") finalPage = enriched.filter(g => g.status === "skipped");
    // my_sequence not supported efficiently in paginated mode yet (future enhancement)

    return {
      ...paginated,
      page: finalPage,
      sortBy,
      sortOrder,
      filter,
      searchTerm,
    } as any;
  },
});
