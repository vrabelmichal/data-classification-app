import { query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import {
  classificationsByAwesomeFlag,
  classificationsByFailedFitting,
  classificationsByLsbClass,
  classificationsByMorphology,
  classificationsByValidRedshift,
  classificationsByVisibleNucleus,
} from "../../galaxies/aggregates";

export const get = query({
  args: {},
  returns: v.object({
    classificationStats: v.object({
      flags: v.object({
        awesome: v.number(),
        visibleNucleus: v.number(),
        failedFitting: v.number(),
        validRedshift: v.number(),
      }),
      lsbClass: v.object({
        nonLSB: v.number(),
        LSB: v.number(),
      }),
      morphology: v.object({
        featureless: v.number(),
        irregular: v.number(),
        spiral: v.number(),
        elliptical: v.number(),
      }),
    }),
    timestamp: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });

    const [
      awesomeFlagCount,
      visibleNucleusCount,
      failedFittingCount,
      validRedshiftCount,
      lsbClassNonLSB,
      lsbClassLSB,
      morphologyFeatureless,
      morphologyIrregular,
      morphologySpiral,
      morphologyElliptical,
    ] = await Promise.all([
      classificationsByAwesomeFlag.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByVisibleNucleus.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByFailedFitting.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByValidRedshift.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
      }),
      classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: 0, inclusive: true }, upper: { key: 0, inclusive: true } },
      }),
      classificationsByLsbClass.count(ctx, {
        bounds: { lower: { key: 1, inclusive: true }, upper: { key: 1, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: -1, inclusive: true }, upper: { key: -1, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 0, inclusive: true }, upper: { key: 0, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 1, inclusive: true }, upper: { key: 1, inclusive: true } },
      }),
      classificationsByMorphology.count(ctx, {
        bounds: { lower: { key: 2, inclusive: true }, upper: { key: 2, inclusive: true } },
      }),
    ]);

    return {
      classificationStats: {
        flags: {
          awesome: awesomeFlagCount,
          visibleNucleus: visibleNucleusCount,
          failedFitting: failedFittingCount,
          validRedshift: validRedshiftCount,
        },
        lsbClass: {
          nonLSB: lsbClassNonLSB,
          LSB: lsbClassLSB,
        },
        morphology: {
          featureless: morphologyFeatureless,
          irregular: morphologyIrregular,
          spiral: morphologySpiral,
          elliptical: morphologyElliptical,
        },
      },
      timestamp: Date.now(),
    };
  },
});
