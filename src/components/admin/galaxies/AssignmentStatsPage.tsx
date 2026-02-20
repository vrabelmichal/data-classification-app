import { useState, useRef, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePageTitle } from "../../../hooks/usePageTitle";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Histogram = Record<number, number>; // totalAssigned → galaxy count

interface ComputationState {
  running: boolean;
  done: boolean;
  processedGalaxies: number;
  totalGalaxies: number | null;
  histogram: Histogram;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeHistograms(base: Histogram, patch: Record<string, number>): Histogram {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const key = Number(k);
    next[key] = (next[key] ?? 0) + v;
  }
  return next;
}

function histogramToChartData(histogram: Histogram) {
  if (Object.keys(histogram).length === 0) return [];
  const maxKey = Math.max(...Object.keys(histogram).map(Number));
  return Array.from({ length: maxKey + 1 }, (_, i) => ({
    assignments: i,
    galaxies: histogram[i] ?? 0,
  }));
}

function fmt(n: number): string {
  return n.toLocaleString();
}

// Compute calculator outputs from histogram
function calcStats(histogram: Histogram, targetN: number, seqSize: number, extraUsers: number) {
  let totalGalaxies = 0;
  let galaxiesBelow = 0; // have < targetN assignments
  let slotsNeededTotal = 0; // sum of (targetN - current) for each galaxy below

  for (const [kStr, count] of Object.entries(histogram)) {
    const k = Number(kStr);
    totalGalaxies += count;
    if (k < targetN) {
      galaxiesBelow += count;
      slotsNeededTotal += (targetN - k) * count;
    }
  }

  // How many users needed if each contributes seqSize slots
  const usersNeededForSlots = seqSize > 0 ? Math.ceil(slotsNeededTotal / seqSize) : null;

  // How large a sequence do I need if I have extraUsers more users to assign
  const seqSizeNeeded = extraUsers > 0 ? Math.ceil(slotsNeededTotal / extraUsers) : null;

  // Percentage already covered
  const coveredPct = totalGalaxies > 0 ? ((totalGalaxies - galaxiesBelow) / totalGalaxies) * 100 : 0;

  return {
    totalGalaxies,
    galaxiesBelow,
    galaxiesAtOrAbove: totalGalaxies - galaxiesBelow,
    slotsNeededTotal,
    usersNeededForSlots,
    seqSizeNeeded,
    coveredPct,
  };
}

// ---------------------------------------------------------------------------
// Custom tooltip for recharts
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">
        Assigned {label} time{label !== 1 ? "s" : ""}
      </p>
      <p className="text-blue-600 dark:text-blue-400">
        {fmt(payload[0].value)} galaxies
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssignmentStatsPage() {
  usePageTitle("Admin – Galaxies – Assignment Stats");

  // Convex hooks
  const summary = useQuery(api.galaxies.assignmentStats.getAssignmentStatsSummary);
  const computeBatch = useAction(api.galaxies.assignmentStats.computeHistogramBatch);

  // Computation state
  const [state, setState] = useState<ComputationState>({
    running: false,
    done: false,
    processedGalaxies: 0,
    totalGalaxies: null,
    histogram: {},
    error: null,
  });

  // Cancel flag
  const cancelRef = useRef(false);

  // Calculator inputs
  const [targetN, setTargetN] = useState(3);
  const [seqSize, setSeqSize] = useState(200);
  const [extraUsers, setExtraUsers] = useState(5);
  // "Increase existing sequences" calculator
  const [existingUsers, setExistingUsers] = useState(5);
  const [currentSeqSize, setCurrentSeqSize] = useState(200);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCompute = useCallback(async () => {
    cancelRef.current = false;
    setState({
      running: true,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: summary?.totalGalaxies ?? null,
      histogram: {},
      error: null,
    });

    let cursor: string | undefined = undefined;
    let accHistogram: Histogram = {};
    let processed = 0;

    try {
      while (true) {
        if (cancelRef.current) break;

        const result = await computeBatch({ cursor, batchSize: 5000 });

        accHistogram = mergeHistograms(accHistogram, result.counts);
        processed += result.batchCount;

        setState((prev) => ({
          ...prev,
          processedGalaxies: processed,
          totalGalaxies: result.totalGalaxies ?? prev.totalGalaxies,
          histogram: { ...accHistogram },
        }));

        if (result.isDone || !result.nextCursor) break;
        cursor = result.nextCursor;
      }

      setState((prev) => ({
        ...prev,
        running: false,
        done: !cancelRef.current,
        error: cancelRef.current ? null : prev.error,
      }));
    } catch (err) {
      const msg = (err as Error)?.message ?? "Unknown error";
      setState((prev) => ({ ...prev, running: false, error: msg }));
    }
  }, [computeBatch, summary?.totalGalaxies]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setState((prev) => ({ ...prev, running: false }));
  }, []);

  const handleReset = useCallback(() => {
    cancelRef.current = true;
    setState({
      running: false,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: null,
      histogram: {},
      error: null,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const chartData = histogramToChartData(state.histogram);
  const hasData = Object.keys(state.histogram).length > 0;
  const progressPct =
    state.totalGalaxies && state.totalGalaxies > 0
      ? Math.min(100, (state.processedGalaxies / state.totalGalaxies) * 100)
      : null;

  const calcResult = hasData ? calcStats(state.histogram, targetN, seqSize, extraUsers) : null;

  // Colour helper: unassigned = red, low = amber, ok = green
  const barColor = (assignments: number): string => {
    if (assignments === 0) return "#ef4444"; // red-500
    if (assignments < targetN) return "#f59e0b"; // amber-500
    return "#22c55e"; // green-500
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assignment Distribution</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Analyse how many galaxies have been assigned 0, 1, 2 … N times.  Use
          the interactive calculator to plan future assignment runs.
        </p>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200 flex flex-wrap gap-4 items-center">
          <span>
            <span className="font-semibold">Total galaxies (aggregate):</span>{" "}
            {summary.totalGalaxies !== null ? fmt(summary.totalGalaxies) : "—"}
          </span>
          {state.done && hasData && (
            <span>
              <span className="font-semibold">Galaxies scanned:</span>{" "}
              {fmt(state.processedGalaxies)}
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Compute Distribution
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Scanning all galaxies in batches of 5,000.  Depending on the dataset
          size this may take a minute.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          {!state.running && (
            <button
              onClick={() => void handleCompute()}
              disabled={!summary?.authorized}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {state.done ? "Recompute" : "Compute Distribution"}
            </button>
          )}

          {state.running && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          )}

          {hasData && !state.running && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(state.running || (state.done && state.totalGalaxies)) && (
          <div className="mt-5 space-y-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {state.running ? "Scanning…" : "Scan complete"}
                {" "}
                {fmt(state.processedGalaxies)} galaxies processed
              </span>
              {state.totalGalaxies && (
                <span>{fmt(state.totalGalaxies)} total</span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  state.running ? "bg-blue-500 animate-pulse" : "bg-green-500"
                }`}
                style={{ width: `${progressPct ?? (state.running ? 5 : 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
            <strong>Error:</strong> {state.error}
          </div>
        )}
      </div>

      {/* Results */}
      {hasData && (
        <>
          {/* Distribution table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Assignment Distribution Table
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-6 font-medium text-gray-600 dark:text-gray-400">
                      Times assigned
                    </th>
                    <th className="text-right py-2 pr-6 font-medium text-gray-600 dark:text-gray-400">
                      Galaxies
                    </th>
                    <th className="text-right py-2 pr-6 font-medium text-gray-600 dark:text-gray-400">
                      % of total
                    </th>
                    <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">
                      Running total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxKey = Math.max(...Object.keys(state.histogram).map(Number));
                    const totalCount = Object.values(state.histogram).reduce((a, b) => a + b, 0);
                    let running = 0;
                    return Array.from({ length: maxKey + 1 }, (_, i) => {
                      const count = state.histogram[i] ?? 0;
                      running += count;
                      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                      const runningPct = totalCount > 0 ? (running / totalCount) * 100 : 0;
                      const isBelow = i < targetN;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-gray-100 dark:border-gray-700/50 ${
                            isBelow
                              ? "bg-amber-50 dark:bg-amber-900/10"
                              : ""
                          }`}
                        >
                          <td className="py-2 pr-6 text-gray-900 dark:text-white font-medium">
                            {i}
                            {i === 0 && (
                              <span className="ml-2 text-xs text-red-500 dark:text-red-400 font-normal">
                                (unassigned)
                              </span>
                            )}
                            {i > 0 && isBelow && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                (below target)
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-6 text-right text-gray-900 dark:text-white">
                            {fmt(count)}
                          </td>
                          <td className="py-2 pr-6 text-right text-gray-500 dark:text-gray-400">
                            {pct.toFixed(2)} %
                          </td>
                          <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                            {fmt(running)} ({runningPct.toFixed(2)} %)
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2 pr-6 font-semibold text-gray-900 dark:text-white">
                      Total
                    </td>
                    <td className="py-2 pr-6 text-right font-semibold text-gray-900 dark:text-white">
                      {fmt(Object.values(state.histogram).reduce((a, b) => a + b, 0))}
                    </td>
                    <td className="py-2 pr-6 text-right text-gray-500 dark:text-gray-400">
                      100 %
                    </td>
                    <td className="py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Histogram chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Distribution Chart
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400 mr-1 align-middle" />
              Unassigned &nbsp;
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 mr-1 align-middle" />
              Below target ({targetN}) &nbsp;
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1 align-middle" />
              At or above target
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="assignments"
                  label={{
                    value: "Times assigned",
                    position: "insideBottom",
                    offset: -2,
                    style: { fontSize: 12, fill: "#6b7280" },
                  }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}k`
                      : String(v)
                  }
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  x={targetN}
                  stroke="#6366f1"
                  strokeDasharray="6 3"
                  label={{
                    value: `Target: ${targetN}`,
                    position: "insideTopRight",
                    style: { fontSize: 11, fill: "#6366f1" },
                  }}
                />
                <Bar dataKey="galaxies" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.assignments}`}
                      fill={barColor(entry.assignments)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive calculator */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Interactive Calculator
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Adjust the parameters below to see how many more users or sequence
              slots are needed to reach your assignment targets.
            </p>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target min. assignments (N)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={targetN}
                  onChange={(e) => setTargetN(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Every galaxy should be assigned at least this many times.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sequence size per user (S)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8192}
                  value={seqSize}
                  onChange={(e) => setSeqSize(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  How many galaxies each new user would be assigned.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional users available (U)
                </label>
                <input
                  type="number"
                  min={1}
                  value={extraUsers}
                  onChange={(e) => setExtraUsers(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Number of extra users you plan to onboard.
                </p>
              </div>
            </div>

            {/* Results */}
            {calcResult && (
              <div className="space-y-4">
                {/* Coverage summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Total galaxies"
                    value={fmt(calcResult.totalGalaxies)}
                    color="gray"
                  />
                  <StatCard
                    label={`Galaxies ≥ ${targetN} assignments`}
                    value={fmt(calcResult.galaxiesAtOrAbove)}
                    sub={`${calcResult.coveredPct.toFixed(1)} % covered`}
                    color="green"
                  />
                  <StatCard
                    label={`Galaxies < ${targetN} assignments`}
                    value={fmt(calcResult.galaxiesBelow)}
                    sub={`${(100 - calcResult.coveredPct).toFixed(1)} % remaining`}
                    color={calcResult.galaxiesBelow > 0 ? "amber" : "green"}
                  />
                  <StatCard
                    label="Total assignment slots needed"
                    value={fmt(calcResult.slotsNeededTotal)}
                    sub="to reach target N for all galaxies"
                    color={calcResult.slotsNeededTotal > 0 ? "red" : "green"}
                  />
                </div>

                {calcResult.slotsNeededTotal > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wide">
                        Users needed (fixed seq. size S={seqSize})
                      </p>
                      <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                        {calcResult.usersNeededForSlots !== null
                          ? fmt(calcResult.usersNeededForSlots)
                          : "—"}
                      </p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        additional users, each assigned S={seqSize} galaxies
                      </p>
                    </div>

                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg p-4">
                      <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1 uppercase tracking-wide">
                        Sequence size needed (fixed users U={extraUsers})
                      </p>
                      <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                        {calcResult.seqSizeNeeded !== null
                          ? fmt(calcResult.seqSizeNeeded)
                          : "—"}
                      </p>
                      <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">
                        galaxies per user with U={extraUsers} additional users
                      </p>
                    </div>
                  </div>
                )}

                {calcResult.slotsNeededTotal === 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-green-700 dark:text-green-300 text-sm font-medium">
                    ✓ All galaxies already have ≥ {targetN} assignment{targetN !== 1 ? "s" : ""}.
                  </div>
                )}

                {/* Coverage progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Coverage at target N={targetN}</span>
                    <span>{calcResult.coveredPct.toFixed(1)} %</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-green-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, calcResult.coveredPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Increase existing sequences calculator */}
          {hasData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                Increase Existing Sequences
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                No new users — how much does each existing user's sequence need
                to grow so that all galaxies reach target N={targetN} assignments?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Existing users with sequences (E)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={existingUsers}
                    onChange={(e) => setExistingUsers(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Number of users who already have an active sequence.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current sequence size per user (C)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={8192}
                    value={currentSeqSize}
                    onChange={(e) => setCurrentSeqSize(Math.max(0, Number(e.target.value)))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Average / typical current sequence length (used to show new total).
                  </p>
                </div>
              </div>

              {(() => {
                if (!calcResult) return null;
                const slots = calcResult.slotsNeededTotal;

                if (slots === 0) {
                  return (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-green-700 dark:text-green-300 text-sm font-medium">
                      ✓ No increase needed — all galaxies already have ≥ {targetN} assignment{targetN !== 1 ? "s" : ""}.
                    </div>
                  );
                }

                const additionalPerUser = Math.ceil(slots / existingUsers);
                const newTotal = currentSeqSize + additionalPerUser;
                const exceeds = newTotal > 8192;
                const maxAddlWithinLimit = Math.max(0, 8192 - currentSeqSize);
                const usersNeededIfCapped =
                  maxAddlWithinLimit > 0
                    ? Math.ceil(slots / maxAddlWithinLimit)
                    : null;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg p-4">
                        <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1 uppercase tracking-wide">
                          Additional galaxies per user
                        </p>
                        <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">
                          +{fmt(additionalPerUser)}
                        </p>
                        <p className="text-xs text-teal-500 dark:text-teal-400 mt-1">
                          split evenly across E={existingUsers} users
                        </p>
                      </div>

                      <div
                        className={`rounded-lg border p-4 ${
                          exceeds
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                            : "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700"
                        }`}
                      >
                        <p
                          className={`text-xs font-medium mb-1 uppercase tracking-wide ${
                            exceeds
                              ? "text-red-600 dark:text-red-400"
                              : "text-teal-600 dark:text-teal-400"
                          }`}
                        >
                          New sequence size per user
                        </p>
                        <p
                          className={`text-3xl font-bold ${
                            exceeds
                              ? "text-red-700 dark:text-red-300"
                              : "text-teal-700 dark:text-teal-300"
                          }`}
                        >
                          {fmt(newTotal)}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            exceeds
                              ? "text-red-500 dark:text-red-400"
                              : "text-teal-500 dark:text-teal-400"
                          }`}
                        >
                          C={currentSeqSize} + {fmt(additionalPerUser)}
                          {exceeds && " — exceeds 8192 limit!"}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                          Total new assignment slots
                        </p>
                        <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                          {fmt(additionalPerUser * existingUsers)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          vs {fmt(slots)} slots needed (rounding up per user)
                        </p>
                      </div>
                    </div>

                    {exceeds && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-sm space-y-1">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          ⚠ Sequence size would exceed the 8 192-galaxy limit
                        </p>
                        <p className="text-amber-600 dark:text-amber-400">
                          Each user can be assigned at most{" "}
                          <strong>{fmt(maxAddlWithinLimit)}</strong> additional galaxies
                          (up to the 8 192 cap).
                        </p>
                        {usersNeededIfCapped !== null && (
                          <p className="text-amber-600 dark:text-amber-400">
                            To stay within the limit you would need at least{" "}
                            <strong>{fmt(usersNeededIfCapped)}</strong> existing users
                            (currently E={existingUsers}).
                          </p>
                        )}
                      </div>
                    )}

                    {/* Visual: how much of the needed slots the expansion covers */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Slots provided vs slots needed</span>
                        <span>
                          {fmt(Math.min(additionalPerUser * existingUsers, slots))} /{" "}
                          {fmt(slots)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            exceeds ? "bg-amber-500" : "bg-teal-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (additionalPerUser * existingUsers / slots) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasData && !state.running && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <svg
            className="mx-auto w-12 h-12 mb-4 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm">Click <strong>Compute Distribution</strong> to begin.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "gray" | "green" | "amber" | "red";
}) {
  const colorClasses: Record<typeof color, string> = {
    gray: "bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}
