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

export function BackfillUserClassificationCountersSection() {
  const backfill = useMutation(api.classifications.maintenance.fullBackfillUserClassificationCounters);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ users: 0, updated: 0 });
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const handleBackfill = async () => {
    if (
      !confirm(
        "Full backfill user counters?\n\n" +
          "Recomputes per-user classification counters (awesome/visible/failed/valid, LSB, morphology) and classificationsCount by scanning each user's classifications."
      )
    )
      return;

    setBusy(true);
    setProgress({ users: 0, updated: 0 });
    setStopRequested(false);
    stopRequestedRef.current = false;

    let cursor: string | null = null;
    let usersProcessed = 0;
    let usersUpdated = 0;
    let stopped = false;

    try {
      for (let i = 0; i < 2000; i++) {
        if (stopRequestedRef.current) {
          toast.message("Backfill stopped", {
            description: `Processed ${usersProcessed.toLocaleString()} users, updated ${usersUpdated.toLocaleString()}.`,
          });
          stopped = true;
          break;
        }

        const res: BackfillResponse = await backfill({ cursor: cursor || undefined });
        usersProcessed += res.processed ?? 0;
        usersUpdated += res.updated ?? 0;
        setProgress({ users: usersProcessed, updated: usersUpdated });
        cursor = res.continueCursor || null;
        if (res.isDone || !cursor) break;
      }

      if (!stopped) {
        toast.success(
          `Backfill finished. Processed ${usersProcessed.toLocaleString()} users, updated ${usersUpdated.toLocaleString()}.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Backfill failed");
    } finally {
      setBusy(false);
      setProgress({ users: 0, updated: 0 });
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
      <h2 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400 mb-3">👥 Backfill User Classification Counters (Full)</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        Scans every user and recomputes all per-user classification counters from scratch. Use this when counters drift or after bulk
        edits to classifications.
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Touches every user profile; expect a slower run.</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy
            ? `Backfilling (${progress.users.toLocaleString()} users, ${progress.updated.toLocaleString()} updated)`
            : "Full backfill user counters"}
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
