import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  PaperCatalogSection,
  ProgressSection,
  SummaryCardsSection,
} from "../overview/OverviewSections";
import { LoadingPanel } from "../overview/shared";
import type {
  PaperCount,
  PaperFilter,
  TargetProgressMetrics,
  Totals,
} from "../overview/types";
import { cn } from "../../../lib/utils";
import { getRoleLabel } from "../../../lib/permissions";

const DEFAULT_TARGET_CLASSIFICATIONS = 3;
const MAX_TARGET_CLASSIFICATIONS = 25;
const GLOBAL_SCOPE_KEY = "__all__";

type CoverageSystemSettings = {
  paperAssignmentCoverageDefaultPaper?: string | null;
};

type UserDirectoryEntry = {
  userId: string;
  name?: string | null;
  role: string;
  isActive: boolean;
};

type ScopeSnapshot = {
  scopeKey: string;
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
  activeClassifiers: number;
  userAssignmentCounts: Array<{ userId: string; counts: number[] }>;
  unassignedCounts: number[];
  updatedAt: number;
};

type SharedSnapshot = {
  catalog: {
    availablePapers: string[];
    paperCounts: Record<string, PaperCount>;
  };
  userDirectory: UserDirectoryEntry[];
  updatedAt: number;
};

type CachedCoveragePayload = {
  sharedSnapshot: SharedSnapshot | null;
  scopeSnapshots: ScopeSnapshot[];
};

type LiveCoveragePayload = {
  sharedSnapshot: SharedSnapshot;
  scopeSnapshots: ScopeSnapshot[];
};

type RouteProps = {
  systemSettings: CoverageSystemSettings;
};

type DashboardProps = {
  mode: "cached" | "live";
  sharedSnapshot: SharedSnapshot;
  scopeSnapshots: ScopeSnapshot[];
  defaultPaper: string | null | undefined;
};

type AssignmentRow = {
  key: string;
  label: string;
  roleLabel: string;
  count: number;
  isActive?: boolean;
  isSpecial?: boolean;
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

function buildModeLink(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function useCoverageFilters(defaultPaper: string | null | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPaperParam = searchParams.has("paper");
  const rawPaper = searchParams.get("paper");
  const selectedPaper = !hasPaperParam
    ? (defaultPaper !== null ? defaultPaper : undefined)
    : rawPaper === null || rawPaper === "__all__"
      ? undefined
      : rawPaper;
  const targetClassifications = sanitizeTargetClassifications(searchParams.get("target"));

  const updateSearchParams = (updateFn: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      updateFn(next);
      return next;
    }, { replace: true, preventScrollReset: true });
  };

  const handleSelectPaper = (paper: string | undefined) => {
    updateSearchParams((next) => {
      if (paper === undefined) {
        if (defaultPaper !== null && defaultPaper !== undefined) {
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
    updateSearchParams((next) => {
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

function deriveTargetProgressFromBuckets({
  targetClassifications,
  totals,
  classificationBuckets,
}: {
  targetClassifications: number;
  totals: Totals;
  classificationBuckets: number[];
}): TargetProgressMetrics {
  const buckets = Array.from({ length: MAX_TARGET_CLASSIFICATIONS + 1 }, (_, index) => {
    const value = classificationBuckets[index] ?? 0;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });

  if (classificationBuckets.length > buckets.length) {
    for (let index = buckets.length; index < classificationBuckets.length; index += 1) {
      const value = classificationBuckets[index] ?? 0;
      if (Number.isFinite(value) && value > 0) {
        buckets[buckets.length - 1] += Math.floor(value);
      }
    }
  }

  const galaxiesAtTarget = buckets.slice(targetClassifications).reduce((sum, count) => sum + count, 0);
  const galaxiesWithMultipleClassifications = buckets.slice(2).reduce((sum, count) => sum + count, 0);
  const remainingClassificationsToTarget = buckets
    .slice(0, targetClassifications)
    .reduce(
      (sum, count, classificationCount) =>
        sum + (targetClassifications - classificationCount) * count,
      0,
    );
  const targetClassificationsTotal = totals.galaxies * targetClassifications;

  return {
    targetClassifications,
    targetClassificationsTotal,
    targetCompletionPercent:
      targetClassificationsTotal > 0
        ? (totals.totalClassifications / targetClassificationsTotal) * 100
        : 0,
    galaxiesAtTarget,
    galaxiesBelowTarget: Math.max(totals.galaxies - galaxiesAtTarget, 0),
    galaxiesWithMultipleClassifications,
    repeatClassifications: Math.max(totals.totalClassifications - totals.classifiedGalaxies, 0),
    remainingClassificationsToTarget,
  };
}

function buildPaperFilter(
  selectedPaper: string | undefined,
  paperCounts: Record<string, PaperCount>,
): PaperFilter {
  if (selectedPaper === undefined) {
    return null;
  }

  const counts = paperCounts[selectedPaper];
  if (!counts) {
    return null;
  }

  return {
    paper: selectedPaper,
    galaxies: counts.total,
    blacklisted: counts.blacklisted,
    adjusted: counts.adjusted,
  };
}

function sumCountsToTarget(counts: number[], targetClassifications: number) {
  return counts.slice(0, targetClassifications).reduce((sum, count) => sum + count, 0);
}

function buildAssignmentRows(
  scopeSnapshot: ScopeSnapshot,
  userDirectory: UserDirectoryEntry[],
  targetClassifications: number,
) {
  const userDirectoryById = new Map(userDirectory.map((entry) => [entry.userId, entry] as const));
  const rows: AssignmentRow[] = scopeSnapshot.userAssignmentCounts
    .map((entry) => {
      const user = userDirectoryById.get(entry.userId);
      return {
        key: entry.userId,
        label: user?.name?.trim() || entry.userId,
        roleLabel: getRoleLabel(user?.role),
        count: sumCountsToTarget(entry.counts, targetClassifications),
        isActive: user?.isActive,
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const unassignedCount = sumCountsToTarget(scopeSnapshot.unassignedCounts, targetClassifications);

  if (unassignedCount > 0) {
    rows.push({
      key: "__unassigned__",
      label: "Not assigned to any user",
      roleLabel: "Pending",
      count: unassignedCount,
      isSpecial: true,
    });
  }

  return rows;
}

function AssignmentCoverageTableSection({
  selectedPaper,
  scopeSnapshot,
  userDirectory,
  targetClassifications,
}: {
  selectedPaper: string | undefined;
  scopeSnapshot: ScopeSnapshot;
  userDirectory: UserDirectoryEntry[];
  targetClassifications: number;
}) {
  const rows = useMemo(
    () => buildAssignmentRows(scopeSnapshot, userDirectory, targetClassifications),
    [scopeSnapshot, targetClassifications, userDirectory],
  );
  const underTargetGalaxies = sumCountsToTarget(
    scopeSnapshot.classificationBuckets,
    targetClassifications,
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Under-target assignment coverage
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Current sequence entries for galaxies below the selected repeat-classification target,
            excluding blacklisted galaxies.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedPaper === undefined
              ? `${underTargetGalaxies.toLocaleString()} galaxies are still below ${targetClassifications} classifications across the full effective catalog.`
              : `${paperLabel(selectedPaper)} has ${underTargetGalaxies.toLocaleString()} galaxies below ${targetClassifications} classifications after blacklist filtering.`}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-right dark:border-blue-800/70 dark:bg-blue-950/20">
          <div className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Current target
          </div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {targetClassifications}x
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          {underTargetGalaxies === 0
            ? `Every galaxy in this scope already reached ${targetClassifications} classifications.`
            : "No current sequence entries match the under-target subset."}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3 text-right">Galaxies In Sequence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(row.isSpecial && "bg-amber-50/60 dark:bg-amber-950/10")}
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{row.label}</div>
                    {!row.isSpecial && row.isActive === false && (
                      <div className="text-xs text-amber-700 dark:text-amber-300">Inactive account</div>
                    )}
                    {row.isSpecial && (
                      <div className="text-xs text-amber-700 dark:text-amber-300">Galaxies with no current sequence owner</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">{row.roleLabel}</td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PageIntroCard({
  mode,
  switchTo,
  switchLabel,
  onCompute,
  isComputing = false,
  updatedAt,
}: {
  mode: "cached" | "live";
  switchTo: string;
  switchLabel: string;
  onCompute?: () => void;
  isComputing?: boolean;
  updatedAt?: number | null;
}) {
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleString() : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Paper assignment coverage
            </h2>
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
              {mode === "cached" ? "Cached snapshot" : "Live calculation"}
            </span>
          </div>
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            Paper-scoped coverage statistics for the effective catalog. All totals exclude blacklisted galaxies,
            and the user table shows who currently owns galaxies that are still below the selected
            repeat-classification target.
          </p>
          {updatedLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {updatedLabel}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCompute && (
            <button
              type="button"
              onClick={onCompute}
              disabled={isComputing}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-white transition-colors",
                isComputing ? "cursor-wait bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isComputing ? "Calculating…" : updatedAt ? "Recompute live snapshot" : "Calculate live snapshot"}
            </button>
          )}
          <Link
            to={switchTo}
            className="rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
          >
            {switchLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PaperAssignmentCoverageDashboard({
  mode,
  sharedSnapshot,
  scopeSnapshots,
  defaultPaper,
}: DashboardProps) {
  const {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  } = useCoverageFilters(defaultPaper);

  const scopeSnapshotsByKey = useMemo(
    () => new Map(scopeSnapshots.map((snapshot) => [snapshot.scopeKey, snapshot] as const)),
    [scopeSnapshots],
  );
  const currentScopeKey = selectedPaper ?? GLOBAL_SCOPE_KEY;
  const currentScope = scopeSnapshotsByKey.get(currentScopeKey);
  const paperFilter = buildPaperFilter(selectedPaper, sharedSnapshot.catalog.paperCounts);
  const targetProgress = currentScope
    ? deriveTargetProgressFromBuckets({
        targetClassifications,
        totals: currentScope.totals,
        classificationBuckets: currentScope.classificationBuckets,
      })
    : undefined;

  const alternateModeLink = mode === "cached"
    ? buildModeLink("/statistics/paper-assignment-coverage-live", searchParams)
    : buildModeLink("/statistics/paper-assignment-coverage", searchParams);

  if (!currentScope) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode={mode}
          switchTo={alternateModeLink}
          switchLabel={mode === "cached" ? "Open live calculation" : "Open cached snapshot"}
          updatedAt={sharedSnapshot.updatedAt}
        />
        <LoadingPanel>
          {selectedPaper === undefined
            ? "The global paper-assignment coverage snapshot is not available yet."
            : `No snapshot is available for ${paperLabel(selectedPaper)} yet.`}
        </LoadingPanel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PaperCatalogSection
        availablePapers={sharedSnapshot.catalog.availablePapers}
        paperCounts={sharedSnapshot.catalog.paperCounts}
        paperFilter={paperFilter}
        selectedPaper={selectedPaper}
        onSelectPaper={handleSelectPaper}
        mode={mode}
        updatedAt={sharedSnapshot.updatedAt}
      />

      <SummaryCardsSection
        totals={currentScope.totals}
        selectedPaper={selectedPaper}
        mode={mode}
        updatedAt={currentScope.updatedAt}
      />

      <ProgressSection
        totals={currentScope.totals}
        targetProgress={targetProgress}
        targetClassifications={targetClassifications}
        onTargetClassificationsChange={handleTargetClassificationsChange}
        activeClassifiers={currentScope.activeClassifiers}
        selectedPaper={selectedPaper}
        mode={mode}
        updatedAt={currentScope.updatedAt}
      />

      <AssignmentCoverageTableSection
        selectedPaper={selectedPaper}
        scopeSnapshot={currentScope}
        userDirectory={sharedSnapshot.userDirectory}
        targetClassifications={targetClassifications}
      />
    </div>
  );
}

export function CachedPaperAssignmentCoverageTab({ systemSettings }: RouteProps) {
  const cachedPayload = useQuery(
    api.statistics.paperAssignmentCoverage.cache.getCachedSnapshot,
    {},
  ) as CachedCoveragePayload | undefined;
  const { searchParams } = useCoverageFilters(systemSettings.paperAssignmentCoverageDefaultPaper);
  const liveLink = buildModeLink("/statistics/paper-assignment-coverage-live", searchParams);

  if (cachedPayload === undefined) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode="cached"
          switchTo={liveLink}
          switchLabel="Open live calculation"
        />
        <LoadingPanel>Loading cached paper-assignment coverage…</LoadingPanel>
      </div>
    );
  }

  if (!cachedPayload.sharedSnapshot || cachedPayload.scopeSnapshots.length === 0) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode="cached"
          switchTo={liveLink}
          switchLabel="Open live calculation"
        />
        <LoadingPanel>
          Cached paper-assignment coverage is not available yet. Open the live calculation page to compute the
          latest numbers immediately, or wait for the scheduled snapshot refresh.
        </LoadingPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntroCard
        mode="cached"
        switchTo={liveLink}
        switchLabel="Open live calculation"
        updatedAt={cachedPayload.sharedSnapshot.updatedAt}
      />
      <PaperAssignmentCoverageDashboard
        mode="cached"
        sharedSnapshot={cachedPayload.sharedSnapshot}
        scopeSnapshots={cachedPayload.scopeSnapshots}
        defaultPaper={systemSettings.paperAssignmentCoverageDefaultPaper}
      />
    </div>
  );
}

export function LivePaperAssignmentCoverageTab({ systemSettings }: RouteProps) {
  const computeLiveSnapshot = useAction(
    api.statistics.paperAssignmentCoverage.cache.computeLiveSnapshot,
  );
  const [snapshot, setSnapshot] = useState<LiveCoveragePayload | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const { searchParams } = useCoverageFilters(systemSettings.paperAssignmentCoverageDefaultPaper);
  const cachedLink = buildModeLink("/statistics/paper-assignment-coverage", searchParams);

  const handleCompute = async () => {
    setIsComputing(true);
    try {
      const nextSnapshot = await computeLiveSnapshot({});
      setSnapshot(nextSnapshot as LiveCoveragePayload);
      toast.success("Live paper-assignment coverage updated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to compute live paper-assignment coverage.");
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntroCard
        mode="live"
        switchTo={cachedLink}
        switchLabel="Open cached snapshot"
        onCompute={handleCompute}
        isComputing={isComputing}
        updatedAt={snapshot?.sharedSnapshot.updatedAt}
      />

      {!snapshot ? (
        <LoadingPanel>
          Click <span className="font-medium">Calculate live snapshot</span> to scan the current catalog,
          classifications, and active sequences. The resulting view stays fully interactive as you switch papers
          or change the target classifications per galaxy.
        </LoadingPanel>
      ) : (
        <PaperAssignmentCoverageDashboard
          mode="live"
          sharedSnapshot={snapshot.sharedSnapshot}
          scopeSnapshots={snapshot.scopeSnapshots}
          defaultPaper={systemSettings.paperAssignmentCoverageDefaultPaper}
        />
      )}
    </div>
  );
}