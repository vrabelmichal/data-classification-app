import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";


export const galaxyIdsAggregate = new TableAggregate<{
  Key: bigint;
  DataModel: DataModel;
  TableName: "galaxyIds";
}>(components.aggregate, {
  sortKey: (doc) => doc.numericId,
});


export const clearGalaxyIdsAggregate = mutation({
  args: {},
  handler: async (ctx) => {
    // make sure only admin can call this
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check if user is admin
    const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile || profile.role !== "admin") throw new Error("Not authorized");
    
    await galaxyIdsAggregate.clear(ctx);
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
  // Insert core row first
  const galaxyRef = await ctx.db.insert("galaxies", galaxy);

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

// Get next galaxy for classification
export const getNextGalaxy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence) return null;

    // Handle new format (array of galaxy IDs)
    if (sequence.galaxyIds && sequence.galaxyIds.length > 0) {
      // Get all skipped galaxy IDs for user
      const skippedRecords = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const skippedIds = new Set(skippedRecords.map(r => r.galaxyId));

      // Get all classified galaxy IDs for user
      const classifiedRecords = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const classifiedIds = new Set(classifiedRecords.map(r => r.galaxyId));

      // Filter out skipped and classified IDs from sequence
      const remainingGalaxyIds = sequence.galaxyIds.filter(
        id => !skippedIds.has(id) && !classifiedIds.has(id)
      );

      if (remainingGalaxyIds.length > 0) {
        const galaxy = await ctx.db.get(remainingGalaxyIds[0]);
        return galaxy;
      }
      return null; // All galaxies in new format sequence are done
    }
    
    return null;
  },
});

// Get current galaxy position and navigation info
export const getGalaxyNavigation = query({
  args: {
    currentGalaxyId: v.optional(v.id("galaxies")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence) return null;

    // Handle new format only for navigation (legacy format doesn't support navigation)
    if (!sequence.galaxyIds) return null;

    let currentIndex = -1;


    if (args.currentGalaxyId) {
      // Find the specific galaxy's position in the sequence using stringified IDs
      const targetStr = args.currentGalaxyId.toString();
      currentIndex = sequence.galaxyIds.findIndex(id => id.toString() === targetStr);
    } else {

      // Fetch classified and skipped IDs once to avoid many DB queries in a loop
      const [skippedRecords, classifiedRecords] = await Promise.all([
        ctx.db.query("skippedGalaxies").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("classifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ]);

      const skippedIds = new Set(skippedRecords.map(r => r.galaxyId.toString()));
      const classifiedIds = new Set(classifiedRecords.map(r => r.galaxyId.toString()));

      // Find first unclassified and unskipped galaxy position using the pre-fetched sets
      for (let i = 0; i < sequence.galaxyIds.length; i++) {
        const galaxyIdStr = sequence.galaxyIds[i].toString();
        if (!classifiedIds.has(galaxyIdStr) && !skippedIds.has(galaxyIdStr)) {
          currentIndex = i;
          break;
        }
      }
    }

    return {
      currentIndex,
      totalGalaxies: sequence.galaxyIds.length,
      hasNext: currentIndex < sequence.galaxyIds.length - 1,
      hasPrevious: currentIndex > 0,
      sequenceId: sequence._id,
      galaxyIds: sequence.galaxyIds,
    };
  },
});

// Navigate to specific galaxy in sequence  // TODO: investigate if this can be query
export const navigateToGalaxy = mutation({
  args: {
    direction: v.union(v.literal("next"), v.literal("previous")),
    currentGalaxyId: v.optional(v.id("galaxies")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence || !sequence.galaxyIds) throw new Error("No sequence found");

    // Fetch skipped then classified records once
    const [skippedRecords, classifiedRecords] = await Promise.all([
      ctx.db.query("skippedGalaxies").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("classifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    const skippedIds = new Set(skippedRecords.map(r => r.galaxyId.toString()));
    const classifiedIds = new Set(classifiedRecords.map(r => r.galaxyId.toString()));

    // Build remaining list by removing skipped then classified
    const remainingGalaxyIds = sequence.galaxyIds.filter(id => {
      const idStr = id.toString();
      return !skippedIds.has(idStr) && !classifiedIds.has(idStr);
    });

    if (remainingGalaxyIds.length === 0) {
      throw new Error("No available galaxies to navigate");
    }

    // Determine current index within remaining list
    let currentIndexInRemaining = -1;
    if (args.currentGalaxyId) {
      const targetStr = args.currentGalaxyId.toString();
      currentIndexInRemaining = remainingGalaxyIds.findIndex(id => id.toString() === targetStr);
      // If provided currentGalaxyId is not in remaining, default to first available
      if (currentIndexInRemaining === -1) currentIndexInRemaining = 0;
    } else {
      // Use first available in remaining
      currentIndexInRemaining = 0;
    }

    // Calculate target index within remaining list
    const targetIndexInRemaining = args.direction === "next" ? currentIndexInRemaining + 1 : currentIndexInRemaining - 1;

    if (targetIndexInRemaining < 0 || targetIndexInRemaining >= remainingGalaxyIds.length) {
      throw new Error(`No ${args.direction} galaxy available`);
    }

    const targetGalaxyId = remainingGalaxyIds[targetIndexInRemaining];
    const targetGalaxy = await ctx.db.get(targetGalaxyId);

    if (!targetGalaxy) {
      throw new Error("Target galaxy not found");
    }

    // Compute position in the full sequence for compatibility
    const originalIndex = sequence.galaxyIds.findIndex(id => id.toString() === targetGalaxyId.toString());

    return {
      galaxy: targetGalaxy,
      position: originalIndex >= 0 ? originalIndex + 1 : targetIndexInRemaining + 1,
      total: sequence.galaxyIds.length,
    };
  },
});

// Get galaxy by position in sequence
export const getGalaxyByPosition = query({
  args: {
    position: v.number(), // 1-based position
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence || !sequence.galaxyIds) return null;

    const index = args.position - 1; // Convert to 0-based
    if (index < 0 || index >= sequence.galaxyIds.length) {
      return null;
    }

    const galaxyId = sequence.galaxyIds[index];
    const galaxy = await ctx.db.get(galaxyId);

    if (!galaxy) return null;

    // Check if already classified
    const existingClassification = await ctx.db
      .query("classifications")
      .withIndex("by_user_and_galaxy", (q) => 
        q.eq("userId", userId).eq("galaxyId", galaxyId)
      )
      .unique();

    // Check if skipped
    const isSkipped = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => 
        q.eq("userId", userId).eq("galaxyId", galaxyId)
      )
      .unique();

    return {
      galaxy,
      isClassified: !!existingClassification,
      isSkipped: !!isSkipped,
      classification: existingClassification,
      position: args.position,
      total: sequence.galaxyIds.length,
    };
  },
});

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
      allGalaxies = allGalaxies.filter(galaxy => 
        galaxy.id.toLowerCase().includes(term) ||
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
        allGalaxies = allGalaxies.filter(galaxy => 
          userSequence.galaxyIds!.includes(galaxy._id)
        );
      } else if (filter === "classified" || filter === "unclassified" || filter === "skipped") {
        const filteredGalaxies = [];
        
        for (const galaxy of allGalaxies) {
          const classification = await ctx.db
            .query("classifications")
            .withIndex("by_user_and_galaxy", (q) => 
              q.eq("userId", userId).eq("galaxyId", galaxy._id)
            )
            .unique();

          const skipped = await ctx.db
            .query("skippedGalaxies")
            .withIndex("by_user_and_galaxy", (q) => 
              q.eq("userId", userId).eq("galaxyId", galaxy._id)
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
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxy._id)
          )
          .unique();

        const skipped = await ctx.db
          .query("skippedGalaxies")
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxy._id)
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

// Submit classification
export const submitClassification = mutation({
  args: {
    galaxyId: v.id("galaxies"),
    lsb_class: v.number(),
    morphology: v.number(),
    awesome_flag: v.boolean(),
    valid_redshift: v.boolean(),
    visible_nucleus: v.optional(v.boolean()),
    comments: v.optional(v.string()),
    sky_bkg: v.optional(v.number()),
    timeSpent: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already classified
    const existing = await ctx.db
      .query("classifications")
      .withIndex("by_user_and_galaxy", (q) => 
        q.eq("userId", userId).eq("galaxyId", args.galaxyId)
      )
      .unique();

    if (existing) {
      throw new Error("Galaxy already classified");
    }

    // Remove from skipped if it was skipped before
    const skipped = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => 
        q.eq("userId", userId).eq("galaxyId", args.galaxyId)
      )
      .unique();

    if (skipped) {
      await ctx.db.delete(skipped._id);
    }

    // Insert classification
    await ctx.db.insert("classifications", {
      userId,
      galaxyId: args.galaxyId,
      lsb_class: args.lsb_class,
      morphology: args.morphology,
      awesome_flag: args.awesome_flag,
      valid_redshift: args.valid_redshift,
      visible_nucleus: args.visible_nucleus,
      comments: args.comments,
      sky_bkg: args.sky_bkg,
      timeSpent: args.timeSpent,
    });

    // Update user's classification count
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        classificationsCount: userProfile.classificationsCount + 1,
        lastActiveAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Skip galaxy
export const skipGalaxy = mutation({
  args: {
    galaxyId: v.id("galaxies"),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already skipped
    const existing = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => 
        q.eq("userId", userId).eq("galaxyId", args.galaxyId)
      )
      .unique();

    if (existing) {
      throw new Error("Galaxy already skipped");
    }

    // Insert skip record
    await ctx.db.insert("skippedGalaxies", {
      userId,
      galaxyId: args.galaxyId,
      comments: args.comments,
    });

    return { success: true };
  },
});

// Get progress
export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence) return null;

    // Count classified and skipped galaxies
    let classified = sequence.numClassified || 0;
    let skipped = sequence.numSkipped || 0;

    // Handle new format
    if (sequence.galaxyIds && sequence.galaxyIds.length > 0) {
      // for (const galaxyId of sequence.galaxyIds) {
      //   const existingClassification = await ctx.db
      //     .query("classifications")
      //     .withIndex("by_user_and_galaxy", (q) => 
      //       q.eq("userId", userId).eq("galaxyId", galaxyId)
      //     )
      //     .unique();

      //   const isSkipped = await ctx.db
      //     .query("skippedGalaxies")
      //     .withIndex("by_user_and_galaxy", (q) => 
      //       q.eq("userId", userId).eq("galaxyId", galaxyId)
      //     )
      //     .unique();

      //     if (existingClassification) classified++;
      //     if (isSkipped) skipped++;
      // }
      
      const total = sequence.galaxyIds.length;
      const completed = classified + skipped;

      return {
        classified,
        skipped,
        total,
        completed,
        remaining: total - completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    return null;
  },
});

// Get skipped galaxies for current user
export const getSkippedGalaxies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const skippedRecords = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // console.log("Skipped records:", skippedRecords);

    const skippedWithGalaxies = await Promise.all(
      skippedRecords.map(async (record) => {
        let galaxy = await ctx.db.get(record.galaxyId);
        return {
          ...record,
          galaxy,
        };
      })
    );

    return skippedWithGalaxies.filter(item => item.galaxy !== null);
  },
});

// Remove galaxy from skipped list
export const removeFromSkipped = mutation({
  args: {
    skippedId: v.id("skippedGalaxies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const skipped = await ctx.db.get(args.skippedId);
    if (!skipped) throw new Error("Skipped record not found");

    // Verify ownership
    if (skipped.userId !== userId) {
      throw new Error("Not authorized to remove this record");
    }

    await ctx.db.delete(args.skippedId);
    return { success: true };
  },
});

// Generate mock galaxies (admin only)
export const generateMockGalaxies = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Generate 100 mock galaxies (minimal nested structures matching schema)
    const mockGalaxies = [] as any[];
    for (let i = 1; i <= 100; i++) {
      mockGalaxies.push({
        id: `mock_galaxy_${i.toString().padStart(3, '0')}`,
        ra: Number((Math.random() * 360).toFixed(5)),
        dec: Number(((Math.random() - 0.5) * 180).toFixed(5)),
        reff: Number((Math.random() * 10 + 1).toFixed(3)),
        q: Number((Math.random() * 0.8 + 0.2).toFixed(3)),
        pa: Number((Math.random() * 180).toFixed(2)),
        nucleus: Math.random() > 0.5,
        photometry: {
          g: { sersic: {}, source_extractor: {} },
          r: { sersic: {}, source_extractor: {} },
          i: { sersic: {}, source_extractor: {} },
        },
        misc: {},
        thuruthipilly: {},
      });
    }

    // Insert all mock galaxies safely (skip existing ids)
    for (const galaxy of mockGalaxies) {
      const existing = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
        .unique();
      if (!existing) {
        await ctx.db.insert("galaxies", galaxy);
      }
    }

    return { 
      success: true, 
      message: `Generated ${mockGalaxies.length} mock galaxies` 
    };
  },
});

// Get galaxy by external ID
export const getGalaxyByExternalId = query({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.externalId || !args.externalId.trim()) return null;
    const externalId = args.externalId.trim();

    // Use the index defined in schema (by_external_id) which indexes the 'id' field
    const galaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", externalId))
      .unique();

    return galaxy || null;
  },
});

// Insert a new galaxy (for data loading)
// export const insertGalaxy = mutation({
//   args: {
//     id: v.string(),
//     ra: v.number(),
//     dec: v.number(),
//     reff: v.number(),
//     q: v.number(),
//     pa: v.number(),
//     nucleus: v.boolean(),
//     imageUrl: v.optional(v.string()),
//     isActive: v.optional(v.boolean()),
//     redshift_x: v.optional(v.number()),
//     redshift_y: v.optional(v.number()),
//     x: v.optional(v.number()),
//     y: v.optional(v.number()),
//   },
//   handler: async (ctx, args) => {
//     // Check if galaxy with this external ID already exists
//     const existing = await ctx.db
//       .query("galaxies")
//       .withIndex("by_external_id", (q) => q.eq("id", args.id))
//       .unique();

//     if (existing) {
//       throw new Error(`Galaxy with ID ${args.id} already exists`);
//     }

//     // Insert the new galaxy
//     const galaxyId = await ctx.db.insert("galaxies", {
//       id: args.id,
//       ra: args.ra,
//       dec: args.dec,
//       reff: args.reff,
//       q: args.q,
//       pa: args.pa,
//       nucleus: args.nucleus,
//       imageUrl: args.imageUrl,
//       isActive: args.isActive,
//       redshift_x: args.redshift_x,
//       redshift_y: args.redshift_y,
//       x: args.x,
//       y: args.y,
//     });

//     return { success: true, galaxyId };
//   },
// });

// // Batch insert galaxies (for efficient bulk loading)
// export const insertGalaxiesBatch = mutation({
//   args: {
//     galaxies: v.array(v.object({
//       id: v.string(),
//       ra: v.number(),
//       dec: v.number(),
//       reff: v.number(),
//       q: v.number(),
//       pa: v.number(),
//       nucleus: v.boolean(),
//       imageUrl: v.optional(v.string()),
//       isActive: v.optional(v.boolean()),
//       redshift_x: v.optional(v.number()),
//       redshift_y: v.optional(v.number()),
//       x: v.optional(v.number()),
//       y: v.optional(v.number()),
//     })),
//   },
//   handler: async (ctx, args) => {
//     const results = {
//       inserted: 0,
//       skipped: 0,
//       errors: [] as string[],
//     };

//     for (const galaxy of args.galaxies) {
//       try {
//         // Check if galaxy with this external ID already exists
//         const existing = await ctx.db
//           .query("galaxies")
//           .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
//           .unique();

//         if (existing) {
//           results.skipped++;
//           continue;
//         }

//         // Insert the new galaxy
//         await ctx.db.insert("galaxies", galaxy);
//         results.inserted++;

//       } catch (error) {
//         results.errors.push(`Error inserting galaxy ${galaxy.id}: ${error}`);
//       }
//     }

//     return results;
//   },
// });
