import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function RebuildGalaxyAggregatesSection() {
  const [rebuildingGalaxyAggregates, setRebuildingGalaxyAggregates] = useState(false);
  const [rebuildCursor, setRebuildCursor] = useState<string | null>(null);
  const [rebuildProgress, setRebuildProgress] = useState<number>(0);
  const rebuildGalaxyAggregates = useMutation(api.galaxies_aggregates.rebuildGalaxyAggregates);

  const handleRebuildGalaxyAggregates = async () => {
    if (!confirm("Rebuild galaxy aggregates? This may take some time for large datasets and will process in batches.")) return;
    try {
      setRebuildingGalaxyAggregates(true);
      setRebuildProgress(0); // Reset progress
      let totalProcessed = 0;
      let iterations = 0;
      let currentCursor = rebuildCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await rebuildGalaxyAggregates({
          cursor: currentCursor || undefined,
        });
        totalProcessed += result.processed || 0;
        setRebuildProgress(totalProcessed); // Update progress
        currentCursor = result.continueCursor || null;
        setRebuildCursor(result.continueCursor || null);

        if (result.isDone) break;
        iterations++;
      }

      // Reset cursor and progress when done
      if (currentCursor === null) {
        setRebuildCursor(null);
        setRebuildProgress(0);
      }

      toast.success(`Galaxy aggregates rebuilt successfully. Processed ${totalProcessed} galaxies across ${iterations + 1} batches`);
    } catch (e) {
      toast.error("Failed to rebuild galaxy aggregates");
      console.error(e);
      setRebuildProgress(0); // Reset on error
    } finally {
      setRebuildingGalaxyAggregates(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-4">🔨 Rebuild Galaxy Aggregates</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rebuild galaxy aggregates from scratch. Processes in batches of 200 to avoid timeouts and will continue until all galaxies are processed. Required after clearing aggregates or if aggregates become corrupted.
      </p>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => void (async () => { await handleRebuildGalaxyAggregates(); })()}
          disabled={rebuildingGalaxyAggregates}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {rebuildingGalaxyAggregates && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {rebuildingGalaxyAggregates ? 'Rebuilding...' : 'Rebuild Aggregates'}
        </button>
        {rebuildProgress > 0 && (
          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {rebuildProgress.toLocaleString()} processed
          </div>
        )}
      </div>
    </div>
  );
}