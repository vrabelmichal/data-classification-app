import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

type UserStatisticsData = {
  total: number;
  thisWeek: number | null;
  byLsbClass: {
    nonLSB: number;
    LSB: number;
  };
  byMorphology: {
    featureless: number;
    irregular: number;
    spiral: number;
    elliptical: number;
  };
  averageTime: number | null;
  awesomeCount: number;
  validRedshiftCount: number;
  visibleNucleusCount: number;
  failedFittingCount: number;
  _source: "cache" | "profile_fallback";
};

type StatisticsCacheState = {
  status: "cached" | "stale" | "missing";
  updatedAt: number | null;
  dirtySince: number | null;
};

type UserStatisticsResponse = {
  data: UserStatisticsData | null;
  cache: StatisticsCacheState;
};

type BreakdownItem = {
  label: string;
  value: number;
  accentColor: string;
  icon: React.ReactNode;
};

type StatisticsMorphologyIconKind = "featureless" | "irregular" | "spiral" | "elliptical";

type SummaryCard = {
  id: string;
  label: string;
  value: number | string;
  icon: string;
  bgColor: string;
  textColor: string;
  title?: string;
};

type StatisticsSnapshot = {
  targetKey: string;
  data: UserStatisticsResponse;
};

function formatBreakdownPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  if (value < 0.1) {
    return "<0.1%";
  }

  if (value < 10) {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toFixed(0)}%`;
}

function formatStatValue(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function formatAverageTimeValue(value: number | null) {
  return value === null ? "—" : `${value}s`;
}

function formatCompactTimestamp(timestamp: number | null) {
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

function formatRelativeTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) {
    return "just now";
  }

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function StatisticsRefreshFooter({
  cache,
  source,
  isRefreshing,
  onRefresh,
}: {
  cache: StatisticsCacheState;
  source: UserStatisticsData["_source"] | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const updatedAtLabel = formatCompactTimestamp(cache.updatedAt);
  const updatedAtRelative = formatRelativeTimestamp(cache.updatedAt);
  const dirtySinceLabel = formatRelativeTimestamp(cache.dirtySince);

  let title = "Cached statistics";
  let description = "Refresh recalculates this panel from live classifications.";

  if (cache.status === "cached") {
    title = updatedAtLabel
      ? `Cached snapshot from ${updatedAtLabel}${updatedAtRelative ? ` (${updatedAtRelative})` : ""}`
      : "Cached snapshot ready";
  } else if (cache.status === "stale") {
    title = updatedAtLabel
      ? `Showing cached snapshot from ${updatedAtLabel}`
      : "Showing cached snapshot";
    description = dirtySinceLabel
      ? `New classifications landed ${dirtySinceLabel}. Refresh or wait for the hourly cache update.`
      : "Refresh or wait for the hourly cache update to pull in newer classifications.";
  } else if (source === "profile_fallback") {
    title = "Detailed snapshot not calculated yet";
    description = "Totals and breakdowns come from cached profile counters. Weekly activity and average time appear after refresh.";
  }

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-gray-600 underline decoration-gray-300 underline-offset-4 transition hover:text-gray-900 hover:decoration-gray-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-gray-300 dark:decoration-gray-600 dark:hover:text-white dark:hover:decoration-gray-300 disabled:dark:text-gray-500"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}

function StatisticsEmptyState({ message }: { message: string }) {
  return <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>;
}

function StatisticsLsbIcon({ color }: { color: string }) {
  return (
    <span
      className="block h-5 w-5 rounded-full ring-1 ring-gray-300/80 dark:ring-gray-600/80"
      style={{ backgroundColor: color }}
    />
  );
}

function StatisticsMorphologyIcon({
  kind,
  color,
}: {
  kind: StatisticsMorphologyIconKind;
  color: string;
}) {
  switch (kind) {
    case "featureless":
      return <span className="block h-5 w-5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />;
    case "irregular":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ color }} fill="currentColor" aria-hidden="true">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
        </svg>
      );
    case "spiral":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          style={{ color }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          <path
            d="M12 7C14.7614 7 17 9.23858 17 12C17 15.3137 14.3137 18 11 18C8.5 18 6.5 16.5 6 14.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 17C9.23858 17 7 14.7614 7 12C7 8.68629 9.68629 6 13 6C15.5 6 17.5 7.5 18 9.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "elliptical":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ color }} fill="currentColor" aria-hidden="true">
          <ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)" fillOpacity="0.3" />
          <ellipse cx="12" cy="12" rx="5" ry="2.5" transform="rotate(-30 12 12)" />
          <circle cx="12" cy="12" r="1.2" />
        </svg>
      );
  }
}

function StatisticsBreakdownCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      {children}

      {footer && <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">{footer}</div>}
    </div>
  );
}

function StatisticsCompositionBreakdown({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/60">
        <div className="flex h-4 w-full">
          {items.map((item) => {
            const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;

            return (
              <div
                key={item.label}
                title={`${item.label}: ${item.value.toLocaleString()} (${formatBreakdownPercent(percentage)})`}
                className="h-full transition-[width] duration-300"
                style={{ width: `${percentage}%`, backgroundColor: item.accentColor }}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;

          return (
            <div
              key={item.label}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center justify-center text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
              </div>

              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {item.value.toLocaleString()}
              </span>
              <span className="w-14 text-right text-xs text-gray-500 dark:text-gray-400">
                {formatBreakdownPercent(percentage)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatisticsFlagBreakdown({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;

        return (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center justify-center text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
              </div>

              <div className="flex shrink-0 items-baseline gap-3 text-right">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {item.value.toLocaleString()}
                </span>
                <span className="w-14 text-xs text-gray-500 dark:text-gray-400">
                  {formatBreakdownPercent(percentage)}
                </span>
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: item.accentColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatisticsBreakdownsSection({
  lsbItems,
  morphologyItems,
  flagItems,
  totalClassifications,
}: {
  lsbItems: BreakdownItem[];
  morphologyItems: BreakdownItem[];
  flagItems: BreakdownItem[];
  totalClassifications: number;
}) {
  const lsbTotal = lsbItems.reduce((sum, item) => sum + item.value, 0);
  const morphologyTotal = morphologyItems.reduce((sum, item) => sum + item.value, 0);
  const hasFlagsPanel = flagItems.length > 0;
  const hasMismatchWarning = lsbItems.length > 0 && morphologyItems.length > 0 && lsbTotal !== morphologyTotal;

  return (
    <div className="mb-8 space-y-6">
      {hasMismatchWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200">
          LSB total ({lsbTotal.toLocaleString()}) and morphology total ({morphologyTotal.toLocaleString()}) do not match. For per-user statistics this usually means the cached user counters are stale and should be recomputed from the underlying classifications.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <div className={cn(hasFlagsPanel ? "xl:col-span-3" : "xl:col-span-4")}>
          <StatisticsBreakdownCard
            title="LSB Classification"
            description="How your submitted classifications split between non-LSB and LSB labels."
          >
            {totalClassifications === 0 ? (
              <StatisticsEmptyState message="No classifications yet." />
            ) : (
              <StatisticsCompositionBreakdown items={lsbItems} />
            )}
          </StatisticsBreakdownCard>
        </div>

        <div className={cn(hasFlagsPanel ? "xl:col-span-5" : "xl:col-span-8")}>
          <StatisticsBreakdownCard
            title="Morphology Classification"
            description="Distribution of morphology choices across your submitted classifications."
          >
            {totalClassifications === 0 ? (
              <StatisticsEmptyState message="No classifications yet." />
            ) : (
              <StatisticsCompositionBreakdown items={morphologyItems} />
            )}
          </StatisticsBreakdownCard>
        </div>

        {hasFlagsPanel && (
          <div className="lg:col-span-2 xl:col-span-4">
            <StatisticsBreakdownCard
              title="Classification Flags"
              description="Optional flags you have marked true on submitted classifications."
              footer="Flags can overlap, so the percentages here do not add up to 100%."
            >
              {totalClassifications === 0 ? (
                <StatisticsEmptyState message="No classifications yet." />
              ) : (
                <StatisticsFlagBreakdown items={flagItems} total={totalClassifications} />
              )}
            </StatisticsBreakdownCard>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatisticsTab() {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [lastStatsSnapshot, setLastStatsSnapshot] = useState<StatisticsSnapshot | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  
  const userProfile = useQuery(api.users.getUserProfile);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const refreshUserStatsSnapshot = useAction(api.users.refreshUserStatsSnapshot);
  
  const isAdmin = userProfile?.role === "admin";
  
  // Only fetch user list if admin
  const usersList = useQuery(
    api.users.getUsersForSelection,
    isAdmin ? {} : "skip"
  );
  
  // Get stats for selected user (or self if not admin/no selection)
  const stats = useQuery(
    api.users.getUserStats,
    selectedUserId ? { targetUserId: selectedUserId } : {}
  );
  const progress = useQuery(
    api.classification.getProgress,
    selectedUserId ? { targetUserId: selectedUserId } : {}
  );

  const statsTargetKey = selectedUserId ?? userProfile?.userId ?? null;

  // Preserve last successful stats to avoid layout jumps/scrollbar flicker while refetching
  useEffect(() => {
    if (stats && statsTargetKey) {
      setLastStatsSnapshot({ targetKey: String(statsTargetKey), data: stats });
    }
  }, [stats, statsTargetKey]);

  // Find the selected user's display name
  const selectedUserDisplay = useMemo(() => {
    if (!selectedUserId || !usersList) return null;
    const user = usersList.find(u => u.userId === selectedUserId);
    if (!user) return null;
    return user.name || user.email || user.userId;
  }, [selectedUserId, usersList]);

  const displayStatsResponse =
    stats ??
    (statsTargetKey !== null && lastStatsSnapshot?.targetKey === String(statsTargetKey)
      ? lastStatsSnapshot.data
      : null);

  const displayStats = displayStatsResponse?.data ?? null;
  const displayCache = displayStatsResponse?.cache ?? null;

  if ((stats === undefined && !displayStatsResponse) || progress === undefined || systemSettings === undefined || userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // System settings for showing/hiding flags
  const showAwesomeFlag = systemSettings?.showAwesomeFlag ?? true;
  const showValidRedshift = systemSettings?.showValidRedshift ?? true;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus ?? true;
  const failedFittingMode = systemSettings?.failedFittingMode ?? "checkbox";
  // Show failed fitting stat only in checkbox mode
  const showFailedFitting = failedFittingMode === "checkbox";

  const isRefetching = stats === undefined && !!displayStatsResponse;

  const handleRefreshStats = async () => {
    if (isRefreshingStats) {
      return;
    }

    setIsRefreshingStats(true);
    try {
      await refreshUserStatsSnapshot(selectedUserId ? { targetUserId: selectedUserId } : {});
      toast.success("Statistics refreshed.");
    } catch (error) {
      console.error("[StatisticsTab] failed to refresh statistics", error);
      toast.error("Failed to refresh statistics.");
    } finally {
      setIsRefreshingStats(false);
    }
  };

  const totalClassifications = displayStats?.total ?? 0;

  const neutralColor = "#6b7280";
  const lsbColor = "#22c55e";
  const irregularColor = "#eab308";
  const spiralColor = "#3b82f6";
  const ellipticalColor = "#a855f7";
  const awesomeColor = "#eab308";
  const nucleusColor = "#f97316";
  const redshiftColor = "#ef4444";
  const failedFittingColor = "#f43f5e";

  const lsbItems: BreakdownItem[] = [
    {
      label: "Non-LSB",
      value: displayStats?.byLsbClass?.nonLSB ?? 0,
      accentColor: neutralColor,
      icon: <StatisticsLsbIcon color={neutralColor} />,
    },
    {
      label: "LSB",
      value: displayStats?.byLsbClass?.LSB ?? 0,
      accentColor: lsbColor,
      icon: <StatisticsLsbIcon color={lsbColor} />,
    },
  ];

  const morphologyItems: BreakdownItem[] = [
    {
      label: "Featureless",
      value: displayStats?.byMorphology?.featureless ?? 0,
      accentColor: neutralColor,
      icon: <StatisticsMorphologyIcon kind="featureless" color={neutralColor} />,
    },
    {
      label: "Irregular",
      value: displayStats?.byMorphology?.irregular ?? 0,
      accentColor: irregularColor,
      icon: <StatisticsMorphologyIcon kind="irregular" color={irregularColor} />,
    },
    {
      label: "Spiral",
      value: displayStats?.byMorphology?.spiral ?? 0,
      accentColor: spiralColor,
      icon: <StatisticsMorphologyIcon kind="spiral" color={spiralColor} />,
    },
    {
      label: "Elliptical",
      value: displayStats?.byMorphology?.elliptical ?? 0,
      accentColor: ellipticalColor,
      icon: <StatisticsMorphologyIcon kind="elliptical" color={ellipticalColor} />,
    },
  ];

  const flagItems: BreakdownItem[] = [];
  if (showAwesomeFlag) {
    flagItems.push({ label: "Awesome", value: displayStats?.awesomeCount ?? 0, accentColor: awesomeColor, icon: "⭐" });
  }
  if (showVisibleNucleus) {
    flagItems.push({ label: "Visible Nucleus", value: displayStats?.visibleNucleusCount ?? 0, accentColor: nucleusColor, icon: "🎯" });
  }
  if (showValidRedshift) {
    flagItems.push({ label: "Valid Redshift", value: displayStats?.validRedshiftCount ?? 0, accentColor: redshiftColor, icon: "🔴" });
  }
  if (showFailedFitting) {
    flagItems.push({ label: "Failed Fitting", value: displayStats?.failedFittingCount ?? 0, accentColor: failedFittingColor, icon: "❌" });
  }

  // Build dynamic stat cards based on enabled flags
  const statCards: SummaryCard[] = [
    {
      id: "total",
      label: "Total",
      value: formatStatValue(displayStats?.total ?? null),
      icon: "🔍",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "thisWeek",
      label: "This Week",
      value: formatStatValue(displayStats?.thisWeek ?? null),
      icon: "📅",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-600 dark:text-green-400",
    },
  ];

  if (showAwesomeFlag) {
    statCards.push({
      id: "awesome",
      label: "Awesome",
      value: formatStatValue(displayStats?.awesomeCount ?? null),
      icon: "⭐",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      textColor: "text-yellow-600 dark:text-yellow-400",
    });
  }

  if (showVisibleNucleus) {
    statCards.push({
      id: "visibleNucleus",
      label: "Nucleus",
      title: "Visible Nucleus",
      value: formatStatValue(displayStats?.visibleNucleusCount ?? null),
      icon: "🎯",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      textColor: "text-orange-600 dark:text-orange-400",
    });
  }

  if (showValidRedshift) {
    statCards.push({
      id: "validRedshift",
      label: "Valid Redshift",
      value: formatStatValue(displayStats?.validRedshiftCount ?? null),
      icon: "🔴",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-600 dark:text-red-400",
    });
  }

  if (showFailedFitting) {
    statCards.push({
      id: "failedFitting",
      label: "Failed",
      title: "Failed Fitting",
      value: formatStatValue(displayStats?.failedFittingCount ?? null),
      icon: "❌",
      bgColor: "bg-rose-100 dark:bg-rose-900/30",
      textColor: "text-rose-600 dark:text-rose-400",
    });
  }

  statCards.push({
    id: "avgTime",
    label: "Avg Time",
    value: formatAverageTimeValue(displayStats?.averageTime ?? null),
    icon: "⏱️",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
  });

  // Calculate grid columns based on number of cards
  const gridColsClass = statCards.length <= 3 
    ? "lg:grid-cols-3" 
    : statCards.length <= 4 
      ? "lg:grid-cols-4" 
      : statCards.length <= 5 
        ? "lg:grid-cols-5" 
        : "lg:grid-cols-6";

  return (
    <div className="relative">
      {isRefetching && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 opacity-80" />
        </div>
      )}
      {/* Admin User Selector */}
      {isAdmin && usersList && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-4">
            <label htmlFor="user-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              View statistics for:
            </label>
            <select
              id="user-select"
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value ? e.target.value as Id<"users"> : null)}
              className="flex-1 max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Myself</option>
              {usersList.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.name || user.email || user.userId} ({user.classificationsCount} classifications)
                </option>
              ))}
            </select>
          </div>
          {selectedUserId && selectedUserDisplay && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Showing statistics for: <span className="font-medium text-gray-700 dark:text-gray-200">{selectedUserDisplay}</span>
            </p>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 ${gridColsClass} gap-6 mb-8`}>
        {statCards.map((card) => (
          <div key={card.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <span className={`${card.textColor} text-lg`}>{card.icon}</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap" title={card.title}>{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <StatisticsBreakdownsSection
        lsbItems={lsbItems}
        morphologyItems={morphologyItems}
        flagItems={flagItems}
        totalClassifications={totalClassifications}
      />

      {/* Progress Overview */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Progress Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Progress Ring */}
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-gray-200 dark:text-gray-700"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600 dark:text-blue-400"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${progress && progress.total > 0 ? (progress.classified / progress.total) * 100 : 0}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {progress && progress.total > 0 ? Math.round((progress.classified / progress.total) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Details */}
          <div className="md:col-span-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {progress?.classified || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Classified</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {progress?.skipped || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {progress?.remaining || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Remaining</div>
            </div>
          </div>
        </div>

        {progress && progress.remaining > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Keep going! You're making great progress.
            </p>
          </div>
        )}
      </div>

      {displayCache && (
        <StatisticsRefreshFooter
          cache={displayCache}
          source={displayStats?._source ?? null}
          isRefreshing={isRefreshingStats}
          onRefresh={() => void handleRefreshStats()}
        />
      )}
    </div>
  );
}
