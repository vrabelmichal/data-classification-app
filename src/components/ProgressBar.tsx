interface ProgressBarProps {
  progress: {
    total: number;
    classified: number;
    skipped: number;
    remaining: number;
  };
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const completionPercentage = progress.total > 0 
    ? Math.round(((progress.classified + progress.skipped) / progress.total) * 100)
    : 0;

  const classifiedPercentage = progress.total > 0
    ? (progress.classified / progress.total) * 100
    : 0;

  const skippedPercentage = progress.total > 0
    ? (progress.skipped / progress.total) * 100
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
            {progress.total}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Total</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-600 dark:text-green-400">
            {progress.classified}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Classified</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-yellow-600 dark:text-yellow-400">
            {progress.skipped}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Skipped</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-blue-600 dark:text-blue-400">
            {progress.remaining}
          </div>
          <div className="text-gray-500 dark:text-gray-400">Remaining</div>
        </div>
      </div>
    </div>
  );
}
