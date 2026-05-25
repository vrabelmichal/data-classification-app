import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
  getNamedAnalysisFrameworkSignature,
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
const DEFAULT_ANALYSIS_SETUP_NAME_PREFIX = "Analysis";

function createAnalysisSetupKey() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `analysis-${Date.now().toString(36)}-${randomSuffix}`;
}

function normalizeAnalysisSetupName(name: string, fallbackName: string) {
  const trimmedName = name.trim();
  return trimmedName.length > 0 ? trimmedName : fallbackName;
}

function mergeSavedAnalysisFrameworks(
  fetchedConfigs: SavedAnalysisFrameworkConfig[] | undefined,
  localOverrides: Record<string, SavedAnalysisFrameworkConfig>
) {
  const mergedConfigs = new Map<string, SavedAnalysisFrameworkConfig>();

  for (const config of fetchedConfigs ?? []) {
    mergedConfigs.set(config.configKey, config);
  }

  for (const config of Object.values(localOverrides)) {
    const existingConfig = mergedConfigs.get(config.configKey);
    if (!existingConfig || config.updatedAt >= existingConfig.updatedAt) {
      mergedConfigs.set(config.configKey, config);
    }
  }

  return [...mergedConfigs.values()].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildDefaultAnalysisSetupName(
  savedConfigs: SavedAnalysisFrameworkConfig[]
) {
  const usedNames = new Set(
    savedConfigs
      .map((config) => config.name.trim().toLowerCase())
      .filter((name) => name.length > 0)
  );

  let suffix = 1;
  while (usedNames.has(`${DEFAULT_ANALYSIS_SETUP_NAME_PREFIX.toLowerCase()} ${suffix}`)) {
    suffix += 1;
  }

  return `${DEFAULT_ANALYSIS_SETUP_NAME_PREFIX} ${suffix}`;
}

function moveItemById<T extends { id: string }>(
  items: T[],
  itemId: string,
  direction: "up" | "down"
) {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) {
    return items;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(currentIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

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
  const fetchedSavedAnalysisFrameworks = useQuery(
    api.statistics.classificationAnalysis.listAnalysisFrameworkConfigs
  ) as SavedAnalysisFrameworkConfig[] | undefined;
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
  const [savedAnalysisFrameworkOverrides, setSavedAnalysisFrameworkOverrides] = useState<
    Record<string, SavedAnalysisFrameworkConfig>
  >({});
  const [selectedAnalysisSetupKey, setSelectedAnalysisSetupKey] = useState<string | null>(
    null
  );
  const [analysisSetupDraftName, setAnalysisSetupDraftName] = useState("");
  const [isSavingAnalysisFramework, setIsSavingAnalysisFramework] = useState(false);
  const [areQueryCardsHidden, setAreQueryCardsHidden] = useState(false);
  const [areComparisonCardsHidden, setAreComparisonCardsHidden] = useState(false);
  const [areClassificationComparisonCardsHidden, setAreClassificationComparisonCardsHidden] =
    useState(false);

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
  } = usePinnedQueryNavigator(queries, hasDataset, !areQueryCardsHidden);

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
  const savedAnalysisFrameworks = useMemo(
    () =>
      mergeSavedAnalysisFrameworks(
        fetchedSavedAnalysisFrameworks,
        savedAnalysisFrameworkOverrides
      ),
    [fetchedSavedAnalysisFrameworks, savedAnalysisFrameworkOverrides]
  );
  const defaultNewAnalysisSetupName = useMemo(
    () => buildDefaultAnalysisSetupName(savedAnalysisFrameworks),
    [savedAnalysisFrameworks]
  );
  const selectedSavedAnalysisFramework = useMemo(
    () =>
      selectedAnalysisSetupKey
        ? savedAnalysisFrameworks.find(
            (config) => config.configKey === selectedAnalysisSetupKey
          ) ?? null
        : null,
    [savedAnalysisFrameworks, selectedAnalysisSetupKey]
  );

  useEffect(() => {
    if (savedAnalysisFrameworks.length === 0) {
      return;
    }

    setSelectedAnalysisSetupKey((currentKey) => {
      if (
        currentKey &&
        savedAnalysisFrameworks.some((config) => config.configKey === currentKey)
      ) {
        return currentKey;
      }

      const legacyConfig = savedAnalysisFrameworks.find(
        (config) => config.configKey === MY_ANALYSIS_FRAMEWORK_KEY
      );
      return legacyConfig?.configKey ?? savedAnalysisFrameworks[0].configKey;
    });
  }, [savedAnalysisFrameworks]);

  useEffect(() => {
    if (selectedSavedAnalysisFramework) {
      setAnalysisSetupDraftName(selectedSavedAnalysisFramework.name);
      return;
    }

    setAnalysisSetupDraftName((currentName) =>
      currentName.trim().length > 0 ? currentName : defaultNewAnalysisSetupName
    );
  }, [defaultNewAnalysisSetupName, selectedSavedAnalysisFramework]);

  const currentAnalysisSetupName = useMemo(
    () =>
      normalizeAnalysisSetupName(
        analysisSetupDraftName,
        selectedSavedAnalysisFramework?.name ?? defaultNewAnalysisSetupName
      ),
    [analysisSetupDraftName, defaultNewAnalysisSetupName, selectedSavedAnalysisFramework]
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
  const currentAnalysisSetupSignature = useMemo(
    () =>
      getNamedAnalysisFrameworkSignature(
        currentAnalysisSetupName,
        currentAnalysisFrameworkState
      ),
    [currentAnalysisFrameworkState, currentAnalysisSetupName]
  );
  const defaultAnalysisFrameworkSignature = useMemo(
    () => getAnalysisFrameworkSignature(defaultAnalysisFramework),
    [defaultAnalysisFramework]
  );
  const savedAnalysisFrameworkSignature = useMemo(
    () =>
      selectedSavedAnalysisFramework
        ? getNamedAnalysisFrameworkSignature(
            selectedSavedAnalysisFramework.name,
            selectedSavedAnalysisFramework.state
          )
        : null,
    [selectedSavedAnalysisFramework]
  );
  const hasSavedAnalysisFramework = savedAnalysisFrameworks.length > 0;
  const hasSelectedSavedAnalysisFramework = selectedSavedAnalysisFramework !== null;
  const isSavedAnalysisFrameworkLoading = fetchedSavedAnalysisFrameworks === undefined;
  const matchesSavedAnalysisFramework =
    savedAnalysisFrameworkSignature !== null &&
    currentAnalysisSetupSignature === savedAnalysisFrameworkSignature;
  const matchesDefaultAnalysisFramework =
    currentAnalysisFrameworkSignature === defaultAnalysisFrameworkSignature;

  const analysisSetupStatus = useMemo(() => {
    if (isSavedAnalysisFrameworkLoading) {
      return {
        tone: "neutral" as const,
        message: "Checking saved analysis setups on the server.",
      };
    }

    if (!hasSelectedSavedAnalysisFramework) {
      return {
        tone: matchesDefaultAnalysisFramework ? ("neutral" as const) : ("warning" as const),
        message: matchesDefaultAnalysisFramework
          ? hasSavedAnalysisFramework
            ? `Choose a saved setup to load it, or save the current local setup as ${currentAnalysisSetupName}.`
            : `Using the built-in local defaults. Save to store ${currentAnalysisSetupName} on the server.`
          : `This setup only exists in the current browser session until you save it as ${currentAnalysisSetupName}.`,
      };
    }

    const savedAtLabel =
      formatLoadedAt(selectedSavedAnalysisFramework.updatedAt) ?? "recently";

    if (matchesSavedAnalysisFramework) {
      return {
        tone: "success" as const,
        message: `${selectedSavedAnalysisFramework.name} matches the current local setup. Server copy saved ${savedAtLabel}.`,
      };
    }

    if (matchesDefaultAnalysisFramework) {
      return {
        tone: "warning" as const,
        message: `${selectedSavedAnalysisFramework.name} is saved on the server from ${savedAtLabel}. The page is currently using local defaults until you load it or save over it.`,
      };
    }

    return {
      tone: "warning" as const,
      message: `${selectedSavedAnalysisFramework.name} is saved on the server from ${savedAtLabel}. The current local setup differs and will not overwrite it until you save.`,
    };
  }, [
    currentAnalysisSetupName,
    hasSavedAnalysisFramework,
    hasSelectedSavedAnalysisFramework,
    isSavedAnalysisFrameworkLoading,
    matchesDefaultAnalysisFramework,
    matchesSavedAnalysisFramework,
    selectedSavedAnalysisFramework,
  ]);

  const handleSaveAnalysisFramework = useCallback(async () => {
    setIsSavingAnalysisFramework(true);

    const fallbackName = selectedSavedAnalysisFramework?.name ?? defaultNewAnalysisSetupName;
    const setupName = normalizeAnalysisSetupName(analysisSetupDraftName, fallbackName);
    const configKey = selectedSavedAnalysisFramework?.configKey ?? createAnalysisSetupKey();
    const createdNewSetup = selectedSavedAnalysisFramework === null;

    try {
      const savedConfig = await saveAnalysisFrameworkConfig({
        configKey,
        name: setupName,
        state: cloneAnalysisFrameworkState(currentAnalysisFrameworkState),
      });
      setSavedAnalysisFrameworkOverrides((currentOverrides) => ({
        ...currentOverrides,
        [savedConfig.configKey]: savedConfig,
      }));
      setSelectedAnalysisSetupKey(savedConfig.configKey);
      setAnalysisSetupDraftName(savedConfig.name);
      toast.success(
        createdNewSetup
          ? `Created ${savedConfig.name} on the server.`
          : `Saved ${savedConfig.name} to the server.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save the current analysis setup."
      );
    } finally {
      setIsSavingAnalysisFramework(false);
    }
  }, [
    analysisSetupDraftName,
    currentAnalysisFrameworkState,
    defaultNewAnalysisSetupName,
    saveAnalysisFrameworkConfig,
    selectedSavedAnalysisFramework,
  ]);

  const handleSaveAnalysisFrameworkAsNew = useCallback(async () => {
    setIsSavingAnalysisFramework(true);

    const requestedName = analysisSetupDraftName.trim();
    const currentSavedName = selectedSavedAnalysisFramework?.name.trim() ?? "";
    const setupName =
      requestedName.length === 0 || requestedName === currentSavedName
        ? defaultNewAnalysisSetupName
        : requestedName;

    try {
      const savedConfig = await saveAnalysisFrameworkConfig({
        configKey: createAnalysisSetupKey(),
        name: setupName,
        state: cloneAnalysisFrameworkState(currentAnalysisFrameworkState),
      });
      setSavedAnalysisFrameworkOverrides((currentOverrides) => ({
        ...currentOverrides,
        [savedConfig.configKey]: savedConfig,
      }));
      setSelectedAnalysisSetupKey(savedConfig.configKey);
      setAnalysisSetupDraftName(savedConfig.name);
      toast.success(`Created ${savedConfig.name} on the server.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create a new analysis setup."
      );
    } finally {
      setIsSavingAnalysisFramework(false);
    }
  }, [
    analysisSetupDraftName,
    currentAnalysisFrameworkState,
    defaultNewAnalysisSetupName,
    saveAnalysisFrameworkConfig,
    selectedSavedAnalysisFramework,
  ]);

  const handleLoadAnalysisFramework = useCallback(() => {
    if (!selectedSavedAnalysisFramework) {
      return;
    }

    applyAnalysisFrameworkState(selectedSavedAnalysisFramework.state);
    setAnalysisSetupDraftName(selectedSavedAnalysisFramework.name);
    toast.success(`Loaded ${selectedSavedAnalysisFramework.name} from the server.`);
  }, [applyAnalysisFrameworkState, selectedSavedAnalysisFramework]);

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

  const moveQuery = useCallback((queryId: string, direction: "up" | "down") => {
    setQueries((currentQueries) => moveItemById(currentQueries, queryId, direction));
  }, []);

  const moveComparison = useCallback(
    (comparisonId: string, direction: "up" | "down") => {
      setComparisons((currentComparisons) =>
        moveItemById(currentComparisons, comparisonId, direction)
      );
    },
    []
  );

  const moveClassificationComparison = useCallback(
    (comparisonId: string, direction: "up" | "down") => {
      setClassificationComparisons((currentComparisons) =>
        moveItemById(currentComparisons, comparisonId, direction)
      );
    },
    []
  );

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
        analysisSetupName={currentAnalysisSetupName}
        analysisSetupOptions={savedAnalysisFrameworks.map((config) => ({
          configKey: config.configKey,
          name: config.name,
          updatedAt: config.updatedAt,
        }))}
        selectedAnalysisSetupKey={selectedAnalysisSetupKey}
        hasSavedAnalysisSetup={hasSelectedSavedAnalysisFramework}
        savedAnalysisSetupCount={savedAnalysisFrameworks.length}
        analysisSetupStatusMessage={analysisSetupStatus.message}
        analysisSetupStatusTone={analysisSetupStatus.tone}
        isAnalysisSetupLoading={isSavedAnalysisFrameworkLoading}
        isAnalysisSetupSaving={isSavingAnalysisFramework}
        onSelectAnalysisSetup={setSelectedAnalysisSetupKey}
        onChangeAnalysisSetupName={setAnalysisSetupDraftName}
        onSaveAnalysisSetup={() => {
          void handleSaveAnalysisFramework();
        }}
        onSaveAsNewAnalysisSetup={() => {
          void handleSaveAnalysisFrameworkAsNew();
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

      <AnalysisQueryToolbar
        onAddQuery={() =>
          setQueries((currentQueries) => [...currentQueries, createBlankAnalysisQuery()])
        }
        onCollapseAll={collapseAllQueries}
        onExpandAll={expandAllQueries}
        isSectionHidden={areQueryCardsHidden}
        onToggleSectionVisibility={() =>
          setAreQueryCardsHidden((currentState) => !currentState)
        }
      />

      {!areQueryCardsHidden ? (
        <>
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
            {queries.map((query, index) => (
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
                canMoveUp={index > 0}
                canMoveDown={index < queries.length - 1}
                onOpenDetails={setSelectedRecord}
                onDownloadQueryIdsTxt={handleDownloadQueryIdsTxt}
                onDownloadQueryMatchesCsv={handleDownloadQueryMatchesCsv}
                onToggleCollapsed={() => toggleQueryCollapsed(query.id)}
                onMoveUp={() => moveQuery(query.id, "up")}
                onMoveDown={() => moveQuery(query.id, "down")}
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
        </>
      ) : null}

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
        isSectionHidden={areComparisonCardsHidden}
        onToggleSectionVisibility={() =>
          setAreComparisonCardsHidden((currentState) => !currentState)
        }
      />

      {!areComparisonCardsHidden ? (
        <div className="space-y-6">
          {comparisons.map((comparison, index) => (
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
              canMoveUp={index > 0}
              canMoveDown={index < comparisons.length - 1}
              onOpenDetails={setSelectedRecord}
              onToggleCollapsed={() => toggleComparisonCollapsed(comparison.id)}
              onMoveUp={() => moveComparison(comparison.id, "up")}
              onMoveDown={() => moveComparison(comparison.id, "down")}
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
      ) : null}

      <AnalysisClassificationDistributionToolbar
        onAddDistribution={() =>
          setClassificationComparisons((currentComparisons) => [
            ...currentComparisons,
            createBlankAnalysisClassificationDistributionComparison(),
          ])
        }
        onCollapseAll={collapseAllClassificationComparisons}
        onExpandAll={expandAllClassificationComparisons}
        isSectionHidden={areClassificationComparisonCardsHidden}
        onToggleSectionVisibility={() =>
          setAreClassificationComparisonCardsHidden((currentState) => !currentState)
        }
      />

      {!areClassificationComparisonCardsHidden ? (
        <div className="space-y-6">
          {classificationComparisons.map((comparison, index) => (
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
              canMoveUp={index > 0}
              canMoveDown={
                index < classificationComparisons.length - 1
              }
              onOpenDetails={setSelectedRecord}
              onToggleCollapsed={() =>
                toggleClassificationComparisonCollapsed(comparison.id)
              }
              onMoveUp={() => moveClassificationComparison(comparison.id, "up")}
              onMoveDown={() =>
                moveClassificationComparison(comparison.id, "down")
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
      ) : null}

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