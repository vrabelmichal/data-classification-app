import type { PreparedDataset } from "./tabTypes";

const ANALYSIS_DATASET_STORAGE_KEY = "statistics.dataAnalysis.dataset.v1";
const ANALYSIS_DATASET_STORAGE_VERSION = 1;

type StoredAnalysisDataset = {
  version: number;
  savedAt: number;
  dataset: PreparedDataset;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isPreparedDataset(value: unknown): value is PreparedDataset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PreparedDataset>;
  return (
    Array.isArray(candidate.records) &&
    typeof candidate.loadedAt === "number" &&
    typeof candidate.classifiedGalaxyCount === "number" &&
    typeof candidate.maxClassificationsPerGalaxy === "number" &&
    typeof candidate.totalAwesomeVotes === "number" &&
    typeof candidate.totalVisibleNucleusVotes === "number" &&
    typeof candidate.totalFailedFittingVotes === "number" &&
    typeof candidate.totalCommentedClassifications === "number" &&
    (candidate.averageCommentLength === null ||
      candidate.averageCommentLength === undefined ||
      typeof candidate.averageCommentLength === "number") &&
    typeof candidate.maxCommentLength === "number" &&
    typeof candidate.orphanedGalaxyCount === "number" &&
    typeof candidate.orphanedClassificationCount === "number"
  );
}

export function getStoredAnalysisDataset() {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ANALYSIS_DATASET_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredAnalysisDataset>;
    if (
      parsedValue.version !== ANALYSIS_DATASET_STORAGE_VERSION ||
      typeof parsedValue.savedAt !== "number" ||
      !isPreparedDataset(parsedValue.dataset)
    ) {
      return null;
    }

    return {
      savedAt: parsedValue.savedAt,
      dataset: parsedValue.dataset,
    };
  } catch {
    return null;
  }
}

export function saveAnalysisDatasetToStorage(dataset: PreparedDataset) {
  if (!canUseLocalStorage()) {
    return { ok: false as const, error: "Local storage is not available in this browser." };
  }

  try {
    const payload: StoredAnalysisDataset = {
      version: ANALYSIS_DATASET_STORAGE_VERSION,
      savedAt: Date.now(),
      dataset,
    };

    window.localStorage.setItem(
      ANALYSIS_DATASET_STORAGE_KEY,
      JSON.stringify(payload)
    );

    return { ok: true as const, savedAt: payload.savedAt };
  } catch {
    return {
      ok: false as const,
      error:
        "Failed to save the analysis dataset to local storage. The dataset may be too large for this browser quota.",
    };
  }
}

export function clearStoredAnalysisDataset() {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(ANALYSIS_DATASET_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getAnalysisDatasetStorageKey() {
  return ANALYSIS_DATASET_STORAGE_KEY;
}