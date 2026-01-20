import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireConfirmedUser } from "./lib/auth";
import { Doc } from "./_generated/dataModel";
import {
  classificationsByCreated,
  classificationsByAwesomeFlag,
  classificationsByVisibleNucleus,
  classificationsByFailedFitting,
  classificationsByValidRedshift,
  classificationsByLsbClass,
  classificationsByMorphology,
  userProfilesByClassificationsCount,
  userProfilesByLastActive,
  galaxiesByTotalClassifications,
  galaxiesByNumAwesomeFlag,
  galaxiesByNumVisibleNucleus,
} from "./galaxies/aggregates";

/**
 * Safely replace an entry in a galaxy aggregate index.
 * If the old entry is missing (DELETE_MISSING_KEY), fall back to inserting the new entry.
 * This handles cases where galaxies were added before the aggregate was initialized.
 */
async function safeReplaceGalaxyAggregate(
  ctx: any,
  aggregate: typeof galaxiesByTotalClassifications | typeof galaxiesByNumAwesomeFlag | typeof galaxiesByNumVisibleNucleus,
  oldDoc: Doc<"galaxies">,
  newDoc: Doc<"galaxies">
) {
  try {
    await aggregate.replace(ctx, oldDoc, newDoc);
  } catch (error: any) {
    const code = error?.data?.code;
    const message = error?.message ?? "";
    if (code === "DELETE_MISSING_KEY" || message.includes("DELETE_MISSING_KEY")) {
      // Old entry doesn't exist in aggregate - just insert the new one
      await aggregate.insert(ctx, newDoc);
      return;
    }
    throw error;
  }
}

/**
 * Safely replace an entry in a user profile aggregate index.
 * If the old entry is missing (DELETE_MISSING_KEY), fall back to inserting the new entry.
 */
async function safeReplaceUserProfileAggregate(
  ctx: any,
  aggregate: typeof userProfilesByClassificationsCount | typeof userProfilesByLastActive,
  oldDoc: Doc<"userProfiles">,
  newDoc: Doc<"userProfiles">
) {
  try {
    await aggregate.replace(ctx, oldDoc, newDoc);
  } catch (error: any) {
    const code = error?.data?.code;
    const message = error?.message ?? "";
    if (code === "DELETE_MISSING_KEY" || message.includes("DELETE_MISSING_KEY")) {
      await aggregate.insert(ctx, newDoc);
      return;
    }
    throw error;
  }
}

/**
 * Safely replace an entry in a classification aggregate index.
 * If the old entry is missing (DELETE_MISSING_KEY), fall back to inserting the new entry.
 */
async function safeReplaceClassificationAggregate(
  ctx: any,
  aggregate: typeof classificationsByCreated | typeof classificationsByAwesomeFlag | typeof classificationsByVisibleNucleus | typeof classificationsByFailedFitting | typeof classificationsByValidRedshift | typeof classificationsByLsbClass | typeof classificationsByMorphology,
  oldDoc: Doc<"classifications">,
  newDoc: Doc<"classifications">
) {
  try {
    await aggregate.replace(ctx, oldDoc, newDoc);
  } catch (error: any) {
    const code = error?.data?.code;
    const message = error?.message ?? "";
    if (code === "DELETE_MISSING_KEY" || message.includes("DELETE_MISSING_KEY")) {
      await aggregate.insert(ctx, newDoc);
      return;
    }
    throw error;
  }
}


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
        await safeReplaceClassificationAggregate(ctx, classificationsByCreated, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByAwesomeFlag, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByVisibleNucleus, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByFailedFitting, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByValidRedshift, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByLsbClass, existing, updatedClassification);
        await safeReplaceClassificationAggregate(ctx, classificationsByMorphology, existing, updatedClassification);
      }

      // Update per-user counters (classification total unchanged on edit)
      const awesomeDelta = Number(args.awesome_flag) - Number(existing.awesome_flag);
      const visibleDelta = Number(Boolean(args.visible_nucleus)) - Number(Boolean(existing.visible_nucleus));
      const failedDelta = Number(finalFailedFitting) - Number(existing.failed_fitting ?? false);
      const validDelta = Number(args.valid_redshift) - Number(existing.valid_redshift);

      const lsbKeyFromVal = (val: number) => (val === -1 ? "lsbNeg1Count" : val === 0 ? "lsb0Count" : "lsb1Count");
      const morphKeyFromVal = (val: number) =>
        val === -1 ? "morphNeg1Count" : val === 0 ? "morph0Count" : val === 1 ? "morph1Count" : "morph2Count";

      const profilePatch: Record<string, number> = {};
      const bump = (key: string, delta: number) => {
        if (delta === 0) return;
        const current = (profile as any)[key] ?? 0;
        profilePatch[key] = Math.max(0, current + delta);
      };

      bump("awesomeCount", awesomeDelta);
      bump("visibleNucleusCount", visibleDelta);
      bump("failedFittingCount", failedDelta);
      bump("validRedshiftCount", validDelta);
      bump(lsbKeyFromVal(finalLsbClass), 1);
      bump(lsbKeyFromVal(existing.lsb_class), -1);
      bump(morphKeyFromVal(args.morphology), 1);
      bump(morphKeyFromVal(existing.morphology), -1);

      if (Object.keys(profilePatch).length > 0) {
        await ctx.db.patch(profile._id, profilePatch);
      }

      // Update per-galaxy awesome/visible counters if flags changed
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", args.galaxyExternalId))
        .unique();

      if (galaxy) {
        const awesomeDelta = Number(args.awesome_flag) - Number(existing.awesome_flag ? 1 : 0);
        const newVisible = args.visible_nucleus ?? false;
        const visibleDelta = Number(newVisible ? 1 : 0) - Number(existing.visible_nucleus ? 1 : 0);

        if (awesomeDelta !== 0 || visibleDelta !== 0) {
          const currentAwesome = galaxy.numAwesomeFlag ?? BigInt(0);
          const currentVisible = galaxy.numVisibleNucleus ?? BigInt(0);
          const nextAwesome = currentAwesome + BigInt(awesomeDelta);
          const nextVisible = currentVisible + BigInt(visibleDelta);

          await ctx.db.patch(galaxy._id, {
            numAwesomeFlag: nextAwesome < BigInt(0) ? BigInt(0) : nextAwesome,
            numVisibleNucleus: nextVisible < BigInt(0) ? BigInt(0) : nextVisible,
          });

          const refreshedGalaxy = await ctx.db.get(galaxy._id);
          if (refreshedGalaxy) {
            if (awesomeDelta !== 0) {
              await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshedGalaxy);
            }
            if (visibleDelta !== 0) {
              await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshedGalaxy);
            }
          }
        }
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
        await classificationsByAwesomeFlag.insert(ctx, newClassification);
        await classificationsByVisibleNucleus.insert(ctx, newClassification);
        await classificationsByFailedFitting.insert(ctx, newClassification);
        await classificationsByValidRedshift.insert(ctx, newClassification);
        await classificationsByLsbClass.insert(ctx, newClassification);
        await classificationsByMorphology.insert(ctx, newClassification);
      }

      // Insert into userGalaxyClassifications for efficient browse queries
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", args.galaxyExternalId))
        .unique();

      if (galaxy) {
        // Insert tracking record for efficient "classified by me" queries
        await ctx.db.insert("userGalaxyClassifications", {
          userId,
          galaxyExternalId: args.galaxyExternalId,
          galaxyNumericId: galaxy.numericId ?? BigInt(0),
          classificationId,
          classifiedAt: Date.now(),
        });

        // Increment galaxy classification counter
        const updatedTotalClassifications = (galaxy.totalClassifications ?? BigInt(0)) + BigInt(1);
        const updatedNumAwesomeFlag = (galaxy.numAwesomeFlag ?? BigInt(0)) + (args.awesome_flag ? BigInt(1) : BigInt(0));
        const updatedNumVisibleNucleus = (galaxy.numVisibleNucleus ?? BigInt(0)) + (args.visible_nucleus ? BigInt(1) : BigInt(0));

        await ctx.db.patch(galaxy._id, {
          totalClassifications: updatedTotalClassifications,
          numAwesomeFlag: updatedNumAwesomeFlag,
          numVisibleNucleus: updatedNumVisibleNucleus,
        });

        const refreshedGalaxy = await ctx.db.get(galaxy._id);
        if (refreshedGalaxy) {
          await safeReplaceGalaxyAggregate(ctx, galaxiesByTotalClassifications, galaxy, refreshedGalaxy);
          await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshedGalaxy);
          await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshedGalaxy);
        }
      }

      // Update user's classification count
      const lsbKeyFromVal = (val: number) => (val === -1 ? "lsbNeg1Count" : val === 0 ? "lsb0Count" : "lsb1Count");
      const morphKeyFromVal = (val: number) =>
        val === -1 ? "morphNeg1Count" : val === 0 ? "morph0Count" : val === 1 ? "morph1Count" : "morph2Count";

      await ctx.db.patch(profile._id, {
        classificationsCount: profile.classificationsCount + 1,
        lastActiveAt: Date.now(),
        awesomeCount: ((profile as any).awesomeCount ?? 0) + (args.awesome_flag ? 1 : 0),
        visibleNucleusCount: ((profile as any).visibleNucleusCount ?? 0) + (args.visible_nucleus ? 1 : 0),
        failedFittingCount: ((profile as any).failedFittingCount ?? 0) + (finalFailedFitting ? 1 : 0),
        validRedshiftCount: ((profile as any).validRedshiftCount ?? 0) + (args.valid_redshift ? 1 : 0),
        [lsbKeyFromVal(finalLsbClass)]: ((profile as any)[lsbKeyFromVal(finalLsbClass)] ?? 0) + 1,
        [morphKeyFromVal(args.morphology)]: ((profile as any)[morphKeyFromVal(args.morphology)] ?? 0) + 1,
      });

      const updatedProfile = await ctx.db.get(profile._id);
      if (updatedProfile) {
        await safeReplaceUserProfileAggregate(ctx, userProfilesByClassificationsCount, profile, updatedProfile);
        await safeReplaceUserProfileAggregate(ctx, userProfilesByLastActive, profile, updatedProfile);
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

