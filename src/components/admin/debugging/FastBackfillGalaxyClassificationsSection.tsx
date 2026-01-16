import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

type FastBackfillResponse = {
  processed?: number;
  uniqueGalaxies?: number;
  galaxiesUpdated?: number;
  isDone?: boolean;
  continueCursor?: string | null;
};

export function FastBackfillGalaxyClassificationsSection() {
  const fastBackfill = useMutation(api.galaxies.maintenance.fastBackfillGalaxyClassificationStats);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ classifications: 0, galaxiesUpdated: 0 });
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleFastBackfill = async () => {
    if (
      !confirm(
        "Fast backfill classification stats?\n\n" +
          "This scans the classifications table (not galaxies) and updates only galaxies that have classifications.\n" +
          "Recomputes totalClassifications, numAwesomeFlag, and numVisibleNucleus for those galaxies.\n\n" +
          "⚠️ Note: Galaxies with 0 classifications won't be reset. Use 'Zero Out Statistics' first if needed."
      )
    )
      return;

    setBusy(true);
    setProgress({ classifications: 0, galaxiesUpdated: 0 });
    setStopRequested(false);
    stopRequestedRef.current = false;

    let cursor: string | null = null;
    let totalClassifications = 0;
    let totalGalaxiesUpdated = 0;
    let stopped = false;

    try {
      for (let i = 0; i < 2000; i++) {
        if (stopRequestedRef.current) {
          toast.message("Fast backfill stopped", {
            description: `Processed ${totalClassifications.toLocaleString()} classifications, updated ${totalGalaxiesUpdated.toLocaleString()} galaxies.`,
          });
          stopped = true;
          break;
        }

        const res: FastBackfillResponse = await fastBackfill({ cursor: cursor || undefined });
        totalClassifications += res.processed ?? 0;
        totalGalaxiesUpdated += res.galaxiesUpdated ?? 0;
        setProgress({ classifications: totalClassifications, galaxiesUpdated: totalGalaxiesUpdated });
        cursor = res.continueCursor || null;
        if (res.isDone || !cursor) break;
      }

      if (!stopped) {
        toast.success(
          `Fast backfill finished. Processed ${totalClassifications.toLocaleString()} classifications, updated ${totalGalaxiesUpdated.toLocaleString()} galaxies.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Fast backfill failed");
    } finally {
      setBusy(false);
      setProgress({ classifications: 0, galaxiesUpdated: 0 });
      setStopRequested(false);
      stopRequestedRef.current = false;
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    setStopRequested(true);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-3">
        ⚡ Fast Backfill Galaxy Classification Stats
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
        Recompute <code>totalClassifications</code>, <code>numAwesomeFlag</code>, and <code>numVisibleNucleus</code> by scanning the{" "}
        <strong>classifications table</strong> instead of all galaxies. Much faster when most galaxies have no classifications.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        ⚠️ Only updates galaxies with ≥1 classification. Does not reset counts to 0. Use "Zero Out
        Statistics" first if classifications were deleted.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleFastBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {busy
            ? `Processing (${progress.classifications.toLocaleString()} classifications)`
            : "Fast backfill"}
        </button>
        {busy && (
          <button
            type="button"
            onClick={handleStop}
            disabled={stopRequested}
            className="inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-3 rounded-lg transition-colors"
          >
            {stopRequested ? "Stopping..." : "Stop"}
          </button>
        )}
      </div>
    </div>
  );
}
