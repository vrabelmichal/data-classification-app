import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Statistics() {
  const stats = useQuery(api.users.getUserStats);
  const progress = useQuery(api.galaxies.getProgress);

  if (stats === undefined || progress === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const lsbClassTypes = [
    { key: "failed", label: "Failed Fitting", color: "bg-red-500", icon: "❌" },
    { key: "nonLSB", label: "Non-LSB", color: "bg-gray-500", icon: "⚪" },
    { key: "LSB", label: "LSB", color: "bg-green-500", icon: "🟢" },
  ];

  const morphologyTypes = [
    { key: "featureless", label: "Featureless", color: "bg-gray-500", icon: "⚫" },
    { key: "irregular", label: "Irregular", color: "bg-yellow-500", icon: "⚡" },
    { key: "spiral", label: "Spiral", color: "bg-blue-500", icon: "🌀" },
    { key: "elliptical", label: "Elliptical", color: "bg-purple-500", icon: "⭕" },
  ];

  const totalClassifications = stats ? stats.total : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Your classification progress and performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Classifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 text-lg">🔍</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.total || 0}</p>
            </div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 text-lg">📅</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">This Week</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.thisWeek || 0}</p>
            </div>
          </div>
        </div>

        {/* Awesome Galaxies */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-400 text-lg">⭐</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Awesome</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.awesomeCount || 0}</p>
            </div>
          </div>
        </div>

        {/* Average Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 dark:text-purple-400 text-lg">⏱️</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Avg Time</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.averageTime || 0}s</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LSB Classification Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            LSB Classification
          </h2>
          
          <div className="space-y-4">
            {lsbClassTypes.map((type) => {
              const count = stats?.byLsbClass[type.key] || 0;
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
              const count = stats?.byMorphology[type.key] || 0;
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
