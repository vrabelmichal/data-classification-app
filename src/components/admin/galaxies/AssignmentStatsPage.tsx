import { useState, useRef, useCallback, useEffect } from "react";
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
type PaperCounts = Record<string, number>; // misc.paper ("" = no paper) → galaxy count

interface ComputationState {
  running: boolean;
  done: boolean;
  processedGalaxies: number;
  totalGalaxies: number | null;
  histogram: Histogram;
  error: string | null;
  skippedTotal: number;
}

interface PaperStatsComputationState {
  running: boolean;
  done: boolean;
  processedGalaxies: number;
  totalGalaxies: number | null;
  countsAll: PaperCounts;
  countsExcludingBlacklisted: PaperCounts;
  error: string | null;
  source: "summary" | "client" | null;
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

function mergePaperCounts(base: PaperCounts, patch: Record<string, number>): PaperCounts {
  const next = { ...base };
  for (const [paper, count] of Object.entries(patch)) {
    next[paper] = (next[paper] ?? 0) + count;
  }
  return next;
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
// System limits
// ---------------------------------------------------------------------------

/** Maximum number of galaxies that can be in a single user's sequence. */
const MAX_SEQUENCE_SIZE = 8192;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssignmentStatsPage() {
  usePageTitle("Admin – Galaxies – Assignment Stats");

  // Convex hooks
  const summary = useQuery(api.galaxies.assignmentStats.getAssignmentStatsSummary);
  const computeBatch = useAction(api.galaxies.assignmentStats.computeHistogramBatch);
  const computePaperStatsBatch = useAction(api.galaxies.assignmentStats.computePaperStatsBatch);

  // Computation state
  const [state, setState] = useState<ComputationState>({
    running: false,
    done: false,
    processedGalaxies: 0,
    totalGalaxies: null,
    histogram: {},
    error: null,
    skippedTotal: 0,
  });

  // Per-paper stats state (summary query first, client-side paginated fallback if needed)
  const [paperStats, setPaperStats] = useState<PaperStatsComputationState>({
    running: false,
    done: false,
    processedGalaxies: 0,
    totalGalaxies: null,
    countsAll: {},
    countsExcludingBlacklisted: {},
    error: null,
    source: null,
  });

  // Cancel flag
  const cancelRef = useRef(false);
  const paperCancelRef = useRef(false);

  // Calculator inputs
  const [targetN, setTargetN] = useState(3);
  const [seqSize, setSeqSize] = useState(3090);
  const [extraUsers, setExtraUsers] = useState(5);
  // "Increase existing sequences" calculator
  const [existingUsers, setExistingUsers] = useState(5);
  const [currentSeqSize, setCurrentSeqSize] = useState(200);

  // Modals
  const [showSlotsModal, setShowSlotsModal] = useState(false);

  // Filters
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [papersInitialised, setPapersInitialised] = useState(false);
  const [excludeBlacklisted, setExcludeBlacklisted] = useState(true);
  const [seqStatsInitialised, setSeqStatsInitialised] = useState(false);

  // Initialise paper selection from system settings (select all by default)
  useEffect(() => {
    if (!papersInitialised && summary?.availablePapers && summary.availablePapers.length > 0) {
      setSelectedPapers(new Set(summary.availablePapers));
      setPapersInitialised(true);
    }
  }, [summary?.availablePapers, papersInitialised]);

  // Initialise calculator inputs from real sequence statistics once available
  useEffect(() => {
    if (seqStatsInitialised) return;
    const u = (summary as any)?.usersWithSequences;
    const m = (summary as any)?.medianSequenceSize;
    if (u == null && m == null) return;
    if (u != null && u > 0) setExistingUsers(u);
    if (m != null && m > 0) setSeqSize(Math.round(m));
    setSeqStatsInitialised(true);
  }, [(summary as any)?.usersWithSequences, (summary as any)?.medianSequenceSize, seqStatsInitialised]);

  // Initialise per-paper stats from summary query when available.
  useEffect(() => {
    if (!summary) return;
    if (!summary.authorized) {
      setPaperStats({
        running: false,
        done: false,
        processedGalaxies: 0,
        totalGalaxies: null,
        countsAll: {},
        countsExcludingBlacklisted: {},
        error: null,
        source: null,
      });
      return;
    }

    if ((summary as any).paperStatsComputed) {
      const all = ((summary as any).paperTotals ?? {}) as PaperCounts;
      const excl = ((summary as any).paperTotalsExcludingBlacklisted ?? {}) as PaperCounts;
      const total = Object.values(all).reduce((a, b) => a + b, 0);
      setPaperStats({
        running: false,
        done: true,
        processedGalaxies: total,
        totalGalaxies: (summary as any).totalGalaxies ?? total,
        countsAll: all,
        countsExcludingBlacklisted: excl,
        error: null,
        source: "summary",
      });
      return;
    }

    setPaperStats((prev) => ({
      ...prev,
      running: false,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: (summary as any).totalGalaxies ?? null,
      countsAll: {},
      countsExcludingBlacklisted: {},
      error: null,
      source: null,
    }));
  }, [summary]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCompute = useCallback(async () => {
    cancelRef.current = false;

    // Build paper filter: undefined means all papers
    const availablePapers = summary?.availablePapers ?? [];
    const paperFilter =
      availablePapers.length > 0 && selectedPapers.size < availablePapers.length
        ? Array.from(selectedPapers)
        : undefined;

    setState({
      running: true,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: summary?.totalGalaxies ?? null,
      histogram: {},
      error: null,
      skippedTotal: 0,
    });

    let cursor: string | undefined = undefined;
    let accHistogram: Histogram = {};
    let processed = 0;
    let skippedTotal = 0;
    // Cache blacklist IDs returned by the first call to avoid reloading each batch
    let cachedBlacklistedIds: string[] | undefined = undefined;

    try {
      while (true) {
        if (cancelRef.current) break;

        const result = await computeBatch({
          cursor,
          batchSize: 5000,
          paperFilter,
          excludeBlacklisted: excludeBlacklisted && !cachedBlacklistedIds ? true : undefined,
          blacklistedIds: cachedBlacklistedIds,
        });

        // Cache blacklisted IDs returned on the first call
        if (result.blacklistedIds) {
          cachedBlacklistedIds = result.blacklistedIds;
        }

        accHistogram = mergeHistograms(accHistogram, result.counts);
        processed += result.batchCount;
        skippedTotal += result.skippedCount;

        setState((prev) => ({
          ...prev,
          processedGalaxies: processed,
          totalGalaxies: result.totalGalaxies ?? prev.totalGalaxies,
          histogram: { ...accHistogram },
          skippedTotal,
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
  }, [computeBatch, summary?.totalGalaxies, summary?.availablePapers, selectedPapers, excludeBlacklisted]);

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
      skippedTotal: 0,
    });
  }, []);

  const handleComputePaperStats = useCallback(async () => {
    paperCancelRef.current = false;

    setPaperStats({
      running: true,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: summary?.totalGalaxies ?? null,
      countsAll: {},
      countsExcludingBlacklisted: {},
      error: null,
      source: "client",
    });

    let cursor: string | undefined = undefined;
    let accAll: PaperCounts = {};
    let accExcl: PaperCounts = {};
    let processed = 0;
    let cachedBlacklistedIds: string[] | undefined = undefined;

    try {
      while (true) {
        if (paperCancelRef.current) break;

        const result = await computePaperStatsBatch({
          cursor,
          batchSize: 5000,
          excludeBlacklisted: !cachedBlacklistedIds ? true : undefined,
          blacklistedIds: cachedBlacklistedIds,
        });

        if (result.blacklistedIds) {
          cachedBlacklistedIds = result.blacklistedIds;
        }

        accAll = mergePaperCounts(accAll, result.countsAll);
        accExcl = mergePaperCounts(accExcl, result.countsExcludingBlacklisted);
        processed += result.batchCount;

        setPaperStats((prev) => ({
          ...prev,
          processedGalaxies: processed,
          totalGalaxies: result.totalGalaxies ?? prev.totalGalaxies,
          countsAll: { ...accAll },
          countsExcludingBlacklisted: { ...accExcl },
        }));

        if (result.isDone || !result.nextCursor) break;
        cursor = result.nextCursor;
      }

      setPaperStats((prev) => ({
        ...prev,
        running: false,
        done: !paperCancelRef.current,
        error: paperCancelRef.current ? null : prev.error,
      }));
    } catch (err) {
      const msg = (err as Error)?.message ?? "Unknown error";
      setPaperStats((prev) => ({ ...prev, running: false, error: msg }));
    }
  }, [computePaperStatsBatch, summary?.totalGalaxies]);

  const handleCancelPaperStats = useCallback(() => {
    paperCancelRef.current = true;
    setPaperStats((prev) => ({ ...prev, running: false }));
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
  const paperStatsHasData = Object.keys(paperStats.countsAll).length > 0;
  const paperStatsProgressPct =
    paperStats.totalGalaxies && paperStats.totalGalaxies > 0
      ? Math.min(100, (paperStats.processedGalaxies / paperStats.totalGalaxies) * 100)
      : null;
  const paperRows = (() => {
    const keys = new Set<string>([
      ...Object.keys(paperStats.countsAll),
      ...Object.keys(paperStats.countsExcludingBlacklisted),
      ...((summary?.availablePapers ?? []) as string[]),
    ]);
    const rows = Array.from(keys).map((paper) => ({
      paper,
      total: paperStats.countsAll[paper] ?? 0,
      excludingBlacklisted: paperStats.countsExcludingBlacklisted[paper] ?? 0,
    }));
    rows.sort((a, b) => {
      if (a.paper === "") return 1;
      if (b.paper === "") return -1;
      return a.paper.localeCompare(b.paper);
    });
    return rows;
  })();

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
          {summary.blacklistedCount > 0 && (
            <span>
              <span className="font-semibold">Blacklisted:</span>{" "}
              {fmt(summary.blacklistedCount)}
            </span>
          )}
          {state.done && hasData && (
            <span>
              <span className="font-semibold">Galaxies matched:</span>{" "}
              {fmt(state.processedGalaxies - state.skippedTotal)}
            </span>
          )}
          {state.done && state.skippedTotal > 0 && (
            <span>
              <span className="font-semibold">Skipped (filtered/blacklisted):</span>{" "}
              {fmt(state.skippedTotal)}
            </span>
          )}
        </div>
      )}

      {/* Per-paper totals */}
      {summary?.authorized && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Galaxies per Paper
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Totals per paper, including and excluding blacklisted galaxies.
              </p>
            </div>

            {!(summary as any).paperStatsComputed && !paperStats.running && (
              <button
                type="button"
                onClick={() => void handleComputePaperStats()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Compute per-paper stats
              </button>
            )}

            {paperStats.running && (
              <button
                type="button"
                onClick={handleCancelPaperStats}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {!(summary as any).paperStatsComputed && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Summary query did not include per-paper totals (likely due query limits). Use the button above to compute them client-side in paginated batches.
            </p>
          )}

          {(paperStats.running || (paperStats.done && paperStats.totalGalaxies)) && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {paperStats.running ? "Scanning…" : "Scan complete"} {fmt(paperStats.processedGalaxies)} galaxies processed
                </span>
                {paperStats.totalGalaxies && <span>{fmt(paperStats.totalGalaxies)} total</span>}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    paperStats.running ? "bg-blue-500 animate-pulse" : "bg-green-500"
                  }`}
                  style={{ width: `${paperStatsProgressPct ?? (paperStats.running ? 5 : 100)}%` }}
                />
              </div>
            </div>
          )}

          {paperStats.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {paperStats.error}
            </div>
          )}

          {paperStatsHasData ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Paper</th>
                    <th className="text-right py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Total galaxies</th>
                    <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Excluding blacklisted</th>
                  </tr>
                </thead>
                <tbody>
                  {paperRows.map((row) => (
                    <tr key={row.paper || "__no_paper__"} className="border-b border-gray-100 dark:border-gray-700/60">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.paper === "" ? "(no paper)" : row.paper}</td>
                      <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(row.total)}</td>
                      <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(row.excludingBlacklisted)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">Total</td>
                    <td className="py-2 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                      {fmt(paperRows.reduce((sum, row) => sum + row.total, 0))}
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">
                      {fmt(paperRows.reduce((sum, row) => sum + row.excludingBlacklisted, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            !paperStats.running && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Per-paper totals are not available yet.
              </p>
            )
          )}

          {paperStats.source && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Source: {paperStats.source === "summary" ? "summary query" : "client-side paginated scan"}
            </p>
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

        {/* Paper filter */}
        {summary?.availablePapers && summary.availablePapers.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Paper filter</p>
            <div className="flex flex-wrap gap-2">
              {summary.availablePapers.map((paper) => {
                const checked = selectedPapers.has(paper);
                const label = paper === "" ? "(no paper)" : paper;
                return (
                  <label
                    key={paper}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-200"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                    } ${state.running ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={state.running}
                      onChange={() => {
                        setSelectedPapers((prev) => {
                          const next = new Set(prev);
                          if (next.has(paper)) next.delete(paper);
                          else next.add(paper);
                          return next;
                        });
                      }}
                    />
                    <span>{checked ? "✓" : ""}</span>
                    <span>{label}</span>
                  </label>
                );
              })}
              <button
                type="button"
                disabled={state.running}
                onClick={() => setSelectedPapers(new Set(summary.availablePapers))}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                All
              </button>
              <button
                type="button"
                disabled={state.running}
                onClick={() => setSelectedPapers(new Set())}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
              >
                None
              </button>
            </div>
          </div>
        )}

        {/* Blacklist toggle */}
        <div className="mb-5">
          <label className={`inline-flex items-center gap-2 text-sm cursor-pointer select-none ${
            state.running ? "opacity-50 pointer-events-none" : ""
          }`}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={excludeBlacklisted}
              disabled={state.running}
              onChange={(e) => setExcludeBlacklisted(e.target.checked)}
            />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Exclude blacklisted galaxies
            </span>
            {summary?.blacklistedCount !== undefined && summary.blacklistedCount > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({fmt(summary.blacklistedCount)} blacklisted)
              </span>
            )}
          </label>
        </div>

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

      {/* Global analysis target — affects the chart, table highlights, and all calculators */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">
            Assignment Target &mdash; N
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400">
            The minimum number of times every galaxy should be assigned. Affects
            the chart colours, table row highlights, and both calculators below.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setTargetN((n) => Math.max(1, n - 1))}
            className="w-8 h-8 rounded-full border border-indigo-300 dark:border-indigo-500 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 font-bold text-lg leading-none hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors flex items-center justify-center"
            aria-label="Decrease N"
          >
            &minus;
          </button>
          <div className="text-center">
            <span className="block text-4xl font-extrabold text-indigo-700 dark:text-indigo-300 w-16 text-center">{targetN}</span>
            <span className="text-xs text-indigo-500 dark:text-indigo-400">assignments</span>
          </div>
          <button
            type="button"
            onClick={() => setTargetN((n) => Math.min(100, n + 1))}
            className="w-8 h-8 rounded-full border border-indigo-300 dark:border-indigo-500 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 font-bold text-lg leading-none hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors flex items-center justify-center"
            aria-label="Increase N"
          >
            +
          </button>
          <input
            type="number"
            min={1}
            max={100}
            value={targetN}
            onChange={(e) => setTargetN(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="w-20 border border-indigo-300 dark:border-indigo-500 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 text-sm text-center"
          />
        </div>
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
                      const isTarget = i === targetN;
                      const isAbove = i > targetN;
                      const rowBg = isBelow
                        ? "bg-amber-50 dark:bg-amber-900/10"
                        : isTarget
                          ? "bg-green-100 dark:bg-green-900/25"
                          : isAbove
                            ? "bg-green-50 dark:bg-green-900/10"
                            : "";
                      return (
                        <tr
                          key={i}
                          className={`border-b border-gray-100 dark:border-gray-700/50 ${rowBg}`}
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
                            {isTarget && (
                              <span className="ml-2 text-xs text-green-700 dark:text-green-400 font-semibold">
                                ← target
                              </span>
                            )}
                            {isAbove && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-500 font-normal">
                                (above target)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sequence size per user (S)
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_SEQUENCE_SIZE}
                  value={seqSize}
                  onChange={(e) => setSeqSize(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  How many galaxies each new user would be assigned.{" "}
                  {(summary as any)?.medianSequenceSize != null && (
                    <span className="text-indigo-500 dark:text-indigo-400">
                      Initialised from median of existing sequences ({Math.round((summary as any).medianSequenceSize).toLocaleString()}).
                    </span>
                  )}
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
                  {/* Total slots card with Explain button */}
                  {(() => {
                    const color = calcResult.slotsNeededTotal > 0 ? "red" : "green";
                    const colorClasses = {
                      red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300",
                      green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
                    }[color];
                    return (
                      <div className={`rounded-lg border p-4 ${colorClasses}`}>
                        <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">Total assignment slots needed</p>
                        <p className="text-2xl font-bold">{fmt(calcResult.slotsNeededTotal)}</p>
                        <p className="text-xs opacity-60 mt-1">
                          to reach target N for all galaxies
                          {calcResult.slotsNeededTotal > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowSlotsModal(true)}
                              className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded border border-current opacity-70 hover:opacity-100 transition-opacity align-baseline"
                            >
                              Explain
                            </button>
                          )}
                        </p>
                      </div>
                    );
                  })()}
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
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
                        &lceil;slots&nbsp;/&nbsp;S&rceil;&nbsp;=&nbsp;&lceil;{fmt(calcResult.slotsNeededTotal)}&nbsp;/&nbsp;{seqSize}&rceil;
                      </p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                        additional users, each assigned S={seqSize} galaxies
                      </p>
                    </div>

                    {(() => {
                      const needed = calcResult.seqSizeNeeded;
                      const overLimit = needed !== null && needed > MAX_SEQUENCE_SIZE;
                      return (
                        <div className={`rounded-lg border p-4 ${
                          overLimit
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                            : "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700"
                        }`}>
                          <p className={`text-xs font-medium mb-1 uppercase tracking-wide ${
                            overLimit
                              ? "text-red-600 dark:text-red-400"
                              : "text-violet-600 dark:text-violet-400"
                          }`}>
                            Sequence size needed (fixed users U={extraUsers})
                          </p>
                          <p className={`text-3xl font-bold ${
                            overLimit
                              ? "text-red-700 dark:text-red-300"
                              : "text-violet-700 dark:text-violet-300"
                          }`}>
                            {needed !== null ? fmt(needed) : "—"}
                          </p>
                          <p className={`text-xs mt-2 font-mono ${
                            overLimit
                              ? "text-red-600 dark:text-red-400"
                              : "text-violet-600 dark:text-violet-400"
                          }`}>
                            &lceil;slots&nbsp;/&nbsp;U&rceil;&nbsp;=&nbsp;&lceil;{fmt(calcResult.slotsNeededTotal)}&nbsp;/&nbsp;{extraUsers}&rceil;
                          </p>
                          <p className={`text-xs mt-1 ${
                            overLimit
                              ? "text-red-500 dark:text-red-400"
                              : "text-violet-500 dark:text-violet-400"
                          }`}>
                            galaxies per user with U={extraUsers} additional users
                          </p>
                          {overLimit && needed !== null && (
                            <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                              ⚠ Exceeds system limit of {MAX_SEQUENCE_SIZE.toLocaleString()}.
                              You need at least{" "}
                              <strong>{Math.ceil(calcResult.slotsNeededTotal / MAX_SEQUENCE_SIZE).toLocaleString()}</strong>{" "}
                              additional users to stay within the limit.
                            </p>
                          )}
                        </div>
                      );
                    })()}
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
                    Number of users who already have an active sequence.{" "}
                    {(summary as any)?.usersWithSequences != null && (
                      <span className="text-indigo-500 dark:text-indigo-400">
                        Auto-detected: {((summary as any).usersWithSequences as number).toLocaleString()} users.
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current sequence size per user (C)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={MAX_SEQUENCE_SIZE}
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
                const exceeds = newTotal > MAX_SEQUENCE_SIZE;
                const maxAddlWithinLimit = Math.max(0, MAX_SEQUENCE_SIZE - currentSeqSize);
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
                        <p className="text-xs text-teal-600 dark:text-teal-400 mt-2 font-mono">
                          &lceil;slots&nbsp;/&nbsp;E&rceil;&nbsp;=&nbsp;&lceil;{fmt(slots)}&nbsp;/&nbsp;{existingUsers}&rceil;
                        </p>
                        <p className="text-xs text-teal-500 dark:text-teal-400 mt-1">
                          split evenly across E={existingUsers} existing users
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
                          C={currentSeqSize} + {fmt(additionalPerUser)} = {fmt(newTotal)}
                          {exceeds && ` — exceeds ${MAX_SEQUENCE_SIZE.toLocaleString()} limit!`}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                          Total new assignment slots
                        </p>
                        <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                          {fmt(additionalPerUser * existingUsers)}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-mono">
                          additional&nbsp;&times;&nbsp;E&nbsp;=&nbsp;{fmt(additionalPerUser)}&nbsp;&times;&nbsp;{existingUsers}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          slots needed:&nbsp;<span className="font-semibold">{fmt(slots)}</span>
                          {additionalPerUser * existingUsers > slots && (
                            <span className="text-gray-400">
                              {" "}(+{fmt(additionalPerUser * existingUsers - slots)} rounding overhead)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {exceeds && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-sm space-y-1">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          ⚠ Sequence size would exceed the {MAX_SEQUENCE_SIZE.toLocaleString()}-galaxy limit
                        </p>
                        <p className="text-amber-600 dark:text-amber-400">
                          Each user can be assigned at most{" "}
                          <strong>{fmt(maxAddlWithinLimit)}</strong> additional galaxies
                          (up to the {MAX_SEQUENCE_SIZE.toLocaleString()} cap).
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

                    {/* Visual: current vs projected coverage */}
                    {(() => {
                      const total = calcResult!.totalGalaxies;
                      const alreadyCovered = calcResult!.galaxiesAtOrAbove;
                      const currentPct = total > 0 ? (alreadyCovered / total) * 100 : 0;

                      // Slots actually available after applying the MAX_SEQUENCE_SIZE cap (if needed)
                      const provided = additionalPerUser * existingUsers;
                      const cappedProvided = exceeds
                        ? existingUsers * maxAddlWithinLimit
                        : provided;

                      // Greedy optimal simulation: fill galaxies closest to target first
                      // (maximises number of galaxies that reach N)
                      let remaining = cappedProvided;
                      let projected = alreadyCovered;
                      for (let k = targetN - 1; k >= 0 && remaining > 0; k--) {
                        const need = targetN - k;
                        const count = state.histogram[k] ?? 0;
                        if (count === 0) continue;
                        const canFull = Math.min(count, Math.floor(remaining / need));
                        projected += canFull;
                        remaining -= canFull * need;
                      }
                      const projectedPct = total > 0 ? (projected / total) * 100 : 0;
                      const gain = projected - alreadyCovered;

                      return (
                        <div className="space-y-4">
                          {/* Bar 1 — current */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Current coverage</span>
                              <span>
                                {fmt(alreadyCovered)} / {fmt(total)}{" "}
                                ({currentPct.toFixed(1)} %)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className="h-3 rounded-full transition-all duration-500 bg-gray-400 dark:bg-gray-500"
                                style={{ width: `${Math.min(100, currentPct)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Galaxies already at ≥ {targetN} assignment{targetN !== 1 ? "s" : ""} — does not change with E or C
                            </p>
                          </div>

                          {/* Bar 2 — projected after expansion */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span className={`font-medium ${exceeds ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}`}>
                                Projected after expansion{exceeds ? " (capped at 8 192)" : ""}
                              </span>
                              <span>
                                {fmt(projected)} / {fmt(total)}{" "}
                                ({projectedPct.toFixed(1)} %)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative">
                              {/* grey base: current coverage */}
                              <div
                                className="absolute top-0 left-0 h-3 rounded-full bg-gray-400 dark:bg-gray-500"
                                style={{ width: `${Math.min(100, currentPct)}%` }}
                              />
                              {/* teal extension: gain from expansion */}
                              <div
                                className={`absolute top-0 h-3 rounded-full transition-all duration-500 ${exceeds ? "bg-amber-500" : "bg-teal-500"}`}
                                style={{
                                  left: `${Math.min(100, currentPct)}%`,
                                  width: `${Math.max(0, Math.min(100 - currentPct, projectedPct - currentPct))}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                              <span>
                                +{fmt(gain)} galaxies newly covered (optimal distribution)
                              </span>
                              {projectedPct >= 100 && (
                                <span className="text-teal-600 dark:text-teal-400 font-medium">
                                  ✓ Full coverage achievable
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Slots explanation modal */}
      {showSlotsModal && calcResult && (() => {
        // Build per-bucket breakdown
        const rows: { k: number; count: number; deficit: number; contribution: number }[] = [];
        for (let k = 0; k < targetN; k++) {
          const count = state.histogram[k] ?? 0;
          if (count === 0) continue;
          const deficit = targetN - k;
          rows.push({ k, count, deficit, contribution: deficit * count });
        }
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowSlotsModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    How are the total slots calculated?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    For every galaxy with fewer than N={targetN} assignments, we count how many more it needs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSlotsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-4"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto px-6 py-4 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Formula per bucket:&nbsp;
                  <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">
                    slots contributed = (N &minus; k) &times; count(k)
                  </span>
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                        <th className="py-2 pr-6 font-medium text-gray-600 dark:text-gray-400">Times assigned (k)</th>
                        <th className="py-2 pr-6 text-right font-medium text-gray-600 dark:text-gray-400">Galaxies count</th>
                        <th className="py-2 pr-6 text-right font-medium text-gray-600 dark:text-gray-400">Deficit (N&minus;k)</th>
                        <th className="py-2 text-right font-medium text-gray-600 dark:text-gray-400">Slots needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ k, count, deficit, contribution }) => (
                        <tr key={k} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 pr-6 font-mono text-gray-800 dark:text-gray-200">
                            {k}{k === 0 && <span className="ml-1 text-xs text-red-500">(unassigned)</span>}
                          </td>
                          <td className="py-1.5 pr-6 text-right text-gray-700 dark:text-gray-300">{fmt(count)}</td>
                          <td className="py-1.5 pr-6 text-right font-mono text-gray-700 dark:text-gray-300">
                            {targetN}&minus;{k}&nbsp;=&nbsp;<strong>{deficit}</strong>
                          </td>
                          <td className="py-1.5 text-right font-mono text-gray-900 dark:text-white">
                            {fmt(deficit)}&nbsp;&times;&nbsp;{fmt(count)}&nbsp;=&nbsp;<strong>{fmt(contribution)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td colSpan={3} className="py-2 pr-6 font-semibold text-gray-900 dark:text-white">Total</td>
                        <td className="py-2 text-right font-bold text-red-700 dark:text-red-300 text-base">
                          {fmt(calcResult.slotsNeededTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Buckets with k &ge; N (already at or above target) contribute 0 and are not shown.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

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
