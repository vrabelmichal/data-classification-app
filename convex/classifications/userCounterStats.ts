import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

export type UserClassificationCounterSnapshot = {
  classificationsCount: number;
  awesomeCount: number;
  visibleNucleusCount: number;
  failedFittingCount: number;
  validRedshiftCount: number;
  lsbNeg1Count: number;
  lsb0Count: number;
  lsb1Count: number;
  morphNeg1Count: number;
  morph0Count: number;
  morph1Count: number;
  morph2Count: number;
};

export const USER_CLASSIFICATION_COUNTER_KEYS = [
  "classificationsCount",
  "awesomeCount",
  "visibleNucleusCount",
  "failedFittingCount",
  "validRedshiftCount",
  "lsbNeg1Count",
  "lsb0Count",
  "lsb1Count",
  "morphNeg1Count",
  "morph0Count",
  "morph1Count",
  "morph2Count",
] as const;

export const userClassificationCounterKeyValidator = v.union(
  v.literal("classificationsCount"),
  v.literal("awesomeCount"),
  v.literal("visibleNucleusCount"),
  v.literal("failedFittingCount"),
  v.literal("validRedshiftCount"),
  v.literal("lsbNeg1Count"),
  v.literal("lsb0Count"),
  v.literal("lsb1Count"),
  v.literal("morphNeg1Count"),
  v.literal("morph0Count"),
  v.literal("morph1Count"),
  v.literal("morph2Count")
);

export const userClassificationCounterSnapshotValidator = v.object({
  classificationsCount: v.number(),
  awesomeCount: v.number(),
  visibleNucleusCount: v.number(),
  failedFittingCount: v.number(),
  validRedshiftCount: v.number(),
  lsbNeg1Count: v.number(),
  lsb0Count: v.number(),
  lsb1Count: v.number(),
  morphNeg1Count: v.number(),
  morph0Count: v.number(),
  morph1Count: v.number(),
  morph2Count: v.number(),
});

export type UserClassificationCounterKey = (typeof USER_CLASSIFICATION_COUNTER_KEYS)[number];

export type UserClassificationCounterAudit = {
  counters: UserClassificationCounterSnapshot;
  invalidLsbCount: number;
  invalidMorphologyCount: number;
};

export function createEmptyUserClassificationCounterSnapshot(): UserClassificationCounterSnapshot {
  return {
    classificationsCount: 0,
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
}

export function getUserClassificationCounterSnapshotFromProfile(
  profile: Partial<Doc<"userProfiles">> | null | undefined
): UserClassificationCounterSnapshot {
  return {
    classificationsCount: profile?.classificationsCount ?? 0,
    awesomeCount: profile?.awesomeCount ?? 0,
    visibleNucleusCount: profile?.visibleNucleusCount ?? 0,
    failedFittingCount: profile?.failedFittingCount ?? 0,
    validRedshiftCount: profile?.validRedshiftCount ?? 0,
    lsbNeg1Count: profile?.lsbNeg1Count ?? 0,
    lsb0Count: profile?.lsb0Count ?? 0,
    lsb1Count: profile?.lsb1Count ?? 0,
    morphNeg1Count: profile?.morphNeg1Count ?? 0,
    morph0Count: profile?.morph0Count ?? 0,
    morph1Count: profile?.morph1Count ?? 0,
    morph2Count: profile?.morph2Count ?? 0,
  };
}

export function auditUserClassificationStats(
  classifications: Doc<"classifications">[]
): UserClassificationCounterAudit {
  const counters = createEmptyUserClassificationCounterSnapshot();
  counters.classificationsCount = classifications.length;

  let invalidLsbCount = 0;
  let invalidMorphologyCount = 0;

  for (const classification of classifications) {
    if (classification.awesome_flag) counters.awesomeCount += 1;
    if (classification.visible_nucleus) counters.visibleNucleusCount += 1;
    if (classification.failed_fitting) counters.failedFittingCount += 1;
    if (classification.valid_redshift) counters.validRedshiftCount += 1;

    switch (classification.lsb_class) {
      case -1:
        counters.lsbNeg1Count += 1;
        break;
      case 0:
        counters.lsb0Count += 1;
        break;
      case 1:
        counters.lsb1Count += 1;
        break;
      default:
        invalidLsbCount += 1;
        break;
    }

    switch (classification.morphology) {
      case -1:
        counters.morphNeg1Count += 1;
        break;
      case 0:
        counters.morph0Count += 1;
        break;
      case 1:
        counters.morph1Count += 1;
        break;
      case 2:
        counters.morph2Count += 1;
        break;
      default:
        invalidMorphologyCount += 1;
        break;
    }
  }

  return {
    counters,
    invalidLsbCount,
    invalidMorphologyCount,
  };
}

export function buildUserClassificationCounterPatch(
  profile: Partial<Doc<"userProfiles">>,
  nextCounters: UserClassificationCounterSnapshot
): Partial<Doc<"userProfiles">> {
  const currentCounters = getUserClassificationCounterSnapshotFromProfile(profile);
  const patch: Partial<Doc<"userProfiles">> = {};

  for (const key of USER_CLASSIFICATION_COUNTER_KEYS) {
    if (currentCounters[key] !== nextCounters[key]) {
      (patch as Record<UserClassificationCounterKey, number>)[key] = nextCounters[key];
    }
  }

  return patch;
}

export function getUserClassificationCounterDiffKeys(
  cachedCounters: UserClassificationCounterSnapshot,
  actualCounters: UserClassificationCounterSnapshot
): UserClassificationCounterKey[] {
  return USER_CLASSIFICATION_COUNTER_KEYS.filter((key) => cachedCounters[key] !== actualCounters[key]);
}

export function getUserClassificationLsbTotal(counters: UserClassificationCounterSnapshot): number {
  return counters.lsbNeg1Count + counters.lsb0Count + counters.lsb1Count;
}

export function getUserClassificationMorphologyTotal(counters: UserClassificationCounterSnapshot): number {
  return counters.morphNeg1Count + counters.morph0Count + counters.morph1Count + counters.morph2Count;
}