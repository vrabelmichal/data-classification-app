import { mutation } from "../_generated/server";
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

function tallyUserClassificationStats(classifications: Doc<"classifications">[]) {
  const result = {
    classificationsCount: classifications.length,
    awesomeCount: 0,
    visibleNucleusCount: 0,
    failedFittingCount: 0,
    validRedshiftCount: 0,
    lsbNeg1Count: 0,
    lsb0Count: 0,
    lsb1Count: 0,
    morphNeg1Count: 0,
    morph0Count: 0,
    morph1Count: 0,
    morph2Count: 0,
  };

  for (const c of classifications) {
    if (c.awesome_flag) result.awesomeCount += 1;
    if (c.visible_nucleus) result.visibleNucleusCount += 1;
    if (c.failed_fitting) result.failedFittingCount += 1;
    if (c.valid_redshift) result.validRedshiftCount += 1;

    if (c.lsb_class === -1) result.lsbNeg1Count += 1;
    else if (c.lsb_class === 0) result.lsb0Count += 1;
    else result.lsb1Count += 1;

    if (c.morphology === -1) result.morphNeg1Count += 1;
    else if (c.morphology === 0) result.morph0Count += 1;
    else if (c.morphology === 1) result.morph1Count += 1;
    else result.morph2Count += 1;
  }

  return result;
}

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
      const classifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .collect();

      const counts = tallyUserClassificationStats(classifications);

      const patch: Partial<Doc<"userProfiles">> = {};
      const maybe = (key: keyof typeof counts, value: number) => {
        if ((profile as any)[key] !== value) {
          patch[key] = value as any;
        }
      };

      maybe("classificationsCount", counts.classificationsCount);
      maybe("awesomeCount", counts.awesomeCount);
      maybe("visibleNucleusCount", counts.visibleNucleusCount);
      maybe("failedFittingCount", counts.failedFittingCount);
      maybe("validRedshiftCount", counts.validRedshiftCount);
      maybe("lsbNeg1Count", counts.lsbNeg1Count);
      maybe("lsb0Count", counts.lsb0Count);
      maybe("lsb1Count", counts.lsb1Count);
      maybe("morphNeg1Count", counts.morphNeg1Count);
      maybe("morph0Count", counts.morph0Count);
      maybe("morph1Count", counts.morph1Count);
      maybe("morph2Count", counts.morph2Count);

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

      const classifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const counts = tallyUserClassificationStats(classifications);

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
