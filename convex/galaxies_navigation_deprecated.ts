import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";


// Navigate to specific galaxy in sequence  // TODO: investigate if this can be query

export const navigateToGalaxy = mutation({
  args: {
    direction: v.union(v.literal("next"), v.literal("previous")),
    currentGalaxyId: v.optional(v.id("galaxies")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Get user's current sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!sequence || !sequence.galaxyExternalIds) throw new Error("No sequence found");

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

    // Build remaining list by removing skipped then classified
    const remainingExternalIds = sequence.galaxyExternalIds.filter(externalId => {
      return !skippedExternalIds.has(externalId) && !classifiedExternalIds.has(externalId);
    });

    if (remainingExternalIds.length === 0) {
      throw new Error("No available galaxies to navigate");
    }

    // Determine current index within remaining list
    let currentIndexInRemaining = -1;
    if (args.currentGalaxyId) {
      // Get the galaxy to find its external ID
      const currentGalaxy = await ctx.db.get(args.currentGalaxyId);
      if (currentGalaxy) {
        currentIndexInRemaining = remainingExternalIds.findIndex(externalId => externalId === currentGalaxy.id);
      }
      // If provided currentGalaxyId is not in remaining, default to first available
      if (currentIndexInRemaining === -1) currentIndexInRemaining = 0;
    } else {
      // Use first available in remaining
      currentIndexInRemaining = 0;
    }

    // Calculate target index within remaining list
    const targetIndexInRemaining = args.direction === "next" ? currentIndexInRemaining + 1 : currentIndexInRemaining - 1;

    if (targetIndexInRemaining < 0 || targetIndexInRemaining >= remainingExternalIds.length) {
      throw new Error(`No ${args.direction} galaxy available`);
    }

    const targetExternalId = remainingExternalIds[targetIndexInRemaining];
    const targetGalaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", targetExternalId))
      .unique();

    if (!targetGalaxy) {
      throw new Error("Target galaxy not found");
    }

    // Compute position in the full sequence for compatibility
    const originalIndex = sequence.galaxyExternalIds.findIndex(externalId => externalId === targetExternalId);

    return {
      galaxy: targetGalaxy,
      position: originalIndex >= 0 ? originalIndex + 1 : targetIndexInRemaining + 1,
      total: sequence.galaxyExternalIds.length,
    };
  },
});



