interface ProgressBarProps {
  progress: {
    total: number;
    classified: number;
    skipped: number;
    remaining: number;
    effectiveTotal?: number;
    effectiveClassified?: number;
    effectiveSkipped?: number;
    effectiveRemaining?: number;
    effectivePercentage?: number;
    blacklistedTotal?: number;
    blacklistedClassifiedCount?: number;
  };
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const displayTotal = progress.effectiveTotal ?? progress.total;
  const displayClassified = progress.effectiveClassified ?? progress.classified;
  const displaySkipped = progress.effectiveSkipped ?? progress.skipped;
  const displayRemaining = progress.effectiveRemaining ?? progress.remaining;
  const blacklistedTotal = progress.blacklistedTotal ?? 0;
  const blacklistedClassifiedCount = progress.blacklistedClassifiedCount ?? 0;
  const completionPercentage =
    progress.effectivePercentage ??
    (displayTotal > 0 ? Math.round(((displayClassified + displaySkipped) / displayTotal) * 100) : 0);

  const classifiedPercentage = displayTotal > 0
    ? (displayClassified / displayTotal) * 100
    : 0;

  const skippedPercentage = displayTotal > 0
    ? (displaySkipped / displayTotal) * 100
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Progress
        </h3>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {completionPercentage}% Complete
        </span>
      </div>

      {blacklistedTotal > 0 && (
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Excludes {blacklistedTotal.toLocaleString()} blacklisted galaxies from the progress total. You have classified {blacklistedClassifiedCount.toLocaleString()} of them.
        </p>
      )}

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
        <div className="h-full flex">
          <div 
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${classifiedPercentage}%` }}
          />
          <div 
            className="bg-yellow-500 transition-all duration-300"
            style={{ width: `${skippedPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold text-gray-900 dark:text-white">
            {displayTotal}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Total</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-600 dark:text-green-400">
            {displayClassified}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Classified</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-yellow-600 dark:text-yellow-400">
            {displaySkipped}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Skipped</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-blue-600 dark:text-blue-400">
            {displayRemaining}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Remaining</div>
        </div>
      </div>
    </div>
  );
}
