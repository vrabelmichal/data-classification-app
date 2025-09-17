import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";


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

    if (!sequence || !sequence.galaxyExternalIds) return null;

    const index = args.position - 1; // Convert to 0-based
    if (index < 0 || index >= sequence.galaxyExternalIds.length) {
      return null;
    }

    const galaxyExternalId = sequence.galaxyExternalIds[index];
    const galaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
      .unique();

    if (!galaxy) return null;

    // Check if already classified
    const existingClassification = await ctx.db
      .query("classifications")
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxyExternalId)
      )
      .unique();

    // Check if skipped
    const isSkipped = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxyExternalId)
      )
      .unique();

    return {
      galaxy,
      isClassified: !!existingClassification,
      isSkipped: !!isSkipped,
      classification: existingClassification,
      position: args.position,
      total: sequence.galaxyExternalIds.length,
    };
  },
});
