import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function ClearGalaxyAggregatesSection() {
  const [clearingGalaxyAggregates, setClearingGalaxyAggregates] = useState(false);
  const clearGalaxyAggregates = useMutation(api.galaxies_aggregates.clearGalaxyAggregates);

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