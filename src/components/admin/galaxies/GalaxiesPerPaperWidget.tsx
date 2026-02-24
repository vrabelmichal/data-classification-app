import { useAction, useQuery } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";

type PaperCounts = Record<string, number>;

interface PaperStatsComputationState {
  running: boolean;
  done: boolean;
  processedGalaxies: number;
  totalGalaxies: number | null;
  countsAll: PaperCounts;
  countsExcludingBlacklisted: PaperCounts;
  error: string | null;
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

export function GalaxiesPerPaperWidget() {
  const summary = useQuery(api.galaxies.paperStats.getPaperStatsSummary);
  const computePaperStatsBatch = useAction(api.galaxies.paperStats.computePaperStatsBatch);

  const [paperStats, setPaperStats] = useState<PaperStatsComputationState>({
    running: false,
    done: false,
    processedGalaxies: 0,
    totalGalaxies: null,
    countsAll: {},
    countsExcludingBlacklisted: {},
    error: null,
  });

  const cancelRef = useRef(false);

  const handleCompute = useCallback(async () => {
    cancelRef.current = false;

    setPaperStats({
      running: true,
      done: false,
      processedGalaxies: 0,
      totalGalaxies: summary?.totalGalaxies ?? null,
      countsAll: {},
      countsExcludingBlacklisted: {},
      error: null,
    });

    let cursor: string | undefined = undefined;
    let accAll: PaperCounts = {};
    let accExcl: PaperCounts = {};
    let processed = 0;
    let cachedBlacklistedIds: string[] | undefined = undefined;

    try {
      while (true) {
        if (cancelRef.current) break;

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
        done: !cancelRef.current,
        error: cancelRef.current ? null : prev.error,
      }));
    } catch (err) {
      const msg = (err as Error)?.message ?? "Unknown error";
      setPaperStats((prev) => ({ ...prev, running: false, error: msg }));
    }
  }, [computePaperStatsBatch, summary?.totalGalaxies]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setPaperStats((prev) => ({ ...prev, running: false }));
  }, []);

  const hasData = Object.keys(paperStats.countsAll).length > 0;
  const scannedTotal = Object.values(paperStats.countsAll).reduce((sum, value) => sum + value, 0);
  const aggregateTotal = paperStats.totalGalaxies;
  const hasAggregateMismatch =
    paperStats.done &&
    aggregateTotal !== null &&
    scannedTotal > 0 &&
    aggregateTotal !== scannedTotal;
  const progressPct =
    paperStats.done
      ? 100
      : paperStats.totalGalaxies && paperStats.totalGalaxies > 0
      ? Math.min(100, (paperStats.processedGalaxies / paperStats.totalGalaxies) * 100)
      : null;

  const rows = useMemo(() => {
    const keys = new Set<string>([
      ...Object.keys(paperStats.countsAll),
      ...Object.keys(paperStats.countsExcludingBlacklisted),
      ...(summary?.availablePapers ?? []),
    ]);
    const nextRows = Array.from(keys).map((paper) => ({
      paper,
      total: paperStats.countsAll[paper] ?? 0,
      excludingBlacklisted: paperStats.countsExcludingBlacklisted[paper] ?? 0,
    }));
    nextRows.sort((a, b) => {
      if (a.paper === "") return 1;
      if (b.paper === "") return -1;
      return a.paper.localeCompare(b.paper);
    });
    return nextRows;
  }, [paperStats.countsAll, paperStats.countsExcludingBlacklisted, summary?.availablePapers]);

  if (!summary?.authorized) {
    return null;
  }

  return (
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

        {!paperStats.running && (
          <button
            type="button"
            onClick={() => void handleCompute()}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Compute per-paper stats
          </button>
        )}

        {paperStats.running && (
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400">
        Per-paper totals are computed only when you click the button above and run in paginated batches.
      </p>

      {(paperStats.running || (paperStats.done && paperStats.totalGalaxies)) && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {paperStats.running ? "Scanning…" : "Scan complete"} {fmt(paperStats.processedGalaxies)} galaxies processed
            </span>
            {paperStats.running && paperStats.totalGalaxies && <span>{fmt(paperStats.totalGalaxies)} total</span>}
            {paperStats.done && <span>{fmt(scannedTotal)} scanned total</span>}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                paperStats.running ? "bg-blue-500 animate-pulse" : "bg-green-500"
              }`}
              style={{ width: `${progressPct ?? (paperStats.running ? 5 : 100)}%` }}
            />
          </div>
          {hasAggregateMismatch && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Aggregate total ({fmt(aggregateTotal!)}) differs from scanned galaxies table total ({fmt(scannedTotal)}).
            </p>
          )}
        </div>
      )}

      {paperStats.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
          <strong>Error:</strong> {paperStats.error}
        </div>
      )}

      {hasData ? (
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
              {rows.map((row) => (
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
                  {fmt(rows.reduce((sum, row) => sum + row.total, 0))}
                </td>
                <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">
                  {fmt(rows.reduce((sum, row) => sum + row.excludingBlacklisted, 0))}
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
    </div>
  );
}
