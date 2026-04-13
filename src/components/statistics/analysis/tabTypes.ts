import type { AnalysisRecord } from "./helpers";

export type PublicSystemSettings = {
  galaxyBrowserImageQuality?: "high" | "low";
};

export type DatasetSummary = {
  totalGalaxies: number;
  totalClassifications: number;
  catalogNucleusGalaxies: number;
  availablePapers: string[];
};

export type PreparedDataset = {
  records: AnalysisRecord[];
  loadedAt: number;
  classifiedGalaxyCount: number;
  totalAwesomeVotes: number;
  totalVisibleNucleusVotes: number;
  totalFailedFittingVotes: number;
  orphanedGalaxyCount: number;
  orphanedClassificationCount: number;
};

export type DataLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  phase: "idle" | "galaxies" | "classifications" | "combining" | "ready";
  galaxiesLoaded: number;
  classificationRowsLoaded: number;
  error: string | null;
  cancelled: boolean;
};

export type ZeroBucketState = {
  awesomeVotes: boolean;
  visibleNucleusVotes: boolean;
  failedFittingVotes: boolean;
};

export type PinnedNavigatorStyle = {
  left: number;
  top: number;
  width: number;
};