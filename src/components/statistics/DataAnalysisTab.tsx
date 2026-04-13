import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getImageUrl } from "../../images";
import { getPreviewImageName } from "../../images/displaySettings";
import { AnalysisHistogram } from "./analysis/AnalysisHistogram";
import {
  accumulateClassificationVote,
  analysisConditionMetricOptions,
  analysisHistogramMetricOptions,
  analysisOperatorOptions,
  analysisSortMetricOptions,
  buildAnalysisRecord,
  buildDefaultAnalysisQueries,
  buildGlobalSummaryHistograms,
  catalogNucleusOptions,
  clampPreviewLimit,
  createAnalysisCondition,
  createBlankAnalysisQuery,
  createEmptyAggregate,
  duplicateAnalysisQuery,
  evaluateAnalysisQuery,
  formatMetricValue,
  formatPaperLabel,
  getMetricLabel,
  getMetricShortLabel,
  type AnalysisAggregate,
  type AnalysisGalaxy,
  type AnalysisQueryConfig,
  type AnalysisQueryCondition,
  type AnalysisRecord,
} from "./analysis/helpers";

type PublicSystemSettings = {
  galaxyBrowserImageQuality?: "high" | "low";
};

type DatasetSummary = {
  totalGalaxies: number;
  totalClassifications: number;
  catalogNucleusGalaxies: number;
  availablePapers: string[];
};

type PreparedDataset = {
  records: AnalysisRecord[];
  loadedAt: number;
  classifiedGalaxyCount: number;
  totalAwesomeVotes: number;
  totalVisibleNucleusVotes: number;
  totalFailedFittingVotes: number;
  orphanedGalaxyCount: number;
  orphanedClassificationCount: number;
};

type DataLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  phase: "idle" | "galaxies" | "classifications" | "combining" | "ready";
  galaxiesLoaded: number;
  classificationRowsLoaded: number;
  error: string | null;
  cancelled: boolean;
};

const GALAXY_PAGE_SIZE = 400;
const CLASSIFICATION_PAGE_SIZE = 1500;
const EMPTY_RECORDS: AnalysisRecord[] = [];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to load the analysis dataset.";
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`;
}

function formatLoadedAt(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{value}</div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function ProgressRail({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(100, (current / safeTotal) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        <span>
          {current.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function QueryConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: AnalysisQueryCondition;
  onChange: (nextCondition: AnalysisQueryCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_112px_44px]">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Metric
        </span>
        <select
          value={condition.metric}
          onChange={(event) =>
            onChange({
              ...condition,
              metric: event.target.value as AnalysisQueryCondition["metric"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisConditionMetricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Operator
        </span>
        <select
          value={condition.operator}
          onChange={(event) =>
            onChange({
              ...condition,
              operator: event.target.value as AnalysisQueryCondition["operator"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisOperatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Count
        </span>
        <input
          type="number"
          min={0}
          step={1}
          value={condition.count}
          onChange={(event) =>
            onChange({
              ...condition,
              count: Math.max(0, Math.floor(Number(event.target.value) || 0)),
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          aria-label="Remove condition"
          title="Remove condition"
        >
          x
        </button>
      </div>
    </div>
  );
}

function AnalysisGalaxyCard({
  record,
  imageQuality,
  previewImageName,
}: {
  record: AnalysisRecord;
  imageQuality: "high" | "low";
  previewImageName: string;
}) {
  const { galaxy, aggregate } = record;

  return (
    <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:grid-cols-[160px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40">
        <img
          src={getImageUrl(galaxy.id, previewImageName, { quality: imageQuality })}
          alt={`Preview of galaxy ${galaxy.id}`}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/classify/${galaxy.id}`}
                className="text-lg font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                {galaxy.id}
              </Link>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                #{galaxy.numericId?.toLocaleString() ?? "-"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Paper: {formatPaperLabel(galaxy.paper)}
              <span className="mx-2">•</span>
              Catalog nucleus: {galaxy.nucleus ? "Yes" : "No"}
            </p>
          </div>

          <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {formatPercent(record.agreement.overall)} agreement
          </div>
        </div>

        <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dominant LSB
            </div>
            <div className="mt-1 font-medium">{record.dominantLsbLabel}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dominant morphology
            </div>
            <div className="mt-1 font-medium">{record.dominantMorphologyLabel}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Classifications
            </div>
            <div className="mt-1 font-medium">
              {aggregate.totalClassifications.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Votes snapshot
            </div>
            <div className="mt-1 font-medium">
              LSB {aggregate.lsbVotes} / ETG {aggregate.etgVotes}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Flags
            </div>
            <div className="mt-1 font-medium">
              Awesome {aggregate.awesomeVotes} / Nucleus {aggregate.visibleNucleusVotes}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Nucleus confirmation
            </div>
            <div className="mt-1 font-medium">
              {formatPercent(record.nucleusConfirmationRate)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>RA {galaxy.ra.toFixed(4)} deg</span>
          <span>Dec {galaxy.dec.toFixed(4)} deg</span>
          <span>Reff {galaxy.reff.toFixed(2)}</span>
          <span>q {galaxy.q.toFixed(3)}</span>
          <span>Mag {galaxy.mag === null ? "-" : galaxy.mag.toFixed(2)}</span>
          <span>
            mu0 {galaxy.mean_mue === null ? "-" : galaxy.mean_mue.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/classify/${galaxy.id}`}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Classify
          </Link>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Disagreement {formatPercent(record.disagreement)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DataAnalysisTab({ systemSettings }: { systemSettings: PublicSystemSettings }) {
  usePageTitle("Statistics – Data Analysis");

  const convex = useConvex();
  const summary = useQuery(
    api.statistics.classificationAnalysis.getDatasetSummary
  ) as DatasetSummary | undefined;
  const [queries, setQueries] = useState<AnalysisQueryConfig[]>(() =>
    buildDefaultAnalysisQueries()
  );
  const [dataset, setDataset] = useState<PreparedDataset | null>(null);
  const [loadState, setLoadState] = useState<DataLoadState>({
    status: "idle",
    phase: "idle",
    galaxiesLoaded: 0,
    classificationRowsLoaded: 0,
    error: null,
    cancelled: false,
  });
  const cancelLoadRef = useRef(false);

  const deferredQueries = useDeferredValue(queries);
  const deferredRecords = useDeferredValue(dataset?.records ?? EMPTY_RECORDS);
  const previewImageName = getPreviewImageName();
  const imageQuality = systemSettings.galaxyBrowserImageQuality ?? "low";

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
  }, []);

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

        for (const vote of page.page) {
          const aggregate =
            aggregateMap.get(vote.galaxyExternalId) ?? createEmptyAggregate();
          accumulateClassificationVote(aggregate, vote);
          aggregateMap.set(vote.galaxyExternalId, aggregate);
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
      let totalAwesomeVotes = 0;
      let totalVisibleNucleusVotes = 0;
      let totalFailedFittingVotes = 0;

      for (const galaxy of sortedGalaxies) {
        const aggregate = aggregateMap.get(galaxy.id) ?? createEmptyAggregate();
        if (aggregate.totalClassifications > 0) {
          classifiedGalaxyCount += 1;
        }
        totalAwesomeVotes += aggregate.awesomeVotes;
        totalVisibleNucleusVotes += aggregate.visibleNucleusVotes;
        totalFailedFittingVotes += aggregate.failedFittingVotes;
        records.push(buildAnalysisRecord(galaxy, aggregate));
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
          totalAwesomeVotes,
          totalVisibleNucleusVotes,
          totalFailedFittingVotes,
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

  const queryResults = useMemo(() => {
    const resultMap = new Map<string, ReturnType<typeof evaluateAnalysisQuery>>();
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

  const loadedAtLabel = formatLoadedAt(dataset?.loadedAt ?? null);
  const loadedRecords = dataset?.records ?? EMPTY_RECORDS;
  const hasDataset = dataset !== null;

  if (summary === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Client-side classification analysis
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                This workspace pulls the raw galaxy and classification data in pages,
                then evaluates every histogram and query locally in your browser.
                Nothing runs automatically: click the button to fetch the dataset,
                then adjust or add as many query cards as you need.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Galaxy catalog"
                value={summary.totalGalaxies.toLocaleString()}
                detail="Total galaxy rows that will be paged into the local analysis dataset."
              />
              <StatCard
                label="Classification rows"
                value={summary.totalClassifications.toLocaleString()}
                detail="Raw classification rows available for vote aggregation."
              />
              <StatCard
                label="Catalog nuclei"
                value={summary.catalogNucleusGalaxies.toLocaleString()}
                detail="Galaxies marked with a nucleus in the input catalog."
              />
              <StatCard
                label="Configured papers"
                value={summary.availablePapers.length.toLocaleString()}
                detail="Paper filters available in the query builder. Empty paper stays selectable."
              />
            </div>
          </div>

          <div className="w-full max-w-md rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Analysis run
            </div>
            <div className="mt-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
              {hasDataset ? "Dataset ready" : "Dataset not loaded"}
            </div>
            <p className="mt-2 text-sm text-blue-800/90 dark:text-blue-200/90">
              {hasDataset
                ? `Loaded ${loadedRecords.length.toLocaleString()} galaxies${loadedAtLabel ? ` at ${loadedAtLabel}` : ""}. Query edits now stay fully local.`
                : "Fetching happens in paged requests so the page stays within Convex limits and avoids one huge query."}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleLoadDataset()}
                disabled={loadState.status === "loading"}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
              >
                {loadState.status === "loading"
                  ? "Loading dataset..."
                  : hasDataset
                  ? "Reload dataset"
                  : "Load data and run analysis"}
              </button>

              {loadState.status === "loading" && (
                <button
                  type="button"
                  onClick={handleCancelLoad}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>

            {loadState.cancelled && loadState.status === "idle" && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                Loading was cancelled before the local dataset finished building.
              </p>
            )}
            {loadState.error && (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                {loadState.error}
              </p>
            )}
          </div>
        </div>

        {loadState.status === "loading" && (
          <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Loading in pages
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Phase: {loadState.phase}
                </p>
              </div>
            </div>

            <ProgressRail
              label="Galaxy pages"
              current={loadState.galaxiesLoaded}
              total={summary.totalGalaxies}
            />
            <ProgressRail
              label="Classification pages"
              current={loadState.classificationRowsLoaded}
              total={summary.totalClassifications}
            />
          </div>
        )}
      </div>

      {hasDataset && dataset && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Classified galaxies</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {dataset.classifiedGalaxyCount.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {formatPercent(dataset.classifiedGalaxyCount / Math.max(summary.totalGalaxies, 1))} of the full catalog currently has at least one classification.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Awesome votes</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {dataset.totalAwesomeVotes.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Total awesome flags summed locally across the loaded rows.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Visible-nucleus votes</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {dataset.totalVisibleNucleusVotes.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Confirmation votes that can be compared to the catalog nucleus field.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Failed-fitting votes</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {dataset.totalFailedFittingVotes.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Legacy and checkbox failed-fitting votes are normalized into one count.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">Integrity watch</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {dataset.orphanedGalaxyCount.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Classification-only galaxy IDs missing from the current galaxy table.
              {dataset.orphanedClassificationCount > 0
                ? ` (${dataset.orphanedClassificationCount.toLocaleString()} classification rows)`
                : ""}
            </p>
          </div>
        </div>
      )}

      {hasDataset && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agreement distribution
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                How concentrated the votes are across the classified catalog.
              </p>
            </div>
            <AnalysisHistogram data={globalHistograms.agreement} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Awesome-vote distribution
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Which part of the catalog is attracting repeated follow-up interest.
              </p>
            </div>
            <AnalysisHistogram data={globalHistograms.awesomeVotes} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Catalog nucleus confirmations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Visible-nucleus confirmation rate for galaxies whose catalog row already says nucleus.
              </p>
            </div>
            <AnalysisHistogram data={globalHistograms.nucleusConfirmation} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Interactive query cards
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Stack several local questions on one page. Each card filters the same
            loaded dataset with its own thresholds, histogram, and top-galaxy list.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setQueries((currentQueries) => [...currentQueries, createBlankAnalysisQuery()])}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Add query
        </button>
      </div>

      <div className="space-y-6">
        {queries.map((query) => {
          const result = queryResults.get(query.id);

          return (
            <section
              key={query.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid flex-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Query name
                    </span>
                    <input
                      type="text"
                      value={query.name}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Paper filter
                    </span>
                    <select
                      value={query.paper}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          paper: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="__any__">All papers</option>
                      {summary.availablePapers.map((paper) => (
                        <option key={paper || "__empty__"} value={paper}>
                          {formatPaperLabel(paper)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Prompt
                    </span>
                    <textarea
                      value={query.description}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          description: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Catalog nucleus filter
                    </span>
                    <select
                      value={query.catalogNucleus}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          catalogNucleus: event.target.value as AnalysisQueryConfig["catalogNucleus"],
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      {catalogNucleusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Sort results by
                    </span>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <select
                        value={query.sortBy}
                        onChange={(event) =>
                          updateQuery(query.id, (currentQuery) => ({
                            ...currentQuery,
                            sortBy: event.target.value as AnalysisQueryConfig["sortBy"],
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        {analysisSortMetricOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={query.sortDirection}
                        onChange={(event) =>
                          updateQuery(query.id, (currentQuery) => ({
                            ...currentQuery,
                            sortDirection: event.target.value as AnalysisQueryConfig["sortDirection"],
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="desc">Highest first</option>
                        <option value="asc">Lowest first</option>
                      </select>
                    </div>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Histogram metric
                    </span>
                    <select
                      value={query.histogramMetric}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          histogramMetric: event.target.value as AnalysisQueryConfig["histogramMetric"],
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      {analysisHistogramMetricOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Preview rows
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={query.previewLimit}
                      onChange={(event) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          previewLimit: clampPreviewLimit(Number(event.target.value) || 0),
                        }))
                      }
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </label>
                </div>

                <div className="flex shrink-0 gap-3 xl:flex-col">
                  <button
                    type="button"
                    onClick={() =>
                      setQueries((currentQueries) => [
                        ...currentQueries,
                        duplicateAnalysisQuery(query),
                      ])
                    }
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuery(query.id)}
                    disabled={queries.length === 1}
                    className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Thresholds
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Each condition is an AND filter applied to the local per-galaxy aggregates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuery(query.id, (currentQuery) => ({
                        ...currentQuery,
                        conditions: [
                          ...currentQuery.conditions,
                          createAnalysisCondition(),
                        ],
                      }))
                    }
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Add condition
                  </button>
                </div>

                <div className="space-y-3">
                  {query.conditions.map((condition) => (
                    <QueryConditionEditor
                      key={condition.id}
                      condition={condition}
                      onChange={(nextCondition) =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          conditions: currentQuery.conditions.map((candidate) =>
                            candidate.id === nextCondition.id ? nextCondition : candidate
                          ),
                        }))
                      }
                      onRemove={() =>
                        updateQuery(query.id, (currentQuery) => ({
                          ...currentQuery,
                          conditions:
                            currentQuery.conditions.length > 1
                              ? currentQuery.conditions.filter(
                                  (candidate) => candidate.id !== condition.id
                                )
                              : currentQuery.conditions,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Result summary
                  </div>
                  {hasDataset && result ? (
                    <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                      <div>
                        <div className="text-3xl font-semibold text-gray-900 dark:text-white">
                          {result.matchedCount.toLocaleString()}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Matching galaxies in the loaded dataset.
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Total classifications in matches
                        </div>
                        <div className="mt-1 font-medium">
                          {result.totalMatchingClassifications.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Average agreement
                        </div>
                        <div className="mt-1 font-medium">
                          {formatPercent(result.averageAgreement)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Sort metric
                        </div>
                        <div className="mt-1 font-medium">
                          {getMetricLabel(query.sortBy)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Histogram metric
                        </div>
                        <div className="mt-1 font-medium">
                          {getMetricLabel(query.histogramMetric)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Load the dataset first to evaluate this query locally.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {query.name || "Untitled query"}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {query.description}
                    </p>
                  </div>
                  <AnalysisHistogram data={result?.histogram ?? []} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Top matches
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Showing up to {clampPreviewLimit(query.previewLimit)} galaxies ranked by {getMetricShortLabel(query.sortBy).toLowerCase()}.
                    </p>
                  </div>
                </div>

                {!hasDataset ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                    Load the dataset to preview galaxies here.
                  </div>
                ) : result && result.previewRecords.length > 0 ? (
                  <div className="space-y-4">
                    {result.previewRecords.map((record) => (
                      <AnalysisGalaxyCard
                        key={`${query.id}-${record.galaxy._id}`}
                        record={record}
                        imageQuality={imageQuality}
                        previewImageName={previewImageName}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                    No galaxies matched this query. Try relaxing one or more vote thresholds.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}