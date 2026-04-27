import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  createCsvHeader,
  createCsvRow,
  downloadTextFile,
  formatDateForFilename,
  sanitizeFilenameSegment,
  type CsvColumn,
} from "../../lib/csv";
import { ClassificationDetailsModal } from "./analysis/ClassificationDetailsModal";
import { DataAnalysisNavigator } from "./analysis/DataAnalysisNavigator";
import {
  AnalysisClassificationDistributionToolbar,
  AnalysisDistributionToolbar,
  AnalysisDatasetStats,
  AnalysisGlobalHistogramSection,
  AnalysisLoadSection,
  AnalysisQueryToolbar,
} from "./analysis/DataAnalysisOverviewSections";
import {
  DataAnalysisQueryCard,
  duplicateAnalysisQuery,
} from "./analysis/DataAnalysisQueryCard";
import {
  DataAnalysisClassificationDistributionCard,
  duplicateAnalysisClassificationDistributionComparison,
} from "./analysis/DataAnalysisClassificationDistributionCard";
import {
  DataAnalysisDistributionCard,
  duplicateAnalysisDistributionComparison,
} from "./analysis/DataAnalysisDistributionCard";
import { AgreementExplanation } from "./analysis/AgreementExplanation";
import {
  buildGlobalSummaryHistograms,
  createBlankAnalysisClassificationDistributionComparison,
  createBlankAnalysisDistributionComparison,
  createBlankAnalysisQuery,
  evaluateAnalysisClassificationDistributionComparison,
  evaluateAnalysisDistributionComparison,
  evaluateAnalysisQuery,
  filterZeroCountHistogram,
  formatPaperLabel,
  type AnalysisClassificationDistributionComparisonConfig,
  type AnalysisClassificationDistributionComparisonResult,
  type AnalysisDistributionComparisonConfig,
  type AnalysisDistributionComparisonResult,
  type AnalysisQueryConfig,
  type AnalysisQueryResult,
  type AnalysisRecord,
  type AnalysisUserDirectoryEntry,
} from "./analysis/helpers";
import {
  buildDefaultAnalysisFrameworkState,
  cloneAnalysisFrameworkState,
  createCollapsedItemMap,
  getAnalysisFrameworkSignature,
  MY_ANALYSIS_FRAMEWORK_KEY,
  MY_ANALYSIS_FRAMEWORK_NAME,
  type AnalysisFrameworkState,
  type SavedAnalysisFrameworkConfig,
} from "./analysis/analysisFrameworkState";
import {
  buildAnalysisHtmlReport,
  buildAnalysisStatsExport,
} from "./analysis/reportExport";
import type {
  DatasetSummary,
  PublicSystemSettings,
  ZeroBucketState,
} from "./analysis/tabTypes";
import { useAnalysisDataset } from "./analysis/useAnalysisDataset";
import { usePinnedQueryNavigator } from "./analysis/usePinnedQueryNavigator";
import { formatLoadedAt, formatPercent } from "./analysis/tabUtils";

const EMPTY_RECORDS: AnalysisRecord[] = [];

function formatNullableNumber(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  return value.toFixed(digits);
}

const ANALYSIS_MATCH_EXPORT_COLUMNS: CsvColumn<AnalysisRecord>[] = [
  { header: "externalId", getValue: (record) => record.galaxy.id },
  {
    header: "numericId",
    getValue: (record) => record.galaxy.numericId ?? "",
  },
  {
    header: "paper",
    getValue: (record) => formatPaperLabel(record.galaxy.paper),
  },
  {
    header: "catalogNucleus",
    getValue: (record) => (record.galaxy.nucleus ? "yes" : "no"),
  },
  {
    header: "galaxyCreationTime",
    getValue: (record) => new Date(record.galaxy._creationTime).toISOString(),
  },
  {
    header: "totalClassifications",
    getValue: (record) => record.aggregate.totalClassifications,
  },
  {
    header: "commentedClassifications",
    getValue: (record) => record.aggregate.commentedClassifications,
  },
  {
    header: "averageCommentLength",
    getValue: (record) =>
      record.averageCommentLength === null
        ? ""
        : formatNullableNumber(record.averageCommentLength, 2),
  },
  {
    header: "maxCommentLength",
    getValue: (record) => record.aggregate.maxCommentLength,
  },
  { header: "dominantLsb", getValue: (record) => record.dominantLsbLabel },
  { header: "lsbComparableVotes", getValue: (record) => record.lsb.comparableVotes },
  { header: "lsbVotes", getValue: (record) => record.aggregate.lsbVotes },
  { header: "nonLsbVotes", getValue: (record) => record.aggregate.nonLsbVotes },
  { header: "lsbAgreementCount", getValue: (record) => record.lsb.agreementCount },
  {
    header: "lsbAgreementRate",
    getValue: (record) => formatPercent(record.lsb.agreementRate),
  },
  {
    header: "dominantMorphology",
    getValue: (record) => record.dominantMorphologyLabel,
  },
  {
    header: "morphologyAgreementCount",
    getValue: (record) => record.morphology.agreementCount,
  },
  {
    header: "morphologyAgreementRate",
    getValue: (record) => formatPercent(record.morphology.agreementRate),
  },
  {
    header: "featurelessVotes",
    getValue: (record) => record.aggregate.featurelessVotes,
  },
  {
    header: "irregularVotes",
    getValue: (record) => record.aggregate.irregularVotes,
  },
  { header: "ltgVotes", getValue: (record) => record.aggregate.ltgVotes },
  { header: "etgVotes", getValue: (record) => record.aggregate.etgVotes },
  {
    header: "awesomeVotes",
    getValue: (record) => record.aggregate.awesomeVotes,
  },
  {
    header: "validRedshiftVotes",
    getValue: (record) => record.aggregate.validRedshiftVotes,
  },
  {
    header: "visibleNucleusState",
    getValue: (record) => record.visibleNucleus.label,
  },
  {
    header: "visibleNucleusVotes",
    getValue: (record) => record.aggregate.visibleNucleusVotes,
  },
  {
    header: "visibleNucleusComparableVotes",
    getValue: (record) => record.visibleNucleus.comparableVotes,
  },
  {
    header: "visibleNucleusAgreementCount",
    getValue: (record) => record.visibleNucleus.agreementCount,
  },
  {
    header: "visibleNucleusAgreementRate",
    getValue: (record) => formatPercent(record.visibleNucleus.agreementRate),
  },
  {
    header: "failedFittingState",
    getValue: (record) => record.failedFitting.label,
  },
  {
    header: "failedFittingVotes",
    getValue: (record) => record.aggregate.failedFittingVotes,
  },
  {
    header: "failedFittingComparableVotes",
    getValue: (record) => record.failedFitting.comparableVotes,
  },
  {
    header: "failedFittingAgreementCount",
    getValue: (record) => record.failedFitting.agreementCount,
  },
  {
    header: "failedFittingAgreementRate",
    getValue: (record) => formatPercent(record.failedFitting.agreementRate),
  },
  {
    header: "nucleusConfirmationRate",
    getValue: (record) => formatPercent(record.nucleusConfirmationRate),
  },
  { header: "ra", getValue: (record) => formatNullableNumber(record.galaxy.ra, 4) },
  { header: "dec", getValue: (record) => formatNullableNumber(record.galaxy.dec, 4) },
  { header: "reff", getValue: (record) => formatNullableNumber(record.galaxy.reff, 2) },
  { header: "q", getValue: (record) => formatNullableNumber(record.galaxy.q, 3) },
  { header: "mag", getValue: (record) => formatNullableNumber(record.galaxy.mag, 2) },
  {
    header: "meanMue",
    getValue: (record) => formatNullableNumber(record.galaxy.mean_mue, 2),
  },
];

export function DataAnalysisTab({ systemSettings }: { systemSettings: PublicSystemSettings }) {
  usePageTitle("Statistics – Data Analysis");

  const summary = useQuery(
    api.statistics.classificationAnalysis.getDatasetSummary
  ) as DatasetSummary | undefined;
  const saveAnalysisFrameworkConfig = useMutation(
    api.statistics.classificationAnalysis.saveAnalysisFrameworkConfig
  );
  const userPrefs = useQuery(api.users.getUserPreferences);
  const userDirectory = useQuery(
    api.statistics.classificationAnalysis.getUserDirectory
  ) as AnalysisUserDirectoryEntry[] | undefined;
  const savedAnalysisFramework = useQuery(
    api.statistics.classificationAnalysis.getAnalysisFrameworkConfig,
    { configKey: MY_ANALYSIS_FRAMEWORK_KEY }
  ) as SavedAnalysisFrameworkConfig | null | undefined;
  const defaultAnalysisFramework = useMemo(
    () => buildDefaultAnalysisFrameworkState(),
    []
  );
  const initialAnalysisFramework = useMemo(
    () => cloneAnalysisFrameworkState(defaultAnalysisFramework),
    [defaultAnalysisFramework]
  );
  const [queries, setQueries] = useState<AnalysisQueryConfig[]>(
    initialAnalysisFramework.queries
  );
  const [comparisons, setComparisons] = useState<AnalysisDistributionComparisonConfig[]>(
    initialAnalysisFramework.comparisons
  );
  const [classificationComparisons, setClassificationComparisons] = useState<
    AnalysisClassificationDistributionComparisonConfig[]
  >(initialAnalysisFramework.classificationComparisons);
  const [collapsedQueries, setCollapsedQueries] = useState<Record<string, boolean>>(
    () => createCollapsedItemMap(initialAnalysisFramework.queries)
  );
  const [collapsedComparisons, setCollapsedComparisons] = useState<
    Record<string, boolean>
  >(() => createCollapsedItemMap(initialAnalysisFramework.comparisons));
  const [collapsedClassificationComparisons, setCollapsedClassificationComparisons] =
    useState<Record<string, boolean>>(() =>
      createCollapsedItemMap(initialAnalysisFramework.classificationComparisons)
    );
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [hideZeroBuckets, setHideZeroBuckets] = useState<ZeroBucketState>({
    awesomeVotes: true,
    visibleNucleusAgreementCount: true,
    failedFittingVotes: true,
  });
  const [isSavingAnalysisFramework, setIsSavingAnalysisFramework] = useState(false);

  const {
    dataset,
    loadState,
    hasDataset,
    hasStoredDataset,
    storedDatasetRecordCount,
    storedDatasetSavedAtLabel,
    datasetNotice,
    loadedAtLabel,
    loadedRecords,
    loadedSource,
    handleLoadDataset,
    handleCancelLoad,
    handleSaveDatasetToStorage,
    handleLoadStoredDataset,
    handleDownloadDatasetArchive,
    handleImportDatasetArchive,
    handleClearStoredDataset,
  } = useAnalysisDataset();

  const {
    activeQueryId,
    isNavigatorPinned,
    isSectionVisible,
    navigatorHeight,
    navigatorAnchorRef,
    navigatorRef,
    queriesSectionEndRef,
    pinnedNavigatorStyle,
  } = usePinnedQueryNavigator(queries, hasDataset);

  const deferredQueries = useDeferredValue(queries);
  const deferredRecords = useDeferredValue(dataset?.records ?? EMPTY_RECORDS);
  const imageQuality =
    (userPrefs?.imageQuality as "high" | "low" | undefined) ??
    systemSettings.galaxyBrowserImageQuality ??
    "low";

  const userDisplayNames = useMemo(() => {
    const entries = userDirectory ?? [];
    return entries.reduce<Record<string, string>>((accumulator, entry) => {
      accumulator[String(entry.userId)] = entry.displayName;
      return accumulator;
    }, {});
  }, [userDirectory]);

  const currentAnalysisFrameworkState = useMemo<AnalysisFrameworkState>(
    () => ({
      queries,
      comparisons,
      classificationComparisons,
    }),
    [classificationComparisons, comparisons, queries]
  );

  const applyAnalysisFrameworkState = useCallback((nextState: AnalysisFrameworkState) => {
    const clonedState = cloneAnalysisFrameworkState(nextState);

    setQueries(clonedState.queries);
    setComparisons(clonedState.comparisons);
    setClassificationComparisons(clonedState.classificationComparisons);
    setCollapsedQueries(createCollapsedItemMap(clonedState.queries));
    setCollapsedComparisons(createCollapsedItemMap(clonedState.comparisons));
    setCollapsedClassificationComparisons(
      createCollapsedItemMap(clonedState.classificationComparisons)
    );
  }, []);

  const currentAnalysisFrameworkSignature = useMemo(
    () => getAnalysisFrameworkSignature(currentAnalysisFrameworkState),
    [currentAnalysisFrameworkState]
  );
  const defaultAnalysisFrameworkSignature = useMemo(
    () => getAnalysisFrameworkSignature(defaultAnalysisFramework),
    [defaultAnalysisFramework]
  );
  const savedAnalysisFrameworkSignature = useMemo(
    () =>
      savedAnalysisFramework
        ? getAnalysisFrameworkSignature(savedAnalysisFramework.state)
        : null,
    [savedAnalysisFramework]
  );
  const hasSavedAnalysisFramework =
    savedAnalysisFramework !== null && savedAnalysisFramework !== undefined;
  const isSavedAnalysisFrameworkLoading = savedAnalysisFramework === undefined;
  const matchesSavedAnalysisFramework =
    savedAnalysisFrameworkSignature !== null &&
    currentAnalysisFrameworkSignature === savedAnalysisFrameworkSignature;
  const matchesDefaultAnalysisFramework =
    currentAnalysisFrameworkSignature === defaultAnalysisFrameworkSignature;

  const analysisSetupStatus = useMemo(() => {
    if (isSavedAnalysisFrameworkLoading) {
      return {
        tone: "neutral" as const,
        message: "Checking the saved server copy for My analysis.",
      };
    }

    if (!hasSavedAnalysisFramework) {
      return {
        tone: matchesDefaultAnalysisFramework ? ("neutral" as const) : ("warning" as const),
        message: matchesDefaultAnalysisFramework
          ? "Using the built-in local defaults. Save to store My analysis on the server."
          : "This setup only exists in the current browser session until you save it.",
      };
    }

    const savedAtLabel = formatLoadedAt(savedAnalysisFramework.updatedAt) ?? "recently";

    if (matchesSavedAnalysisFramework) {
      return {
        tone: "success" as const,
        message: `${savedAnalysisFramework.name} matches the current local setup. Server copy saved ${savedAtLabel}.`,
      };
    }

    if (matchesDefaultAnalysisFramework) {
      return {
        tone: "warning" as const,
        message: `${savedAnalysisFramework.name} is saved on the server from ${savedAtLabel}. The page is currently using local defaults until you load it or save over it.`,
      };
    }

    return {
      tone: "warning" as const,
      message: `${savedAnalysisFramework.name} is saved on the server from ${savedAtLabel}. The current local setup differs and will not overwrite it until you save.`,
    };
  }, [
    hasSavedAnalysisFramework,
    isSavedAnalysisFrameworkLoading,
    matchesDefaultAnalysisFramework,
    matchesSavedAnalysisFramework,
    savedAnalysisFramework,
  ]);

  const handleSaveAnalysisFramework = useCallback(async () => {
    setIsSavingAnalysisFramework(true);

    try {
      await saveAnalysisFrameworkConfig({
        configKey: MY_ANALYSIS_FRAMEWORK_KEY,
        name: MY_ANALYSIS_FRAMEWORK_NAME,
        state: cloneAnalysisFrameworkState(currentAnalysisFrameworkState),
      });
      toast.success("Saved My analysis to the server.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save My analysis."
      );
    } finally {
      setIsSavingAnalysisFramework(false);
    }
  }, [currentAnalysisFrameworkState, saveAnalysisFrameworkConfig]);

  const handleLoadAnalysisFramework = useCallback(() => {
    if (!savedAnalysisFramework) {
      return;
    }

    applyAnalysisFrameworkState(savedAnalysisFramework.state);
    toast.success(`Loaded ${savedAnalysisFramework.name} from the server.`);
  }, [applyAnalysisFrameworkState, savedAnalysisFramework]);

  const handleRestoreDefaultAnalysisFramework = useCallback(() => {
    applyAnalysisFrameworkState(defaultAnalysisFramework);
    toast.message("Restored the built-in local analysis defaults.");
  }, [applyAnalysisFrameworkState, defaultAnalysisFramework]);

  const updateQuery = useCallback(
    (queryId: string, updater: (query: AnalysisQueryConfig) => AnalysisQueryConfig) => {
      setQueries((currentQueries) =>
        currentQueries.map((query) =>
          query.id === queryId ? updater(query) : query
        )
      );
    },
    []
  );

  const updateComparison = useCallback(
    (
      comparisonId: string,
      updater: (
        comparison: AnalysisDistributionComparisonConfig
      ) => AnalysisDistributionComparisonConfig
    ) => {
      setComparisons((currentComparisons) =>
        currentComparisons.map((comparison) =>
          comparison.id === comparisonId ? updater(comparison) : comparison
        )
      );
    },
    []
  );

  const updateClassificationComparison = useCallback(
    (
      comparisonId: string,
      updater: (
        comparison: AnalysisClassificationDistributionComparisonConfig
      ) => AnalysisClassificationDistributionComparisonConfig
    ) => {
      setClassificationComparisons((currentComparisons) =>
        currentComparisons.map((comparison) =>
          comparison.id === comparisonId ? updater(comparison) : comparison
        )
      );
    },
    []
  );

  const removeQuery = useCallback((queryId: string) => {
    setQueries((currentQueries) =>
      currentQueries.filter((query) => query.id !== queryId)
    );
    setCollapsedQueries((current) => {
      const next = { ...current };
      delete next[queryId];
      return next;
    });
  }, []);

  const removeComparison = useCallback((comparisonId: string) => {
    setComparisons((currentComparisons) =>
      currentComparisons.filter((comparison) => comparison.id !== comparisonId)
    );
    setCollapsedComparisons((current) => {
      const next = { ...current };
      delete next[comparisonId];
      return next;
    });
  }, []);

  const removeClassificationComparison = useCallback((comparisonId: string) => {
    setClassificationComparisons((currentComparisons) =>
      currentComparisons.filter((comparison) => comparison.id !== comparisonId)
    );
    setCollapsedClassificationComparisons((current) => {
      const next = { ...current };
      delete next[comparisonId];
      return next;
    });
  }, []);

  const toggleQueryCollapsed = useCallback((queryId: string) => {
    setCollapsedQueries((current) => ({
      ...current,
      [queryId]: !current[queryId],
    }));
  }, []);

  const toggleComparisonCollapsed = useCallback((comparisonId: string) => {
    setCollapsedComparisons((current) => ({
      ...current,
      [comparisonId]: !current[comparisonId],
    }));
  }, []);

  const toggleClassificationComparisonCollapsed = useCallback(
    (comparisonId: string) => {
      setCollapsedClassificationComparisons((current) => ({
        ...current,
        [comparisonId]: !current[comparisonId],
      }));
    },
    []
  );

  const collapseAllQueries = useCallback(() => {
    setCollapsedQueries(Object.fromEntries(queries.map((query) => [query.id, true])));
  }, [queries]);

  const collapseAllComparisons = useCallback(() => {
    setCollapsedComparisons(
      Object.fromEntries(comparisons.map((comparison) => [comparison.id, true]))
    );
  }, [comparisons]);

  const collapseAllClassificationComparisons = useCallback(() => {
    setCollapsedClassificationComparisons(
      Object.fromEntries(
        classificationComparisons.map((comparison) => [comparison.id, true])
      )
    );
  }, [classificationComparisons]);

  const expandAllQueries = useCallback(() => {
    setCollapsedQueries({});
  }, []);

  const expandAllComparisons = useCallback(() => {
    setCollapsedComparisons({});
  }, []);

  const expandAllClassificationComparisons = useCallback(() => {
    setCollapsedClassificationComparisons({});
  }, []);

  const toggleZeroBucket = useCallback((key: keyof ZeroBucketState) => {
    setHideZeroBuckets((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const handleExportReport = useCallback(() => {
    if (!summary || !dataset) {
      return;
    }

    const reportHtml = buildAnalysisHtmlReport({
      summary,
      dataset,
      queries,
      comparisons,
      classificationComparisons,
      hideZeroBuckets,
      imageQuality,
      userDisplayNames,
      generatedAt: new Date(),
    });

    downloadTextFile(
      reportHtml,
      `classification-analysis-report-${formatDateForFilename()}.html`,
      "text/html;charset=utf-8"
    );
  }, [
    classificationComparisons,
    comparisons,
    dataset,
    hideZeroBuckets,
    imageQuality,
    queries,
    summary,
    userDisplayNames,
  ]);

  const handleExportJson = useCallback(() => {
    if (!summary || !dataset) {
      return;
    }

    const statsExport = buildAnalysisStatsExport({
      summary,
      dataset,
      queries,
      comparisons,
      classificationComparisons,
      hideZeroBuckets,
      imageQuality,
      userDisplayNames,
      generatedAt: new Date(),
    });

    downloadTextFile(
      `${JSON.stringify(statsExport, null, 2)}\n`,
      `classification-analysis-stats-${formatDateForFilename()}.json`,
      "application/json;charset=utf-8"
    );
  }, [
    classificationComparisons,
    comparisons,
    dataset,
    hideZeroBuckets,
    imageQuality,
    queries,
    summary,
    userDisplayNames,
  ]);

  const handleDownloadQueryIdsTxt = useCallback(
    (query: AnalysisQueryConfig, result: AnalysisQueryResult) => {
      if (result.matchedRecords.length === 0) {
        return;
      }

      const content = `${result.matchedRecords
        .map((record) => record.galaxy.id)
        .join("\n")}\n`;

      downloadTextFile(
        content,
        `classification-analysis-${sanitizeFilenameSegment(query.name || "query")}-ids-${formatDateForFilename()}.txt`,
        "text/plain;charset=utf-8"
      );
    },
    []
  );

  const handleDownloadQueryMatchesCsv = useCallback(
    (query: AnalysisQueryConfig, result: AnalysisQueryResult) => {
      if (result.matchedRecords.length === 0) {
        return;
      }

      const csvLines = [
        createCsvHeader(ANALYSIS_MATCH_EXPORT_COLUMNS),
        ...result.matchedRecords.map((record) =>
          createCsvRow(record, ANALYSIS_MATCH_EXPORT_COLUMNS)
        ),
      ];

      downloadTextFile(
        `${csvLines.join("\n")}\n`,
        `classification-analysis-${sanitizeFilenameSegment(query.name || "query")}-matches-${formatDateForFilename()}.csv`,
        "text/csv;charset=utf-8"
      );
    },
    []
  );

  const queryResults = useMemo<Map<string, AnalysisQueryResult>>(() => {
    const resultMap = new Map<string, AnalysisQueryResult>();
    if (deferredRecords.length === 0) {
      return resultMap;
    }

    for (const query of deferredQueries) {
      resultMap.set(query.id, evaluateAnalysisQuery(deferredRecords, query));
    }

    return resultMap;
  }, [deferredQueries, deferredRecords]);

  const comparisonResults = useMemo<Map<string, AnalysisDistributionComparisonResult>>(() => {
    const resultMap = new Map<string, AnalysisDistributionComparisonResult>();
    if (deferredRecords.length === 0) {
      return resultMap;
    }

    for (const comparison of comparisons) {
      resultMap.set(
        comparison.id,
        evaluateAnalysisDistributionComparison(deferredRecords, comparison)
      );
    }

    return resultMap;
  }, [comparisons, deferredRecords]);

  const classificationComparisonResults = useMemo<
    Map<string, AnalysisClassificationDistributionComparisonResult>
  >(() => {
    const resultMap = new Map<
      string,
      AnalysisClassificationDistributionComparisonResult
    >();
    if (deferredRecords.length === 0) {
      return resultMap;
    }

    for (const comparison of classificationComparisons) {
      resultMap.set(
        comparison.id,
        evaluateAnalysisClassificationDistributionComparison(
          deferredRecords,
          comparison
        )
      );
    }

    return resultMap;
  }, [classificationComparisons, deferredRecords]);

  const globalHistograms = useMemo(
    () => buildGlobalSummaryHistograms(deferredRecords),
    [deferredRecords]
  );

  const visibleGlobalHistograms = useMemo(
    () => ({
      classificationCoverage: globalHistograms.classificationCoverage,
      lsbAgreementCount: globalHistograms.lsbAgreementCount,
      morphologyAgreementCount: globalHistograms.morphologyAgreementCount,
      visibleNucleusAgreementCount: filterZeroCountHistogram(
        globalHistograms.visibleNucleusAgreementCount,
        hideZeroBuckets.visibleNucleusAgreementCount
      ),
      awesomeVotes: filterZeroCountHistogram(
        globalHistograms.awesomeVotes,
        hideZeroBuckets.awesomeVotes
      ),
      failedFittingVotes: filterZeroCountHistogram(
        globalHistograms.failedFittingVotes,
        hideZeroBuckets.failedFittingVotes
      ),
      nucleusConfirmation: globalHistograms.nucleusConfirmation,
    }),
    [globalHistograms, hideZeroBuckets]
  );

  if (summary === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnalysisLoadSection
        summary={summary}
        hasDataset={hasDataset}
        hasStoredDataset={hasStoredDataset}
        storedDatasetRecordCount={storedDatasetRecordCount}
        storedDatasetSavedAtLabel={storedDatasetSavedAtLabel}
        datasetNotice={datasetNotice}
        loadedRecordsCount={loadedRecords.length}
        loadedAtLabel={loadedAtLabel}
        loadedSource={loadedSource}
        loadState={loadState}
        onLoadDataset={() => {
          void handleLoadDataset();
        }}
        onLoadStoredDataset={handleLoadStoredDataset}
        onCancelLoad={handleCancelLoad}
        onSaveDatasetToStorage={handleSaveDatasetToStorage}
        onDownloadDatasetArchive={handleDownloadDatasetArchive}
        onImportDatasetFile={(file) => {
          void handleImportDatasetArchive(file);
        }}
        onClearStoredDataset={handleClearStoredDataset}
        onExportReport={handleExportReport}
        onExportJson={handleExportJson}
        canDownloadDatasetArchive={hasDataset && loadState.status !== "loading"}
        canImportDatasetArchive={loadState.status !== "loading"}
        canExportReport={hasDataset && loadState.status !== "loading"}
        analysisSetupName={MY_ANALYSIS_FRAMEWORK_NAME}
        hasSavedAnalysisSetup={hasSavedAnalysisFramework}
        analysisSetupStatusMessage={analysisSetupStatus.message}
        analysisSetupStatusTone={analysisSetupStatus.tone}
        isAnalysisSetupLoading={isSavedAnalysisFrameworkLoading}
        isAnalysisSetupSaving={isSavingAnalysisFramework}
        onSaveAnalysisSetup={() => {
          void handleSaveAnalysisFramework();
        }}
        onLoadAnalysisSetup={handleLoadAnalysisFramework}
        onRestoreDefaultAnalysisSetup={handleRestoreDefaultAnalysisFramework}
      />

      <AgreementExplanation />

      {hasDataset && dataset ? (
        <AnalysisDatasetStats
          dataset={dataset}
          totalGalaxies={summary.totalGalaxies}
        />
      ) : null}

      {hasDataset ? (
        <AnalysisGlobalHistogramSection
          histograms={visibleGlobalHistograms}
          hideZeroBuckets={hideZeroBuckets}
          onToggleZeroBucket={toggleZeroBucket}
        />
      ) : null}

      {isSectionVisible ? (
        <AnalysisQueryToolbar
          onAddQuery={() =>
            setQueries((currentQueries) => [...currentQueries, createBlankAnalysisQuery()])
          }
          onCollapseAll={collapseAllQueries}
          onExpandAll={expandAllQueries}
        />
      ) : null}

      <DataAnalysisNavigator
        queries={queries}
        queryResults={queryResults}
        activeQueryId={activeQueryId}
        hasDataset={hasDataset}
        isNavigatorPinned={isNavigatorPinned}
        isSectionVisible={isSectionVisible}
        navigatorHeight={navigatorHeight}
        pinnedNavigatorStyle={pinnedNavigatorStyle}
        navigatorAnchorRef={navigatorAnchorRef}
        navigatorRef={navigatorRef}
      />

      <div className="space-y-6">
        {queries.map((query) => (
          <DataAnalysisQueryCard
            key={query.id}
            query={query}
            result={queryResults.get(query.id)}
            summary={summary}
            isCollapsed={collapsedQueries[query.id] === true}
            hasDataset={hasDataset}
            imageQuality={imageQuality}
            userPreferences={userPrefs}
            canRemove={queries.length > 1}
            onOpenDetails={setSelectedRecord}
            onDownloadQueryIdsTxt={handleDownloadQueryIdsTxt}
            onDownloadQueryMatchesCsv={handleDownloadQueryMatchesCsv}
            onToggleCollapsed={() => toggleQueryCollapsed(query.id)}
            onDuplicate={() =>
              setQueries((currentQueries) => [
                ...currentQueries,
                duplicateAnalysisQuery(query),
              ])
            }
            onRemove={() => removeQuery(query.id)}
            onUpdateQuery={updateQuery}
          />
        ))}
      </div>

      <div ref={queriesSectionEndRef} />

      <AnalysisDistributionToolbar
        onAddDistribution={() =>
          setComparisons((currentComparisons) => [
            ...currentComparisons,
            createBlankAnalysisDistributionComparison(),
          ])
        }
        onCollapseAll={collapseAllComparisons}
        onExpandAll={expandAllComparisons}
      />

      <div className="space-y-6">
        {comparisons.map((comparison) => (
          <DataAnalysisDistributionCard
            key={comparison.id}
            comparison={comparison}
            result={comparisonResults.get(comparison.id)}
            summary={summary}
            isCollapsed={collapsedComparisons[comparison.id] === true}
            hasDataset={hasDataset}
            imageQuality={imageQuality}
            userPreferences={userPrefs}
            canRemove={true}
            onOpenDetails={setSelectedRecord}
            onToggleCollapsed={() => toggleComparisonCollapsed(comparison.id)}
            onDuplicate={() =>
              setComparisons((currentComparisons) => [
                ...currentComparisons,
                duplicateAnalysisDistributionComparison(comparison),
              ])
            }
            onRemove={() => removeComparison(comparison.id)}
            onUpdateComparison={updateComparison}
          />
        ))}
      </div>

      <AnalysisClassificationDistributionToolbar
        onAddDistribution={() =>
          setClassificationComparisons((currentComparisons) => [
            ...currentComparisons,
            createBlankAnalysisClassificationDistributionComparison(),
          ])
        }
        onCollapseAll={collapseAllClassificationComparisons}
        onExpandAll={expandAllClassificationComparisons}
      />

      <div className="space-y-6">
        {classificationComparisons.map((comparison) => (
          <DataAnalysisClassificationDistributionCard
            key={comparison.id}
            comparison={comparison}
            result={classificationComparisonResults.get(comparison.id)}
            summary={summary}
            isCollapsed={
              collapsedClassificationComparisons[comparison.id] === true
            }
            hasDataset={hasDataset}
            userDisplayNames={userDisplayNames}
            canRemove={true}
            onOpenDetails={setSelectedRecord}
            onToggleCollapsed={() =>
              toggleClassificationComparisonCollapsed(comparison.id)
            }
            onDuplicate={() =>
              setClassificationComparisons((currentComparisons) => [
                ...currentComparisons,
                duplicateAnalysisClassificationDistributionComparison(comparison),
              ])
            }
            onRemove={() => removeClassificationComparison(comparison.id)}
            onUpdateComparison={updateClassificationComparison}
          />
        ))}
      </div>

      <ClassificationDetailsModal
        isOpen={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
        userDisplayNames={userDisplayNames}
        imageQuality={imageQuality}
        userPreferences={userPrefs}
      />
    </div>
  );
}