import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  DEFAULT_SEQUENCE_BLACKLIST_STATS_BATCH_SIZE,
  SEQUENCE_BLACKLIST_STATS_MAX_BATCH_SIZE,
} from "../../../lib/defaults";

type RebuildResult = {
  success: boolean;
  processed: number;
  isComplete: boolean;
  nextCursor: string | null;
  currentVersion: number;
  batchSize: number;
};

export function RebuildSequenceBlacklistStatsSection() {
  const rebuildState = useQuery(api.sequenceBlacklistStats.getRebuildSequenceBlacklistStatsState, {});
  const rebuild = useMutation(api.sequenceBlacklistStats.rebuildSequenceBlacklistStatsBatch);
  const [busy, setBusy] = useState(false);
  const [batchSize, setBatchSize] = useState(DEFAULT_SEQUENCE_BLACKLIST_STATS_BATCH_SIZE);
  const [processed, setProcessed] = useState(0);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const runRebuild = async (reset: boolean) => {
    if (
      !confirm(
        reset
          ? "Restart sequence blacklist stats backfill from the beginning? Existing cursor progress will be cleared."
          : "Run or resume sequence blacklist stats backfill?"
      )
    ) {
      return;
    }

    setBusy(true);
    setProcessed(0);
    setStopRequested(false);
    stopRequestedRef.current = false;

    let totalProcessed = 0;
    let completed = false;

    try {
      for (let iteration = 0; iteration < 10000; iteration += 1) {
        if (stopRequestedRef.current) {
          toast.message("Sequence blacklist stats rebuild stopped", {
            description: `Processed ${totalProcessed.toLocaleString()} sequences in this run.`,
          });
          break;
        }

        const result: RebuildResult = await rebuild({
          batchSize,
          reset: iteration === 0 ? reset : false,
        });

        totalProcessed += result.processed;
        setProcessed(totalProcessed);

        if (result.isComplete) {
          completed = true;
          toast.success(
            `Sequence blacklist stats rebuilt. Processed ${totalProcessed.toLocaleString()} sequences at version ${result.currentVersion}.`
          );
          break;
        }
      }

      if (!completed && !stopRequestedRef.current) {
        toast.info(
          `Sequence blacklist stats rebuild paused after ${totalProcessed.toLocaleString()} sequences. Resume to continue.`
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to rebuild sequence blacklist stats");
    } finally {
      setBusy(false);
      setStopRequested(false);
      stopRequestedRef.current = false;
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    setStopRequested(true);
  };

  const isStateLoading = rebuildState === undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400 mb-3">
        🧮 Rebuild Sequence Blacklist Stats
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Backfills persisted effective sequence counts for existing rows so user-facing progress and My Statistics can read cached blacklist-aware totals instead of computing them live.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 mb-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
        <div>
          <span className="font-medium">Admin path:</span> Maintenance → Aggregates → Rebuild Sequence Blacklist Stats
        </div>
        <div>
          <span className="font-medium">Current version:</span>{" "}
          {isStateLoading ? "Loading..." : rebuildState?.currentVersion.toLocaleString()}
        </div>
        <div>
          <span className="font-medium">Saved cursor:</span>{" "}
          {isStateLoading
            ? "Loading..."
            : rebuildState?.hasCursor
              ? "Present (a previous run can be resumed)"
              : "None (no saved progress)"}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Batch Size
        </label>
        <input
          type="number"
          min="1"
          max={SEQUENCE_BLACKLIST_STATS_MAX_BATCH_SIZE}
          value={batchSize}
          onChange={(event) => {
            const parsedValue = Number(event.target.value);

            if (Number.isNaN(parsedValue) || parsedValue <= 0) {
              setBatchSize(DEFAULT_SEQUENCE_BLACKLIST_STATS_BATCH_SIZE);
              return;
            }

            setBatchSize(
              Math.min(
                SEQUENCE_BLACKLIST_STATS_MAX_BATCH_SIZE,
                Math.max(1, parsedValue)
              )
            );
          }}
          disabled={busy}
          className="w-full sm:max-w-xs border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Default batch size: {DEFAULT_SEQUENCE_BLACKLIST_STATS_BATCH_SIZE}. Dedicated maximum batch size: {SEQUENCE_BLACKLIST_STATS_MAX_BATCH_SIZE}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void runRebuild(false)}
          disabled={busy}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {busy ? `Rebuilding (${processed.toLocaleString()})` : rebuildState?.hasCursor ? "Resume Rebuild" : "Start Rebuild"}
        </button>

        <button
          type="button"
          onClick={() => void runRebuild(true)}
          disabled={busy}
          className="inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Restart From Beginning
        </button>

        {busy && (
          <button
            type="button"
            onClick={handleStop}
            disabled={stopRequested}
            className="inline-flex items-center justify-center bg-gray-500 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-3 rounded-lg transition-colors"
          >
            {stopRequested ? "Stopping..." : "Stop"}
          </button>
        )}
      </div>
    </div>
  );
}