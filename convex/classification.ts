import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireConfirmedUser, requirePermission } from "./lib/auth";
import { Doc } from "./_generated/dataModel";
import { normalizeUserExperience, userExperienceValidator } from "./lib/permissions";
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
  galaxiesByNumFailedFitting,
} from "./galaxies/aggregates";
import {
  computeSequenceBlacklistStats,
  getSequenceBlacklistStatsVersion,
  getStoredSequenceBlacklistStats,
  listBlacklistedGalaxyExternalIds,
  shouldUseStoredSequenceBlacklistStats,
} from "./lib/sequenceBlacklistStats";
import {
  resolveDisplayNameOrObfuscatedEmail,
  resolveEmailForViewer,
} from "./lib/userEmailVisibility";

/**
 * Safely replace an entry in a galaxy aggregate index.
 * If the old entry is missing (DELETE_MISSING_KEY), fall back to inserting the new entry.
 * This handles cases where galaxies were added before the aggregate was initialized.
 */
async function safeReplaceGalaxyAggregate(
  ctx: any,
  aggregate:
    | typeof galaxiesByTotalClassifications
    | typeof galaxiesByNumAwesomeFlag
    | typeof galaxiesByNumVisibleNucleus
    | typeof galaxiesByNumFailedFitting,
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

async function markUserStatsSnapshotDirty(
  ctx: any,
  userId: Doc<"userProfiles">["userId"]
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("userStatsSnapshots")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      dirty: true,
      dirtySince: existing.dirtySince ?? now,
    });
    return;
  }

  await ctx.db.insert("userStatsSnapshots", {
    userId,
    updatedAt: 0,
    dirty: true,
    dirtySince: now,
  });
}

async function loadSequenceBlacklistStatsForUser(
  ctx: any,
  userId: Doc<"userProfiles">["userId"],
  sequence: {
    galaxyExternalIds?: string[];
    numClassified: number;
    numSkipped: number;
    effectiveGalaxyCount?: number;
    blacklistedGalaxyCount?: number;
    blacklistedClassifiedCount?: number;
    blacklistedSkippedCount?: number;
    blacklistStatsVersion?: number;
  }
) {
  const currentVersion = await getSequenceBlacklistStatsVersion(ctx);

  if (shouldUseStoredSequenceBlacklistStats(sequence, currentVersion)) {
    return getStoredSequenceBlacklistStats(sequence);
  }

  const [blacklistedIds, classifiedRecords, skippedRecords] = await Promise.all([
    listBlacklistedGalaxyExternalIds(ctx),
    ctx.db.query("classifications").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(),
    ctx.db.query("skippedGalaxies").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(),
  ]);

  return computeSequenceBlacklistStats(sequence, {
    blacklistedExternalIds: new Set(blacklistedIds),
    classifiedExternalIds: new Set(classifiedRecords.map((record: { galaxyExternalId: string }) => record.galaxyExternalId)),
    skippedExternalIds: new Set(skippedRecords.map((record: { galaxyExternalId: string }) => record.galaxyExternalId)),
  });
}

async function buildSequenceClassificationPatch(
  ctx: any,
  userId: Doc<"userProfiles">["userId"],
  sequence: Doc<"galaxySequences">,
  galaxyExternalId: string
) {
  const patch: Record<string, number> = {
    numClassified: (sequence.numClassified || 0) + 1,
  };

  const currentVersion = await getSequenceBlacklistStatsVersion(ctx);
  if (!shouldUseStoredSequenceBlacklistStats(sequence, currentVersion)) {
    return patch;
  }

  const blacklistEntry = await ctx.db
    .query("galaxyBlacklist")
    .withIndex("by_galaxy", (q: any) => q.eq("galaxyExternalId", galaxyExternalId))
    .unique();

  if (blacklistEntry) {
    patch.blacklistedClassifiedCount = (sequence.blacklistedClassifiedCount ?? 0) + 1;
  }

  return patch;
}


// Get progress

export const getProgress = query({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getOptionalUserId(ctx);
    if (!currentUserId) return null;

    let userId = currentUserId;
    if (args.targetUserId && args.targetUserId !== currentUserId) {
      await requirePermission(ctx, "viewUserStatistics", {
        notAuthorizedMessage: "Only users with per-user statistics access can view other users' progress",
      });
      userId = args.targetUserId;
    }

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
      const stats = await loadSequenceBlacklistStatsForUser(ctx, userId, sequence);

      return {
        classified,
        skipped,
        total,
        completed,
        remaining: total - completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        effectiveClassified: stats!.effectiveClassifiedCount,
        effectiveSkipped: stats!.effectiveSkippedCount,
        effectiveTotal: stats!.effectiveGalaxyCount,
        effectiveCompleted: stats!.effectiveCompletedCount,
        effectiveRemaining: stats!.effectiveRemainingCount,
        effectivePercentage: stats!.effectiveCompletionPercent,
        blacklistedTotal: stats!.blacklistedGalaxyCount,
        blacklistedClassifiedCount: stats!.blacklistedClassifiedCount,
        blacklistedSkippedCount: stats!.blacklistedSkippedCount,
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

    // Check maintenance mode – block all classifications if disabled
    const maintenanceDoc = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "maintenanceDisableClassifications"))
      .unique();
    const maintenanceDisableClassifications = maintenanceDoc?.value === true;

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

    // Block all classifications (new and edits) when maintenance mode is active
    if (maintenanceDisableClassifications) {
      throw new Error("Classifications are currently disabled for maintenance. Please try again later.");
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

      const profileCounterDeltas: Record<string, number> = {};
      const bump = (key: string, delta: number) => {
        if (delta === 0) return;
        profileCounterDeltas[key] = (profileCounterDeltas[key] ?? 0) + delta;
      };

      bump("awesomeCount", awesomeDelta);
      bump("visibleNucleusCount", visibleDelta);
      bump("failedFittingCount", failedDelta);
      bump("validRedshiftCount", validDelta);
      bump(lsbKeyFromVal(finalLsbClass), 1);
      bump(lsbKeyFromVal(existing.lsb_class), -1);
      bump(morphKeyFromVal(args.morphology), 1);
      bump(morphKeyFromVal(existing.morphology), -1);

      const profilePatch: Record<string, number> = {};
      for (const [key, delta] of Object.entries(profileCounterDeltas)) {
        if (delta === 0) continue;
        const current = (profile as any)[key] ?? 0;
        profilePatch[key] = Math.max(0, current + delta);
      }

      if (Object.keys(profilePatch).length > 0) {
        await ctx.db.patch(profile._id, profilePatch);
      }

      // Update per-galaxy awesome/visible/failed counters if flags changed
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", args.galaxyExternalId))
        .unique();

      if (galaxy) {
        const awesomeDelta = Number(args.awesome_flag) - Number(existing.awesome_flag ? 1 : 0);
        const newVisible = args.visible_nucleus ?? false;
        const visibleDelta = Number(newVisible ? 1 : 0) - Number(existing.visible_nucleus ? 1 : 0);
        const failedDelta = Number(finalFailedFitting) - Number(existing.failed_fitting ? 1 : 0);

        if (awesomeDelta !== 0 || visibleDelta !== 0 || failedDelta !== 0) {
          const currentAwesome = galaxy.numAwesomeFlag ?? BigInt(0);
          const currentVisible = galaxy.numVisibleNucleus ?? BigInt(0);
          const currentFailed = galaxy.numFailedFitting ?? BigInt(0);
          const nextAwesome = currentAwesome + BigInt(awesomeDelta);
          const nextVisible = currentVisible + BigInt(visibleDelta);
          const nextFailed = currentFailed + BigInt(failedDelta);

          await ctx.db.patch(galaxy._id, {
            numAwesomeFlag: nextAwesome < BigInt(0) ? BigInt(0) : nextAwesome,
            numVisibleNucleus: nextVisible < BigInt(0) ? BigInt(0) : nextVisible,
            numFailedFitting: nextFailed < BigInt(0) ? BigInt(0) : nextFailed,
          });

          const refreshedGalaxy = await ctx.db.get(galaxy._id);
          if (refreshedGalaxy) {
            if (awesomeDelta !== 0) {
              await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshedGalaxy);
            }
            if (visibleDelta !== 0) {
              await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshedGalaxy);
            }
            if (failedDelta !== 0) {
              await safeReplaceGalaxyAggregate(ctx, galaxiesByNumFailedFitting, galaxy, refreshedGalaxy);
            }
          }
        }
      }

      await markUserStatsSnapshotDirty(ctx, userId);
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
        const updatedNumFailedFitting = (galaxy.numFailedFitting ?? BigInt(0)) + (finalFailedFitting ? BigInt(1) : BigInt(0));

        await ctx.db.patch(galaxy._id, {
          totalClassifications: updatedTotalClassifications,
          numAwesomeFlag: updatedNumAwesomeFlag,
          numVisibleNucleus: updatedNumVisibleNucleus,
          numFailedFitting: updatedNumFailedFitting,
        });

        const refreshedGalaxy = await ctx.db.get(galaxy._id);
        if (refreshedGalaxy) {
          await safeReplaceGalaxyAggregate(ctx, galaxiesByTotalClassifications, galaxy, refreshedGalaxy);
          await safeReplaceGalaxyAggregate(ctx, galaxiesByNumAwesomeFlag, galaxy, refreshedGalaxy);
          await safeReplaceGalaxyAggregate(ctx, galaxiesByNumVisibleNucleus, galaxy, refreshedGalaxy);
          await safeReplaceGalaxyAggregate(ctx, galaxiesByNumFailedFitting, galaxy, refreshedGalaxy);
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
        await ctx.db.patch(
          sequence._id,
          await buildSequenceClassificationPatch(ctx, userId, sequence, args.galaxyExternalId)
        );
      }

      await markUserStatsSnapshotDirty(ctx, userId);
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

function getSequenceState(
  sequenceIndex: number,
  currentIndex: number,
  alreadyHandled: boolean
) {
  if (alreadyHandled && sequenceIndex >= currentIndex) {
    return "completed" as const;
  }

  if (sequenceIndex < currentIndex) {
    return "passed" as const;
  }

  if (sequenceIndex === currentIndex) {
    return "current" as const;
  }

  return "upcoming" as const;
}

function summarizeClassification(classification: Doc<"classifications">) {
  return {
    lsb_class: classification.lsb_class,
    morphology: classification.morphology,
    awesome_flag: classification.awesome_flag,
    valid_redshift: classification.valid_redshift,
    visible_nucleus: classification.visible_nucleus ?? null,
    failed_fitting: classification.failed_fitting ?? false,
    comments: classification.comments ?? null,
    timeSpent: classification.timeSpent,
    createdAt: classification._creationTime,
  };
}

const galaxyAssignmentDetailsClassificationValidator = v.object({
  lsb_class: v.number(),
  morphology: v.number(),
  awesome_flag: v.boolean(),
  valid_redshift: v.boolean(),
  visible_nucleus: v.union(v.null(), v.boolean()),
  failed_fitting: v.boolean(),
  comments: v.union(v.null(), v.string()),
  timeSpent: v.number(),
  createdAt: v.number(),
});

const galaxyAssignmentDetailsSkippedValidator = v.object({
  comments: v.union(v.null(), v.string()),
});

const galaxyAssignmentDetailsUserValidator = v.object({
  userId: v.string(),
  name: v.union(v.null(), v.string()),
  email: v.union(v.null(), v.string()),
  role: v.string(),
  experience: userExperienceValidator,
  isActive: v.union(v.null(), v.boolean()),
  currentlyAssigned: v.boolean(),
  sequencePosition: v.union(v.null(), v.number()),
  sequenceLength: v.union(v.null(), v.number()),
  sequenceState: v.union(
    v.null(),
    v.literal("passed"),
    v.literal("current"),
    v.literal("upcoming"),
    v.literal("completed")
  ),
  numClassifiedInSequence: v.union(v.null(), v.number()),
  numSkippedInSequence: v.union(v.null(), v.number()),
  classification: v.union(v.null(), galaxyAssignmentDetailsClassificationValidator),
  skipped: v.union(v.null(), galaxyAssignmentDetailsSkippedValidator),
});

const galaxyAssignmentDetailsValidator = v.object({
  assignmentSourceTracked: v.boolean(),
  users: v.array(galaxyAssignmentDetailsUserValidator),
});

export const getGalaxyAssignmentDetails = query({
  args: { galaxyExternalId: v.string() },
  returns: galaxyAssignmentDetailsValidator,
  handler: async (ctx, { galaxyExternalId }) => {
    const { permissions } = await requirePermission(ctx, "viewGalaxyAssignmentDetails", {
      notAuthorizedMessage: "Galaxy assignment details are not available for this account",
    });
    const showUserEmails = permissions.viewUserEmails;

    const [sequences, classifications, skippedRows] = await Promise.all([
      ctx.db.query("galaxySequences").collect(),
      ctx.db
        .query("classifications")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .collect(),
      ctx.db
        .query("skippedGalaxies")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .collect(),
    ]);

    const assignments = sequences
      .map((sequence) => {
        const galaxyIds = sequence.galaxyExternalIds ?? [];
        const sequenceIndex = galaxyIds.indexOf(galaxyExternalId);

        if (sequenceIndex === -1) {
          return null;
        }

        return {
          sequence,
          sequenceIndex,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          sequence: Doc<"galaxySequences">;
          sequenceIndex: number;
        } => entry !== null
      );

    const userIds = new Set(assignments.map((entry) => entry.sequence.userId));
    for (const classification of classifications) {
      userIds.add(classification.userId);
    }
    for (const skipped of skippedRows) {
      userIds.add(skipped.userId);
    }

    const assignmentByUserId = new Map(
      assignments.map((entry) => [entry.sequence.userId, entry] as const)
    );
    const classificationByUserId = new Map(
      classifications.map((classification) => [classification.userId, classification] as const)
    );
    const skippedByUserId = new Map(
      skippedRows.map((skipped) => [skipped.userId, skipped] as const)
    );

    const userDetailsEntries = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const [user, profile] = await Promise.all([
          ctx.db.get(userId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique(),
        ]);

        return [
          userId,
          {
            name: resolveDisplayNameOrObfuscatedEmail({
              name: user?.name,
              email: user?.email,
            }),
            email: resolveEmailForViewer({
              name: user?.name,
              email: user?.email,
              canViewRawEmail: showUserEmails,
            }),
            role: profile?.role ?? "user",
            experience: normalizeUserExperience(profile?.experience),
            isActive: profile?.isActive ?? null,
          },
        ] as const;
      })
    );

    const userDetailsById = new Map(userDetailsEntries);

    const users = Array.from(userIds)
      .map((userId) => {
        const assignment = assignmentByUserId.get(userId) ?? null;
        const classification = classificationByUserId.get(userId) ?? null;
        const skipped = skippedByUserId.get(userId) ?? null;
        const userDetails = userDetailsById.get(userId);

        return {
          userId,
          name: userDetails?.name ?? null,
          email: userDetails?.email ?? null,
          role: userDetails?.role ?? "user",
          experience: normalizeUserExperience(userDetails?.experience),
          isActive: userDetails?.isActive ?? null,
          currentlyAssigned: assignment !== null,
          sequencePosition: assignment ? assignment.sequenceIndex + 1 : null,
          sequenceLength: assignment
            ? assignment.sequence.galaxyExternalIds?.length ?? 0
            : null,
          sequenceState: assignment
            ? getSequenceState(
                assignment.sequenceIndex,
                assignment.sequence.currentIndex,
                Boolean(classification || skipped)
              )
            : null,
          numClassifiedInSequence: assignment ? assignment.sequence.numClassified : null,
          numSkippedInSequence: assignment ? assignment.sequence.numSkipped : null,
          classification: classification ? summarizeClassification(classification) : null,
          skipped: skipped
            ? {
                comments: skipped.comments ?? null,
              }
            : null,
        };
      })
      .sort((left, right) => {
        if (left.currentlyAssigned !== right.currentlyAssigned) {
          return left.currentlyAssigned ? -1 : 1;
        }

        if (Boolean(left.classification) !== Boolean(right.classification)) {
          return left.classification ? -1 : 1;
        }

        const leftLabel = left.name ?? left.email ?? left.userId;
        const rightLabel = right.name ?? right.email ?? right.userId;
        return leftLabel.localeCompare(rightLabel, undefined, {
          sensitivity: "base",
        });
      });

    return {
      assignmentSourceTracked: false,
      users,
    };
  },
});

export const getGalaxyResults = query({
  args: { galaxyExternalId: v.string() },
  returns: v.object({
    galaxy: v.union(v.null(), v.any()),
    classifications: v.array(v.object({
      userId: v.string(),
      userName: v.union(v.null(), v.string()),
      userEmail: v.union(v.null(), v.string()),
      userRole: v.string(),
      userExperience: v.string(),
      userIsActive: v.union(v.null(), v.boolean()),
      lsb_class: v.number(),
      morphology: v.number(),
      awesome_flag: v.boolean(),
      valid_redshift: v.boolean(),
      visible_nucleus: v.union(v.null(), v.boolean()),
      failed_fitting: v.boolean(),
      comments: v.union(v.null(), v.string()),
      timeSpent: v.number(),
      createdAt: v.number(),
    })),
    summary: v.object({
      totalClassifications: v.number(),
      totalClassifiers: v.number(),
      nonLsbCount: v.number(),
      lsbCount: v.number(),
      failedFittingCount: v.number(),
      featurelessCount: v.number(),
      irregularCount: v.number(),
      spiralCount: v.number(),
      ellipticalCount: v.number(),
      awesomeCount: v.number(),
      validRedshiftCount: v.number(),
      visibleNucleusCount: v.number(),
    }),
  }),
  handler: async (ctx, { galaxyExternalId }) => {
    const { permissions } = await requirePermission(ctx, "viewGalaxyResults", {
      notAuthorizedMessage: "You do not have permission to view galaxy classification results.",
    });

    const showUserEmails = permissions.viewUserEmails;
    const trimmedId = galaxyExternalId.trim();
    if (!trimmedId) {
      return {
        galaxy: null,
        classifications: [],
        summary: {
          totalClassifications: 0,
          totalClassifiers: 0,
          nonLsbCount: 0,
          lsbCount: 0,
          failedFittingCount: 0,
          featurelessCount: 0,
          irregularCount: 0,
          spiralCount: 0,
          ellipticalCount: 0,
          awesomeCount: 0,
          validRedshiftCount: 0,
          visibleNucleusCount: 0,
        },
      };
    }

    const galaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", trimmedId))
      .unique();

    const classificationDocs = await ctx.db
      .query("classifications")
      .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", trimmedId))
      .order("desc")
      .collect();

    const userIds = new Set(classificationDocs.map((c) => c.userId));

    const userDetailsEntries = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const [user, profile] = await Promise.all([
          ctx.db.get(userId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique(),
        ]);

        return [
          userId,
          {
            name: resolveDisplayNameOrObfuscatedEmail({
              name: user?.name,
              email: user?.email,
            }),
            email: resolveEmailForViewer({
              name: user?.name,
              email: user?.email,
              canViewRawEmail: showUserEmails,
            }),
            role: profile?.role ?? "user",
            experience: normalizeUserExperience(profile?.experience),
            isActive: profile?.isActive ?? null,
          },
        ] as const;
      })
    );

    const userDetailsById = new Map(userDetailsEntries);

    const classifications = classificationDocs.map((c) => {
      const userDetails = userDetailsById.get(c.userId);
      return {
        userId: c.userId,
        userName: userDetails?.name ?? null,
        userEmail: userDetails?.email ?? null,
        userRole: userDetails?.role ?? "user",
        userExperience: userDetails?.experience ?? "normal",
        userIsActive: userDetails?.isActive ?? null,
        lsb_class: c.lsb_class,
        morphology: c.morphology,
        awesome_flag: c.awesome_flag,
        valid_redshift: c.valid_redshift,
        visible_nucleus: c.visible_nucleus ?? null,
        failed_fitting: c.failed_fitting ?? false,
        comments: c.comments ?? null,
        timeSpent: c.timeSpent,
        createdAt: c._creationTime,
      };
    });

    const totalClassifications = classifications.length;
    const totalClassifiers = userIds.size;

    let nonLsbCount = 0;
    let lsbCount = 0;
    let failedFittingCount = 0;
    let featurelessCount = 0;
    let irregularCount = 0;
    let spiralCount = 0;
    let ellipticalCount = 0;
    let awesomeCount = 0;
    let validRedshiftCount = 0;
    let visibleNucleusCount = 0;

    for (const c of classifications) {
      if (c.failed_fitting) {
        failedFittingCount++;
      } else if (c.lsb_class === 1) {
        lsbCount++;
      } else {
        nonLsbCount++;
      }

      if (c.morphology === -1) featurelessCount++;
      else if (c.morphology === 0) irregularCount++;
      else if (c.morphology === 1) spiralCount++;
      else if (c.morphology === 2) ellipticalCount++;

      if (c.awesome_flag) awesomeCount++;
      if (c.valid_redshift) validRedshiftCount++;
      if (c.visible_nucleus) visibleNucleusCount++;
    }

    return {
      galaxy,
      classifications,
      summary: {
        totalClassifications,
        totalClassifiers,
        nonLsbCount,
        lsbCount,
        failedFittingCount,
        featurelessCount,
        irregularCount,
        spiralCount,
        ellipticalCount,
        awesomeCount,
        validRedshiftCount,
        visibleNucleusCount,
      },
    };
  },
});

