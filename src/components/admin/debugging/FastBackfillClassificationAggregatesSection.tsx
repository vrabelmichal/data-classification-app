import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

type BackfillResponse = {
  processed?: number;
  isDone?: boolean;
  continueCursor?: string | null;
};

export function FastBackfillClassificationAggregatesSection() {
  const backfill = useMutation(api.classifications.maintenance.fastBackfillClassificationAggregates);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (
      !confirm(
        "Fast backfill classification aggregates?\n\n" +
          "Rebuilds only the boolean/enum aggregates (awesome, visible nucleus, failed fitting, valid redshift, LSB, morphology)." +
          "\nSkips the created-at timeline for speed."
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
          toast.message("Fast backfill stopped", {
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
        toast.success(`Fast backfill finished. Processed ${totalProcessed.toLocaleString()} classifications.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Fast backfill failed");
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
      <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3">⚡ Fast Backfill Classification Aggregates</h2>

      <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <span className="text-red-600 dark:text-red-400 shrink-0 mt-0.5">⛔</span>
        <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">Do not run while users are actively labeling.</p>
          <p>
            Despite the "fast" name, this still clears the boolean/enum classification aggregates
            before rebuilding them. A classification submitted during the clear → rebuild window
            will be inserted into the empty aggregate; the rebuild will then hit a{" "}
            <strong>duplicate-key error on that record and fail the entire batch</strong>, stalling
            indefinitely until you restart from scratch.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        Rebuilds boolean and enum classification aggregates without touching the created-at timeline. Best when you need quick recovery
        after small data fixes.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        Skips aggregates that sort by creation time; use the full backfill if that ordering matters.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy ? `Backfilling (${progress.toLocaleString()})` : "Fast backfill aggregates"}
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
