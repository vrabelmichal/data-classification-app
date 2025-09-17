import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";


// Get next galaxy for classification

export const getNextGalaxyToClassify = query({
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

    // Handle new format (array of galaxy external IDs)
    if (sequence.galaxyExternalIds && sequence.galaxyExternalIds.length > 0) {
      // Get all skipped galaxy external IDs for user
      const skippedRecords = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      
      const skippedExternalIds = new Set(skippedRecords.map(r => r.galaxyExternalId));

      // Get all classified galaxy external IDs for user
      const classifiedRecords = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      
      const classifiedExternalIds = new Set(classifiedRecords.map(r => r.galaxyExternalId));

      // Filter out skipped and classified external IDs from sequence
      const remainingExternalIds = sequence.galaxyExternalIds.filter(
        externalId => !skippedExternalIds.has(externalId) && !classifiedExternalIds.has(externalId)
      );

      if (remainingExternalIds.length > 0) {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q) => q.eq("id", remainingExternalIds[0]))
          .unique();
        return galaxy;
      }
      return null; // All galaxies in new format sequence are done
    }

    return null;
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
// Get current galaxy position and navigation info

export const getGalaxyNavigation = query({
  args: {
    currentGalaxyExternalId: v.optional(v.string()),
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
    if (!sequence.galaxyExternalIds) return null;

    let currentIndex = -1;

    if (args.currentGalaxyExternalId) {
      // Find the position of the current galaxy in the sequence
      currentIndex = sequence.galaxyExternalIds.findIndex(externalId => externalId === args.currentGalaxyExternalId);
    } else {
      // Fetch classified and skipped external IDs once to avoid many DB queries in a loop
      const [skippedRecords, classifiedRecords] = await Promise.all([
        ctx.db.query("skippedGalaxies").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("classifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ]);

      const skippedExternalIds = new Set(skippedRecords.map(r => r.galaxyExternalId));
      const classifiedExternalIds = new Set(classifiedRecords.map(r => r.galaxyExternalId));

      // Find first unclassified and unskipped galaxy position using the pre-fetched sets
      for (let i = 0; i < sequence.galaxyExternalIds.length; i++) {
        const externalId = sequence.galaxyExternalIds[i];
        if (!classifiedExternalIds.has(externalId) && !skippedExternalIds.has(externalId)) {
          currentIndex = i;
          break;
        }
      }
    }

    return {
      currentIndex,
      totalGalaxies: sequence.galaxyExternalIds.length,
      hasNext: currentIndex < sequence.galaxyExternalIds.length - 1,
      hasPrevious: currentIndex > 0,
      sequenceId: sequence._id,
      galaxyExternalIds: sequence.galaxyExternalIds,
    };
  },
});
export const navigateToGalaxyInSequence = mutation({
    args: {
        direction: v.union(v.literal("next"), v.literal("previous")),
        currentGalaxyExternalId: v.optional(v.string()),
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

        if (!sequence || !sequence.galaxyExternalIds) throw new Error("No sequence found");

        let originalIndex = -1;
        if (args.currentGalaxyExternalId) {
            // Find the position of the current galaxy in the sequence
            originalIndex = sequence.galaxyExternalIds.findIndex(externalId => externalId === args.currentGalaxyExternalId);
        }

        if (originalIndex === -1) {
            // If currentGalaxyExternalId not found, start from beginning or end based on direction
            originalIndex = args.direction === "next" ? -1 : sequence.galaxyExternalIds.length;
        }

        const targetIndex = args.direction === "next" ? originalIndex + 1 : originalIndex - 1;

        if (targetIndex < 0 || targetIndex >= sequence.galaxyExternalIds.length) {
            throw new Error(`No ${args.direction} galaxy available`);
        }

        const targetExternalId = sequence.galaxyExternalIds[targetIndex];
        const targetGalaxy = await ctx.db
            .query("galaxies")
            .withIndex("by_external_id", (q) => q.eq("id", targetExternalId))
            .unique();

        if (!targetGalaxy) {
            throw new Error("Target galaxy not found");
        }

        return {
            galaxy: targetGalaxy,
            position: targetIndex + 1,
            total: sequence.galaxyExternalIds.length,
        };
    },
});


