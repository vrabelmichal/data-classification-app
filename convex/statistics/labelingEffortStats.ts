import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requirePermission } from "../lib/auth";
import {
  classificationsByAwesomeFlag,
  classificationsByCreated,
  classificationsByFailedFitting,
  classificationsByLsbClass,
  classificationsByMorphology,
  classificationsByValidRedshift,
  classificationsByVisibleNucleus,
} from "../galaxies/aggregates";

const userStatsValidator = v.object({
  userId: v.id("users"),
  total: v.number(),
  awesome: v.number(),
  visibleNucleus: v.number(),
  failedFitting: v.number(),
  validRedshift: v.number(),
  lsb: v.record(v.string(), v.number()),
  morphology: v.record(v.string(), v.number()),
});

export const getClassificationStats = query({
  args: { userId: v.optional(v.id("users")) },
  returns: v.object({
    global: v.object({
      total: v.number(),
      awesome: v.number(),
      visibleNucleus: v.number(),
      failedFitting: v.number(),
      validRedshift: v.number(),
      lsb: v.record(v.string(), v.number()),
      morphology: v.record(v.string(), v.number()),
    }),
    perUser: v.union(v.null(), userStatsValidator),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewLiveOverviewStatistics", {
      notAuthorizedMessage: "Not authorized",
    });

    const globalAwesome = await classificationsByAwesomeFlag.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalVisible = await classificationsByVisibleNucleus.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalFailed = await classificationsByFailedFitting.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });
    const globalValidRedshift = await classificationsByValidRedshift.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    });

    const lsbValues = [-1, 0, 1];
    const morphologyValues = [-1, 0, 1, 2];

    const lsbCounts: Record<string, number> = {};
    for (const val of lsbValues) {
      lsbCounts[String(val)] = await classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const morphologyCounts: Record<string, number> = {};
    for (const val of morphologyValues) {
      morphologyCounts[String(val)] = await classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const totalClassifications = await classificationsByCreated.count(ctx);

    let perUser: null | {
      userId: Id<"users">;
      total: number;
      awesome: number;
      visibleNucleus: number;
      failedFitting: number;
      validRedshift: number;
      lsb: Record<string, number>;
      morphology: Record<string, number>;
    } = null;

    if (args.userId) {
      const userId = args.userId;

      const userLsb: Record<string, number> = { "-1": 0, "0": 0, "1": 0 };
      const userMorph: Record<string, number> = { "-1": 0, "0": 0, "1": 0, "2": 0 };

      let awesome = 0;
      let visible = 0;
      let failed = 0;
      let validRedshift = 0;
      let userTotal = 0;

      const userQuery = ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId));

      for await (const c of userQuery) {
        userTotal += 1;
        if (c.awesome_flag) awesome += 1;
        if (c.visible_nucleus) visible += 1;
        if (c.failed_fitting) failed += 1;
        if (c.valid_redshift) validRedshift += 1;
        const lsbKey = String(c.lsb_class);
        if (userLsb[lsbKey] !== undefined) {
          userLsb[lsbKey] += 1;
        }
        const morphKey = String(c.morphology);
        if (userMorph[morphKey] !== undefined) {
          userMorph[morphKey] += 1;
        }
      }

      perUser = {
        userId,
        total: userTotal,
        awesome,
        visibleNucleus: visible,
        failedFitting: failed,
        validRedshift,
        lsb: userLsb,
        morphology: userMorph,
      };
    }

    return {
      global: {
        total: totalClassifications,
        awesome: globalAwesome,
        visibleNucleus: globalVisible,
        failedFitting: globalFailed,
        validRedshift: globalValidRedshift,
        lsb: lsbCounts,
        morphology: morphologyCounts,
      },
      perUser,
      timestamp: Date.now(),
    };
  },
});
