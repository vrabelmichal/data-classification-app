import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function ClearGalaxyIdsAggregateSection() {
  const [clearingAggregate, setClearingAggregate] = useState(false);
  const clearGalaxyIdsAggregate = useMutation(api.galaxies.aggregates.clearGalaxyIdsAggregate);

  const handleClearGalaxyIdsAggregate = async () => {
    if (!confirm("Clear galaxy IDs aggregate? This cannot be undone.")) return;
    try {
      setClearingAggregate(true);
      const res: any = await clearGalaxyIdsAggregate();
      toast.success(res?.message || "Galaxy IDs aggregate cleared");
    } catch (e) {
      toast.error("Failed to clear galaxy aggregate");
      console.error(e);
    } finally {
      setClearingAggregate(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clear Galaxy IDs Aggregate</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        This will clear the galaxy IDs aggregate. This action cannot be undone.
      </p>
      <button
        onClick={() => void (async () => { await handleClearGalaxyIdsAggregate(); })()}
        disabled={clearingAggregate}
        className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {clearingAggregate && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {clearingAggregate ? 'Clearing...' : 'Clear Galaxy IDs Aggregate'}
      </button>
    </div>
  );
}