import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";


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
});// Submit classification

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
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", args.galaxyId)
      )
      .unique();

    if (existing) {
      // Update existing classification
      await ctx.db.patch(existing._id, {
        lsb_class: args.lsb_class,
        morphology: args.morphology,
        awesome_flag: args.awesome_flag,
        valid_redshift: args.valid_redshift,
        visible_nucleus: args.visible_nucleus,
        comments: args.comments,
        sky_bkg: args.sky_bkg,
        timeSpent: existing.timeSpent + args.timeSpent, // accumulate time spent
      });
    } else {

      // // Remove from skipped if it was skipped before
      // const skipped = await ctx.db
      //   .query("skippedGalaxies")
      //   .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyId", args.galaxyId)
      //   )
      //   .unique();

      // if (skipped) {
      //   await ctx.db.delete(skipped._id);
      // }

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

      // update user's galaxy sequence details, if the galaxy is part of their current sequence
      const sequence = await ctx.db
        .query('galaxySequences')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('desc')
        .first();

      if (sequence && sequence.galaxyIds && sequence.galaxyIds.includes(args.galaxyId)) {
        // update numClassified couner in sequence
        await ctx.db.patch(sequence._id, {
          numClassified: (sequence.numClassified || 0) + 1,
        });
      }
    }

    return { success: true };
  },
});

// Query: get the current user's classification for a galaxy by external id
export const getUserClassificationForGalaxy = query({
  args: { galaxyRefId: v.id('galaxies') },
  handler: async (ctx, { galaxyRefId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Direct lookup of classification by user and galaxy reference id
    try {
      const classification = await ctx.db
        .query('classifications')
        .withIndex('by_user_and_galaxy', (q) => q.eq('userId', userId).eq('galaxyId', galaxyRefId))
        .unique();
      if (classification) return classification;
    } catch (e) {
      // ignore
    }

    return null;
  },
});

