import { useState, useRef, useCallback, useEffect } from "react";
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

const PARALLELISM_OPTIONS = [1, 2, 3, 5, 8, 15] as const;

type StageStatus = "pending" | "clearing" | "rebuilding" | "done" | "failed";

interface StageState {
  name: string;
  status: StageStatus;
  processed: number;
  completedAt?: number;
  error?: string;
  startedAt?: number; // timestamp when rebuild phase started (for ETA)
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

/** Compute the majority count among all "done" aggregates. Returns undefined if none are done. */
function getMajorityCount(
  stages: StageState[],
  counts: Record<string, number>
): number | undefined {
  const doneCounts = stages
    .filter((s) => s.status === "done")
    .map((s) => counts[s.name])
    .filter((c) => c !== undefined);
  if (doneCounts.length === 0) return undefined;
  const freq = new Map<number, number>();
  for (const c of doneCounts) freq.set(c, (freq.get(c) ?? 0) + 1);
  let best = doneCounts[0];
  let bestFreq = 0;
  for (const [val, f] of freq) {
    if (f > bestFreq) {
      best = val;
      bestFreq = f;
    }
  }
  return best;
}

/** Format seconds into a compact human-readable ETA string */
function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

/** Format a rate value (items/sec) compactly */
function formatRate(rate: number): string {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k/s`;
  return `${Math.round(rate)}/s`;
}

/** Compute per-stage rate (items/sec) and ETA (seconds). Returns null if not enough data. */
function computeStageStats(
  stage: StageState,
  totalItems: number,
  now: number
): { rate: number; eta: number | null } | null {
  if (stage.status !== "rebuilding" || !stage.startedAt || stage.processed < 1) return null;
  const elapsed = (now - stage.startedAt) / 1000;
  if (elapsed < 0.5) return null; // Too early to predict
  const rate = stage.processed / elapsed; // items/sec
  if (totalItems <= 0) return { rate, eta: null };
  const remaining = totalItems - stage.processed;
  return { rate, eta: remaining <= 0 ? 0 : remaining / rate };
}

/** Determine the best available total-items estimate and its source label */
function useTotalEstimate(
  galaxyIdsCount: number | null | undefined,
  countMap: Record<string, number>
): { total: number; source: string } {
  // Find the max count among all known aggregate counts
  const aggCounts = Object.values(countMap).filter((c) => c > 0);
  const maxAggCount = aggCounts.length > 0 ? Math.max(...aggCounts) : 0;

  if (galaxyIdsCount != null && galaxyIdsCount > 0) {
    if (galaxyIdsCount >= maxAggCount) {
      return { total: galaxyIdsCount, source: "galaxyIds aggregate" };
    }
    // Unusual: some galaxy aggregate is higher. Use the max.
    return { total: maxAggCount, source: "highest galaxy aggregate" };
  }
  if (maxAggCount > 0) {
    return { total: maxAggCount, source: "highest galaxy aggregate" };
  }
  return { total: 0, source: "unknown" };
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
  const [parallelism, setParallelism] = useState(3);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(GALAXY_AGGREGATE_NAMES)
  );
  const [tick, setTick] = useState(0); // Forces re-render every second for live ETAs
  const stopRef = useRef(false);
  const initializedRef = useRef(false);
  const runStartRef = useRef<number | null>(null); // overall run start time

  const clearSingle = useMutation(api.galaxies.aggregates.clearSingleGalaxyAggregate);
  const rebuildSingle = useMutation(api.galaxies.aggregates.rebuildSingleGalaxyAggregate);
  const saveState = useMutation(api.galaxies.aggregates.saveGalaxyAggregateRebuildState);

  // Reactive queries — update live across all clients
  const persistedState = useQuery(api.galaxies.aggregates.getGalaxyAggregateRebuildState);
  const aggregateStatus = useQuery(api.galaxies.aggregates.getGalaxyAggregateStatus);

  // Build a name → count map from the reactive query (new shape: { aggregates, galaxyIdsCount })
  const countMap: Record<string, number> = {};
  const galaxyIdsCount = aggregateStatus?.galaxyIdsCount ?? null;
  if (aggregateStatus?.aggregates) {
    for (const entry of aggregateStatus.aggregates) {
      countMap[entry.name] = entry.count;
    }
  }

  const { total: estimatedTotal, source: totalSource } = useTotalEstimate(galaxyIdsCount, countMap);

  const majorityCount = getMajorityCount(stages, countMap);

  // Tick timer: update every second while running so ETAs stay fresh
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Restore persisted state on first load (only once)
  useEffect(() => {
    if (initializedRef.current || !persistedState) return;
    initializedRef.current = true;

    setStages((prev) =>
      prev.map((s) => {
        const saved = persistedState[s.name];
        if (!saved) return s;
        return {
          ...s,
          status: saved.status as StageStatus,
          processed: saved.processed,
          completedAt: saved.completedAt,
          error: saved.error,
        };
      })
    );
  }, [persistedState]);

  const updateStage = useCallback((index: number, updates: Partial<StageState>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  /** Persist current stages to Convex DB so other clients can see progress */
  const persistStages = useCallback(
    async (currentStages: StageState[]) => {
      const state: Record<
        string,
        { status: string; processed: number; completedAt?: number; error?: string }
      > = {};
      for (const s of currentStages) {
        state[s.name] = {
          status: s.status,
          processed: s.processed,
          ...(s.completedAt !== undefined ? { completedAt: s.completedAt } : {}),
          ...(s.error !== undefined ? { error: s.error } : {}),
        };
      }
      try {
        await saveState({ state });
      } catch {
        // Best-effort persistence — don't block rebuild
      }
    },
    [saveState]
  );

  /** Process a single aggregate: clear then rebuild in paginated batches. Returns true on success. */
  const processStage = useCallback(
    async (index: number): Promise<boolean> => {
      const name = GALAXY_AGGREGATE_NAMES[index];

      // Clear phase
      updateStage(index, { status: "clearing", processed: 0, error: undefined, completedAt: undefined, startedAt: undefined });
      try {
        await clearSingle({ aggregateName: name });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStage(index, { status: "failed", error: `Clear failed: ${msg}` });
        return false;
      }

      // Rebuild phase (paginated)
      updateStage(index, { status: "rebuilding", processed: 0, startedAt: Date.now() });
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
        return false;
      }

      updateStage(index, { status: "done", completedAt: Date.now() });
      return true;
    },
    [clearSingle, rebuildSingle, updateStage]
  );

  /**
   * Run stages with configurable parallelism.
   * Processes `concurrency` aggregates at a time. Failures don't block other
   * in-flight stages — all launched stages finish before the next batch starts.
   */
  const runStages = useCallback(
    async (indices: number[], concurrency: number) => {
      setIsRunning(true);
      stopRef.current = false;
      runStartRef.current = Date.now();

      // Reset stages that will be processed
      setStages((prev) =>
        prev.map((s, i) =>
          indices.includes(i)
            ? { ...s, status: "pending" as StageStatus, processed: 0, error: undefined, completedAt: undefined, startedAt: undefined }
            : s
        )
      );

      let completedInRun = 0;
      let failedInRun = 0;

      // Process in chunks of `concurrency`
      for (let offset = 0; offset < indices.length; offset += concurrency) {
        if (stopRef.current) {
          toast.info(
            `Stopped after completing ${completedInRun} stage(s)` +
              (failedInRun > 0 ? ` (${failedInRun} failed)` : "") +
              "."
          );
          break;
        }

        const chunk = indices.slice(offset, offset + concurrency);
        const results = await Promise.all(chunk.map((idx) => processStage(idx)));

        for (const success of results) {
          if (success) completedInRun++;
          else failedInRun++;
        }

        // Persist after each concurrency chunk
        setStages((current) => {
          void persistStages(current);
          return current;
        });
      }

      setIsRunning(false);
      runStartRef.current = null;

      // Final persist
      setStages((current) => {
        void persistStages(current);
        return current;
      });

      if (completedInRun === indices.length) {
        toast.success(
          indices.length === GALAXY_AGGREGATE_NAMES.length
            ? "All galaxy aggregates rebuilt successfully!"
            : `${completedInRun} aggregate(s) rebuilt successfully!`
        );
      } else if (failedInRun > 0 && !stopRef.current) {
        toast.error(
          `Finished with ${failedInRun} failed stage(s). ` +
            `${completedInRun} completed successfully. Use "Retry Failed" to retry.`
        );
      }
    },
    [processStage, persistStages]
  );

  const handleRebuildSelected = async () => {
    const indices = GALAXY_AGGREGATE_NAMES.map((name, i) => (selected.has(name) ? i : -1)).filter(
      (i) => i !== -1
    );
    if (indices.length === 0) {
      toast.error("No aggregates selected");
      return;
    }
    if (
      !confirm(
        `Rebuild ${indices.length} galaxy aggregate(s)? ` +
          `Processing ${Math.min(parallelism, indices.length)} in parallel.`
      )
    )
      return;
    await runStages(indices, parallelism);
  };

  const handleRetryFailed = async () => {
    const failedIndices = stages
      .map((s, i) => (s.status === "failed" ? i : -1))
      .filter((i) => i !== -1);
    if (failedIndices.length === 0) return;
    const names = failedIndices.map((i) => AGGREGATE_LABELS[stages[i].name]).join(", ");
    if (
      !confirm(
        `Retry ${failedIndices.length} failed stage(s): ${names}?\n` +
          `Processing ${Math.min(parallelism, failedIndices.length)} in parallel.`
      )
    )
      return;
    await runStages(failedIndices, parallelism);
  };

  const handleRetryStage = async (index: number) => {
    setIsRunning(true);
    stopRef.current = false;
    const success = await processStage(index);
    // Persist after single-stage retry
    setStages((current) => {
      void persistStages(current);
      return current;
    });
    setIsRunning(false);
    if (success) {
      toast.success(`${AGGREGATE_LABELS[GALAXY_AGGREGATE_NAMES[index]]} rebuilt successfully`);
    }
  };

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(GALAXY_AGGREGATE_NAMES));
  const selectNone = () => setSelected(new Set());

  const completedCount = stages.filter((s) => s.status === "done").length;
  const failedCount = stages.filter((s) => s.status === "failed").length;
  const activeCount = stages.filter(
    (s) => s.status === "clearing" || s.status === "rebuilding"
  ).length;
  const totalProcessed = stages.reduce((sum, s) => sum + s.processed, 0);
  const selectedCount = selected.size;

  // --- ETA / rate calculations (uses `tick` so they refresh every second) ---
  const nowMs = Date.now() + tick * 0; // referencing `tick` keeps this live

  // Overall rate + ETA
  const { overallEta, overallRate } = (() => {
    if (!isRunning || estimatedTotal <= 0) return { overallEta: null, overallRate: null };
    const startedStages = stages.filter(
      (s) => s.status === "rebuilding" || s.status === "done" || s.status === "failed"
    );
    if (startedStages.length === 0) return { overallEta: null, overallRate: null };

    const totalItemsProcessed = startedStages.reduce((sum, s) => sum + s.processed, 0);
    if (totalItemsProcessed < 100) return { overallEta: null, overallRate: null };

    const runElapsed = runStartRef.current ? (nowMs - runStartRef.current) / 1000 : 0;
    if (runElapsed < 1) return { overallEta: null, overallRate: null };

    const rate = totalItemsProcessed / runElapsed; // items/sec across all active stages
    if (rate <= 0) return { overallEta: null, overallRate: null };

    const pendingStages = stages.filter((s) => s.status === "pending").length;
    const rebuildingStages = stages.filter((s) => s.status === "rebuilding");
    const remainingInActive = rebuildingStages.reduce(
      (sum, s) => sum + Math.max(0, estimatedTotal - s.processed),
      0
    );
    const totalRemaining = remainingInActive + pendingStages * estimatedTotal;
    return { overallEta: totalRemaining / rate, overallRate: rate };
  })();

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
        Rebuilds aggregates independently in batches of 100. Select which to rebuild below.
        Progress is persisted to the database and visible across all clients.
      </p>

      {/* Total estimate info */}
      {estimatedTotal > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <span>📊</span>
          <span>
            Estimated total:{" "}
            <span className="font-medium tabular-nums">{estimatedTotal.toLocaleString()}</span>{" "}
            galaxies{" "}
            <span
              className="cursor-help underline decoration-dotted"
              title={`Source: ${totalSource}. The highest available count is used for ETA calculations.${galaxyIdsCount != null ? ` galaxyIds aggregate: ${galaxyIdsCount.toLocaleString()}` : ""}`}
            >
              (from {totalSource})
            </span>
          </span>
        </div>
      )}

      {/* Parallelism selector */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-gray-600 dark:text-gray-300">Parallel stages:</label>
        <div className="flex gap-1">
          {PARALLELISM_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setParallelism(n)}
              disabled={isRunning}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                parallelism === n
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {n}
            </button>
          ))}
        </div>
        {parallelism > 5 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ High parallelism may hit rate limits
          </span>
        )}
      </div>

      {/* Selection controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-600 dark:text-gray-300">Select:</span>
        <button
          onClick={selectAll}
          disabled={isRunning}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
        >
          All
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={selectNone}
          disabled={isRunning}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
        >
          None
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          ({selectedCount} selected)
        </span>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => void handleRebuildSelected()}
          disabled={isRunning || selectedCount === 0}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          {selectedCount === GALAXY_AGGREGATE_NAMES.length
            ? "Rebuild All"
            : `Rebuild Selected (${selectedCount})`}
        </button>

        {failedCount > 0 && !isRunning && (
          <button
            onClick={() => void handleRetryFailed()}
            className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Retry Failed ({failedCount})
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
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto tabular-nums">
            {completedCount}/{GALAXY_AGGREGATE_NAMES.length} done
            {failedCount > 0 && ` · ${failedCount} failed`}
            {activeCount > 0 && ` · ${activeCount} active`}
            {totalProcessed > 0 && ` · ${totalProcessed.toLocaleString()} rec`}
            {isRunning && overallRate != null && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {" · "}{formatRate(overallRate)}
              </span>
            )}
            {isRunning && overallEta != null && (
              <span className="text-indigo-600 dark:text-indigo-400">
                {" · ETA "}{formatEta(overallEta)}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Overall progress bar */}
      {(isRunning || completedCount > 0 || failedCount > 0) && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden flex">
            <div
              className="bg-indigo-600 h-1.5 transition-all duration-300"
              style={{
                width: `${(completedCount / GALAXY_AGGREGATE_NAMES.length) * 100}%`,
              }}
            />
            {failedCount > 0 && (
              <div
                className="bg-red-500 h-1.5 transition-all duration-300"
                style={{
                  width: `${(failedCount / GALAXY_AGGREGATE_NAMES.length) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Count warning */}
      {aggregateStatus && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-600 dark:text-amber-400">
          <span>⚠</span>
          <span>
            Counts shown are read from the aggregate B-trees and may be inaccurate if the aggregate
            needs rebuilding. Recently rebuilt counts (✓) are likely correct.
          </span>
        </div>
      )}

      {/* Stages list */}
      <div className="space-y-1 max-h-[420px] overflow-y-auto">
        {stages.map((stage, index) => {
          const count = countMap[stage.name];
          const hasCount = count !== undefined;
          const isMismatch =
            hasCount && majorityCount !== undefined && count !== majorityCount;
          const isCountTrusted = stage.status === "done";

          // Per-stage rate + ETA
          const stageStats = computeStageStats(stage, estimatedTotal, nowMs);
          const stageRate = stageStats?.rate ?? null;
          const stageEta = stageStats?.eta ?? null;
          // Per-stage progress percentage
          const stageProgress =
            stage.status === "rebuilding" && estimatedTotal > 0
              ? Math.min(100, (stage.processed / estimatedTotal) * 100)
              : null;

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
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(stage.name)}
                onChange={() => toggleSelect(stage.name)}
                disabled={isRunning}
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 shrink-0"
              />

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

              {/* Status info + inline ETA */}
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate tabular-nums">
                {stage.status === "clearing" && "Clearing…"}
                {stage.status === "rebuilding" && (
                  <>
                    {stage.processed.toLocaleString()}
                    {stageProgress != null && (
                      <span className="text-gray-400 dark:text-gray-500">
                        {" "}({stageProgress.toFixed(0)}%)
                      </span>
                    )}
                    {stageRate != null && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {" · "}{formatRate(stageRate)}
                      </span>
                    )}
                    {stageEta != null && (
                      <span className="text-indigo-500 dark:text-indigo-400">
                        {" · ~"}{formatEta(stageEta)}
                      </span>
                    )}
                  </>
                )}
                {stage.status === "done" && `${stage.processed.toLocaleString()} records`}
                {stage.status === "failed" && (
                  <span className="text-red-600 dark:text-red-400">{stage.error}</span>
                )}
              </span>

              {/* Aggregate count */}
              {hasCount && (
                <span
                  title={
                    isCountTrusted
                      ? `Count from freshly rebuilt aggregate (likely accurate)`
                      : `Count from aggregate B-tree — may be inaccurate if aggregate needs rebuilding`
                  }
                  className={`text-xs tabular-nums shrink-0 cursor-help ${
                    isMismatch
                      ? "text-amber-600 dark:text-amber-400 font-semibold"
                      : isCountTrusted
                        ? "text-green-600 dark:text-green-500"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {count.toLocaleString()}
                  {isMismatch && " ⚠"}
                  {isCountTrusted && !isMismatch && " ✓"}
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