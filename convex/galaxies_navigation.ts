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
export const navigateToGalaxyInSequence = mutation({
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

        let originalIndex = -1;
        if (args.currentGalaxyId) {
            const targetStr = args.currentGalaxyId.toString();
            originalIndex = sequence.galaxyIds.findIndex(id => id.toString() === targetStr);
        }

        if (originalIndex === -1) {
            // If currentGalaxyId not found, start from beginning or end based on direction
            originalIndex = args.direction === "next" ? -1 : sequence.galaxyIds.length;
        }

        const targetIndex = args.direction === "next" ? originalIndex + 1 : originalIndex - 1;

        if (targetIndex < 0 || targetIndex >= sequence.galaxyIds.length) {
            throw new Error(`No ${args.direction} galaxy available`);
        }

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


