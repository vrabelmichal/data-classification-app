import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

type BackfillResponse = {
  processed?: number;
  updated?: number;
  isDone?: boolean;
  continueCursor?: string | null;
};

export function BackfillGalaxyClassificationsSection() {
  const backfill = useMutation(api.galaxies.maintenance.backfillGalaxyClassificationStats);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (
      !confirm(
        "Backfill galaxy classification stats?\n\n" +
          "This scans galaxies in batches and recomputes totalClassifications, numAwesomeFlag, and numVisibleNucleus."
      )
    )
      return;
    setBusy(true);
    setProgress(0);
    setStopRequested(false);
    stopRequestedRef.current = false;
    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let stopped = false;
    try {
      for (let i = 0; i < 2000; i++) {
        if (stopRequestedRef.current) {
          toast.message("Backfill stopped", {
            description: `Processed ${totalProcessed.toLocaleString()}, updated ${totalUpdated.toLocaleString()}.`,
          });
          stopped = true;
          break;
        }
        const res: BackfillResponse = await backfill({ cursor: cursor || undefined });
        totalProcessed += res.processed ?? 0;
        totalUpdated += res.updated ?? 0;
        setProgress(totalProcessed);
        cursor = res.continueCursor || null;
        if (res.isDone || !cursor) break;
      }
      if (!stopped) {
        toast.success(`Backfill finished. Processed ${totalProcessed.toLocaleString()}, updated ${totalUpdated.toLocaleString()}.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Backfill failed");
    } finally {
      setBusy(false);
      setProgress(0);
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
      <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-3">🧮 Backfill Galaxy Classification Stats</h2>
      <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
        Full rescan of all galaxies that counts classifications and recomputes <code>totalClassifications</code>, <code>numAwesomeFlag</code>, and <code>numVisibleNucleus</code> to keep aggregates correct.
        Use this when you need exact totals (including zeros after deletes) rather than the faster classifications-first sweep.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        <strong>⚠️ Expect a long run time and heavy database load.</strong> Prefer the fast backfill when you only need updates for galaxies that already have classifications.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy ? `Backfilling (${progress.toLocaleString()})` : "Backfill classification stats"}
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
