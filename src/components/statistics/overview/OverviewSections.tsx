import { BreakdownBar, LoadingPanel, ProgressBar, StatCard } from "./shared";
import { PaperCount, PaperFilter, Totals } from "./types";

function paperLabel(p: string) {
  return p === "" ? "Unassigned" : p;
}

export function PaperCatalogSection({
  availablePapers,
  paperCounts,
  paperFilter,
  selectedPaper,
  totals,
  onSelectPaper,
}: {
  availablePapers: string[];
  paperCounts: Record<string, PaperCount>;
  paperFilter: PaperFilter;
  selectedPaper: string | undefined;
  totals?: Totals;
  onSelectPaper: (paper: string | undefined) => void;
}) {
  if (availablePapers.length === 0) return null;
  const hasPaperFilter = availablePapers.some((p) => p !== "");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Galaxy catalog by paper</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total / effective (excl. blacklisted) galaxies per dataset</p>
        </div>
        {hasPaperFilter && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSelectPaper(undefined)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedPaper === undefined
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400"
              }`}
            >
              All
            </button>
            {availablePapers.map((p) => (
              <button
                key={p === "" ? "__empty__" : p}
                onClick={() => onSelectPaper(p === selectedPaper ? undefined : p)}
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

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {availablePapers.map((p) => {
          const counts = paperCounts[p] ?? { total: 0, blacklisted: 0, adjusted: 0 };
          const pct = (totals?.galaxies ?? 0) > 0 ? (counts.total / (totals?.galaxies ?? 1)) * 100 : 0;
          const isSelected = selectedPaper === p;
          return (
            <div
              key={p === "" ? "__empty__" : p}
              role={hasPaperFilter ? "button" : undefined}
              tabIndex={hasPaperFilter ? 0 : undefined}
              aria-pressed={hasPaperFilter ? isSelected : undefined}
              className={`py-3 flex items-center gap-4 ${hasPaperFilter ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-lg px-2 -mx-2 transition-colors" : ""} ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2 -mx-2" : ""}`}
              onClick={hasPaperFilter ? () => onSelectPaper(isSelected ? undefined : p) : undefined}
              onKeyDown={hasPaperFilter ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectPaper(isSelected ? undefined : p); } } : undefined}
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
  );
}

export function SummaryCardsSection({ totals }: { totals?: Totals }) {
  if (!totals) return <LoadingPanel>Loading summary statistics…</LoadingPanel>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Galaxies" value={totals.galaxies.toLocaleString()} helper="Total in catalog" />
      <StatCard label="Classified" value={totals.classifiedGalaxies.toLocaleString()} helper="Have at least one label" />
      <StatCard label="Unclassified" value={totals.unclassifiedGalaxies.toLocaleString()} helper="Still waiting" />
      <StatCard label="Completion" value={`${totals.progress.toFixed(1)}%`} helper="Overall progress" />
    </div>
  );
}

export function ProgressSection({
  totals,
  activeClassifiers,
}: {
  totals?: Totals;
  activeClassifiers?: number;
}) {
  const avgPerActive = totals && activeClassifiers && activeClassifiers > 0
    ? totals.totalClassifications / activeClassifiers
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Overall progress</div>
          <div className="text-3xl font-semibold text-gray-900 dark:text-white">{totals ? `${totals.progress.toFixed(1)}%` : "—"}</div>
        </div>
        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
          {totals ? `${totals.totalClassifications.toLocaleString()} classifications overall` : "Loading overall counts…"}
        </div>
      </div>
      <ProgressBar percent={totals?.progress ?? 0} />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300">
        <div>
          <div className="font-medium text-gray-900 dark:text-white">Per galaxy</div>
          <div>{totals ? `${totals.avgClassificationsPerGalaxy.toFixed(2)} avg classifications/galaxy` : "Loading…"}</div>
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">Active users</div>
          <div>{activeClassifiers !== undefined ? `${activeClassifiers.toLocaleString()} with ≥1 classification` : "Loading…"}</div>
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white">Avg per active user</div>
          <div>{totals && activeClassifiers !== undefined ? `${avgPerActive.toFixed(2)} classifications` : "Loading…"}</div>
        </div>
      </div>
    </div>
  );
}

export function ThroughputSection({
  recency,
  dailySeries,
}: {
  recency?: { classificationsLast24h: number; classificationsLast7d: number };
  dailySeries: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Recent throughput</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {recency
              ? `${recency.classificationsLast24h.toLocaleString()} past 24h • ${recency.classificationsLast7d.toLocaleString()} past 7d`
              : "Loading recent throughput…"}
          </div>
        </div>
      </div>
      {recency ? (
        <div className="space-y-2">
          {dailySeries.map((day) => (
            <div key={day.label} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <span className="text-gray-500 dark:text-gray-400">{day.label}</span>
              <span className="font-medium">{day.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading daily activity…</div>
      )}
    </div>
  );
}

export function TopClassifiersSection({
  topClassifiers,
}: {
  topClassifiers: Array<{ profileId: string; name?: string | null; userId: string; lastActiveAt?: number; classifications: number }> | undefined;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Top classifiers</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">Most cumulative labels</div>
        </div>
      </div>
      {topClassifiers === undefined ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading classifier data…</div>
      ) : topClassifiers.length > 0 ? (
        <div className="space-y-3">
          {topClassifiers.map((entry) => (
            <div key={entry.profileId} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{entry.name || entry.userId}</div>
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
  );
}

export function ClassificationBreakdownsSection({
  lsbItems,
  morphologyItems,
  flagItems,
  totalClassifications,
  loading,
}: {
  lsbItems: Array<{ label: string; value: number; color: string; icon: string }>;
  morphologyItems: Array<{ label: string; value: number; color: string; icon: string }>;
  flagItems: Array<{ label: string; value: number; color: string; icon: string }>;
  totalClassifications: number;
  loading: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading && lsbItems.length === 0 && morphologyItems.length === 0 && flagItems.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm text-sm text-gray-500 dark:text-gray-400 lg:col-span-2">
            Loading classification breakdowns…
          </div>
        )}

        {lsbItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">LSB Classification</h3>
            <BreakdownBar items={lsbItems} total={totalClassifications} />
            {totalClassifications === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">No classifications yet</div>
            )}
          </div>
        )}

        {morphologyItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Morphology Classification</h3>
            <BreakdownBar items={morphologyItems} total={totalClassifications} />
          </div>
        )}
      </div>

      {flagItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Classification Flags</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Count of classifications where each flag was marked true</p>
          <BreakdownBar items={flagItems} total={totalClassifications} />
        </div>
      )}
    </>
  );
}
