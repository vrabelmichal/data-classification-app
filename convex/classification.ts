import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireConfirmedUser } from "./lib/auth";
import {
  classificationsByCreated,
  userProfilesByClassificationsCount,
  userProfilesByLastActive,
} from "./galaxies/aggregates";
import { galaxiesByTotalClassifications } from "./galaxies/aggregates";


// Get progress

export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
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
    if (sequence.galaxyExternalIds && sequence.galaxyExternalIds.length > 0) {
      const total = sequence.galaxyExternalIds.length;
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
    galaxyExternalId: v.string(),
    lsb_class: v.number(),
    morphology: v.number(),
    awesome_flag: v.boolean(),
    valid_redshift: v.boolean(),
    visible_nucleus: v.optional(v.boolean()),
    failed_fitting: v.optional(v.boolean()),
    comments: v.optional(v.string()),
    sky_bkg: v.optional(v.number()),
    timeSpent: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireConfirmedUser(ctx);

    // Get system settings for failed fitting mode
    const failedFittingModeDoc = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "failedFittingMode"))
      .unique();
    const failedFittingMode = failedFittingModeDoc?.value || "checkbox";

    const fallbackLsbClassDoc = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "failedFittingFallbackLsbClass"))
      .unique();
    const fallbackLsbClass = fallbackLsbClassDoc?.value ?? 0;

    // Handle legacy mode: translate lsb_class=-1 to failed_fitting flag
    let finalLsbClass = args.lsb_class;
    let finalFailedFitting = args.failed_fitting || false;

    if (failedFittingMode === "legacy" && args.lsb_class === -1) {
      finalFailedFitting = true;
      finalLsbClass = fallbackLsbClass;
    }

    // Check if already classified
    const existing = await ctx.db
      .query("classifications")
      .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", args.galaxyExternalId)
      )
      .unique();

    if (existing) {
      // Update existing classification
      await ctx.db.patch(existing._id, {
        lsb_class: finalLsbClass,
        morphology: args.morphology,
        awesome_flag: args.awesome_flag,
        valid_redshift: args.valid_redshift,
        visible_nucleus: args.visible_nucleus,
        failed_fitting: finalFailedFitting,
        comments: args.comments,
        sky_bkg: args.sky_bkg,
        timeSpent: existing.timeSpent + args.timeSpent, // accumulate time spent
      });

      const updatedClassification = await ctx.db.get(existing._id);
      if (updatedClassification) {
        await classificationsByCreated.replace(ctx, existing, updatedClassification);
      }
    } else {

      // // Remove from skipped if it was skipped before
      // const skipped = await ctx.db
      //   .query("skippedGalaxies")
      //   .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", args.galaxyExternalId)
      //   )
      //   .unique();

      // if (skipped) {
      //   await ctx.db.delete(skipped._id);
      // }

      // Insert classification
      const classificationId = await ctx.db.insert("classifications", {
        userId,
        galaxyExternalId: args.galaxyExternalId,
        lsb_class: finalLsbClass,
        morphology: args.morphology,
        awesome_flag: args.awesome_flag,
        valid_redshift: args.valid_redshift,
        visible_nucleus: args.visible_nucleus,
        failed_fitting: finalFailedFitting,
        comments: args.comments,
        sky_bkg: args.sky_bkg,
        timeSpent: args.timeSpent,
      });

      const newClassification = await ctx.db.get(classificationId);
      if (newClassification) {
        await classificationsByCreated.insert(ctx, newClassification);
      }

      // Increment galaxy classification counter
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", args.galaxyExternalId))
        .unique();

      if (galaxy) {
        const updatedTotalClassifications = (galaxy.totalClassifications ?? BigInt(0)) + BigInt(1);
        await ctx.db.patch(galaxy._id, {
          totalClassifications: updatedTotalClassifications,
        });

        const refreshedGalaxy = await ctx.db.get(galaxy._id);
        if (refreshedGalaxy) {
          await galaxiesByTotalClassifications.replace(ctx, galaxy, refreshedGalaxy);
        }
      }

      // Update user's classification count
      await ctx.db.patch(profile._id, {
        classificationsCount: profile.classificationsCount + 1,
        lastActiveAt: Date.now(),
      });

      const updatedProfile = await ctx.db.get(profile._id);
      if (updatedProfile) {
        await userProfilesByClassificationsCount.replace(ctx, profile, updatedProfile);
        await userProfilesByLastActive.replace(ctx, profile, updatedProfile);
      }

      // update user's galaxy sequence details, if the galaxy is part of their current sequence
      const sequence = await ctx.db
        .query('galaxySequences')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('desc')
        .first();

      if (sequence && sequence.galaxyExternalIds && sequence.galaxyExternalIds.includes(args.galaxyExternalId)) {
        // update numClassified counter in sequence
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
  args: { galaxyExternalId: v.string() },
  handler: async (ctx, { galaxyExternalId }) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;

    // Direct lookup of classification by user and galaxy external id
    try {
      const classification = await ctx.db
        .query('classifications')
        .withIndex('by_user_and_galaxy', (q) => q.eq('userId', userId).eq('galaxyExternalId', galaxyExternalId))
        .unique();
      if (classification) return classification;
    } catch (e) {
      // ignore
    }

    return null;
  },
});

