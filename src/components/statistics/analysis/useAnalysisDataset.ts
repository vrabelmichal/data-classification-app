import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import {
  downloadAnalysisDatasetArchive,
  importAnalysisDatasetArchive,
} from "./datasetArchive";
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
import type {
  DataLoadState,
  DatasetNotice,
  LoadedDatasetSource,
  PreparedDataset,
} from "./tabTypes";
import { formatLoadedAt, getErrorMessage } from "./tabUtils";

const GALAXY_PAGE_SIZE = 2500;
const CLASSIFICATION_PAGE_SIZE = 2500;
const EMPTY_RECORDS: AnalysisRecord[] = [];

type StoredDatasetInfo = {
  savedAt: number;
  recordCount: number;
};

function getDatasetClassificationRowCount(dataset: PreparedDataset) {
  return (
    dataset.records.reduce(
      (sum, record) => sum + record.aggregate.totalClassifications,
      0
    ) + dataset.orphanedClassificationCount
  );
}

function buildReadyLoadState(
  dataset: PreparedDataset,
  counts?: { galaxiesLoaded: number; classificationRowsLoaded: number }
): DataLoadState {
  return {
    status: "ready",
    phase: "ready",
    galaxiesLoaded: counts?.galaxiesLoaded ?? dataset.records.length,
    classificationRowsLoaded:
      counts?.classificationRowsLoaded ?? getDatasetClassificationRowCount(dataset),
    error: null,
    cancelled: false,
  };
}

export function useAnalysisDataset() {
  const convex = useConvex();
  const [dataset, setDataset] = useState<PreparedDataset | null>(null);
  const [loadedSource, setLoadedSource] = useState<LoadedDatasetSource | null>(null);
  const [storedDatasetInfo, setStoredDatasetInfo] = useState<StoredDatasetInfo | null>(null);
  const [datasetNotice, setDatasetNotice] = useState<DatasetNotice>(null);
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

  const applyReadyDataset = useCallback(
    (
      nextDataset: PreparedDataset,
      source: LoadedDatasetSource,
      counts?: { galaxiesLoaded: number; classificationRowsLoaded: number }
    ) => {
      startTransition(() => {
        setDataset(nextDataset);
        setLoadedSource(source);
        setLoadState(buildReadyLoadState(nextDataset, counts));
      });
    },
    []
  );

  const handleLoadDataset = useCallback(async () => {
    cancelLoadRef.current = false;
    setDatasetNotice(null);
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

      applyReadyDataset(
        {
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
        },
        { kind: "database" },
        {
          galaxiesLoaded,
          classificationRowsLoaded,
        }
      );
    } catch (error) {
      setLoadState((currentState) => ({
        ...currentState,
        status: "error",
        phase: "idle",
        error: getErrorMessage(error),
        cancelled: false,
      }));
    }
  }, [applyReadyDataset, convex]);

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
      setDatasetNotice({
        tone: "success",
        message: "Saved the current analysis dataset to browser storage for fast reloads.",
      });
      return;
    }

    setDatasetNotice({ tone: "error", message: saveResult.error });
  }, [dataset, refreshStoredDatasetInfo]);

  const handleLoadStoredDataset = useCallback(async () => {
    const storedDataset = await getStoredAnalysisDataset();
    if (!storedDataset) {
      refreshStoredDatasetInfo();
      setDatasetNotice({
        tone: "error",
        message: "No saved browser dataset is currently available, or the saved cache could not be read.",
      });
      return;
    }

    applyReadyDataset(storedDataset.dataset, {
      kind: "browserCache",
      savedAt: storedDataset.savedAt,
    });

    setDatasetNotice({
      tone: "success",
      message: "Loaded the analysis dataset from browser storage instead of querying the database again.",
    });
  }, [applyReadyDataset, refreshStoredDatasetInfo]);

  const handleDownloadDatasetArchive = useCallback(() => {
    if (!dataset) {
      return;
    }

    try {
      const downloadResult = downloadAnalysisDatasetArchive(dataset);
      setDatasetNotice({
        tone: "success",
        message: `Downloaded ${downloadResult.fileName}. Upload it from this page in another browser session to keep the analysis fully client-side.`,
      });
    } catch (error) {
      setDatasetNotice({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Failed to create the analysis dataset ZIP export.",
      });
    }
  }, [dataset]);

  const handleImportDatasetArchive = useCallback(
    async (file: File) => {
      setDatasetNotice(null);

      try {
        const importedDataset = await importAnalysisDatasetArchive(file);
        applyReadyDataset(importedDataset.dataset, {
          kind: "file",
          fileName: importedDataset.fileName,
          exportedAt: importedDataset.exportedAt,
        });
        setDatasetNotice({
          tone: "success",
          message: `Imported ${importedDataset.dataset.records.length.toLocaleString()} galaxies from ${importedDataset.fileName}. Use Save to cache if you also want this snapshot available in this browser without uploading it again.`,
        });
      } catch (error) {
        setDatasetNotice({
          tone: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "Failed to import the analysis dataset ZIP file.",
        });
      }
    },
    [applyReadyDataset]
  );

  const handleClearStoredDataset = useCallback(async () => {
    await clearStoredAnalysisDataset();
    refreshStoredDatasetInfo();
    setDatasetNotice({
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
    datasetNotice,
    loadedAtLabel: formatLoadedAt(dataset?.loadedAt ?? null),
    loadedRecords: dataset?.records ?? EMPTY_RECORDS,
    loadedSource,
    handleLoadDataset,
    handleCancelLoad,
    handleSaveDatasetToStorage,
    handleLoadStoredDataset,
    handleDownloadDatasetArchive,
    handleImportDatasetArchive,
    handleClearStoredDataset,
  };
}