import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";


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
        let galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q) => q.eq("id", record.galaxyExternalId))
          .unique();
        return {
          ...record,
          galaxy,
        };
      })
    );

    return skippedWithGalaxies.filter(item => item.galaxy !== null);
  },
});

// Check if a specific galaxy is skipped by the current user
export const isGalaxySkipped = query({
  args: { galaxyExternalId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const existing = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", args.galaxyExternalId))
      .unique();

    return existing !== null;
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

    // Check user profile and confirmation status
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || !userProfile.isConfirmed) {
      throw new Error("Account not confirmed");
    }

    const skipped = await ctx.db.get(args.skippedId);
    if (!skipped) throw new Error("Skipped record not found");

    // Verify ownership
    if (skipped.userId !== userId) {
      throw new Error("Not authorized to remove this record");
    }
    await ctx.db.delete(args.skippedId);

    // Update user's skipped count in the sequence
    const sequence = await ctx.db
      .query('galaxySequences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .first();

    if (sequence && sequence.galaxyExternalIds && sequence.galaxyExternalIds.includes(skipped.galaxyExternalId)) {
      await ctx.db.patch(sequence._id, {
        numSkipped: Math.max((sequence.numSkipped || 1) - 1, 0),
      });
    }

    return { success: true };
  },
});// Skip galaxy

export const skipGalaxy = mutation({
  args: {
    galaxyExternalId: v.string(),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check user profile and confirmation status
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || !userProfile.isConfirmed) {
      throw new Error("Account not confirmed");
    }

    // Check if already skipped
    const existing = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", args.galaxyExternalId)
      )
      .unique();

    if (existing) {
      return { success: true };
    }

    // Insert skip record
    await ctx.db.insert("skippedGalaxies", {
      userId,
      galaxyExternalId: args.galaxyExternalId,
      comments: args.comments,
    });

    // Update user's skipped count in the sequence
    const sequence = await ctx.db
      .query('galaxySequences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .first();

    if (sequence && sequence.galaxyExternalIds && sequence.galaxyExternalIds.includes(args.galaxyExternalId)) {
      await ctx.db.patch(sequence._id, {
        numSkipped: (sequence.numSkipped || 0) + 1,
      });
    }

    return { success: true };
  },
});

