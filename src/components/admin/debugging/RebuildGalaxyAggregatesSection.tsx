import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function RebuildGalaxyAggregatesSection() {
  const [rebuildingGalaxyAggregates, setRebuildingGalaxyAggregates] = useState(false);
  const [rebuildCursor, setRebuildCursor] = useState<string | null>(null);
  const [rebuildProgress, setRebuildProgress] = useState<number>(0);
  const [totalGalaxies, setTotalGalaxies] = useState<number | null>(null);
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const stopRebuildingRef = useRef(false);
  const rebuildGalaxyAggregates = useMutation(api.galaxies.aggregates.rebuildGalaxyAggregates);

  const handleRebuildGalaxyAggregates = async () => {
    if (!confirm("Rebuild galaxy aggregates? This may take some time for large datasets and will process in batches.")) return;
    try {
      setRebuildingGalaxyAggregates(true);
      setRebuildProgress(0); // Reset progress
      setTotalGalaxies(null);
      setCurrentBatch(0);
      stopRebuildingRef.current = false; // Reset stop flag
      let totalProcessed = 0;
      let iterations = 0;
      let currentCursor = rebuildCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        if (stopRebuildingRef.current) {
          console.log('[RebuildGalaxyAggregates] Operation stopped by user');
          break;
        }

        const result = await rebuildGalaxyAggregates({
          cursor: currentCursor || undefined,
        });
        totalProcessed += result.processed || 0;
        setRebuildProgress(totalProcessed); // Update progress
        if (result.totalGalaxies) {
          setTotalGalaxies(result.totalGalaxies);
        }
        setCurrentBatch(iterations + 1);
        currentCursor = result.continueCursor || null;
        setRebuildCursor(result.continueCursor || null);

        if (result.isDone) break;
        iterations++;
      }

      // Reset cursor and progress when done or stopped
      if (currentCursor === null || stopRebuildingRef.current) {
        setRebuildCursor(null);
        setRebuildProgress(0);
        setTotalGalaxies(null);
        setCurrentBatch(0);
      }

      if (stopRebuildingRef.current) {
        toast.info(`Galaxy aggregates rebuild stopped. Processed ${totalProcessed} galaxies across ${iterations + 1} batches so far.`);
      } else {
        toast.success(`Galaxy aggregates rebuilt successfully. Processed ${totalProcessed} galaxies across ${iterations + 1} batches`);
      }
    } catch (e) {
      toast.error("Failed to rebuild galaxy aggregates");
      console.error(e);
      setRebuildProgress(0); // Reset on error
      setTotalGalaxies(null);
      setCurrentBatch(0);
    } finally {
      setRebuildingGalaxyAggregates(false);
      stopRebuildingRef.current = false;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-4">🔨 Rebuild Galaxy Aggregates</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rebuild galaxy aggregates from scratch. Clears existing aggregates first, then rebuilds in batches of 20 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
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
          {rebuildingGalaxyAggregates && (
            <button
              onClick={() => stopRebuildingRef.current = true}
              className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              🛑 Stop
            </button>
          )}
        </div>
        {rebuildProgress > 0 && (
          <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {rebuildProgress.toLocaleString()} processed
          </div>
        )}
      </div>
      {rebuildingGalaxyAggregates && totalGalaxies && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>Progress</span>
            <span>{Math.round((rebuildProgress / totalGalaxies) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((rebuildProgress / totalGalaxies) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Batch {currentBatch} • {totalGalaxies.toLocaleString()} total galaxies
          </div>
        </div>
      )}
    </div>
  );
}