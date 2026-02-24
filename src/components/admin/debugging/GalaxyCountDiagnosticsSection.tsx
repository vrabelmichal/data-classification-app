import { useAction, useQuery } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";

type ScanState = {
  running: boolean;
  done: boolean;
  error: string | null;
  scannedGalaxies: number;
  scannedGalaxyIds: number;
  missingNumericIdInGalaxies: number;
  phase: "idle" | "galaxies" | "galaxyIds" | "done";
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  return n.toLocaleString();
}

function signedDelta(value: number | null): string {
  if (value === null) return "N/A";
  if (value === 0) return "0";
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

export function GalaxyCountDiagnosticsSection() {
  const summary = useQuery(api.galaxies.countDiagnostics.getGalaxyCountDiagnosticsSummary);
  const computeBatch = useAction(api.galaxies.countDiagnostics.computeCountDiagnosticsBatch);
  const cancelRef = useRef(false);

  const [scan, setScan] = useState<ScanState>({
    running: false,
    done: false,
    error: null,
    scannedGalaxies: 0,
    scannedGalaxyIds: 0,
    missingNumericIdInGalaxies: 0,
    phase: "idle",
  });

  const handleRun = useCallback(async () => {
    cancelRef.current = false;
    setScan({
      running: true,
      done: false,
      error: null,
      scannedGalaxies: 0,
      scannedGalaxyIds: 0,
      missingNumericIdInGalaxies: 0,
      phase: "galaxies",
    });

    try {
      let galaxiesCursor: string | undefined = undefined;
      let galaxyIdsCursor: string | undefined = undefined;
      let scannedGalaxies = 0;
      let scannedGalaxyIds = 0;
      let missingNumericIdInGalaxies = 0;

      while (true) {
        if (cancelRef.current) break;

        const result = await computeBatch({
          table: "galaxies",
          cursor: galaxiesCursor,
          batchSize: 5000,
        });

        scannedGalaxies += result.batchCount;
        missingNumericIdInGalaxies += result.missingNumericIdInBatch ?? 0;

        setScan((prev) => ({
          ...prev,
          phase: "galaxies",
          scannedGalaxies,
          missingNumericIdInGalaxies,
        }));

        if (result.isDone || !result.nextCursor) break;
        galaxiesCursor = result.nextCursor;
      }

      while (!cancelRef.current) {
        const result = await computeBatch({
          table: "galaxyIds",
          cursor: galaxyIdsCursor,
          batchSize: 5000,
        });

        scannedGalaxyIds += result.batchCount;

        setScan((prev) => ({
          ...prev,
          phase: "galaxyIds",
          scannedGalaxyIds,
        }));

        if (result.isDone || !result.nextCursor) break;
        galaxyIdsCursor = result.nextCursor;
      }

      setScan((prev) => ({
        ...prev,
        running: false,
        done: !cancelRef.current,
        phase: cancelRef.current ? prev.phase : "done",
      }));
    } catch (err) {
      const msg = (err as Error)?.message ?? "Unknown error";
      setScan((prev) => ({ ...prev, running: false, error: msg }));
    }
  }, [computeBatch]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setScan((prev) => ({ ...prev, running: false }));
  }, []);

  const aggregateGalaxyIds = summary?.aggregateCounts?.galaxyIdsAggregate ?? null;
  const aggregateGalaxiesById = summary?.aggregateCounts?.galaxiesById ?? null;
  const aggregateGalaxiesByNumericId = summary?.aggregateCounts?.galaxiesByNumericId ?? null;

  const progressEstimateTotal = useMemo(() => {
    const estimatedGalaxies = aggregateGalaxiesById ?? 0;
    const estimatedGalaxyIds = aggregateGalaxyIds ?? 0;
    const sum = estimatedGalaxies + estimatedGalaxyIds;
    return sum > 0 ? sum : null;
  }, [aggregateGalaxiesById, aggregateGalaxyIds]);

  const progressCurrent = scan.scannedGalaxies + scan.scannedGalaxyIds;
  const progressPct =
    scan.done
      ? 100
      : progressEstimateTotal && progressEstimateTotal > 0
      ? Math.min(100, (progressCurrent / progressEstimateTotal) * 100)
      : null;

  const deltaGalaxiesVsGalaxyIds =
    scan.done ? scan.scannedGalaxies - scan.scannedGalaxyIds : null;
  const deltaGalaxiesVsAggregateById =
    scan.done && aggregateGalaxiesById !== null
      ? scan.scannedGalaxies - aggregateGalaxiesById
      : null;
  const deltaGalaxyIdsVsAggregate =
    scan.done && aggregateGalaxyIds !== null
      ? scan.scannedGalaxyIds - aggregateGalaxyIds
      : null;

  if (summary === undefined) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-sm text-gray-600 dark:text-gray-300">Loading galaxy count diagnostics…</div>
      </div>
    );
  }

  if (!summary.authorized) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Galaxy Count Diagnostics</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Compare counts between core tables and aggregates using explicit paginated scans.
          </p>
        </div>

        {!scan.running && (
          <button
            type="button"
            onClick={() => void handleRun()}
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Run count scan
          </button>
        )}

        {scan.running && (
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400">
        No automatic full-table reads: scans run only after clicking the button and process in 5,000-row batches.
      </p>

      {(scan.running || scan.done) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {scan.running ? "Scanning…" : "Scan complete"} phase: {scan.phase}
            </span>
            <span>
              galaxies {fmt(scan.scannedGalaxies)} • galaxyIds {fmt(scan.scannedGalaxyIds)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                scan.running ? "bg-blue-500 animate-pulse" : "bg-green-500"
              }`}
              style={{ width: `${progressPct ?? (scan.running ? 5 : 100)}%` }}
            />
          </div>
        </div>
      )}

      {scan.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
          <strong>Error:</strong> {scan.error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Metric</th>
              <th className="text-right py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Value</th>
              <th className="text-right py-2 font-medium text-gray-600 dark:text-gray-400">Delta</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Scanned galaxies table</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{scan.done ? fmt(scan.scannedGalaxies) : "—"}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">{scan.done ? signedDelta(deltaGalaxiesVsAggregateById) : "—"}</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Scanned galaxyIds table</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{scan.done ? fmt(scan.scannedGalaxyIds) : "—"}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">{scan.done ? signedDelta(deltaGalaxyIdsVsAggregate) : "—"}</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Aggregate galaxiesById</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(aggregateGalaxiesById)}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">—</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Aggregate galaxiesByNumericId</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(aggregateGalaxiesByNumericId)}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">—</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Aggregate galaxyIdsAggregate</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(aggregateGalaxyIds)}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">—</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/60">
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Blacklisted galaxies</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{fmt(summary.blacklistedCount)}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">—</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-900 dark:text-white">Galaxies missing numericId (scan)</td>
              <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{scan.done ? fmt(scan.missingNumericIdInGalaxies) : "—"}</td>
              <td className="py-2 text-right text-gray-500 dark:text-gray-400">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {scan.done && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-md border p-3 text-sm ${deltaGalaxiesVsGalaxyIds === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            galaxies table vs galaxyIds table: {signedDelta(deltaGalaxiesVsGalaxyIds)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${scan.missingNumericIdInGalaxies === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            Missing numericId in galaxies: {fmt(scan.missingNumericIdInGalaxies)}
          </div>
        </div>
      )}
    </div>
  );
}
