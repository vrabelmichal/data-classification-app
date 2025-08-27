import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
      for (const galaxyId of sequence.galaxyIds) {
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

        if (!existingClassification && !isSkipped) {
          const galaxy = await ctx.db.get(galaxyId);
          return galaxy;
        }
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
      // Find the specific galaxy's position in the sequence
      currentIndex = sequence.galaxyIds.findIndex(id => id === args.currentGalaxyId);
    } else {
      // Find first unclassified galaxy position
      for (let i = 0; i < sequence.galaxyIds.length; i++) {
      const galaxyId = sequence.galaxyIds[i];
      
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

      if (!existingClassification && !isSkipped) {
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

    // Find current position
    let currentIndex = -1;
    if (args.currentGalaxyId) {
      currentIndex = sequence.galaxyIds.findIndex(id => id === args.currentGalaxyId);
    } else {
      // Find first unclassified galaxy
      for (let i = 0; i < sequence.galaxyIds.length; i++) {
        const galaxyId = sequence.galaxyIds[i];
        
        const existingClassification = await ctx.db
          .query("classifications")
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxyId)
          )
          .unique();

        const isSkipped = await ctx.db
          .query("skippedGalaxies")
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxyId)
          )
          .unique();

        if (!existingClassification && !isSkipped) {
          currentIndex = i;
          break;
        }
      }
    }

    if (currentIndex === -1) {
      throw new Error("Current galaxy not found in sequence");
    }

    // Calculate target index
    let targetIndex = args.direction === "next" ? currentIndex + 1 : currentIndex - 1;
    
    // Ensure target index is within bounds
    if (targetIndex < 0 || targetIndex >= sequence.galaxyIds.length) {
      throw new Error(`No ${args.direction} galaxy available`);
    }

    // Get the target galaxy
    const targetGalaxyId = sequence.galaxyIds[targetIndex];
    const targetGalaxy = await ctx.db.get(targetGalaxyId);

    if (!targetGalaxy) {
      throw new Error("Target galaxy not found");
    }

    return {
      galaxy: targetGalaxy,
      position: targetIndex + 1,
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
    let classified = 0;
    let skipped = 0;

    // Handle new format
    if (sequence.galaxyIds && sequence.galaxyIds.length > 0) {
      for (const galaxyId of sequence.galaxyIds) {
        const existingClassification = await ctx.db
          .query("classifications")
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxyId)
          )
          .unique();

        const isSkipped = await ctx.db
          .query("skippedGalaxies")
          .withIndex("by_user_and_galaxy", (q) => 
            q.eq("userId", userId).eq("galaxyId", galaxyId)
          )
          .unique();

          if (existingClassification) classified++;
          if (isSkipped) skipped++;
      }
      
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

// Generate user sequence
export const generateUserSequence = mutation({
  args: {
    targetUserId: v.optional(v.id("users")),
    sequenceSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const targetUserId = args.targetUserId || userId;
    const sequenceSize = args.sequenceSize || 50;

    // Check if user is admin when targeting another user
    if (targetUserId !== userId) {
      const currentProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (!currentProfile || currentProfile.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    // Get all available galaxies
    const allGalaxies = await ctx.db.query("galaxies").collect();
    
    if (allGalaxies.length === 0) {
      throw new Error("No galaxies available");
    }

    // Shuffle and select galaxies
    const shuffled = [...allGalaxies].sort(() => Math.random() - 0.5);
    const selectedGalaxies = shuffled.slice(0, Math.min(sequenceSize, allGalaxies.length));

    // Delete existing sequence for this user
    const existingSequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    if (existingSequence) {
      await ctx.db.delete(existingSequence._id);
    }

    // Create new sequence
    await ctx.db.insert("galaxySequences", {
      userId: targetUserId,
      galaxyIds: selectedGalaxies.map(g => g._id),
    });

    // Update user profile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    if (userProfile) {
      await ctx.db.patch(userProfile._id, {
        sequenceGenerated: true,
      });
    }

    return { 
      success: true, 
      message: `Generated sequence of ${selectedGalaxies.length} galaxies` 
    };
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

    // Generate 100 mock galaxies
    const mockGalaxies = [];
    for (let i = 1; i <= 100; i++) {
      mockGalaxies.push({
        id: `mock_galaxy_${i.toString().padStart(3, '0')}`,
        ra: Math.random() * 360,
        dec: (Math.random() - 0.5) * 180,
        reff: Math.random() * 10 + 1,
        q: Math.random() * 0.8 + 0.2,
        pa: Math.random() * 180,
        nucleus: Math.random() > 0.5,
        imageUrl: `https://picsum.photos/400/400?random=${i}`,
      });
    }

    // Insert all mock galaxies
    for (const galaxy of mockGalaxies) {
      await ctx.db.insert("galaxies", galaxy);
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
