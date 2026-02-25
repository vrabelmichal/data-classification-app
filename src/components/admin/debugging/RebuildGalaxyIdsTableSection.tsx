import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function RebuildGalaxyIdsTableSection() {
  const [rebuildingGalaxyIdsTable, setRebuildingGalaxyIdsTable] = useState(false);
  const [rebuildIdsTableCursor, setRebuildIdsTableCursor] = useState<string | null>(null);
  const [rebuildIdsTableProgress, setRebuildIdsTableProgress] = useState<number>(0);
  const rebuildGalaxyIdsTable = useMutation(api.galaxies.maintenance.rebuildGalaxyIdsTable);

  const handleRebuildGalaxyIdsTable = async () => {
    if (!confirm("Rebuild galaxy IDs table? This will clear and rebuild the galaxyIds table from the galaxies table. This may take some time for large datasets and will process in batches.")) return;
    try {
      setRebuildingGalaxyIdsTable(true);
      setRebuildIdsTableProgress(0); // Reset progress
      let totalProcessed = 0;
      let iterations = 0;
      let currentCursor = rebuildIdsTableCursor;
      let currentStartNumericId = BigInt(1);
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await rebuildGalaxyIdsTable({
          cursor: currentCursor || undefined,
          startNumericId: currentStartNumericId,
        });
        totalProcessed += result.processed || 0;
        setRebuildIdsTableProgress(totalProcessed); // Update progress
        currentCursor = result.cursor || null;
        setRebuildIdsTableCursor(result.cursor || null);
        currentStartNumericId = result.nextStartNumericId || currentStartNumericId;

        if (result.isDone) break;
        iterations++;
      }

      // Reset cursor and progress when done
      if (currentCursor === null) {
        setRebuildIdsTableCursor(null);
        setRebuildIdsTableProgress(0);
      }

      toast.success(`Galaxy IDs table rebuilt successfully. Processed ${totalProcessed} galaxies across ${iterations + 1} batches`);
    } catch (e) {
      toast.error("Failed to rebuild galaxy IDs table");
      console.error(e);
      setRebuildIdsTableProgress(0); // Reset on error
    } finally {
      setRebuildingGalaxyIdsTable(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-4">🔨 Rebuild Galaxy IDs Table</h2>

      <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
        <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">⚠️</span>
        <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Galaxy sequence assignment will be unavailable during this operation.</p>
          <p>
            The entire <code>galaxyIds</code> table is deleted on the first batch, then rebuilt
            across multiple subsequent mutation calls. During that window, ingest existence checks
            and galaxy sequence assignment will find no entries and fail. Individual classification
            submission is unaffected (it queries <code>galaxies</code> directly).
          </p>
          <p>Run when no new galaxy sequences are being generated and no ingest is in progress.</p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rebuild galaxyIds table from galaxies table. Clears the table first, then rebuilds with sequential numericIds. Processes in batches of 200 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => void (async () => { await handleRebuildGalaxyIdsTable(); })()}
          disabled={rebuildingGalaxyIdsTable}
          className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {rebuildingGalaxyIdsTable && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {rebuildingGalaxyIdsTable ? 'Rebuilding...' : 'Rebuild IDs Table'}
        </button>
        {rebuildIdsTableProgress > 0 && (
          <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
            {rebuildIdsTableProgress.toLocaleString()} processed
          </div>
        )}
      </div>
    </div>
  );
}