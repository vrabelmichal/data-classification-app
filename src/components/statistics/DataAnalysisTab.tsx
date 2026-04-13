import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConvex, useQuery } from "convex/react";
import { createPortal } from "react-dom";
import { Link } from "react-router";

import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getImageUrl } from "../../images";
import { getPreviewImageName } from "../../images/displaySettings";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "../classification/GalaxyImages";
import { ImageViewer } from "../classification/ImageViewer";
import type { UserPreferences } from "../classification/types";
import { AgreementExplanation } from "./analysis/AgreementExplanation";
import { AnalysisHistogram } from "./analysis/AnalysisHistogram";
import { ClassificationDetailsModal } from "./analysis/ClassificationDetailsModal";
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
  filterZeroCountHistogram,
  formatPaperLabel,
  getMetricLabel,
  getMetricShortLabel,
  getVotePreview,
  type AnalysisAggregate,
  type AnalysisClassificationVote,
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

type ZeroBucketState = {
  awesomeVotes: boolean;
  visibleNucleusVotes: boolean;
  failedFittingVotes: boolean;
};

type PinnedNavigatorStyle = {
  left: number;
  top: number;
  width: number;
};

const GALAXY_PAGE_SIZE = 2500;
const CLASSIFICATION_PAGE_SIZE = 2500;
const EMPTY_RECORDS: AnalysisRecord[] = [];
const PINNED_NAVIGATOR_MARGIN = 16;

function getScrollParents(element: HTMLElement | null) {
  const scrollParents: Array<HTMLElement | Window> = [];
  let current: HTMLElement | null = element?.parentElement ?? null;

  while (current) {
    const computedStyle = window.getComputedStyle(current);
    const overflowY = computedStyle.overflowY;
    const isScrollableContainer =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

    if (isScrollableContainer) {
      scrollParents.push(current);
    }

    current = current.parentElement;
  }

  scrollParents.push(window);

  return scrollParents;
}

function describeScrollParent(scrollParent: HTMLElement | Window) {
  if (scrollParent instanceof Window) {
    return {
      type: "window",
      scrollTop: window.scrollY,
      innerHeight: window.innerHeight,
    };
  }

  return {
    type: "element",
    tagName: scrollParent.tagName,
    className: scrollParent.className,
    scrollTop: scrollParent.scrollTop,
    clientHeight: scrollParent.clientHeight,
    scrollHeight: scrollParent.scrollHeight,
    rectTop: scrollParent.getBoundingClientRect().top,
  };
}

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

function ZeroBucketToggle({
  hideZeroBucket,
  onToggle,
}: {
  hideZeroBucket: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {hideZeroBucket ? "Show 0 bucket" : "Hide 0 bucket"}
    </button>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-base font-semibold" aria-hidden="true">
      +
    </span>
  );
}

function CollapseAllIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-base font-semibold" aria-hidden="true">
      −
    </span>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
      <path d="M6.5 6 7.25 19A2 2 0 0 0 9.24 21h5.52a2 2 0 0 0 1.99-2L17.5 6" />
      <path d="M10 10.5v6" />
      <path d="M14 10.5v6" />
    </svg>
  );
}

function HistogramCard({
  title,
  description,
  data,
  zeroBucketHidden,
  onToggleZeroBucket,
}: {
  title: string;
  description: string;
  data: Array<{ key: string; label: string; count: number; metricLabel: string }>;
  zeroBucketHidden?: boolean;
  onToggleZeroBucket?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {onToggleZeroBucket && zeroBucketHidden !== undefined ? (
          <ZeroBucketToggle
            hideZeroBucket={zeroBucketHidden}
            onToggle={onToggleZeroBucket}
          />
        ) : null}
      </div>

      <AnalysisHistogram data={data} />
    </div>
  );
}

function VotePreviewRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value, index) => (
            <span
              key={`${label}-${index}-${value}`}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {index + 1}. {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">No votes loaded.</span>
        )}
      </div>
    </div>
  );
}

function AnalysisGalaxyCard({
  record,
  imageQuality,
  previewImageName,
  userPreferences,
  onOpenDetails,
}: {
  record: AnalysisRecord;
  imageQuality: "high" | "medium" | "low";
  previewImageName: string;
  userPreferences: UserPreferences | null | undefined;
  onOpenDetails: (record: AnalysisRecord) => void;
}) {
  const { galaxy, aggregate } = record;
  const lsbVotePreview = getVotePreview(record.votes, "lsb");
  const morphologyVotePreview = getVotePreview(record.votes, "morphology");

  return (
    <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:grid-cols-[180px_minmax(0,1fr)]">
      <div className="rounded-lg border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="overflow-hidden rounded-lg">
          <ImageViewer
            imageUrl={getImageUrl(galaxy.id, previewImageName, {
              quality: imageQuality,
            })}
            alt={`Preview of galaxy ${galaxy.id}`}
            preferences={userPreferences}
            defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Click the preview to open the zoom viewer.
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/classify/${galaxy.id}`}
                target="_blank"
                rel="noreferrer"
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

        <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/20 lg:grid-cols-2">
          <VotePreviewRow label="First 5 LSB votes" values={lsbVotePreview} />
          <VotePreviewRow label="First 5 morphology votes" values={morphologyVotePreview} />
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

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/classify/${galaxy.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Classify in new tab
          </Link>
          <button
            type="button"
            onClick={() => onOpenDetails(record)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            View classifications
          </button>
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
  const userPrefs = useQuery(api.users.getUserPreferences);
  const userDirectory = useQuery(api.statistics.classificationAnalysis.getUserDirectory);
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
  const [collapsedQueries, setCollapsedQueries] = useState<Record<string, boolean>>({});
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [hideZeroBuckets, setHideZeroBuckets] = useState<ZeroBucketState>({
    awesomeVotes: true,
    visibleNucleusVotes: true,
    failedFittingVotes: true,
  });
  const [isNavigatorPinned, setIsNavigatorPinned] = useState(false);
  const [navigatorHeight, setNavigatorHeight] = useState(0);
  const [pinnedNavigatorStyle, setPinnedNavigatorStyle] = useState<PinnedNavigatorStyle | null>(null);
  const cancelLoadRef = useRef(false);
  const navigatorDebugCountRef = useRef(0);
  const navigatorAnchorRef = useRef<HTMLDivElement | null>(null);
  const navigatorRef = useRef<HTMLDivElement | null>(null);

  const deferredQueries = useDeferredValue(queries);
  const deferredRecords = useDeferredValue(dataset?.records ?? EMPTY_RECORDS);
  const previewImageName = getPreviewImageName();
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
    setCollapsedQueries(
      Object.fromEntries(queries.map((query) => [query.id, true]))
    );
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

  const loadedAtLabel = formatLoadedAt(dataset?.loadedAt ?? null);
  const loadedRecords = dataset?.records ?? EMPTY_RECORDS;
  const hasDataset = dataset !== null;
  const pageReady = summary !== undefined;

  const renderNavigatorContent = useCallback(
    (isPinnedOverlay: boolean) => (
      <div
        className={
          isPinnedOverlay
            ? "rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
            : "rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {queries.map((query) => {
            const result = queryResults.get(query.id);

            return (
              <a
                key={`nav-${query.id}`}
                href={`#analysis-query-${query.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <span>{query.name || "Untitled query"}</span>
                {hasDataset && result ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                    {result.matchedCount.toLocaleString()}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      </div>
    ),
    [hasDataset, queries, queryResults]
  );

  useEffect(() => {
    const anchorElement = navigatorAnchorRef.current;
    const navigatorElement = navigatorRef.current;

    if (!anchorElement || !navigatorElement) {
      return undefined;
    }

    const scrollParents = getScrollParents(anchorElement);
    const nearestScrollParent = scrollParents[0] ?? window;

    const resizeObserver = new ResizeObserver(() => {
      const nextHeight = navigatorElement.getBoundingClientRect().height;
      setNavigatorHeight(nextHeight);
    });

    let rafId = 0;

    const updatePinnedNavigator = () => {
      rafId = 0;
      navigatorDebugCountRef.current += 1;
      const nextHeight = navigatorElement.getBoundingClientRect().height;
      setNavigatorHeight(nextHeight);

      const anchorRect = anchorElement.getBoundingClientRect();
      const targetTop = PINNED_NAVIGATOR_MARGIN;
      const shouldPin = anchorRect.top <= targetTop;

      if (!shouldPin) {
        setIsNavigatorPinned(false);
        setPinnedNavigatorStyle(null);
        return;
      }

      const nextPinnedStyle = {
        left: anchorRect.left,
        top: targetTop,
        width: anchorRect.width,
      };

      setIsNavigatorPinned(true);
      setPinnedNavigatorStyle(nextPinnedStyle);
    };

    const scheduleUpdatePinnedNavigator = () => {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(updatePinnedNavigator);
    };

    updatePinnedNavigator();
    resizeObserver.observe(navigatorElement);
    resizeObserver.observe(anchorElement);

    for (const scrollParent of scrollParents) {
      scrollParent.addEventListener("scroll", scheduleUpdatePinnedNavigator, {
        passive: true,
      });
    }
    window.addEventListener("resize", scheduleUpdatePinnedNavigator, { passive: true });

    return () => {
      resizeObserver.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }

      for (const scrollParent of scrollParents) {
        scrollParent.removeEventListener("scroll", scheduleUpdatePinnedNavigator);
      }
      window.removeEventListener("resize", scheduleUpdatePinnedNavigator);
    };
  }, [hasDataset, pageReady, queries.length]);

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
                This workspace pulls the raw galaxy and classification data in
                pages of up to 2,500 rows, then evaluates every histogram and
                query locally in your browser. Nothing runs automatically: click
                the button to fetch the dataset, then adjust or add as many query
                cards as you need.
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
                : "Fetching happens in paged requests so the page stays within Convex limits while still pulling large client-side analysis batches."}
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

      <AgreementExplanation />

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
        <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          <HistogramCard
            title="Agreement distribution"
            description="How concentrated the votes are across the classified catalog."
            data={visibleGlobalHistograms.agreement}
          />
          <HistogramCard
            title="Awesome-vote distribution"
            description="Which part of the catalog is attracting repeated follow-up interest. Zero is hidden by default so the tail is easier to inspect."
            data={visibleGlobalHistograms.awesomeVotes}
            zeroBucketHidden={hideZeroBuckets.awesomeVotes}
            onToggleZeroBucket={() => toggleZeroBucket("awesomeVotes")}
          />
          <HistogramCard
            title="Visible-nucleus vote distribution"
            description="How many galaxies received repeated visible-nucleus confirmations. Zero is hidden by default."
            data={visibleGlobalHistograms.visibleNucleusVotes}
            zeroBucketHidden={hideZeroBuckets.visibleNucleusVotes}
            onToggleZeroBucket={() => toggleZeroBucket("visibleNucleusVotes")}
          />
          <HistogramCard
            title="Failed-fitting vote distribution"
            description="How often galaxies accumulate failed-fitting classifications. Zero is hidden by default."
            data={visibleGlobalHistograms.failedFittingVotes}
            zeroBucketHidden={hideZeroBuckets.failedFittingVotes}
            onToggleZeroBucket={() => toggleZeroBucket("failedFittingVotes")}
          />
          <HistogramCard
            title="Catalog nucleus confirmations"
            description="Visible-nucleus confirmation rate for galaxies whose catalog row already says nucleus."
            data={visibleGlobalHistograms.nucleusConfirmation}
          />
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQueries((currentQueries) => [...currentQueries, createBlankAnalysisQuery()])}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Add query
          </button>
          <button
            type="button"
            onClick={collapseAllQueries}
            aria-label="Collapse all query cards"
            title="Collapse all query cards"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <CollapseAllIcon />
          </button>
          <button
            type="button"
            onClick={expandAllQueries}
            aria-label="Expand all query cards"
            title="Expand all query cards"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ExpandAllIcon />
          </button>
        </div>
      </div>

      <div
        ref={navigatorAnchorRef}
        style={{ minHeight: navigatorHeight > 0 ? `${navigatorHeight}px` : undefined }}
        className="relative z-20"
      >
        <div
          ref={navigatorRef}
          className={isNavigatorPinned ? "pointer-events-none opacity-0" : undefined}
          aria-hidden={isNavigatorPinned}
        >
          {renderNavigatorContent(false)}
        </div>
      </div>

      {isNavigatorPinned && pinnedNavigatorStyle
        ? createPortal(
            <div
              className="z-40"
              style={{
                position: "fixed",
                left: pinnedNavigatorStyle.left,
                top: pinnedNavigatorStyle.top,
                width: pinnedNavigatorStyle.width,
              }}
            >
              {renderNavigatorContent(true)}
            </div>,
            document.body
          )
        : null}

      <div className="space-y-6">
        {queries.map((query) => {
          const result = queryResults.get(query.id);
          const isCollapsed = collapsedQueries[query.id] === true;

          return (
            <section
              key={query.id}
              id={`analysis-query-${query.id}`}
              className="scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {query.name || "Untitled query"}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                      {isCollapsed ? "Collapsed" : "Expanded"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {query.description.trim() || "No description added yet."}
                  </p>
                  {hasDataset && result ? (
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                        {result.matchedCount.toLocaleString()} matches
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        Avg agreement {formatPercent(result.averageAgreement)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {result.totalMatchingClassifications.toLocaleString()} classifications
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => toggleQueryCollapsed(query.id)}
                    aria-label={isCollapsed ? "Expand query card" : "Collapse query card"}
                    title={isCollapsed ? "Expand query card" : "Collapse query card"}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <span className="mr-2">
                      <CollapseIcon collapsed={isCollapsed} />
                    </span>
                    {isCollapsed ? "Expand" : "Minimize"}
                  </button>
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
                    aria-label="Remove query card"
                    title="Remove query card"
                    className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
                  >
                    <span className="mr-2">
                      <TrashIcon />
                    </span>
                    Remove
                  </button>
                </div>
              </div>

              {!isCollapsed ? (
                <>
                  <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
                          Description
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
                          placeholder="Optional note about what this card is trying to surface."
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
                          {query.description.trim() || "No description added yet."}
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
                            userPreferences={userPrefs}
                            onOpenDetails={setSelectedRecord}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                        No galaxies matched this query. Try relaxing one or more vote thresholds.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
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