import { useMemo } from "react";
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

export function OverviewTab() {
  const overview = useQuery(api.labeling.getLabelingOverview);

  const dailySeries = useMemo(() => {
    if (!overview?.recency.dailyCounts) return [];
    return overview.recency.dailyCounts.map((entry: any) => ({
      label: new Date(entry.start).toLocaleDateString(),
      count: entry.count,
    }));
  }, [overview]);

  if (overview === undefined) {
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

  const { totals, recency, topClassifiers } = overview as any;

  return (
    <div className="space-y-8">
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
    </div>
  );
}
