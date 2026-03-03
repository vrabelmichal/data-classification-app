import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import {
  classificationsByAwesomeFlag,
  classificationsByCreated,
  classificationsByFailedFitting,
  classificationsByLsbClass,
  classificationsByMorphology,
  classificationsByValidRedshift,
  classificationsByVisibleNucleus,
} from "../galaxies/aggregates";

export const getClassificationStats = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

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

    const lsbCounts: Record<number, number> = {};
    for (const val of lsbValues) {
      lsbCounts[val] = await classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const morphologyCounts: Record<number, number> = {};
    for (const val of morphologyValues) {
      morphologyCounts[val] = await classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: val, inclusive: true }, upper: { key: val, inclusive: true } },
      });
    }

    const totalClassifications = await classificationsByCreated.count(ctx);

    let perUser: null | {
      userId: typeof args.userId;
      total: number;
      awesome: number;
      visibleNucleus: number;
      failedFitting: number;
      validRedshift: number;
      lsb: Record<number, number>;
      morphology: Record<number, number>;
    } = null;

    if (args.userId) {
      const userId = args.userId;

      const userClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const userLsb: Record<number, number> = { [-1]: 0, 0: 0, 1: 0 };
      const userMorph: Record<number, number> = { [-1]: 0, 0: 0, 1: 0, 2: 0 };

      let awesome = 0;
      let visible = 0;
      let failed = 0;
      let validRedshift = 0;

      for (const c of userClassifications) {
        if (c.awesome_flag) awesome += 1;
        if (c.visible_nucleus) visible += 1;
        if (c.failed_fitting) failed += 1;
        if (c.valid_redshift) validRedshift += 1;
        if (userLsb[c.lsb_class] !== undefined) {
          userLsb[c.lsb_class] += 1;
        }
        if (userMorph[c.morphology] !== undefined) {
          userMorph[c.morphology] += 1;
        }
      }

      perUser = {
        userId,
        total: userClassifications.length,
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
