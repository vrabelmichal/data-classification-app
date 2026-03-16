import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { Doc } from "../_generated/dataModel";
import {
  classificationsByAwesomeFlag,
  classificationsByVisibleNucleus,
  classificationsByFailedFitting,
  classificationsByValidRedshift,
  classificationsByLsbClass,
  classificationsByMorphology,
  classificationsByCreated,
  userProfilesByClassificationsCount,
  userProfilesByLastActive,
} from "../galaxies/aggregates";
import {
  auditUserClassificationStats,
  buildUserClassificationCounterPatch,
  createEmptyUserClassificationCounterSnapshot,
  getUserClassificationCounterDiffKeys,
  getUserClassificationCounterSnapshotFromProfile,
  getUserClassificationLsbTotal,
  getUserClassificationMorphologyTotal,
} from "./userCounterStats";

const CLASSIFICATION_AGG_BATCH_SIZE = 500;
const USER_FULL_BATCH_SIZE = 75;
const USER_FAST_CLASSIFICATIONS_BATCH_SIZE = 500;

async function replaceOrInsertUserProfileAggregate(
  ctx: any,
  aggregate: typeof userProfilesByClassificationsCount,
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

async function getUserClassificationAudit(ctx: any, userId: Doc<"userProfiles">["userId"]) {
  const classifications = await ctx.db
    .query("classifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  return auditUserClassificationStats(classifications);
}

async function applyUserClassificationCounterRepair(
  ctx: any,
  profile: Doc<"userProfiles">
) {
  const audit = await getUserClassificationAudit(ctx, profile.userId);
  const patch = buildUserClassificationCounterPatch(profile, audit.counters);

  if (Object.keys(patch).length === 0) {
    return {
      updated: false,
      changedFields: [] as string[],
      invalidLsbCount: audit.invalidLsbCount,
      invalidMorphologyCount: audit.invalidMorphologyCount,
    };
  }

  await ctx.db.patch(profile._id, patch);
  const refreshed = await ctx.db.get(profile._id);
  if (refreshed) {
    await replaceOrInsertUserProfileAggregate(ctx, userProfilesByClassificationsCount, profile, refreshed);
    await replaceOrInsertUserProfileAggregate(ctx, userProfilesByLastActive, profile, refreshed);
  }

  return {
    updated: true,
    changedFields: Object.keys(patch),
    invalidLsbCount: audit.invalidLsbCount,
    invalidMorphologyCount: audit.invalidMorphologyCount,
  };
}

export const getUserClassificationCounterDiagnostics = query({
  args: {
    userIds: v.optional(v.array(v.id("users"))),
    includeConsistent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const includeConsistent = args.includeConsistent ?? false;
    const requestedUserIds = args.userIds?.length ? Array.from(new Set(args.userIds)) : null;

    const usersById = new Map<string, Doc<"users"> | null>();
    const auditByUserId = new Map<string, ReturnType<typeof auditUserClassificationStats>>();

    let profiles: Doc<"userProfiles">[] = [];
    let requestedUsers = 0;

    if (requestedUserIds) {
      requestedUsers = requestedUserIds.length;

      const [userResults, profileResults, classificationResults] = await Promise.all([
        Promise.all(requestedUserIds.map((userId) => ctx.db.get(userId))),
        Promise.all(
          requestedUserIds.map((userId) =>
            ctx.db
              .query("userProfiles")
              .withIndex("by_user", (q) => q.eq("userId", userId))
              .unique()
          )
        ),
        Promise.all(
          requestedUserIds.map((userId) =>
            ctx.db
              .query("classifications")
              .withIndex("by_user", (q) => q.eq("userId", userId))
              .collect()
          )
        ),
      ]);

      for (let index = 0; index < requestedUserIds.length; index += 1) {
        const userId = requestedUserIds[index];
        usersById.set(String(userId), userResults[index] ?? null);
        auditByUserId.set(String(userId), auditUserClassificationStats(classificationResults[index]));
      }

      profiles = profileResults.filter((profile): profile is Doc<"userProfiles"> => profile !== null);
    } else {
      const [allProfiles, allUsers, allClassifications] = await Promise.all([
        ctx.db.query("userProfiles").collect(),
        ctx.db.query("users").collect(),
        ctx.db.query("classifications").collect(),
      ]);

      profiles = allProfiles;
      requestedUsers = allProfiles.length;

      for (const user of allUsers) {
        usersById.set(String(user._id), user);
      }

      const classificationsByUserId = new Map<string, Doc<"classifications">[]>();
      for (const classification of allClassifications) {
        const userKey = String(classification.userId);
        const existing = classificationsByUserId.get(userKey);
        if (existing) {
          existing.push(classification);
        } else {
          classificationsByUserId.set(userKey, [classification]);
        }
      }

      for (const profile of allProfiles) {
        auditByUserId.set(
          String(profile.userId),
          auditUserClassificationStats(classificationsByUserId.get(String(profile.userId)) ?? [])
        );
      }
    }

    let inconsistentUsers = 0;
    let invalidValueUsers = 0;

    const rows = profiles
      .map((profile) => {
        const audit = auditByUserId.get(String(profile.userId)) ?? {
          counters: createEmptyUserClassificationCounterSnapshot(),
          invalidLsbCount: 0,
          invalidMorphologyCount: 0,
        };
        const cachedCounters = getUserClassificationCounterSnapshotFromProfile(profile);
        const changedFields = getUserClassificationCounterDiffKeys(cachedCounters, audit.counters);
        const isConsistent = changedFields.length === 0;
        const hasInvalidStoredValues = audit.invalidLsbCount > 0 || audit.invalidMorphologyCount > 0;
        const user = usersById.get(String(profile.userId));

        if (!isConsistent) {
          inconsistentUsers += 1;
        }
        if (hasInvalidStoredValues) {
          invalidValueUsers += 1;
        }

        return {
          userId: profile.userId,
          name: (user as any)?.name ?? null,
          email: (user as any)?.email ?? null,
          isConsistent,
          hasInvalidStoredValues,
          changedFields,
          cachedClassificationsCount: cachedCounters.classificationsCount,
          actualClassificationsCount: audit.counters.classificationsCount,
          cachedLsbTotal: getUserClassificationLsbTotal(cachedCounters),
          actualLsbTotal: getUserClassificationLsbTotal(audit.counters),
          cachedMorphologyTotal: getUserClassificationMorphologyTotal(cachedCounters),
          actualMorphologyTotal: getUserClassificationMorphologyTotal(audit.counters),
          invalidLsbCount: audit.invalidLsbCount,
          invalidMorphologyCount: audit.invalidMorphologyCount,
          cachedCounters,
          actualCounters: audit.counters,
        };
      })
      .filter((row) => includeConsistent || !row.isConsistent || row.hasInvalidStoredValues)
      .sort((left, right) => {
        if (Number(left.isConsistent) !== Number(right.isConsistent)) {
          return Number(left.isConsistent) - Number(right.isConsistent);
        }

        if (right.changedFields.length !== left.changedFields.length) {
          return right.changedFields.length - left.changedFields.length;
        }

        if (right.actualClassificationsCount !== left.actualClassificationsCount) {
          return right.actualClassificationsCount - left.actualClassificationsCount;
        }

        const leftLabel = left.name || left.email || String(left.userId);
        const rightLabel = right.name || right.email || String(right.userId);
        return leftLabel.localeCompare(rightLabel);
      });

    return {
      requestedUsers,
      scannedUsers: profiles.length,
      missingProfiles: Math.max(requestedUsers - profiles.length, 0),
      inconsistentUsers,
      invalidValueUsers,
      rows,
    };
  },
});

export const repairUserClassificationCounters = mutation({
  args: {
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const userIds = Array.from(new Set(args.userIds));

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let missingProfiles = 0;
    let invalidValueUsers = 0;

    for (const userId of userIds) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (!profile) {
        missingProfiles += 1;
        continue;
      }

      const result = await applyUserClassificationCounterRepair(ctx, profile);
      if (result.invalidLsbCount > 0 || result.invalidMorphologyCount > 0) {
        invalidValueUsers += 1;
      }

      processed += 1;
      if (result.updated) {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return {
      processed,
      updated,
      skipped,
      missingProfiles,
      invalidValueUsers,
    };
  },
});

export const backfillClassificationAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
    clearOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    if (!args.cursor) {
      await Promise.all([
        classificationsByAwesomeFlag.clear(ctx),
        classificationsByVisibleNucleus.clear(ctx),
        classificationsByFailedFitting.clear(ctx),
        classificationsByValidRedshift.clear(ctx),
        classificationsByLsbClass.clear(ctx),
        classificationsByMorphology.clear(ctx),
        classificationsByCreated.clear(ctx),
      ]);

      if (args.clearOnly) {
        return {
          processed: 0,
          isDone: true,
          continueCursor: null,
          message: "Cleared classification aggregates",
        };
      }
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("classifications")
      .paginate({ numItems: CLASSIFICATION_AGG_BATCH_SIZE, cursor: args.cursor ?? null });

    for (const classification of page) {
      await classificationsByAwesomeFlag.insert(ctx, classification);
      await classificationsByVisibleNucleus.insert(ctx, classification);
      await classificationsByFailedFitting.insert(ctx, classification);
      await classificationsByValidRedshift.insert(ctx, classification);
      await classificationsByLsbClass.insert(ctx, classification);
      await classificationsByMorphology.insert(ctx, classification);
      await classificationsByCreated.insert(ctx, classification);
    }

    return {
      processed: page.length,
      isDone,
      continueCursor,
      message: isDone
        ? `Backfill complete. Processed ${page.length} classifications in final batch.`
        : `Processed ${page.length} classifications. Continue with cursor ${continueCursor}`,
    };
  },
});

export const fastBackfillClassificationAggregates = mutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    // Fast path rebuilds only attribute aggregates (booleans/enums). Skips created timestamp aggregate.
    if (!args.cursor) {
      await Promise.all([
        classificationsByAwesomeFlag.clear(ctx),
        classificationsByVisibleNucleus.clear(ctx),
        classificationsByFailedFitting.clear(ctx),
        classificationsByValidRedshift.clear(ctx),
        classificationsByLsbClass.clear(ctx),
        classificationsByMorphology.clear(ctx),
      ]);
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("classifications")
      .paginate({ numItems: CLASSIFICATION_AGG_BATCH_SIZE, cursor: args.cursor ?? null });

    for (const classification of page) {
      await classificationsByAwesomeFlag.insert(ctx, classification);
      await classificationsByVisibleNucleus.insert(ctx, classification);
      await classificationsByFailedFitting.insert(ctx, classification);
      await classificationsByValidRedshift.insert(ctx, classification);
      await classificationsByLsbClass.insert(ctx, classification);
      await classificationsByMorphology.insert(ctx, classification);
    }

    return {
      processed: page.length,
      isDone,
      continueCursor,
      message: isDone
        ? `Fast backfill complete. Processed ${page.length} classifications in final batch.`
        : `Processed ${page.length} classifications. Continue with cursor ${continueCursor}`,
    };
  },
});

export const fullBackfillUserClassificationCounters = mutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const { page, isDone, continueCursor } = await ctx.db
      .query("userProfiles")
      .paginate({ numItems: USER_FULL_BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    let updated = 0;

    for (const profile of page) {
      const counts = (await getUserClassificationAudit(ctx, profile.userId)).counters;
      const patch = buildUserClassificationCounterPatch(profile, counts);

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(profile._id, patch);
        const refreshed = await ctx.db.get(profile._id);
        if (refreshed) {
          await replaceOrInsertUserProfileAggregate(ctx, userProfilesByClassificationsCount, profile, refreshed);
          await replaceOrInsertUserProfileAggregate(ctx, userProfilesByLastActive, profile, refreshed);
        }
        updated += 1;
      }

      processed += 1;
    }

    return {
      processed,
      updated,
      isDone,
      continueCursor,
      message: isDone
        ? `Full backfill complete. Processed ${processed}, updated ${updated} user profiles.`
        : `Processed ${processed}, updated ${updated}. Continue with cursor ${continueCursor}`,
    };
  },
});

export const fastBackfillUserClassificationCounters = mutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const { page, isDone, continueCursor } = await ctx.db
      .query("classifications")
      .paginate({ numItems: USER_FAST_CLASSIFICATIONS_BATCH_SIZE, cursor: args.cursor ?? null });

    const userIds = Array.from(new Set(page.map((c) => c.userId)));

    let updated = 0;

    for (const userId of userIds) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!profile) continue;

      const counts = (await getUserClassificationAudit(ctx, userId)).counters;

      const patch: Partial<Doc<"userProfiles">> = {
        classificationsCount: counts.classificationsCount,
        awesomeCount: counts.awesomeCount,
        visibleNucleusCount: counts.visibleNucleusCount,
        failedFittingCount: counts.failedFittingCount,
        validRedshiftCount: counts.validRedshiftCount,
        lsbNeg1Count: counts.lsbNeg1Count,
        lsb0Count: counts.lsb0Count,
        lsb1Count: counts.lsb1Count,
        morphNeg1Count: counts.morphNeg1Count,
        morph0Count: counts.morph0Count,
        morph1Count: counts.morph1Count,
        morph2Count: counts.morph2Count,
      };

      await ctx.db.patch(profile._id, patch);
      const refreshed = await ctx.db.get(profile._id);
      if (refreshed) {
        await replaceOrInsertUserProfileAggregate(ctx, userProfilesByClassificationsCount, profile, refreshed);
        await replaceOrInsertUserProfileAggregate(ctx, userProfilesByLastActive, profile, refreshed);
      }
      updated += 1;
    }

    return {
      processed: page.length,
      uniqueUsers: userIds.length,
      updated,
      isDone,
      continueCursor,
      message: isDone
        ? `Fast counter backfill complete. Processed ${page.length} classifications in final batch.`
        : `Processed ${page.length} classifications (${userIds.length} users). Continue with cursor ${continueCursor}`,
    };
  },
});
