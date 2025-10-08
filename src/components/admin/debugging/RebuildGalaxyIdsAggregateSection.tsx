import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function RebuildGalaxyIdsAggregateSection() {
  const [rebuildingGalaxyIdsAggregate, setRebuildingGalaxyIdsAggregate] = useState(false);
  const [rebuildIdsCursor, setRebuildIdsCursor] = useState<string | null>(null);
  const [rebuildIdsProgress, setRebuildIdsProgress] = useState<number>(0);
  const rebuildGalaxyIdsAggregate = useMutation(api.galaxies.aggregates.rebuildGalaxyIdsAggregate);

  const handleRebuildGalaxyIdsAggregate = async () => {
    if (!confirm("Rebuild galaxy IDs aggregate? This may take some time for large datasets and will process in batches.")) return;
    try {
      setRebuildingGalaxyIdsAggregate(true);
      setRebuildIdsProgress(0); // Reset progress
      let totalProcessed = 0;
      let iterations = 0;
      let currentCursor = rebuildIdsCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await rebuildGalaxyIdsAggregate({
          cursor: currentCursor || undefined,
        });
        totalProcessed += result.processed || 0;
        setRebuildIdsProgress(totalProcessed); // Update progress
        currentCursor = result.continueCursor || null;
        setRebuildIdsCursor(result.continueCursor || null);

        if (result.isDone) break;
        iterations++;
      }

      // Reset cursor and progress when done
      if (currentCursor === null) {
        setRebuildIdsCursor(null);
        setRebuildIdsProgress(0);
      }

      toast.success(`Galaxy IDs aggregate rebuilt successfully. Processed ${totalProcessed} galaxy IDs across ${iterations + 1} batches`);
    } catch (e) {
      toast.error("Failed to rebuild galaxy IDs aggregate");
      console.error(e);
      setRebuildIdsProgress(0); // Reset on error
    } finally {
      setRebuildingGalaxyIdsAggregate(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-4">🔨 Rebuild Galaxy IDs Aggregate</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rebuild galaxy IDs aggregate from scratch. Processes in batches of 200 to avoid timeouts and will continue until all galaxy IDs are processed. Required after clearing the aggregate or if it becomes corrupted.
      </p>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => void (async () => { await handleRebuildGalaxyIdsAggregate(); })()}
          disabled={rebuildingGalaxyIdsAggregate}
          className="inline-flex items-center justify-center bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {rebuildingGalaxyIdsAggregate && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {rebuildingGalaxyIdsAggregate ? 'Rebuilding...' : 'Rebuild IDs Aggregate'}
        </button>
        {rebuildIdsProgress > 0 && (
          <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            {rebuildIdsProgress.toLocaleString()} processed
          </div>
        )}
      </div>
    </div>
  );
}