import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function FillGalaxyNumericIdSection() {
  const [fillingNumericId, setFillingNumericId] = useState(false);
  const [fillingNumericIdCursor, setFillingNumericIdCursor] = useState<string | null>(null);
  const [nextStartNumericId, setNextStartNumericId] = useState<bigint | null>(null);
  const [progress, setProgress] = useState<{
    currentBatch: number;
    totalProcessed: number;
    currentNumericId: bigint;
  } | null>(null);
  const fillGalaxyNumericId = useMutation(api.galaxies.maintenance.fillGalaxyNumericId);

  const handleFillGalaxyNumericId = async () => {
    try {
      setFillingNumericId(true);
      let totalUpdated = 0;
      let iterations = 0;
      let currentCursor = fillingNumericIdCursor;
      let currentStartNumericId = nextStartNumericId || BigInt(1);
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        setProgress({
          currentBatch: iterations + 1,
          totalProcessed: totalUpdated,
          currentNumericId: currentStartNumericId,
        });

        const result = await fillGalaxyNumericId({
          cursor: currentCursor || undefined,
          startNumericId: currentCursor ? currentStartNumericId : undefined,
        });
        totalUpdated += result.updated;
        currentCursor = result.cursor;
        setFillingNumericIdCursor(result.cursor);
        currentStartNumericId = result.nextStartNumericId;
        setNextStartNumericId(result.nextStartNumericId);

        if (result.isDone || result.updated === 0) break;
        iterations++;
      }

      // Reset cursor and startNumericId when done
      if (currentCursor === null) {
        setFillingNumericIdCursor(null);
        setNextStartNumericId(null);
      }

      toast.success(`Filled numericId for ${totalUpdated} galaxies across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to fill galaxy numericId");
      console.error(error);
      setProgress(null);
    } finally {
      setFillingNumericId(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-teal-600 dark:text-teal-400 mb-4">🔢 Fill Galaxy Numeric ID</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Fill missing numericId values in galaxies table using data from galaxyIds table. Processes in batches of 200 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      {progress && (
        <div className="text-sm text-blue-600 dark:text-blue-400 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="font-medium">Processing Status:</div>
          <div>Batch: {progress.currentBatch}</div>
          <div>Total Processed: {progress.totalProcessed}</div>
          <div>Current Numeric ID: {progress.currentNumericId.toString()}</div>
        </div>
      )}
      <button
        onClick={() => void (async () => { await handleFillGalaxyNumericId(); })()}
        disabled={fillingNumericId}
        className="inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {fillingNumericId && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {fillingNumericId ? 'Filling...' : 'Fill Numeric ID'}
      </button>
    </div>
  );
}