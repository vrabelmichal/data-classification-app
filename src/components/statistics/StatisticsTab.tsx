import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function StatisticsTab() {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [lastStats, setLastStats] = useState<any>(null);
  
  const userProfile = useQuery(api.users.getUserProfile);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  
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

  // Preserve last successful stats to avoid layout jumps/scrollbar flicker while refetching
  useEffect(() => {
    if (stats) {
      setLastStats(stats);
    }
  }, [stats]);

  // Find the selected user's display name
  const selectedUserDisplay = useMemo(() => {
    if (!selectedUserId || !usersList) return null;
    const user = usersList.find(u => u.userId === selectedUserId);
    if (!user) return null;
    return user.name || user.email || user.userId;
  }, [selectedUserId, usersList]);

  if ((stats === undefined && !lastStats) || progress === undefined || systemSettings === undefined || userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const displayStats = stats ?? lastStats;

  // System settings for showing/hiding flags
  const showAwesomeFlag = systemSettings?.showAwesomeFlag ?? true;
  const showValidRedshift = systemSettings?.showValidRedshift ?? true;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus ?? true;
  const failedFittingMode = systemSettings?.failedFittingMode ?? "checkbox";
  // Show failed fitting stat only in checkbox mode
  const showFailedFitting = failedFittingMode === "checkbox";

  // Binary LSB classification (nonLSB vs LSB)
  const lsbClassTypes = [
    { key: "nonLSB", label: "Non-LSB", color: "bg-gray-500", icon: "⚪" },
    { key: "LSB", label: "LSB", color: "bg-green-500", icon: "🟢" },
  ];

  const morphologyTypes = [
    { key: "featureless", label: "Featureless", color: "bg-gray-500", icon: "⚫" },
    { key: "irregular", label: "Irregular", color: "bg-yellow-500", icon: "⚡" },
    { key: "spiral", label: "Spiral", color: "bg-blue-500", icon: "🌀" },
    { key: "elliptical", label: "Elliptical", color: "bg-purple-500", icon: "⭕" },
  ];

  const isRefetching = stats === undefined && !!lastStats;

  const totalClassifications = displayStats ? displayStats.total : 0;

  // Build dynamic stat cards based on enabled flags
  const statCards: Array<{
    id: string;
    label: string;
    value: number | string;
    icon: string;
    bgColor: string;
    textColor: string;
  }> = [
    {
      id: "total",
      label: "Total",
      value: displayStats?.total || 0,
      icon: "🔍",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "thisWeek",
      label: "This Week",
      value: displayStats?.thisWeek || 0,
      icon: "📅",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-600 dark:text-green-400",
    },
  ];

  if (showAwesomeFlag) {
    statCards.push({
      id: "awesome",
      label: "Awesome",
      value: displayStats?.awesomeCount || 0,
      icon: "⭐",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      textColor: "text-yellow-600 dark:text-yellow-400",
    });
  }

  if (showVisibleNucleus) {
    statCards.push({
      id: "visibleNucleus",
      label: "Visible Nucleus",
      value: displayStats?.visibleNucleusCount || 0,
      icon: "🎯",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      textColor: "text-orange-600 dark:text-orange-400",
    });
  }

  if (showValidRedshift) {
    statCards.push({
      id: "validRedshift",
      label: "Valid Redshift",
      value: displayStats?.validRedshiftCount || 0,
      icon: "🔴",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-600 dark:text-red-400",
    });
  }

  if (showFailedFitting) {
    statCards.push({
      id: "failedFitting",
      label: "Failed Fitting",
      value: displayStats?.failedFittingCount || 0,
      icon: "❌",
      bgColor: "bg-rose-100 dark:bg-rose-900/30",
      textColor: "text-rose-600 dark:text-rose-400",
    });
  }

  statCards.push({
    id: "avgTime",
    label: "Avg Time",
    value: `${displayStats?.averageTime || 0}s`,
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LSB Classification Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            LSB Classification
          </h2>
          
          <div className="space-y-4">
            {lsbClassTypes.map((type) => {
              const count = displayStats?.byLsbClass[type.key] || 0;
              const percentage = totalClassifications > 0 ? (count / totalClassifications) * 100 : 0;
              
              return (
                <div key={type.key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${type.color} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-12 text-right">
                      {count}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalClassifications === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No classifications yet</p>
              <p className="text-sm">Start classifying galaxies to see your statistics!</p>
            </div>
          )}
        </div>

        {/* Morphology Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Morphology Classification
          </h2>
          
          <div className="space-y-4">
            {morphologyTypes.map((type) => {
              const count = displayStats?.byMorphology[type.key] || 0;
              const percentage = totalClassifications > 0 ? (count / totalClassifications) * 100 : 0;
              
              return (
                <div key={type.key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${type.color} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-12 text-right">
                      {count}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
    </div>
  );
}
