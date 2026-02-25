import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

async function runRebuild(
  rebuildFn: any,
  label: string,
  setBusy: (v: boolean) => void,
  setProgress: (v: number) => void,
) {
  setBusy(true);
  setProgress(0);
  let cursor: string | null = null;
  let totalProcessed = 0;
  let batches = 0;
  try {
    do {
      const res: any = await rebuildFn({ cursor: cursor || undefined });
      totalProcessed += res.processed || 0;
      batches += 1;
      setProgress(totalProcessed);
      cursor = res.continueCursor || null;
      if (res.isDone) break;
    } while (cursor !== null && batches < 5000);

    toast.success(`${label} aggregates rebuilt (${totalProcessed.toLocaleString()} processed in ${batches} batch${batches === 1 ? "" : "es"})`);
  } catch (err) {
    console.error(err);
    toast.error(`Failed to rebuild ${label} aggregates`);
  } finally {
    setBusy(false);
    setProgress(0);
  }
}

export function LabelingAggregatesSection() {
  const clearLabelingAggregates = useMutation(api.galaxies.aggregates.clearLabelingAggregates);
  const rebuildClassificationAggregates = useMutation(api.galaxies.aggregates.rebuildClassificationAggregates);
  const rebuildUserProfileAggregates = useMutation(api.galaxies.aggregates.rebuildUserProfileAggregates);

  const [clearing, setClearing] = useState(false);
  const [rebuildingClassifications, setRebuildingClassifications] = useState(false);
  const [rebuildingProfiles, setRebuildingProfiles] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState(0);
  const [profileProgress, setProfileProgress] = useState(0);

  const handleClear = async () => {
    if (!confirm("Clear labeling aggregates for classifications and user profiles?")) return;
    try {
      setClearing(true);
      await clearLabelingAggregates();
      toast.success("Labeling aggregates cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear labeling aggregates");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-3">📊 Labeling Aggregates</h2>

      <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <span className="text-red-600 dark:text-red-400 shrink-0 mt-0.5">⛔</span>
        <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">Do not clear or rebuild while users are actively labeling.</p>
          <p>
            <strong>Clear:</strong> Immediately wipes all classification and user-profile aggregate
            entries. Any classification submitted after the clear inserts a fresh entry. If a rebuild
            is then started, it will hit a <strong>duplicate-key error</strong> for every galaxy
            touched since the clear, failing the entire rebuild batch and stalling indefinitely.
          </p>
          <p>
            <strong>Rebuild classification aggregates:</strong> Also clears all classification
            aggregates before rebuilding. Same duplicate-key risk if a classification arrives during
            the clear → rebuild window.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Manage aggregates used for the labeling overview (classification totals and active user activity). Use clear before a rebuild if data changed out-of-band.
      </p>
      <div className="flex flex-col space-y-3">
        <button
          onClick={() => void handleClear()}
          disabled={clearing}
          className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {clearing && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {clearing ? "Clearing..." : "Clear labeling aggregates"}
        </button>
        <button
          onClick={() => void runRebuild(rebuildClassificationAggregates, "Classification", setRebuildingClassifications, setClassificationProgress)}
          disabled={rebuildingClassifications}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {rebuildingClassifications && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {rebuildingClassifications ? `Rebuilding (${classificationProgress.toLocaleString()})` : "Rebuild classification aggregates"}
        </button>
        <button
          onClick={() => void runRebuild(rebuildUserProfileAggregates, "User profile", setRebuildingProfiles, setProfileProgress)}
          disabled={rebuildingProfiles}
          className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {rebuildingProfiles && <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {rebuildingProfiles ? `Rebuilding (${profileProgress.toLocaleString()})` : "Rebuild user profile aggregates"}
        </button>
      </div>
    </div>
  );
}
