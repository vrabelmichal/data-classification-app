import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function ZeroOutGalaxyStatisticsSection() {
  const [zeroingStatistics, setZeroingStatistics] = useState(false);
  const [zeroingCursor, setZeroingCursor] = useState<string | null>(null);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const zeroOutGalaxyStatistics = useMutation(api.galaxies.maintenance.zeroOutGalaxyStatistics);

  const handleZeroOutGalaxyStatistics = async () => {
    try {
      setZeroingStatistics(true);
      let totalUpdated = 0;
      let iterations = 0;
      let currentCursor = zeroingCursor;
      let currentTotalProcessed = totalProcessed;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await zeroOutGalaxyStatistics({
          cursor: currentCursor || undefined,
        });
        totalUpdated += result.updated;
        currentTotalProcessed += result.totalProcessed || result.updated;
        currentCursor = result.cursor;
        setZeroingCursor(result.cursor);
        setTotalProcessed(currentTotalProcessed);

        if (result.isDone || result.updated === 0) break;
        iterations++;
      }

      // Reset cursor and total when done
      if (currentCursor === null) {
        setZeroingCursor(null);
        setTotalProcessed(0);
      }

      toast.success(`Zeroed out statistics for ${totalUpdated} galaxies across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to zero out galaxy statistics");
      console.error(error);
    } finally {
      setZeroingStatistics(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">🔄 Zero Out Galaxy Statistics</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Reset galaxy statistics columns (totalClassifications, numVisibleNucleus, numAwesomeFlag) to zero for all galaxies. Processes in batches of 1000 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      <button
        onClick={() => void (async () => { await handleZeroOutGalaxyStatistics(); })()}
        disabled={zeroingStatistics}
        className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {zeroingStatistics && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {zeroingStatistics 
          ? `Zeroing... (${totalProcessed} processed)` 
          : 'Zero Out Statistics'
        }
      </button>
    </div>
  );
}