import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
      {helper && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helper}</div>}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 transition-all"
        style={{ width: `${clamped}%` }}
      ></div>
    </div>
  );
}

function BreakdownBar({ 
  items, 
  total 
}: { 
  items: Array<{ label: string; value: number; color: string; icon: string }>;
  total: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {item.label}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-16 text-right">
                {item.value.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OverviewTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);

  // Default paper from system settings (null = show all papers by default)
  const defaultOverviewPaper: string | null =
    systemSettings !== undefined
      ? ((systemSettings as any)?.overviewDefaultPaper ?? null)
      : null;

  // Derive selectedPaper from URL, falling back to the system default.
  // ?paper=__all__  → explicit "all" (overrides a non-null system default)
  // ?paper=old      → filter to paper "old"
  // ?paper=         → filter to unassigned paper (empty string)
  // (no param)      → use defaultOverviewPaper, or undefined if none
  const hasParamInUrl = searchParams.has("paper");
  const rawParam = searchParams.get("paper");
  const selectedPaper: string | undefined = !hasParamInUrl
    ? (defaultOverviewPaper !== null ? defaultOverviewPaper : undefined)
    : rawParam === "__all__" ? undefined
    : rawParam!;

  // Update URL when a paper is selected or deselected.
  const handleSelectPaper = (p: string | undefined) => {
    if (p === undefined) {
      // "All" — if there is a system default we need an explicit override marker.
      if (defaultOverviewPaper !== null) {
        setSearchParams((prev) => { prev.set("paper", "__all__"); return prev; }, { replace: true });
      } else {
        setSearchParams((prev) => { prev.delete("paper"); return prev; }, { replace: true });
      }
    } else {
      setSearchParams((prev) => { prev.set("paper", p); return prev; }, { replace: true });
    }
  };

  const overview = useQuery(api.labeling.getLabelingOverview, { paper: selectedPaper });

  const dailySeries = useMemo(() => {
    if (!overview?.recency.dailyCounts) return [];
    return overview.recency.dailyCounts.map((entry: any) => ({
      label: new Date(entry.start).toLocaleDateString(),
      count: entry.count,
    }));
  }, [overview]);

  if (overview === undefined || systemSettings === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="h-10 w-10 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-300 py-12">
        Unable to load labeling overview.
      </div>
    );
  }

  const { totals, recency, classificationStats, topClassifiers } = overview as any;

  // Paper data now comes from the overview response (computed server-side).
  const availablePapers: string[] = (overview as any).availablePapers ?? [];
  const paperCounts: Record<string, { total: number; blacklisted: number; adjusted: number }> =
    (overview as any).paperCounts ?? {};

  // System settings for showing/hiding flags
  const showAwesomeFlag = systemSettings?.showAwesomeFlag ?? true;
  const showValidRedshift = systemSettings?.showValidRedshift ?? true;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus ?? true;
  const failedFittingMode = systemSettings?.failedFittingMode ?? "checkbox";
  const showFailedFitting = failedFittingMode === "checkbox";

  // Build flag stats items based on settings
  const flagItems: Array<{ label: string; value: number; color: string; icon: string }> = [];
  if (showAwesomeFlag && classificationStats?.flags) {
    flagItems.push({ 
      label: "Awesome", 
      value: classificationStats.flags.awesome || 0, 
      color: "bg-yellow-500", 
      icon: "⭐" 
    });
  }
  if (showVisibleNucleus && classificationStats?.flags) {
    flagItems.push({ 
      label: "Visible Nucleus", 
      value: classificationStats.flags.visibleNucleus || 0, 
      color: "bg-orange-500", 
      icon: "🎯" 
    });
  }
  if (showValidRedshift && classificationStats?.flags) {
    flagItems.push({ 
      label: "Valid Redshift", 
      value: classificationStats.flags.validRedshift || 0, 
      color: "bg-red-500", 
      icon: "🔴" 
    });
  }
  if (showFailedFitting && classificationStats?.flags) {
    flagItems.push({ 
      label: "Failed Fitting", 
      value: classificationStats.flags.failedFitting || 0, 
      color: "bg-rose-500", 
      icon: "❌" 
    });
  }

  // LSB breakdown items (binary)
  const lsbItems = classificationStats?.lsbClass ? [
    { label: "Non-LSB", value: classificationStats.lsbClass.nonLSB || 0, color: "bg-gray-500", icon: "⚪" },
    { label: "LSB", value: classificationStats.lsbClass.LSB || 0, color: "bg-green-500", icon: "🟢" },
  ] : [];

  // Morphology breakdown items
  const morphologyItems = classificationStats?.morphology ? [
    { label: "Featureless", value: classificationStats.morphology.featureless || 0, color: "bg-gray-500", icon: "⚫" },
    { label: "Irregular", value: classificationStats.morphology.irregular || 0, color: "bg-yellow-500", icon: "⚡" },
    { label: "Spiral", value: classificationStats.morphology.spiral || 0, color: "bg-blue-500", icon: "🌀" },
    { label: "Elliptical", value: classificationStats.morphology.elliptical || 0, color: "bg-purple-500", icon: "⭕" },
  ] : [];

  const totalClassifications = totals.totalClassifications || 0;

  // Paper-specific filter data returned from the backend (only when a paper is selected).
  const paperFilter = (overview as any).paperFilter as {
    paper: string;
    galaxies: number;
    blacklisted: number;
    adjusted: number;
  } | null;

  // Human-readable label for a paper value.
  function paperLabel(p: string) {
    return p === "" ? "Unassigned" : p;
  }

  // Whether there are multiple distinct non-empty papers (so filter buttons are useful).
  const hasPaperFilter = availablePapers.some((p: string) => p !== "");

  return (
    <div className="space-y-8">
      {/* Galaxy catalog by paper — always visible */}
      {availablePapers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Galaxy catalog by paper</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total / effective (excl. blacklisted) galaxies per dataset</p>
            </div>
            {/* Filter toggle — only shown when there are named papers */}
            {hasPaperFilter && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSelectPaper(undefined)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedPaper === undefined
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400"
                  }`}
                >
                  All
                </button>
                {availablePapers.map((p: string) => (
                  <button
                    key={p === "" ? "__empty__" : p}
                    onClick={() => handleSelectPaper(p === selectedPaper ? undefined : p)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedPaper === p
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400"
                    }`}
                  >
                    {paperLabel(p)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Paper rows */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {availablePapers.map((p: string) => {
              const counts = paperCounts[p] ?? { total: 0, blacklisted: 0, adjusted: 0 };
              const pct = totals.galaxies > 0 ? (counts.total / totals.galaxies) * 100 : 0;
              const isSelected = selectedPaper === p;
              return (
                <div
                  key={p === "" ? "__empty__" : p}
                  className={`py-3 flex items-center gap-4 ${hasPaperFilter ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg px-2 -mx-2 transition-colors" : ""} ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2 -mx-2" : ""}`}
                  onClick={hasPaperFilter ? () => handleSelectPaper(isSelected ? undefined : p) : undefined}
                >
                  <div className="w-28 shrink-0">
                    <span className={`text-sm font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                      {paperLabel(p)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${isSelected ? "bg-blue-500" : "bg-indigo-400 dark:bg-indigo-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{counts.total.toLocaleString()}</span>
                    {counts.blacklisted > 0 && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">−{counts.blacklisted.toLocaleString()} blacklisted</span>
                    )}
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({pct.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active paper filter detail */}
          {paperFilter && (
            <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-800 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{paperFilter.galaxies.toLocaleString()}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{paperFilter.blacklisted.toLocaleString()}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Blacklisted</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{paperFilter.adjusted.toLocaleString()}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Effective</div>
              </div>
            </div>
          )}
          {hasPaperFilter && !paperFilter && (
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Click a paper row or button above to see effective counts excluding blacklisted galaxies.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Galaxies" value={totals.galaxies.toLocaleString()} helper="Total in catalog" />
        <StatCard label="Classified" value={totals.classifiedGalaxies.toLocaleString()} helper="Have at least one label" />
        <StatCard label="Unclassified" value={totals.unclassifiedGalaxies.toLocaleString()} helper="Still waiting" />
        <StatCard label="Completion" value={`${totals.progress.toFixed(1)}%`} helper="Overall progress" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Overall progress</div>
            <div className="text-3xl font-semibold text-gray-900 dark:text-white">{totals.progress.toFixed(1)}%</div>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            {totals.totalClassifications.toLocaleString()} classifications overall
          </div>
        </div>
        <ProgressBar percent={totals.progress} />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">Per galaxy</div>
            <div>{totals.avgClassificationsPerGalaxy.toFixed(2)} avg classifications/galaxy</div>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">Active users</div>
            <div>{recency.activeClassifiers.toLocaleString()} with ≥1 classification</div>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">Avg per active user</div>
            <div>{recency.avgClassificationsPerActiveUser.toFixed(2)} classifications</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Recent throughput</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {recency.classificationsLast24h.toLocaleString()} past 24h • {recency.classificationsLast7d.toLocaleString()} past 7d
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {dailySeries.map((day) => (
              <div key={day.label} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                <span className="text-gray-500 dark:text-gray-400">{day.label}</span>
                <span className="font-medium">{day.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Top classifiers</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">Most cumulative labels</div>
            </div>
          </div>
          {topClassifiers && topClassifiers.length > 0 ? (
            <div className="space-y-3">
              {topClassifiers.map((entry: any) => (
                <div key={entry.profileId} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{entry.name || entry.email || entry.userId}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Last active: {entry.lastActiveAt ? new Date(entry.lastActiveAt).toLocaleString() : "n/a"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{entry.classifications.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">labels</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">No classifier data yet.</div>
          )}
        </div>
      </div>

      {/* Classification Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LSB Classification Breakdown */}
        {lsbItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              LSB Classification
            </h3>
            <BreakdownBar items={lsbItems} total={totalClassifications} />
            {totalClassifications === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                No classifications yet
              </div>
            )}
          </div>
        )}

        {/* Morphology Breakdown */}
        {morphologyItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Morphology Classification
            </h3>
            <BreakdownBar items={morphologyItems} total={totalClassifications} />
          </div>
        )}
      </div>

      {/* Classification Flags */}
      {flagItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Classification Flags
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Count of classifications where each flag was marked true
          </p>
          <BreakdownBar items={flagItems} total={totalClassifications} />
        </div>
      )}
    </div>
  );
}
