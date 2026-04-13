import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { ClassificationDetailsModal } from "./analysis/ClassificationDetailsModal";
import { DataAnalysisNavigator } from "./analysis/DataAnalysisNavigator";
import {
  AnalysisDatasetStats,
  AnalysisGlobalHistogramSection,
  AnalysisLoadSection,
  AnalysisQueryToolbar,
} from "./analysis/DataAnalysisOverviewSections";
import {
  DataAnalysisQueryCard,
  duplicateAnalysisQuery,
} from "./analysis/DataAnalysisQueryCard";
import { AgreementExplanation } from "./analysis/AgreementExplanation";
import {
  buildDefaultAnalysisQueries,
  buildGlobalSummaryHistograms,
  createBlankAnalysisQuery,
  evaluateAnalysisQuery,
  filterZeroCountHistogram,
  type AnalysisQueryConfig,
  type AnalysisQueryResult,
  type AnalysisRecord,
  type AnalysisUserDirectoryEntry,
} from "./analysis/helpers";
import type {
  DatasetSummary,
  PublicSystemSettings,
  ZeroBucketState,
} from "./analysis/tabTypes";
import { useAnalysisDataset } from "./analysis/useAnalysisDataset";
import { usePinnedQueryNavigator } from "./analysis/usePinnedQueryNavigator";

const EMPTY_RECORDS: AnalysisRecord[] = [];

export function DataAnalysisTab({ systemSettings }: { systemSettings: PublicSystemSettings }) {
  usePageTitle("Statistics – Data Analysis");

  const summary = useQuery(
    api.statistics.classificationAnalysis.getDatasetSummary
  ) as DatasetSummary | undefined;
  const userPrefs = useQuery(api.users.getUserPreferences);
  const userDirectory = useQuery(
    api.statistics.classificationAnalysis.getUserDirectory
  ) as AnalysisUserDirectoryEntry[] | undefined;
  const [queries, setQueries] = useState<AnalysisQueryConfig[]>(() =>
    buildDefaultAnalysisQueries()
  );
  const [collapsedQueries, setCollapsedQueries] = useState<Record<string, boolean>>({});
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [hideZeroBuckets, setHideZeroBuckets] = useState<ZeroBucketState>({
    awesomeVotes: true,
    visibleNucleusVotes: true,
    failedFittingVotes: true,
  });

  const {
    dataset,
    loadState,
    hasDataset,
    loadedAtLabel,
    loadedRecords,
    handleLoadDataset,
    handleCancelLoad,
  } = useAnalysisDataset();

  const {
    activeQueryId,
    isNavigatorPinned,
    navigatorHeight,
    navigatorAnchorRef,
    navigatorRef,
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

  const toggleQueryCollapsed = useCallback((queryId: string) => {
    setCollapsedQueries((current) => ({
      ...current,
      [queryId]: !current[queryId],
    }));
  }, []);

  const collapseAllQueries = useCallback(() => {
    setCollapsedQueries(Object.fromEntries(queries.map((query) => [query.id, true])));
  }, [queries]);

  const expandAllQueries = useCallback(() => {
    setCollapsedQueries({});
  }, []);

  const toggleZeroBucket = useCallback((key: keyof ZeroBucketState) => {
    setHideZeroBuckets((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

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

  const globalHistograms = useMemo(
    () => buildGlobalSummaryHistograms(deferredRecords),
    [deferredRecords]
  );

  const visibleGlobalHistograms = useMemo(
    () => ({
      agreement: globalHistograms.agreement,
      awesomeVotes: filterZeroCountHistogram(
        globalHistograms.awesomeVotes,
        hideZeroBuckets.awesomeVotes
      ),
      visibleNucleusVotes: filterZeroCountHistogram(
        globalHistograms.visibleNucleusVotes,
        hideZeroBuckets.visibleNucleusVotes
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
        loadedRecordsCount={loadedRecords.length}
        loadedAtLabel={loadedAtLabel}
        loadState={loadState}
        onLoadDataset={() => {
          void handleLoadDataset();
        }}
        onCancelLoad={handleCancelLoad}
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
      />

      <DataAnalysisNavigator
        queries={queries}
        queryResults={queryResults}
        activeQueryId={activeQueryId}
        hasDataset={hasDataset}
        isNavigatorPinned={isNavigatorPinned}
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

      <ClassificationDetailsModal
        isOpen={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
        userDisplayNames={userDisplayNames}
      />
    </div>
  );
}