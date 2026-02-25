import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function ClearGalaxyAggregatesSection() {
  const [clearingGalaxyAggregates, setClearingGalaxyAggregates] = useState(false);
  const clearGalaxyAggregates = useMutation(api.galaxies.aggregates.clearGalaxyAggregates);

  const handleClearGalaxyAggregates = async () => {
    if (!confirm("Clear galaxy aggregates? This will affect pagination performance until aggregates are rebuilt.")) return;
    try {
      setClearingGalaxyAggregates(true);
      await clearGalaxyAggregates();
      toast.success("Galaxy aggregates cleared");
    } catch (e) {
      toast.error("Failed to clear galaxy aggregates");
      console.error(e);
    } finally {
      setClearingGalaxyAggregates(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-4">🔄 Clear Galaxy Aggregates</h2>

      <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <span className="text-red-600 dark:text-red-400 shrink-0 mt-0.5">⛔</span>
        <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">Do not clear without immediately running a rebuild — and do not run while users are actively labeling.</p>
          <p>
            This immediately removes all entries from the galaxy aggregates including{" "}
            <code>galaxiesByTotalClassifications</code>, <code>galaxiesByNumAwesomeFlag</code>, and{" "}
            <code>galaxiesByNumVisibleNucleus</code>. If any user submits a classification after the
            clear but before the rebuild finishes, their entry will be inserted into the empty
            aggregate. The subsequent rebuild will then hit a{" "}
            <strong>duplicate-key error on that galaxy and fail the entire rebuild batch</strong>,
            stalling indefinitely.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Clear all galaxy aggregates used for pagination. This will affect pagination performance until aggregates are rebuilt.
      </p>
      <button
        onClick={() => void (async () => { await handleClearGalaxyAggregates(); })()}
        disabled={clearingGalaxyAggregates}
        className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {clearingGalaxyAggregates && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {clearingGalaxyAggregates ? 'Clearing...' : 'Clear Aggregates'}
      </button>
    </div>
  );
}