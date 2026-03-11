import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

export function RebuildGalaxyBlacklistAggregateSection() {
  const rebuild = useMutation(api.galaxies.aggregates.rebuildGalaxyBlacklistAggregate);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRebuild = async () => {
    if (!confirm("Rebuild the galaxy blacklist aggregate from existing blacklist rows? This clears the aggregate first and repopulates it in batches.")) {
      return;
    }

    setBusy(true);
    setProgress(0);

    let cursor: string | null = null;
    let totalProcessed = 0;
    let iterations = 0;
    const maxIterations = 10000;

    try {
      while (iterations < maxIterations) {
        const result: {
          processed?: number;
          continueCursor?: string | null;
          isDone?: boolean;
        } = await rebuild({ cursor: cursor ?? undefined });

        totalProcessed += result.processed ?? 0;
        setProgress(totalProcessed);
        cursor = result.continueCursor ?? null;

        if (result.isDone || !cursor) {
          break;
        }

        iterations += 1;
      }

      toast.success(
        `Blacklist aggregate rebuilt. Processed ${totalProcessed.toLocaleString()} rows across ${iterations + 1} batches.`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to rebuild blacklist aggregate");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-3">📋 Rebuild Blacklist Aggregate</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Rebuild the aggregate that powers blacklist row counts in admin summaries. Run this once after deploying the aggregate, or again if you suspect it drifted.
      </p>
      <button
        onClick={() => void handleRebuild()}
        disabled={busy}
        className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {busy ? `Processing (${progress.toLocaleString()})` : "Rebuild Aggregate"}
      </button>
    </div>
  );
}