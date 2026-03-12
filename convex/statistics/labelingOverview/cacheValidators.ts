import { v } from "convex/values";

export const MAX_TARGET_CLASSIFICATIONS = 25;
export const OVERVIEW_BUCKET_COUNT = MAX_TARGET_CLASSIFICATIONS + 1;
export const OVERVIEW_SHARED_SNAPSHOT_KEY = "overview";
export const OVERVIEW_GLOBAL_SCOPE_KEY = "__all__";

export const paperCountValidator = v.object({
  total: v.number(),
  blacklisted: v.number(),
  adjusted: v.number(),
});

export const totalsValidator = v.object({
  galaxies: v.number(),
  classifiedGalaxies: v.number(),
  unclassifiedGalaxies: v.number(),
  totalClassifications: v.number(),
  progress: v.number(),
  avgClassificationsPerGalaxy: v.number(),
});

export const paperFilterValidator = v.object({
  paper: v.string(),
  galaxies: v.number(),
  blacklisted: v.number(),
  adjusted: v.number(),
});

export const recencyStatsValidator = v.object({
  classificationsLast7d: v.number(),
  classificationsLast24h: v.number(),
  activeClassifiers: v.number(),
  activePast7d: v.number(),
  dailyCounts: v.array(v.object({
    start: v.number(),
    end: v.number(),
    count: v.number(),
  })),
});

export const topClassifierValidator = v.object({
  userId: v.string(),
  profileId: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  classifications: v.number(),
  lastActiveAt: v.optional(v.number()),
});

export const classificationStatsValidator = v.object({
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
});

export const overviewCatalogValidator = v.object({
  availablePapers: v.array(v.string()),
  paperCounts: v.record(v.string(), paperCountValidator),
});

export const overviewSharedSnapshotValidator = v.object({
  catalog: v.optional(overviewCatalogValidator),
  catalogUpdatedAt: v.optional(v.number()),
  recency: v.optional(recencyStatsValidator),
  recencyUpdatedAt: v.optional(v.number()),
  topClassifiers: v.optional(v.array(topClassifierValidator)),
  topClassifiersUpdatedAt: v.optional(v.number()),
  classificationStats: v.optional(classificationStatsValidator),
  classificationStatsUpdatedAt: v.optional(v.number()),
  updatedAt: v.number(),
});

export const overviewScopeSnapshotValidator = v.object({
  scopeKey: v.string(),
  paper: v.union(v.string(), v.null()),
  totals: totalsValidator,
  classificationBuckets: v.array(v.number()),
  updatedAt: v.number(),
});

export const cachedOverviewResponseValidator = v.object({
  sharedSnapshot: v.union(overviewSharedSnapshotValidator, v.null()),
  scopeSnapshot: v.union(overviewScopeSnapshotValidator, v.null()),
  paperFilter: v.union(paperFilterValidator, v.null()),
});