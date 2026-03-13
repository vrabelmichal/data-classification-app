import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  ClassificationBreakdownsSection,
  PaperCatalogSection,
  ProgressSection,
  SummaryCardsSection,
  ThroughputSection,
  TopClassifiersSection,
} from "./OverviewSections";
import {
  CachedOverviewPayload,
  ClassificationStatsPayload,
  RecencyPayload,
  TargetProgressMetrics,
  TargetProgressPayload,
  Totals,
  TopClassifiersPayload,
  TotalsAndPapersPayload,
} from "./types";
import { usePaperClassificationStats } from "../../../hooks/usePaperClassificationStats";

const DEFAULT_TARGET_CLASSIFICATIONS = 3;
const MAX_TARGET_CLASSIFICATIONS = 25;
const OVERVIEW_BUCKET_COUNT = MAX_TARGET_CLASSIFICATIONS + 1;

type OverviewSettings = {
  overviewDefaultPaper?: string | null;
  showAwesomeFlag?: boolean;
  showValidRedshift?: boolean;
  showVisibleNucleus?: boolean;
  failedFittingMode?: "checkbox" | "legacy";
};

type OverviewRouteProps = {
  systemSettings: OverviewSettings;
  isAdmin: boolean;
};

type SharedSnapshotWritePayload = {
  catalog: {
    availablePapers: string[];
    paperCounts: TotalsAndPapersPayload["paperCounts"];
  };
  recency: RecencyPayload["recency"];
  topClassifiers: TopClassifiersPayload["topClassifiers"];
  classificationStats: ClassificationStatsPayload["classificationStats"];
};

type ScopeSnapshotWritePayload = {
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
};

type DashboardProps = {
  mode: "live" | "cached";
  adminSwitchTo?: string;
  adminSwitchLabel?: string;
  scopeStatusNotice?: ReactNode;
  catalogUpdatedAt?: number | null;
  summaryUpdatedAt?: number | null;
  progressUpdatedAt?: number | null;
  throughputUpdatedAt?: number | null;
  topClassifiersUpdatedAt?: number | null;
  classificationStatsUpdatedAt?: number | null;
  availablePapers: string[];
  paperCounts: TotalsAndPapersPayload["paperCounts"];
  paperFilter: TotalsAndPapersPayload["paperFilter"];
  selectedPaper: string | undefined;
  onSelectPaper: (paper: string | undefined) => void;
  isCatalogLoading?: boolean;
  isPaperStatsLoading?: boolean;
  totals?: Totals;
  targetProgress?: TargetProgressMetrics;
  targetClassifications: number;
  onTargetClassificationsChange: (nextValue: number) => void;
  activeClassifiers?: number;
  recency?: { classificationsLast24h: number; classificationsLast7d: number; dailyCounts?: Array<{ start: number; end: number; count: number }> };
  topClassifiers?: TopClassifiersPayload["topClassifiers"];
  flagItems: Array<{ label: string; value: number; color: string; icon: string }>;
  lsbItems: Array<{ label: string; value: number; color: string; icon: string }>;
  morphologyItems: Array<{ label: string; value: number; color: string; icon: string }>;
  totalClassificationsForBreakdowns: number;
  breakdownLoading: boolean;
};

function sanitizeTargetClassifications(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TARGET_CLASSIFICATIONS;
  }

  return Math.min(MAX_TARGET_CLASSIFICATIONS, Math.max(1, Math.floor(parsed)));
}

function paperLabel(value: string) {
  return value === "" ? "Unassigned" : value;
}

function buildOverviewModeLink(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function normalizeClassificationBuckets(rawBuckets: number[] | undefined) {
  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, (_, index) => {
    const value = rawBuckets?.[index] ?? 0;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });

  if ((rawBuckets?.length ?? 0) > OVERVIEW_BUCKET_COUNT) {
    for (let index = OVERVIEW_BUCKET_COUNT; index < (rawBuckets?.length ?? 0); index += 1) {
      const value = rawBuckets?.[index] ?? 0;
      if (Number.isFinite(value) && value > 0) {
        buckets[OVERVIEW_BUCKET_COUNT - 1] += Math.floor(value);
      }
    }
  }

  return buckets;
}

function buildClassificationBucketsFromHistogram(classificationHistogram: Record<string, number>) {
  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, () => 0);

  for (const [classificationCountKey, galaxyCount] of Object.entries(classificationHistogram)) {
    const classificationCount = Number(classificationCountKey);
    if (!Number.isFinite(classificationCount) || galaxyCount <= 0) {
      continue;
    }

    if (classificationCount >= MAX_TARGET_CLASSIFICATIONS) {
      buckets[OVERVIEW_BUCKET_COUNT - 1] += galaxyCount;
      continue;
    }

    buckets[Math.max(0, Math.floor(classificationCount))] += galaxyCount;
  }

  return buckets;
}

function deriveTargetProgressFromBuckets({
  targetClassifications,
  totalGalaxies,
  classifiedGalaxies,
  totalClassifications,
  classificationBuckets,
}: {
  targetClassifications: number;
  totalGalaxies: number;
  classifiedGalaxies: number;
  totalClassifications: number;
  classificationBuckets: number[];
}): TargetProgressMetrics {
  const buckets = normalizeClassificationBuckets(classificationBuckets);
  const galaxiesAtTarget = buckets
    .slice(targetClassifications)
    .reduce((sum, count) => sum + count, 0);
  const galaxiesWithMultipleClassifications = buckets
    .slice(2)
    .reduce((sum, count) => sum + count, 0);
  const remainingClassificationsToTarget = buckets
    .slice(0, targetClassifications)
    .reduce(
      (sum, count, classificationCount) =>
        sum + (targetClassifications - classificationCount) * count,
      0,
    );
  const targetClassificationsTotal = totalGalaxies * targetClassifications;

  return {
    targetClassifications,
    targetClassificationsTotal,
    targetCompletionPercent:
      targetClassificationsTotal > 0
        ? (totalClassifications / targetClassificationsTotal) * 100
        : 0,
    galaxiesAtTarget,
    galaxiesBelowTarget: Math.max(totalGalaxies - galaxiesAtTarget, 0),
    galaxiesWithMultipleClassifications,
    repeatClassifications: Math.max(totalClassifications - classifiedGalaxies, 0),
    remainingClassificationsToTarget,
  };
}

function useOverviewFilters(systemSettings: OverviewSettings) {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultOverviewPaper = systemSettings.overviewDefaultPaper ?? null;

  const hasParamInUrl = searchParams.has("paper");
  const rawParam = searchParams.get("paper");
  const selectedPaper: string | undefined = !hasParamInUrl
    ? (defaultOverviewPaper !== null ? defaultOverviewPaper : undefined)
    : rawParam === "__all__" ? undefined
    : rawParam ?? undefined;
  const targetClassifications = sanitizeTargetClassifications(searchParams.get("target"));

  const updateOverviewSearchParams = (updateFn: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      updateFn(next);
      return next;
    }, { replace: true, preventScrollReset: true });
  };

  const handleSelectPaper = (paper: string | undefined) => {
    updateOverviewSearchParams((next) => {
      if (paper === undefined) {
        if (defaultOverviewPaper !== null) {
          next.set("paper", "__all__");
        } else {
          next.delete("paper");
        }
        return;
      }

      next.set("paper", paper);
    });
  };

  const handleTargetClassificationsChange = (nextValue: number) => {
    updateOverviewSearchParams((next) => {
      next.set("target", String(sanitizeTargetClassifications(nextValue)));
    });
  };

  return {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  };
}

function useDailySeries(recency: RecencyPayload["recency"] | undefined) {
  return useMemo(() => {
    if (!recency?.dailyCounts) return [];
    return recency.dailyCounts.map((entry) => ({
      label: new Date(entry.start).toLocaleDateString(),
      count: entry.count,
    }));
  }, [recency]);
}

function useClassificationBreakdownItems(
  systemSettings: OverviewSettings,
  classificationStats: ClassificationStatsPayload["classificationStats"] | undefined,
  totals: Totals | undefined,
) {
  return useMemo(() => {
    const showAwesomeFlag = systemSettings.showAwesomeFlag ?? true;
    const showValidRedshift = systemSettings.showValidRedshift ?? true;
    const showVisibleNucleus = systemSettings.showVisibleNucleus ?? true;
    const failedFittingMode = systemSettings.failedFittingMode ?? "checkbox";
    const showFailedFitting = failedFittingMode === "checkbox";

    const flagItems: Array<{ label: string; value: number; color: string; icon: string }> = [];
    if (showAwesomeFlag && classificationStats?.flags) {
      flagItems.push({ label: "Awesome", value: classificationStats.flags.awesome || 0, color: "bg-yellow-500", icon: "⭐" });
    }
    if (showVisibleNucleus && classificationStats?.flags) {
      flagItems.push({ label: "Visible Nucleus", value: classificationStats.flags.visibleNucleus || 0, color: "bg-orange-500", icon: "🎯" });
    }
    if (showValidRedshift && classificationStats?.flags) {
      flagItems.push({ label: "Valid Redshift", value: classificationStats.flags.validRedshift || 0, color: "bg-red-500", icon: "🔴" });
    }
    if (showFailedFitting && classificationStats?.flags) {
      flagItems.push({ label: "Failed Fitting", value: classificationStats.flags.failedFitting || 0, color: "bg-rose-500", icon: "❌" });
    }

    const lsbItems = classificationStats?.lsbClass ? [
      { label: "Non-LSB", value: classificationStats.lsbClass.nonLSB || 0, color: "bg-gray-500", icon: "⚪" },
      { label: "LSB", value: classificationStats.lsbClass.LSB || 0, color: "bg-green-500", icon: "🟢" },
    ] : [];

    const morphologyItems = classificationStats?.morphology ? [
      { label: "Featureless", value: classificationStats.morphology.featureless || 0, color: "bg-gray-500", icon: "⚫" },
      { label: "Irregular", value: classificationStats.morphology.irregular || 0, color: "bg-yellow-500", icon: "⚡" },
      { label: "Spiral", value: classificationStats.morphology.spiral || 0, color: "bg-blue-500", icon: "🌀" },
      { label: "Elliptical", value: classificationStats.morphology.elliptical || 0, color: "bg-purple-500", icon: "⭕" },
    ] : [];

    const totalClassificationsForBreakdowns = classificationStats?.lsbClass
      ? (classificationStats.lsbClass.nonLSB + classificationStats.lsbClass.LSB)
      : (totals?.totalClassifications || 0);

    return {
      flagItems,
      lsbItems,
      morphologyItems,
      totalClassificationsForBreakdowns,
    };
  }, [classificationStats, systemSettings.failedFittingMode, systemSettings.showAwesomeFlag, systemSettings.showValidRedshift, systemSettings.showVisibleNucleus, totals?.totalClassifications]);
}

function derivePaperTargetProgress({
  targetClassifications,
  totalGalaxies,
  processedGalaxies,
  classifiedGalaxies,
  totalClassifications,
  classificationHistogram,
}: {
  targetClassifications: number;
  totalGalaxies: number;
  processedGalaxies: number;
  classifiedGalaxies: number;
  totalClassifications: number;
  classificationHistogram: Record<string, number>;
}): TargetProgressMetrics {
  let galaxiesAtTarget = 0;
  let galaxiesWithMultipleClassifications = 0;
  let remainingClassificationsToTarget = 0;

  for (const [classificationCountKey, galaxyCount] of Object.entries(classificationHistogram)) {
    const classificationCount = Number(classificationCountKey);
    if (!Number.isFinite(classificationCount) || galaxyCount <= 0) {
      continue;
    }

    if (classificationCount >= 2) {
      galaxiesWithMultipleClassifications += galaxyCount;
    }

    if (classificationCount >= targetClassifications) {
      galaxiesAtTarget += galaxyCount;
      continue;
    }

    remainingClassificationsToTarget += (targetClassifications - classificationCount) * galaxyCount;
  }

  const safeProcessedGalaxies = Math.min(processedGalaxies, totalGalaxies);
  const unprocessedGalaxies = Math.max(totalGalaxies - safeProcessedGalaxies, 0);
  const targetClassificationsTotal = totalGalaxies * targetClassifications;

  return {
    targetClassifications,
    targetClassificationsTotal,
    targetCompletionPercent:
      targetClassificationsTotal > 0
        ? (totalClassifications / targetClassificationsTotal) * 100
        : 0,
    galaxiesAtTarget,
    galaxiesBelowTarget: Math.max(totalGalaxies - galaxiesAtTarget, 0),
    galaxiesWithMultipleClassifications,
    repeatClassifications: Math.max(totalClassifications - classifiedGalaxies, 0),
    remainingClassificationsToTarget:
      remainingClassificationsToTarget + unprocessedGalaxies * targetClassifications,
  };
}

function OverviewDashboard({
  mode,
  adminSwitchTo,
  adminSwitchLabel,
  scopeStatusNotice,
  catalogUpdatedAt,
  summaryUpdatedAt,
  progressUpdatedAt,
  throughputUpdatedAt,
  topClassifiersUpdatedAt,
  classificationStatsUpdatedAt,
  availablePapers,
  paperCounts,
  paperFilter,
  selectedPaper,
  onSelectPaper,
  isCatalogLoading = false,
  isPaperStatsLoading = false,
  totals,
  targetProgress,
  targetClassifications,
  onTargetClassificationsChange,
  activeClassifiers,
  recency,
  topClassifiers,
  flagItems,
  lsbItems,
  morphologyItems,
  totalClassificationsForBreakdowns,
  breakdownLoading,
}: DashboardProps) {
  const dailySeries = useDailySeries(recency as RecencyPayload["recency"] | undefined);
  const throughputRecency = recency
    ? {
        classificationsLast24h: recency.classificationsLast24h,
        classificationsLast7d: recency.classificationsLast7d,
      }
    : undefined;

  return (
    <div className="space-y-8">
      <ClassificationBreakdownsSection
        lsbItems={lsbItems}
        morphologyItems={morphologyItems}
        flagItems={flagItems}
        totalClassifications={totalClassificationsForBreakdowns}
        loading={breakdownLoading}
        selectedPaper={selectedPaper}
        updatedAt={classificationStatsUpdatedAt}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ThroughputSection
          recency={throughputRecency}
          dailySeries={dailySeries}
          selectedPaper={selectedPaper}
          updatedAt={throughputUpdatedAt}
        />
        <TopClassifiersSection
          topClassifiers={topClassifiers}
          selectedPaper={selectedPaper}
          updatedAt={topClassifiersUpdatedAt}
        />
      </div>

      <PaperCatalogSection
        availablePapers={availablePapers}
        paperCounts={paperCounts}
        paperFilter={paperFilter}
        selectedPaper={selectedPaper}
        onSelectPaper={onSelectPaper}
        isLoading={isCatalogLoading}
        isPaperStatsLoading={isPaperStatsLoading}
        mode={mode}
        updatedAt={catalogUpdatedAt}
      />

      {scopeStatusNotice}

      <SummaryCardsSection
        totals={totals}
        selectedPaper={selectedPaper}
        isPaperStatsLoading={isPaperStatsLoading}
        mode={mode}
        updatedAt={summaryUpdatedAt}
      />

      <ProgressSection
        totals={totals}
        targetProgress={targetProgress}
        targetClassifications={targetClassifications}
        onTargetClassificationsChange={onTargetClassificationsChange}
        activeClassifiers={activeClassifiers}
        selectedPaper={selectedPaper}
        isPaperStatsLoading={isPaperStatsLoading}
        mode={mode}
        updatedAt={progressUpdatedAt}
      />

      {adminSwitchTo && adminSwitchLabel && (
        <div className="flex justify-end pt-1">
          <Link
            to={adminSwitchTo}
            className="inline-flex items-center rounded-full border border-gray-200/80 bg-gray-50/70 px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700/80 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {adminSwitchLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

export function CachedOverviewTab({ systemSettings, isAdmin }: OverviewRouteProps) {
  const {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  } = useOverviewFilters(systemSettings);

  const cachedData = useQuery(
    api.statistics.labelingOverview.cache.get,
    { paper: selectedPaper },
  ) as CachedOverviewPayload | undefined;

  const currentScopeKey = selectedPaper ?? "__all__";
  const latestSharedSnapshotRef = useRef<CachedOverviewPayload["sharedSnapshot"] | null>(null);
  const latestScopeSnapshotByKeyRef = useRef<Record<string, NonNullable<CachedOverviewPayload["scopeSnapshot"]>>>({});

  useEffect(() => {
    if (cachedData?.sharedSnapshot) {
      latestSharedSnapshotRef.current = cachedData.sharedSnapshot;
    }

    if (cachedData?.scopeSnapshot) {
      latestScopeSnapshotByKeyRef.current[currentScopeKey] = cachedData.scopeSnapshot;
    }
  }, [cachedData, currentScopeKey]);

  const sharedSnapshot = cachedData?.sharedSnapshot ?? latestSharedSnapshotRef.current ?? null;
  const resolvedScopeSnapshot = latestScopeSnapshotByKeyRef.current[currentScopeKey] ?? null;
  const scopeSnapshot = cachedData?.scopeSnapshot ?? resolvedScopeSnapshot;
  const sharedSnapshotReady = Boolean(
    sharedSnapshot?.catalog
      && sharedSnapshot.recency
      && sharedSnapshot.topClassifiers
      && sharedSnapshot.classificationStats,
  );
  const isScopeLoading = !scopeSnapshot && cachedData === undefined;
  const isScopePending = !scopeSnapshot && cachedData !== undefined;
  const liveSwitchTo = isAdmin
    ? buildOverviewModeLink("/statistics/overview-live", searchParams)
    : undefined;

  const paperFilter = useMemo(() => {
    if (selectedPaper === undefined) {
      return null;
    }

    const livePaperFilter = cachedData?.paperFilter;
    if (livePaperFilter && livePaperFilter.paper === selectedPaper) {
      return livePaperFilter;
    }

    const counts = sharedSnapshot?.catalog?.paperCounts[selectedPaper];
    if (!counts) {
      return null;
    }

    return {
      paper: selectedPaper,
      galaxies: counts.total,
      blacklisted: counts.blacklisted,
      adjusted: counts.adjusted,
    };
  }, [cachedData?.paperFilter, selectedPaper, sharedSnapshot?.catalog?.paperCounts]);

  const targetProgress = useMemo(() => {
    if (!scopeSnapshot?.totals) {
      return undefined;
    }

    return deriveTargetProgressFromBuckets({
      targetClassifications,
      totalGalaxies: scopeSnapshot.totals.galaxies,
      classifiedGalaxies: scopeSnapshot.totals.classifiedGalaxies,
      totalClassifications: scopeSnapshot.totals.totalClassifications,
      classificationBuckets: scopeSnapshot.classificationBuckets,
    });
  }, [scopeSnapshot, targetClassifications]);

  const { flagItems, lsbItems, morphologyItems, totalClassificationsForBreakdowns } =
    useClassificationBreakdownItems(
      systemSettings,
      sharedSnapshot?.classificationStats,
      scopeSnapshot?.totals,
    );

  if (!sharedSnapshotReady) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {cachedData === undefined
              ? "Loading cached overview data…"
              : selectedPaper === undefined
                ? "Cached overview data is not available yet. Open the live overview as an admin or wait for the scheduled refresh to populate it."
                : `Cached snapshot for ${paperLabel(selectedPaper)} is not available yet. Open the live overview as an admin or wait for the scheduled refresh to populate it.`}
          </p>
          {liveSwitchTo && (
            <Link
              to={liveSwitchTo}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            >
              Open live overview
            </Link>
          )}
        </div>
      </div>
    );
  }

  const scopeStatusNotice = isScopePending ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {selectedPaper === undefined
          ? "Cached overview totals are not available yet. Open the live overview as an admin or wait for the scheduled refresh to populate them."
          : `Cached snapshot for ${paperLabel(selectedPaper)} is not available yet. Open the live overview as an admin or wait for the scheduled refresh to populate it.`}
      </p>
      {liveSwitchTo && (
        <Link
          to={liveSwitchTo}
          className="rounded-full border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:border-amber-400 hover:bg-white dark:border-amber-700/80 dark:bg-transparent dark:text-amber-200 dark:hover:border-amber-600 dark:hover:bg-amber-950/30"
        >
          Open live overview
        </Link>
      )}
    </div>
  ) : undefined;

  return (
    <OverviewDashboard
      mode="cached"
      adminSwitchTo={liveSwitchTo}
      adminSwitchLabel="Open live overview"
      scopeStatusNotice={scopeStatusNotice}
      catalogUpdatedAt={sharedSnapshot?.catalogUpdatedAt}
      summaryUpdatedAt={scopeSnapshot?.updatedAt}
      progressUpdatedAt={scopeSnapshot?.updatedAt}
      throughputUpdatedAt={sharedSnapshot?.recencyUpdatedAt}
      topClassifiersUpdatedAt={sharedSnapshot?.topClassifiersUpdatedAt}
      classificationStatsUpdatedAt={sharedSnapshot?.classificationStatsUpdatedAt}
      availablePapers={sharedSnapshot?.catalog?.availablePapers ?? []}
      paperCounts={sharedSnapshot?.catalog?.paperCounts ?? {}}
      paperFilter={paperFilter}
      selectedPaper={selectedPaper}
      onSelectPaper={handleSelectPaper}
      isPaperStatsLoading={selectedPaper !== undefined && (isScopeLoading || isScopePending)}
      totals={scopeSnapshot?.totals}
      targetProgress={targetProgress}
      targetClassifications={targetClassifications}
      onTargetClassificationsChange={handleTargetClassificationsChange}
      activeClassifiers={sharedSnapshot?.recency?.activeClassifiers}
      recency={sharedSnapshot?.recency}
      topClassifiers={sharedSnapshot?.topClassifiers}
      flagItems={flagItems}
      lsbItems={lsbItems}
      morphologyItems={morphologyItems}
      totalClassificationsForBreakdowns={totalClassificationsForBreakdowns}
      breakdownLoading={false}
    />
  );
}

export function LiveOverviewTab({ systemSettings, isAdmin }: OverviewRouteProps) {
  const {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  } = useOverviewFilters(systemSettings);

  const totalsAndPapers = useQuery(
    api.statistics.labelingOverview.totalsAndPapers.get,
    { paper: selectedPaper },
  ) as TotalsAndPapersPayload | undefined;
  const recencyData = useQuery(api.statistics.labelingOverview.recency.get) as RecencyPayload | undefined;
  const topClassifiersData = useQuery(api.statistics.labelingOverview.topClassifiers.get) as TopClassifiersPayload | undefined;
  const classificationStatsData = useQuery(api.statistics.labelingOverview.classificationStats.get) as ClassificationStatsPayload | undefined;
  const globalTargetProgressData = useQuery(
    api.statistics.labelingOverview.totalsAndPapers.getTargetProgress,
    selectedPaper === undefined ? { targetClassifications } : "skip",
  ) as TargetProgressPayload | undefined;

  const saveSharedSnapshotFromLive = useMutation(
    api.statistics.labelingOverview.cache.saveSharedSnapshotFromLive,
  );
  const saveScopeSnapshotFromLive = useMutation(
    api.statistics.labelingOverview.cache.saveScopeSnapshotFromLive,
  );

  const latestCatalogRef = useRef<Pick<TotalsAndPapersPayload, "availablePapers" | "paperCounts"> | undefined>(undefined);
  const latestGlobalTotalsRef = useRef<Totals | undefined>(undefined);
  const lastSharedSignatureRef = useRef<string | null>(null);
  const lastBatchKeyRef = useRef<string | null>(null);
  const lastScopeSignatureByKeyRef = useRef<Record<string, string>>({});
  const lastSharedLoadedSignatureRef = useRef<string | null>(null);
  const lastScopeLoadedSignatureByKeyRef = useRef<Record<string, string>>({});

  const [liveScopeLoadedAt, setLiveScopeLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    if (totalsAndPapers !== undefined) {
      latestCatalogRef.current = {
        availablePapers: totalsAndPapers.availablePapers,
        paperCounts: totalsAndPapers.paperCounts,
      };

      if (selectedPaper === undefined) {
        latestGlobalTotalsRef.current = totalsAndPapers.totals;
      }
    }
  }, [selectedPaper, totalsAndPapers]);

  const catalogData = totalsAndPapers !== undefined
    ? {
        availablePapers: totalsAndPapers.availablePapers,
        paperCounts: totalsAndPapers.paperCounts,
      }
    : latestCatalogRef.current;

  const paperClassStats = usePaperClassificationStats(selectedPaper);
  const isPaperStatsLoading = selectedPaper !== undefined && paperClassStats.isLoading;
  const globalTotals = useMemo(
    () => selectedPaper === undefined
      ? (totalsAndPapers?.totals ?? latestGlobalTotalsRef.current)
      : latestGlobalTotalsRef.current,
    [selectedPaper, totalsAndPapers],
  );

  const availablePapers = catalogData?.availablePapers ?? [];
  const paperCounts = catalogData?.paperCounts ?? {};
  const paperFilter = useMemo(() => {
    if (selectedPaper === undefined) return null;

    const livePaperFilter = totalsAndPapers?.paperFilter;
    if (livePaperFilter && livePaperFilter.paper === selectedPaper) {
      return livePaperFilter;
    }

    const counts = paperCounts[selectedPaper];
    if (!counts) return null;

    return {
      paper: selectedPaper,
      galaxies: counts.total,
      blacklisted: counts.blacklisted,
      adjusted: counts.adjusted,
    };
  }, [paperCounts, selectedPaper, totalsAndPapers?.paperFilter]);

  const totals: Totals | undefined = useMemo(() => {
    if (selectedPaper === undefined) {
      return globalTotals;
    }

    const baseCounts = paperFilter;
    if (!baseCounts) return undefined;

    const classifiedGalaxies = paperClassStats.classifiedGalaxies;
    const totalClassifications = paperClassStats.totalClassifications;
    const unclassifiedGalaxies = Math.max(baseCounts.galaxies - classifiedGalaxies, 0);
    const progress = baseCounts.galaxies > 0 ? (classifiedGalaxies / baseCounts.galaxies) * 100 : 0;
    const avgClassificationsPerGalaxy =
      baseCounts.galaxies > 0 ? totalClassifications / baseCounts.galaxies : 0;
    return {
      galaxies: baseCounts.galaxies,
      classifiedGalaxies,
      unclassifiedGalaxies,
      totalClassifications,
      progress,
      avgClassificationsPerGalaxy,
    };
  }, [globalTotals, paperClassStats, paperFilter, selectedPaper]);

  const recency = recencyData?.recency;
  const classificationStats = classificationStatsData?.classificationStats;
  const topClassifiers = topClassifiersData?.topClassifiers;
  const targetProgress = useMemo(() => {
    if (!totals) {
      return undefined;
    }

    if (selectedPaper === undefined) {
      return globalTargetProgressData?.targetProgress;
    }

    return derivePaperTargetProgress({
      targetClassifications,
      totalGalaxies: totals.galaxies,
      processedGalaxies: paperClassStats.processedGalaxies,
      classifiedGalaxies: paperClassStats.classifiedGalaxies,
      totalClassifications: paperClassStats.totalClassifications,
      classificationHistogram: paperClassStats.classificationHistogram,
    });
  }, [globalTargetProgressData?.targetProgress, paperClassStats, selectedPaper, targetClassifications, totals]);

  const sharedSnapshotPayload = useMemo<SharedSnapshotWritePayload | null>(() => {
    if (!totalsAndPapers || !recencyData || !topClassifiersData || !classificationStatsData) {
      return null;
    }

    return {
      catalog: {
        availablePapers: totalsAndPapers.availablePapers,
        paperCounts: totalsAndPapers.paperCounts,
      },
      recency: recencyData.recency,
      topClassifiers: topClassifiersData.topClassifiers,
      classificationStats: classificationStatsData.classificationStats,
    };
  }, [classificationStatsData, recencyData, topClassifiersData, totalsAndPapers]);

  const scopeSnapshotPayload = useMemo<ScopeSnapshotWritePayload | null>(() => {
    if (!totals) {
      return null;
    }

    if (selectedPaper === undefined) {
      if (!globalTargetProgressData?.classificationBuckets) {
        return null;
      }

      return {
        paper: null,
        totals,
        classificationBuckets: globalTargetProgressData.classificationBuckets,
      };
    }

    if (paperClassStats.isLoading) {
      return null;
    }

    return {
      paper: selectedPaper,
      totals,
      classificationBuckets: buildClassificationBucketsFromHistogram(
        paperClassStats.classificationHistogram,
      ),
    };
  }, [globalTargetProgressData?.classificationBuckets, paperClassStats.classificationHistogram, paperClassStats.isLoading, selectedPaper, totals]);

  const sharedSignature = useMemo(
    () => (sharedSnapshotPayload ? JSON.stringify(sharedSnapshotPayload) : null),
    [sharedSnapshotPayload],
  );
  const scopeSignature = useMemo(
    () => (scopeSnapshotPayload ? JSON.stringify(scopeSnapshotPayload) : null),
    [scopeSnapshotPayload],
  );
  const currentScopeKey = selectedPaper ?? "__all__";

  useEffect(() => {
    setLiveScopeLoadedAt(null);
  }, [currentScopeKey]);

  useEffect(() => {
    if (!sharedSignature || sharedSignature === lastSharedLoadedSignatureRef.current) {
      return;
    }

    lastSharedLoadedSignatureRef.current = sharedSignature;
  }, [sharedSignature]);

  useEffect(() => {
    if (!scopeSignature || scopeSignature === lastScopeLoadedSignatureByKeyRef.current[currentScopeKey]) {
      return;
    }

    lastScopeLoadedSignatureByKeyRef.current[currentScopeKey] = scopeSignature;
    setLiveScopeLoadedAt(Date.now());
  }, [currentScopeKey, scopeSignature]);

  useEffect(() => {
    if (!sharedSnapshotPayload || !scopeSnapshotPayload || !sharedSignature || !scopeSignature) {
      return;
    }

    const batchKey = `${currentScopeKey}:${sharedSignature}:${scopeSignature}`;
    if (batchKey === lastBatchKeyRef.current) {
      return;
    }

    let cancelled = false;

    const syncCachedOverview = async () => {
      try {
        if (sharedSignature !== lastSharedSignatureRef.current) {
          await saveSharedSnapshotFromLive(sharedSnapshotPayload);
          if (cancelled) return;
          lastSharedSignatureRef.current = sharedSignature;
        }

        if (scopeSignature !== lastScopeSignatureByKeyRef.current[currentScopeKey]) {
          await saveScopeSnapshotFromLive(scopeSnapshotPayload);
          if (cancelled) return;
          lastScopeSignatureByKeyRef.current[currentScopeKey] = scopeSignature;
        }

        lastBatchKeyRef.current = batchKey;
        toast.success(
          selectedPaper === undefined
            ? "Live overview loaded and cached overview updated."
            : `Live overview loaded and cached snapshot for ${paperLabel(selectedPaper)} updated.`,
        );
      } catch (error) {
        if (cancelled) return;
        toast.error("Live overview loaded, but updating the cached overview failed.");
      }
    };

    void syncCachedOverview();

    return () => {
      cancelled = true;
    };
  }, [currentScopeKey, saveScopeSnapshotFromLive, saveSharedSnapshotFromLive, scopeSignature, scopeSnapshotPayload, selectedPaper, sharedSignature, sharedSnapshotPayload]);

  const liveSwitchTo = isAdmin
    ? buildOverviewModeLink("/statistics/overview", searchParams)
    : undefined;

  const { flagItems, lsbItems, morphologyItems, totalClassificationsForBreakdowns } = useClassificationBreakdownItems(
    systemSettings,
    classificationStats,
    totals,
  );

  return (
    <OverviewDashboard
      mode="live"
      adminSwitchTo={liveSwitchTo}
      adminSwitchLabel="Open cached overview"
      catalogUpdatedAt={totalsAndPapers?.timestamp}
      summaryUpdatedAt={selectedPaper === undefined ? totalsAndPapers?.timestamp : liveScopeLoadedAt}
      progressUpdatedAt={selectedPaper === undefined ? (globalTargetProgressData?.timestamp ?? totalsAndPapers?.timestamp) : liveScopeLoadedAt}
      throughputUpdatedAt={recencyData?.timestamp}
      topClassifiersUpdatedAt={topClassifiersData?.timestamp}
      classificationStatsUpdatedAt={classificationStatsData?.timestamp}
      availablePapers={availablePapers}
      paperCounts={paperCounts}
      paperFilter={paperFilter}
      selectedPaper={selectedPaper}
      onSelectPaper={handleSelectPaper}
      isCatalogLoading={catalogData === undefined}
      isPaperStatsLoading={isPaperStatsLoading}
      totals={totals}
      targetProgress={targetProgress}
      targetClassifications={targetClassifications}
      onTargetClassificationsChange={handleTargetClassificationsChange}
      activeClassifiers={recency?.activeClassifiers}
      recency={recency}
      topClassifiers={topClassifiers}
      flagItems={flagItems}
      lsbItems={lsbItems}
      morphologyItems={morphologyItems}
      totalClassificationsForBreakdowns={totalClassificationsForBreakdowns}
      breakdownLoading={classificationStats === undefined}
    />
  );
}
