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
