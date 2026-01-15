import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

export function BackfillUserGalaxyClassificationsSection() {
  const backfill = useMutation(api.admin.backfillUserGalaxyClassifications);
  const status = useQuery(api.admin.getBackfillStatus);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, inserted: 0, skipped: 0 });

  const statusText = useMemo(() => {
    if (!status) return "";
    const totalC = typeof status.totalClassifications === "string" ? status.totalClassifications : status.totalClassifications.toString();
    const totalT = typeof status.totalTracking === "string" ? status.totalTracking : status.totalTracking.toString();
    return status.isComplete
      ? `Backfill complete. Tracking rows: ${totalT} / Classifications: ${totalC}`
      : `${totalC} classifications, ${totalT} tracking rows. ${status.message ?? "Run backfill"}`;
  }, [status]);

  const handleBackfill = async () => {
    if (!confirm("Backfill userGalaxyClassifications? This may take several runs on large datasets.")) return;
    setBusy(true);
    setProgress({ processed: 0, inserted: 0, skipped: 0 });

    try {
      let totalProcessed = 0;
      let totalInserted = 0;
      let totalSkipped = 0;
      let isDone = false;

      // Run a few passes; each pass processes up to ~500 rows by default
      for (let i = 0; i < 12; i++) {
        const res = await backfill({});
        totalProcessed += res.processed ?? 0;
        totalInserted += res.inserted ?? 0;
        totalSkipped += res.skipped ?? 0;
        isDone = !!res.isDone;
        setProgress({ processed: totalProcessed, inserted: totalInserted, skipped: totalSkipped });
        if (isDone) break;
      }

      toast.success(
        isDone
          ? `Backfill complete. Processed ${totalProcessed.toLocaleString()}, inserted ${totalInserted.toLocaleString()}.`
          : `Processed ${totalProcessed.toLocaleString()} so far. Run again to continue.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Backfill failed");
    } finally {
      setBusy(false);
      setProgress({ processed: 0, inserted: 0, skipped: 0 });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-3">🔄 Backfill User-Galaxy Tracking</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
        Populate the <code>userGalaxyClassifications</code> table from existing classifications to speed up "classified/unclassified by me" filters.
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{statusText}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBackfill()}
          disabled={busy}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {busy && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />} 
          {busy ? `Running (${progress.processed.toLocaleString()})` : "Run backfill"}
        </button>
        {!busy && status && !status.isComplete && (
          <span className="text-xs text-gray-600 dark:text-gray-400">Run multiple times until complete.</span>
        )}
      </div>
    </div>
  );
}
