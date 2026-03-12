export type Totals = {
  galaxies: number;
  classifiedGalaxies: number;
  unclassifiedGalaxies: number;
  totalClassifications: number;
  progress: number;
  avgClassificationsPerGalaxy: number;
};

export type PaperCount = {
  total: number;
  blacklisted: number;
  adjusted: number;
};

export type PaperFilter = {
  paper: string;
  galaxies: number;
  blacklisted: number;
  adjusted: number;
} | null;

export type TotalsAndPapersPayload = {
  totals: Totals;
  paperCounts: Record<string, PaperCount>;
  availablePapers: string[];
  paperFilter: PaperFilter;
  timestamp: number;
};

export type RecencyPayload = {
  recency: {
    classificationsLast7d: number;
    classificationsLast24h: number;
    activeClassifiers: number;
    activePast7d: number;
    dailyCounts: Array<{ start: number; end: number; count: number }>;
  };
  timestamp: number;
};

export type TopClassifiersPayload = {
  topClassifiers: Array<{
    userId: string;
    profileId: string;
    name?: string | null;
    classifications: number;
    lastActiveAt?: number;
  }>;
  timestamp: number;
};

export type ClassificationStatsPayload = {
  classificationStats: {
    flags: {
      awesome: number;
      visibleNucleus: number;
      failedFitting: number;
      validRedshift: number;
    };
    lsbClass: {
      nonLSB: number;
      LSB: number;
    };
    morphology: {
      featureless: number;
      irregular: number;
      spiral: number;
      elliptical: number;
    };
  };
  timestamp: number;
};

export type TargetProgressMetrics = {
  targetClassifications: number;
  targetClassificationsTotal: number;
  targetCompletionPercent: number;
  galaxiesAtTarget: number;
  galaxiesBelowTarget: number;
  galaxiesWithMultipleClassifications: number;
  repeatClassifications: number;
  remainingClassificationsToTarget: number;
};

export type TargetProgressPayload = {
  targetProgress: TargetProgressMetrics;
  classificationBuckets: number[];
  timestamp: number;
};

export type CachedOverviewSharedSnapshot = {
  catalog?: {
    availablePapers: string[];
    paperCounts: Record<string, PaperCount>;
  };
  catalogUpdatedAt?: number;
  recency?: RecencyPayload["recency"];
  recencyUpdatedAt?: number;
  topClassifiers?: TopClassifiersPayload["topClassifiers"];
  topClassifiersUpdatedAt?: number;
  classificationStats?: ClassificationStatsPayload["classificationStats"];
  classificationStatsUpdatedAt?: number;
  updatedAt: number;
};

export type CachedOverviewScopeSnapshot = {
  scopeKey: string;
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
  updatedAt: number;
};

export type CachedOverviewPayload = {
  sharedSnapshot: CachedOverviewSharedSnapshot | null;
  scopeSnapshot: CachedOverviewScopeSnapshot | null;
  paperFilter: PaperFilter;
};
