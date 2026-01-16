import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

type BackfillResponse = {
  processed?: number;
  uniqueUsers?: number;
  updated?: number;
  isDone?: boolean;
  continueCursor?: string | null;
};

export function FastBackfillUserClassificationCountersSection() {
  const backfill = useMutation(api.classifications.maintenance.fastBackfillUserClassificationCounters);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ classifications: 0, users: 0, updated: 0 });
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (
      !confirm(
        "Fast backfill user counters?\n\n" +
          "Scans the classifications table and refreshes counters for users seen in the batch. Faster but won't touch users with zero classifications."
      )
    )
      return;

    setBusy(true);
    setProgress({ classifications: 0, users: 0, updated: 0 });
    setStopRequested(false);
    stopRequestedRef.current = false;

    let cursor: string | null = null;
    let classificationsProcessed = 0;
    let usersSeen = 0;
    let usersUpdated = 0;
    let stopped = false;

    try {
      for (let i = 0; i < 2000; i++) {
        if (stopRequestedRef.current) {
          toast.message("Fast backfill stopped", {
            description: `Processed ${classificationsProcessed.toLocaleString()} classifications, updated ${usersUpdated.toLocaleString()} users.`,
          });
          stopped = true;
          break;
        }

        const res: BackfillResponse = await backfill({ cursor: cursor || undefined });
        classificationsProcessed += res.processed ?? 0;
        usersSeen += res.uniqueUsers ?? 0;
        usersUpdated += res.updated ?? 0;
        setProgress({ classifications: classificationsProcessed, users: usersSeen, updated: usersUpdated });
        cursor = res.continueCursor || null;
        if (res.isDone || !cursor) break;
      }

      if (!stopped) {
        toast.success(
          `Fast backfill finished. Processed ${classificationsProcessed.toLocaleString()} classifications, updated ${usersUpdated.toLocaleString()} users.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Fast backfill failed");
    } finally {
      setBusy(false);
      setProgress({ classifications: 0, users: 0, updated: 0 });
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
      <h2 className="text-lg font-semibold text-teal-700 dark:text-teal-400 mb-3">⚡ Fast Backfill User Classification Counters</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        Updates per-user counters for users that appear in the scanned classifications. Faster when most users have no activity.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        Skips users with zero classifications. Run the full backfill to reset everyone.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy
            ? `Processing (${progress.classifications.toLocaleString()} classifications)`
            : "Fast backfill user counters"}
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
