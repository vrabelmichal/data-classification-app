import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";


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



