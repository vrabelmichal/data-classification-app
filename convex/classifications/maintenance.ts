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
  getUserClassificationCounterDiffKeys,
  type UserClassificationCounterKey,
  type UserClassificationCounterSnapshot,
  userClassificationCounterKeyValidator,
  userClassificationCounterSnapshotValidator,
  getUserClassificationCounterSnapshotFromProfile,
  getUserClassificationLsbTotal,
  getUserClassificationMorphologyTotal,
} from "./userCounterStats";

const CLASSIFICATION_AGG_BATCH_SIZE = 500;
const USER_FULL_BATCH_SIZE = 75;
const USER_FAST_CLASSIFICATIONS_BATCH_SIZE = 500;
const USER_COUNTER_DIAGNOSTICS_PAGE_SIZE = 5;

const userClassificationCounterDiagnosticRowValidator = v.object({
  userId: v.id("users"),
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  isConsistent: v.boolean(),
  hasInvalidStoredValues: v.boolean(),
  changedFields: v.array(userClassificationCounterKeyValidator),
  cachedClassificationsCount: v.number(),
  actualClassificationsCount: v.number(),
  cachedLsbTotal: v.number(),
  actualLsbTotal: v.number(),
  cachedMorphologyTotal: v.number(),
  actualMorphologyTotal: v.number(),
  invalidLsbCount: v.number(),
  invalidMorphologyCount: v.number(),
  cachedCounters: userClassificationCounterSnapshotValidator,
  actualCounters: userClassificationCounterSnapshotValidator,
});

const userClassificationCounterDiagnosticsResultValidator = v.object({
  requestedUsers: v.number(),
  scannedUsers: v.number(),
  missingProfiles: v.number(),
  inconsistentUsers: v.number(),
  invalidValueUsers: v.number(),
  rows: v.array(userClassificationCounterDiagnosticRowValidator),
  isDone: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
});

const repairUserClassificationCountersResultValidator = v.object({
  processed: v.number(),
  updated: v.number(),
  skipped: v.number(),
  missingProfiles: v.number(),
  invalidValueUsers: v.number(),
});

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

function parseSelectedUserDiagnosticsCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sortUserClassificationDiagnosticRows(
  rows: Array<{
    userId: Doc<"userProfiles">["userId"];
    name: string | null;
    email: string | null;
    isConsistent: boolean;
    changedFields: UserClassificationCounterKey[];
    actualClassificationsCount: number;
  }>
) {
  return rows.sort((left, right) => {
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
}

export const getUserClassificationCounterDiagnostics = query({
  args: {
    userIds: v.optional(v.array(v.id("users"))),
    includeConsistent: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: userClassificationCounterDiagnosticsResultValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const includeConsistent = args.includeConsistent ?? false;
    const requestedUserIds = args.userIds?.length ? Array.from(new Set(args.userIds)) : null;

    const limit = Math.max(1, Math.min(args.limit ?? USER_COUNTER_DIAGNOSTICS_PAGE_SIZE, USER_COUNTER_DIAGNOSTICS_PAGE_SIZE));

    let profiles: Doc<"userProfiles">[] = [];
    let requestedUsers = 0;
    let missingProfiles = 0;
    let isDone = true;
    let nextCursor: string | null = null;

    if (requestedUserIds) {
      requestedUsers = requestedUserIds.length;

      const startIndex = parseSelectedUserDiagnosticsCursor(args.cursor);
      const pageUserIds = requestedUserIds.slice(startIndex, startIndex + limit);
      const nextIndex = startIndex + pageUserIds.length;
      isDone = nextIndex >= requestedUserIds.length;
      nextCursor = isDone ? null : String(nextIndex);

      for (const userId of pageUserIds) {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        if (profile) {
          profiles.push(profile);
        } else {
          missingProfiles += 1;
        }
      }
    } else {
      requestedUsers = await userProfilesByClassificationsCount.count(ctx);

      const page = await ctx.db
        .query("userProfiles")
        .paginate({ numItems: limit, cursor: args.cursor ?? null });

      profiles = page.page;
      isDone = page.isDone;
      nextCursor = page.isDone ? null : page.continueCursor;
    }

    let inconsistentUsers = 0;
    let invalidValueUsers = 0;

    const rows: Array<{
      userId: Doc<"userProfiles">["userId"];
      name: string | null;
      email: string | null;
      isConsistent: boolean;
      hasInvalidStoredValues: boolean;
      changedFields: UserClassificationCounterKey[];
      cachedClassificationsCount: number;
      actualClassificationsCount: number;
      cachedLsbTotal: number;
      actualLsbTotal: number;
      cachedMorphologyTotal: number;
      actualMorphologyTotal: number;
      invalidLsbCount: number;
      invalidMorphologyCount: number;
      cachedCounters: UserClassificationCounterSnapshot;
      actualCounters: UserClassificationCounterSnapshot;
    }> = [];

    for (const profile of profiles) {
      const audit = await getUserClassificationAudit(ctx, profile.userId);
      const user = await ctx.db.get(profile.userId);
      const cachedCounters = getUserClassificationCounterSnapshotFromProfile(profile);
      const changedFields = getUserClassificationCounterDiffKeys(cachedCounters, audit.counters);
      const isConsistent = changedFields.length === 0;
      const hasInvalidStoredValues = audit.invalidLsbCount > 0 || audit.invalidMorphologyCount > 0;

      if (!isConsistent) {
        inconsistentUsers += 1;
      }
      if (hasInvalidStoredValues) {
        invalidValueUsers += 1;
      }

      // Including email in the response poses a compliance/privacy risk (GDPR/CCPA). Even for admin-only diagnostics, consider whether email is necessary or if userId alone suffices for identification.
      const row = {
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

      if (includeConsistent || !row.isConsistent || row.hasInvalidStoredValues) {
        rows.push(row);
      }
    }

    sortUserClassificationDiagnosticRows(rows);

    return {
      requestedUsers,
      scannedUsers: profiles.length,
      missingProfiles,
      inconsistentUsers,
      invalidValueUsers,
      rows,
      isDone,
      nextCursor,
    };
  },
});

export const repairUserClassificationCounters = mutation({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: repairUserClassificationCountersResultValidator,
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
