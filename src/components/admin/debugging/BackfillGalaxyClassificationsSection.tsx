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
  const backfill = useMutation(api.galaxies.maintenance.backfillGalaxyClassificationCounts);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (!confirm("Backfill totalClassifications for galaxies? This scans galaxies in batches.")) return;
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
      <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-3">🧮 Backfill Galaxy Classifications</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Recompute each galaxy's totalClassifications from existing classification rows and refresh aggregates. Run after imports or manual edits.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy ? `Backfilling (${progress.toLocaleString()})` : "Backfill classifications"}
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
