import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

const GALAXY_AGGREGATE_NAMES = [
  "galaxiesById",
  "galaxiesByRa",
  "galaxiesByDec",
  "galaxiesByReff",
  "galaxiesByQ",
  "galaxiesByPa",
  "galaxiesByNucleus",
  "galaxiesByMag",
  "galaxiesByMeanMue",
  "galaxiesByTotalClassifications",
  "galaxiesByNumVisibleNucleus",
  "galaxiesByNumAwesomeFlag",
  "galaxiesByNumFailedFitting",
  "galaxiesByTotalAssigned",
  "galaxiesByNumericId",
] as const;

const AGGREGATE_LABELS: Record<string, string> = {
  galaxiesById: "ID",
  galaxiesByRa: "RA",
  galaxiesByDec: "Dec",
  galaxiesByReff: "Reff",
  galaxiesByQ: "Q (axis ratio)",
  galaxiesByPa: "PA (position angle)",
  galaxiesByNucleus: "Nucleus",
  galaxiesByMag: "Magnitude",
  galaxiesByMeanMue: "Mean μe",
  galaxiesByTotalClassifications: "Total Classifications",
  galaxiesByNumVisibleNucleus: "Visible Nucleus Count",
  galaxiesByNumAwesomeFlag: "Awesome Flag Count",
  galaxiesByNumFailedFitting: "Failed Fitting Count",
  galaxiesByTotalAssigned: "Total Assigned",
  galaxiesByNumericId: "Numeric ID",
};

type StageStatus = "pending" | "clearing" | "rebuilding" | "done" | "failed";

interface StageState {
  name: string;
  status: StageStatus;
  processed: number;
  error?: string;
}

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "pending":
      return <span className="text-gray-400">○</span>;
    case "clearing":
      return (
        <span className="inline-block h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      );
    case "rebuilding":
      return (
        <span className="inline-block h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      );
    case "done":
      return <span className="text-green-600 dark:text-green-400">✓</span>;
    case "failed":
      return <span className="text-red-600 dark:text-red-400">✕</span>;
  }
}

export function RebuildGalaxyAggregatesSection() {
  const [stages, setStages] = useState<StageState[]>(() =>
    GALAXY_AGGREGATE_NAMES.map((name) => ({
      name,
      status: "pending" as StageStatus,
      processed: 0,
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);

  const clearSingle = useMutation(api.galaxies.aggregates.clearSingleGalaxyAggregate);
  const rebuildSingle = useMutation(api.galaxies.aggregates.rebuildSingleGalaxyAggregate);
  const aggregateStatus = useQuery(api.galaxies.aggregates.getGalaxyAggregateStatus);

  const updateStage = useCallback((index: number, updates: Partial<StageState>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  /** Process a single aggregate: clear then rebuild in paginated batches. Returns true on success. */
  const processStage = useCallback(
    async (index: number): Promise<boolean> => {
      const name = GALAXY_AGGREGATE_NAMES[index];

      // Clear phase
      updateStage(index, { status: "clearing", processed: 0, error: undefined });
      try {
        await clearSingle({ aggregateName: name });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStage(index, { status: "failed", error: `Clear failed: ${msg}` });
        toast.error(`Failed to clear ${AGGREGATE_LABELS[name]}: ${msg}`);
        return false;
      }

      // Rebuild phase (paginated)
      updateStage(index, { status: "rebuilding", processed: 0 });
      let cursor: string | undefined = undefined;
      let totalProcessed = 0;

      try {
        while (true) {
          if (stopRef.current) {
            updateStage(index, {
              status: "failed",
              error: "Stopped by user (incomplete)",
            });
            return false;
          }

          const result: { processed: number; isDone: boolean; continueCursor: string } =
            await rebuildSingle({ aggregateName: name, cursor });
          totalProcessed += result.processed;
          updateStage(index, { processed: totalProcessed });

          if (result.isDone) break;
          cursor = result.continueCursor ?? undefined;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStage(index, {
          status: "failed",
          error: `Rebuild failed after ${totalProcessed} records: ${msg}`,
        });
        toast.error(`Failed to rebuild ${AGGREGATE_LABELS[name]}: ${msg}`);
        return false;
      }

      updateStage(index, { status: "done" });
      return true;
    },
    [clearSingle, rebuildSingle, updateStage]
  );

  /** Run stages sequentially starting from startFrom. */
  const runStages = useCallback(
    async (startFrom: number) => {
      setIsRunning(true);
      stopRef.current = false;

      // Reset stages that will be processed
      setStages((prev) =>
        prev.map((s, i) =>
          i >= startFrom
            ? { ...s, status: "pending" as StageStatus, processed: 0, error: undefined }
            : s
        )
      );

      let completedInRun = 0;
      for (let i = startFrom; i < GALAXY_AGGREGATE_NAMES.length; i++) {
        if (stopRef.current) {
          toast.info(`Stopped after completing ${completedInRun} stage(s) in this run.`);
          break;
        }
        const success = await processStage(i);
        if (!success) break;
        completedInRun++;
      }

      setIsRunning(false);

      if (startFrom + completedInRun === GALAXY_AGGREGATE_NAMES.length) {
        toast.success("All galaxy aggregates rebuilt successfully!");
      }
    },
    [processStage]
  );

  const handleRebuildAll = async () => {
    if (
      !confirm(
        "Rebuild ALL galaxy aggregates from scratch? " +
          "Each of the 15 aggregates will be cleared and rebuilt independently."
      )
    )
      return;
    await runStages(0);
  };

  const handleResumeFromFailed = async () => {
    const firstFailed = stages.findIndex((s) => s.status === "failed");
    if (firstFailed === -1) return;
    if (
      !confirm(
        `Resume rebuild from stage ${firstFailed + 1}/${GALAXY_AGGREGATE_NAMES.length} ` +
          `(${AGGREGATE_LABELS[stages[firstFailed].name]})? ` +
          `The failed stage will be cleared and rebuilt from scratch.`
      )
    )
      return;
    await runStages(firstFailed);
  };

  const handleRetryStage = async (index: number) => {
    setIsRunning(true);
    stopRef.current = false;
    const success = await processStage(index);
    setIsRunning(false);
    if (success) {
      toast.success(`${AGGREGATE_LABELS[GALAXY_AGGREGATE_NAMES[index]]} rebuilt successfully`);
    }
  };

  const completedCount = stages.filter((s) => s.status === "done").length;
  const failedCount = stages.filter((s) => s.status === "failed").length;
  const totalProcessed = stages.reduce((sum, s) => sum + s.processed, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
        🔨 Rebuild Galaxy Aggregates
      </h2>

      <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <span className="text-red-600 dark:text-red-400 shrink-0 mt-0.5">⛔</span>
        <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">Do not run while users are actively labeling.</p>
          <p>
            Each aggregate is cleared then rebuilt independently. If a user submits a classification
            while an aggregate is being rebuilt, it may cause duplicate-key conflicts for that
            aggregate.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rebuilds each of the {GALAXY_AGGREGATE_NAMES.length} aggregates independently in batches of
        100. If a stage fails, you can retry just that stage without losing progress on completed
        ones.
      </p>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => void handleRebuildAll()}
          disabled={isRunning}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Rebuild All
        </button>

        {failedCount > 0 && !isRunning && (
          <button
            onClick={() => void handleResumeFromFailed()}
            className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Resume from Failed
          </button>
        )}

        {isRunning && (
          <button
            onClick={() => (stopRef.current = true)}
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            🛑 Stop
          </button>
        )}

        {(completedCount > 0 || isRunning) && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            {completedCount}/{GALAXY_AGGREGATE_NAMES.length} stages
            {totalProcessed > 0 && ` · ${totalProcessed.toLocaleString()} records`}
          </span>
        )}
      </div>

      {/* Overall progress bar */}
      {(isRunning || completedCount > 0) && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${(completedCount / GALAXY_AGGREGATE_NAMES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stages list */}
      <div className="space-y-1 max-h-[420px] overflow-y-auto">
        {stages.map((stage, index) => {
          const serverCount = aggregateStatus?.find((a) => a.name === stage.name)?.count;
          return (
            <div
              key={stage.name}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                stage.status === "failed"
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : stage.status === "done"
                    ? "bg-green-50 dark:bg-green-900/10"
                    : stage.status === "clearing" || stage.status === "rebuilding"
                      ? "bg-indigo-50 dark:bg-indigo-900/10"
                      : ""
              }`}
            >
              <span className="w-5 text-center shrink-0">
                <StatusIcon status={stage.status} />
              </span>

              <span
                className={`font-medium min-w-[140px] ${
                  stage.status === "done"
                    ? "text-green-700 dark:text-green-400"
                    : stage.status === "failed"
                      ? "text-red-700 dark:text-red-400"
                      : stage.status === "clearing" || stage.status === "rebuilding"
                        ? "text-indigo-700 dark:text-indigo-400"
                        : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {AGGREGATE_LABELS[stage.name] ?? stage.name}
              </span>

              {/* Status info */}
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                {stage.status === "clearing" && "Clearing…"}
                {stage.status === "rebuilding" &&
                  `Rebuilding… ${stage.processed.toLocaleString()}`}
                {stage.status === "done" && `${stage.processed.toLocaleString()} records`}
                {stage.status === "failed" && (
                  <span className="text-red-600 dark:text-red-400">{stage.error}</span>
                )}
              </span>

              {/* Live server count */}
              {serverCount !== undefined && (
                <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 shrink-0">
                  {serverCount.toLocaleString()} in DB
                </span>
              )}

              {/* Per-stage retry */}
              {stage.status === "failed" && !isRunning && (
                <button
                  onClick={() => void handleRetryStage(index)}
                  className="text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}