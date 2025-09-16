import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";


// Browse galaxies with pagination and sorting

export const browseGalaxies = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
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
    if (!userId) return null;

    const { page, pageSize, sortBy = "id", sortOrder = "asc", filter = "all", searchTerm } = args;
    const offset = (page - 1) * pageSize;

    // Get all galaxies
    let allGalaxies = await ctx.db.query("galaxies").collect();

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      allGalaxies = allGalaxies.filter(galaxy => galaxy.id.toLowerCase().includes(term) ||
        galaxy.ra.toString().includes(term) ||
        galaxy.dec.toString().includes(term)
      );
    }

    // Apply filtering
    if (filter !== "all") {
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .first();

      if (filter === "my_sequence" && userSequence?.galaxyIds) {
        allGalaxies = allGalaxies.filter(galaxy => userSequence.galaxyIds!.includes(galaxy._id)
        );
      } else if (filter === "classified" || filter === "unclassified" || filter === "skipped") {
        const filteredGalaxies = [];

        for (const galaxy of allGalaxies) {
          const classification = await ctx.db
            .query("classifications")
            .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id)
            )
            .unique();

          const skipped = await ctx.db
            .query("skippedGalaxies")
            .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id)
            )
            .unique();

          if (filter === "classified" && classification) {
            filteredGalaxies.push(galaxy);
          } else if (filter === "unclassified" && !classification && !skipped) {
            filteredGalaxies.push(galaxy);
          } else if (filter === "skipped" && skipped) {
            filteredGalaxies.push(galaxy);
          }
        }

        allGalaxies = filteredGalaxies;
      }
    }

    // Apply custom sorting
    allGalaxies.sort((a, b) => {
      let aVal: any = a[sortBy as keyof typeof a];
      let bVal: any = b[sortBy as keyof typeof b];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      } else if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    const total = allGalaxies.length;
    const paginatedGalaxies = allGalaxies.slice(offset, offset + pageSize);

    // Get classification status for each galaxy
    const galaxiesWithStatus = await Promise.all(
      paginatedGalaxies.map(async (galaxy) => {
        const classification = await ctx.db
          .query("classifications")
          .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id)
          )
          .unique();

        const skipped = await ctx.db
          .query("skippedGalaxies")
          .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", galaxy._id)
          )
          .unique();

        return {
          ...galaxy,
          classification,
          isSkipped: !!skipped,
          status: classification ? "classified" : skipped ? "skipped" : "unclassified",
        };
      })
    );

    return {
      galaxies: galaxiesWithStatus,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: offset + pageSize < total,
        hasPrevious: page > 1,
      },
      sorting: {
        sortBy,
        sortOrder,
      },
      filter,
    };
  },
});
