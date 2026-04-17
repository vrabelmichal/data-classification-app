import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import {
  clearStoredAnalysisDataset,
  getStoredAnalysisDataset,
  getStoredAnalysisDatasetInfo,
  saveAnalysisDatasetToStorage,
} from "./datasetStorage";
import {
  accumulateClassificationVote,
  buildAnalysisRecord,
  createEmptyAggregate,
  type AnalysisAggregate,
  type AnalysisClassificationVote,
  type AnalysisGalaxy,
  type AnalysisRecord,
} from "./helpers";
import type { DataLoadState, PreparedDataset } from "./tabTypes";
import { formatLoadedAt, getErrorMessage } from "./tabUtils";

const GALAXY_PAGE_SIZE = 2500;
const CLASSIFICATION_PAGE_SIZE = 2500;
const EMPTY_RECORDS: AnalysisRecord[] = [];

type StoredDatasetInfo = {
  savedAt: number;
  recordCount: number;
};

type StorageNotice = {
  tone: "success" | "error";
  message: string;
} | null;

export function useAnalysisDataset() {
  const convex = useConvex();
  const [dataset, setDataset] = useState<PreparedDataset | null>(null);
  const [storedDatasetInfo, setStoredDatasetInfo] = useState<StoredDatasetInfo | null>(null);
  const [storageNotice, setStorageNotice] = useState<StorageNotice>(null);
  const [loadState, setLoadState] = useState<DataLoadState>({
    status: "idle",
    phase: "idle",
    galaxiesLoaded: 0,
    classificationRowsLoaded: 0,
    error: null,
    cancelled: false,
  });
  const cancelLoadRef = useRef(false);

  const refreshStoredDatasetInfo = useCallback(() => {
    const storedDatasetInfo = getStoredAnalysisDatasetInfo();
    if (!storedDatasetInfo) {
      setStoredDatasetInfo(null);
      return;
    }

    setStoredDatasetInfo({
      savedAt: storedDatasetInfo.savedAt,
      recordCount: storedDatasetInfo.recordCount,
    });
  }, []);

  useEffect(() => {
    refreshStoredDatasetInfo();
  }, [refreshStoredDatasetInfo]);

  const handleLoadDataset = useCallback(async () => {
    cancelLoadRef.current = false;
    setLoadState({
      status: "loading",
      phase: "galaxies",
      galaxiesLoaded: 0,
      classificationRowsLoaded: 0,
      error: null,
      cancelled: false,
    });

    try {
      const galaxyMap = new Map<string, AnalysisGalaxy>();
      let galaxyCursor: string | undefined;
      let galaxiesLoaded = 0;

      while (true) {
        if (cancelLoadRef.current) {
          setLoadState((currentState) => ({
            ...currentState,
            status: "idle",
            phase: "idle",
            cancelled: true,
          }));
          return;
        }

        const page = await convex.query(
          api.statistics.classificationAnalysis.getGalaxyPage,
          {
            cursor: galaxyCursor,
            limit: GALAXY_PAGE_SIZE,
          }
        );

        for (const galaxy of page.page) {
          galaxyMap.set(galaxy.id, galaxy as AnalysisGalaxy);
        }

        galaxiesLoaded += page.page.length;
        setLoadState((currentState) => ({
          ...currentState,
          phase: "galaxies",
          galaxiesLoaded,
        }));

        if (page.isDone || !page.continueCursor) {
          break;
        }

        galaxyCursor = page.continueCursor;
      }

      const aggregateMap = new Map<string, AnalysisAggregate>();
      const votesByGalaxy = new Map<string, AnalysisClassificationVote[]>();
      let classificationCursor: string | undefined;
      let classificationRowsLoaded = 0;

      setLoadState((currentState) => ({
        ...currentState,
        phase: "classifications",
      }));

      while (true) {
        if (cancelLoadRef.current) {
          setLoadState((currentState) => ({
            ...currentState,
            status: "idle",
            phase: "idle",
            cancelled: true,
          }));
          return;
        }

        const page = await convex.query(
          api.statistics.classificationAnalysis.getClassificationPage,
          {
            cursor: classificationCursor,
            limit: CLASSIFICATION_PAGE_SIZE,
          }
        );

        for (const rawVote of page.page) {
          const vote = rawVote as AnalysisClassificationVote;
          const aggregate =
            aggregateMap.get(vote.galaxyExternalId) ?? createEmptyAggregate();
          accumulateClassificationVote(aggregate, vote);
          aggregateMap.set(vote.galaxyExternalId, aggregate);

          const voteList = votesByGalaxy.get(vote.galaxyExternalId) ?? [];
          voteList.push(vote);
          votesByGalaxy.set(vote.galaxyExternalId, voteList);
        }

        classificationRowsLoaded += page.page.length;
        setLoadState((currentState) => ({
          ...currentState,
          phase: "classifications",
          classificationRowsLoaded,
        }));

        if (page.isDone || !page.continueCursor) {
          break;
        }

        classificationCursor = page.continueCursor;
      }

      setLoadState((currentState) => ({
        ...currentState,
        phase: "combining",
      }));

      const sortedGalaxies = Array.from(galaxyMap.values()).sort((left, right) => {
        const leftNumericId = left.numericId ?? Number.MAX_SAFE_INTEGER;
        const rightNumericId = right.numericId ?? Number.MAX_SAFE_INTEGER;
        if (leftNumericId !== rightNumericId) {
          return leftNumericId - rightNumericId;
        }
        return left.id.localeCompare(right.id);
      });

      const records: AnalysisRecord[] = [];
      let classifiedGalaxyCount = 0;
      let maxClassificationsPerGalaxy = 0;
      let totalAwesomeVotes = 0;
      let totalVisibleNucleusVotes = 0;
      let totalFailedFittingVotes = 0;
      let totalCommentedClassifications = 0;
      let totalCommentCharacters = 0;
      let maxCommentLength = 0;

      for (const galaxy of sortedGalaxies) {
        const aggregate = aggregateMap.get(galaxy.id) ?? createEmptyAggregate();
        if (aggregate.totalClassifications > 0) {
          classifiedGalaxyCount += 1;
        }
        maxClassificationsPerGalaxy = Math.max(
          maxClassificationsPerGalaxy,
          aggregate.totalClassifications
        );
        totalAwesomeVotes += aggregate.awesomeVotes;
        totalVisibleNucleusVotes += aggregate.visibleNucleusVotes;
        totalFailedFittingVotes += aggregate.failedFittingVotes;
        totalCommentedClassifications += aggregate.commentedClassifications;
        totalCommentCharacters += aggregate.totalCommentLength;
        maxCommentLength = Math.max(maxCommentLength, aggregate.maxCommentLength);
        records.push(
          buildAnalysisRecord(galaxy, aggregate, votesByGalaxy.get(galaxy.id) ?? [])
        );
      }

      let orphanedGalaxyCount = 0;
      let orphanedClassificationCount = 0;
      for (const [galaxyId, aggregate] of aggregateMap.entries()) {
        if (!galaxyMap.has(galaxyId)) {
          orphanedGalaxyCount += 1;
          orphanedClassificationCount += aggregate.totalClassifications;
        }
      }

      startTransition(() => {
        setDataset({
          records,
          loadedAt: Date.now(),
          classifiedGalaxyCount,
          maxClassificationsPerGalaxy,
          totalAwesomeVotes,
          totalVisibleNucleusVotes,
          totalFailedFittingVotes,
          totalCommentedClassifications,
          averageCommentLength:
            totalCommentedClassifications > 0
              ? totalCommentCharacters / totalCommentedClassifications
              : null,
          maxCommentLength,
          orphanedGalaxyCount,
          orphanedClassificationCount,
        });
        setLoadState({
          status: "ready",
          phase: "ready",
          galaxiesLoaded,
          classificationRowsLoaded,
          error: null,
          cancelled: false,
        });
      });
      setStorageNotice(null);
    } catch (error) {
      setLoadState((currentState) => ({
        ...currentState,
        status: "error",
        phase: "idle",
        error: getErrorMessage(error),
        cancelled: false,
      }));
    }
  }, [convex]);

  const handleCancelLoad = useCallback(() => {
    cancelLoadRef.current = true;
  }, []);

  const handleSaveDatasetToStorage = useCallback(async () => {
    if (!dataset) {
      return;
    }

    const saveResult = await saveAnalysisDatasetToStorage(dataset);
    if (saveResult.ok) {
      refreshStoredDatasetInfo();
      setStorageNotice({
        tone: "success",
        message: "Saved the current analysis dataset to browser storage for fast reloads.",
      });
      return;
    }

    setStorageNotice({ tone: "error", message: saveResult.error });
  }, [dataset, refreshStoredDatasetInfo]);

  const handleLoadStoredDataset = useCallback(async () => {
    const storedDataset = await getStoredAnalysisDataset();
    if (!storedDataset) {
      refreshStoredDatasetInfo();
      setStorageNotice({
        tone: "error",
        message: "No saved browser dataset is currently available, or the saved cache could not be read.",
      });
      return;
    }

    startTransition(() => {
      setDataset(storedDataset.dataset);
      setLoadState({
        status: "ready",
        phase: "ready",
        galaxiesLoaded: storedDataset.dataset.records.length,
        classificationRowsLoaded: storedDataset.dataset.records.reduce(
          (sum, record) => sum + record.aggregate.totalClassifications,
          0
        ),
        error: null,
        cancelled: false,
      });
    });

    setStorageNotice({
      tone: "success",
      message: "Loaded the analysis dataset from browser storage instead of querying the database again.",
    });
  }, [refreshStoredDatasetInfo]);

  const handleClearStoredDataset = useCallback(async () => {
    await clearStoredAnalysisDataset();
    refreshStoredDatasetInfo();
    setStorageNotice({
      tone: "success",
      message: "Removed the saved browser cache of the analysis dataset.",
    });
  }, [refreshStoredDatasetInfo]);

  return {
    dataset,
    loadState,
    hasDataset: dataset !== null,
    hasStoredDataset: storedDatasetInfo !== null,
    storedDatasetRecordCount: storedDatasetInfo?.recordCount ?? 0,
    storedDatasetSavedAtLabel: formatLoadedAt(storedDatasetInfo?.savedAt ?? null),
    storageNotice,
    loadedAtLabel: formatLoadedAt(dataset?.loadedAt ?? null),
    loadedRecords: dataset?.records ?? EMPTY_RECORDS,
    handleLoadDataset,
    handleCancelLoad,
    handleSaveDatasetToStorage,
    handleLoadStoredDataset,
    handleClearStoredDataset,
  };
}