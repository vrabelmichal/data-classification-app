import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

type BackfillResponse = {
  processed?: number;
  isDone?: boolean;
  continueCursor?: string | null;
};

export function BackfillClassificationAggregatesSection() {
  const backfill = useMutation(api.classifications.maintenance.backfillClassificationAggregates);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (
      !confirm(
        "Full backfill classification aggregates?\n\n" +
          "Clears and rebuilds all classification aggregates (awesome/visible/failed/valid, LSB, morphology, created)." +
          "\nUse this after schema changes or when data was bulk-edited."
      )
    )
      return;

    setBusy(true);
    setProgress(0);
    setStopRequested(false);
    stopRequestedRef.current = false;

    let cursor: string | null = null;
    let totalProcessed = 0;
    let stopped = false;

    try {
      for (let i = 0; i < 2000; i++) {
        if (stopRequestedRef.current) {
          toast.message("Backfill stopped", {
            description: `Processed ${totalProcessed.toLocaleString()} classifications so far.`,
          });
          stopped = true;
          break;
        }

        const res: BackfillResponse = await backfill({ cursor: cursor || undefined });
        totalProcessed += res.processed ?? 0;
        setProgress(totalProcessed);
        cursor = res.continueCursor || null;
        if (res.isDone || !cursor) break;
      }

      if (!stopped) {
        toast.success(`Backfill finished. Processed ${totalProcessed.toLocaleString()} classifications.`);
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
      <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-3">📚 Backfill Classification Aggregates (Full)</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        Clears and rebuilds all classification aggregates, including the created-at timeline. Use this when data was bulk-imported
        or you suspect aggregate drift.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        ⚠️ Slower than the fast option because it touches every aggregate and clears them first.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy ? `Backfilling (${progress.toLocaleString()})` : "Full backfill aggregates"}
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
