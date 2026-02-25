import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type DiagnosticsTable =
  | "galaxies"
  | "galaxyIds"
  | "galaxyBlacklist"
  | "galaxies_photometry_g"
  | "galaxies_photometry_r"
  | "galaxies_photometry_i"
  | "galaxies_source_extractor"
  | "galaxies_thuruthipilly"
  | "classifications"
  | "skippedGalaxies"
  | "userGalaxyClassifications";

const diagnosticsTables: DiagnosticsTable[] = [
  "galaxies",
  "galaxyIds",
  "galaxyBlacklist",
  "galaxies_photometry_g",
  "galaxies_photometry_r",
  "galaxies_photometry_i",
  "galaxies_source_extractor",
  "galaxies_thuruthipilly",
  "classifications",
  "skippedGalaxies",
  "userGalaxyClassifications",
];

const tableLabels: Record<DiagnosticsTable, string> = {
  galaxies: "galaxies",
  galaxyIds: "galaxyIds",
  galaxyBlacklist: "galaxyBlacklist",
  galaxies_photometry_g: "galaxies_photometry_g",
  galaxies_photometry_r: "galaxies_photometry_r",
  galaxies_photometry_i: "galaxies_photometry_i",
  galaxies_source_extractor: "galaxies_source_extractor",
  galaxies_thuruthipilly: "galaxies_thuruthipilly",
  classifications: "classifications",
  skippedGalaxies: "skippedGalaxies",
  userGalaxyClassifications: "userGalaxyClassifications",
};

function createEmptyScannedByTable(): Record<DiagnosticsTable, number> {
  return {
    galaxies: 0,
    galaxyIds: 0,
    galaxyBlacklist: 0,
    galaxies_photometry_g: 0,
    galaxies_photometry_r: 0,
    galaxies_photometry_i: 0,
    galaxies_source_extractor: 0,
    galaxies_thuruthipilly: 0,
    classifications: 0,
    skippedGalaxies: 0,
    userGalaxyClassifications: 0,
  };
}

type ScanState = {
  running: boolean;
  done: boolean;
  error: string | null;
  scannedByTable: Record<DiagnosticsTable, number>;
  missingNumericIdInGalaxies: number;
  phase: "idle" | DiagnosticsTable | "done";
};

type TableViewMode = "folded" | "important" | "all";

type DiagnosticsMetricRow = {
  key: string;
  label: string;
  value: string;
  delta: string;
  important: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type DiagnosticsHistoryItem = {
  _id: Id<"galaxyCountDiagnosticsHistory">;
  createdAt: number;
  runDate: string;
  createdByName: string;
  createdByEmail: string;
  tableScanCounts: Record<string, number>;
  missingNumericIdInGalaxies: number;
  aggregateCounts: Record<string, number | null>;
  blacklistDetails: {
    totalRows: number;
    uniqueExternalIds: number;
    presentInGalaxies: number;
    missingFromGalaxies: number;
  };
  derivedCounts: Record<string, number | null>;
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

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function GalaxyCountDiagnosticsSection() {
  const summary = useQuery(api.galaxies.countDiagnostics.getGalaxyCountDiagnosticsSummary);
  const computeBatch = useAction(api.galaxies.countDiagnostics.computeCountDiagnosticsBatch);
  const saveDiagnosticsResult = useMutation(api.galaxies.countDiagnostics.saveGalaxyCountDiagnosticsResult);
  const deleteDiagnosticsRecord = useMutation(api.galaxies.countDiagnostics.deleteGalaxyCountDiagnosticsHistoryRecord);
  const cancelRef = useRef(false);

  const [scan, setScan] = useState<ScanState>({
    running: false,
    done: false,
    error: null,
    scannedByTable: createEmptyScannedByTable(),
    missingNumericIdInGalaxies: 0,
    phase: "idle",
  });
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>("important");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyCursor, setHistoryCursor] = useState<string | undefined>(undefined);
  const [historyItems, setHistoryItems] = useState<DiagnosticsHistoryItem[]>([]);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiagnosticsHistoryItem | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const historyResult = useQuery(
    api.galaxies.countDiagnostics.getGalaxyCountDiagnosticsHistory,
    historyExpanded
      ? {
          runDate: historyDateFilter || undefined,
          limit: 10,
          cursor: historyCursor,
        }
      : "skip"
  );

  useEffect(() => {
    if (!historyExpanded) {
      setHistoryCursor(undefined);
      setHistoryItems([]);
      setHistoryNextCursor(null);
      setHistoryLoadingMore(false);
      return;
    }

    setHistoryCursor(undefined);
    setHistoryItems([]);
    setHistoryNextCursor(null);
    setHistoryLoadingMore(false);
  }, [historyExpanded, historyDateFilter]);

  useEffect(() => {
    if (!historyExpanded || !historyResult) return;

    setHistoryNextCursor(historyResult.nextCursor ?? null);
    setHistoryLoadingMore(false);

    setHistoryItems((prev) => {
      if (!historyCursor) {
        return historyResult.items as DiagnosticsHistoryItem[];
      }

      const existingIds = new Set(prev.map((item) => item._id));
      const nextItems = (historyResult.items as DiagnosticsHistoryItem[]).filter(
        (item) => !existingIds.has(item._id)
      );
      if (nextItems.length === 0) return prev;
      return [...prev, ...nextItems];
    });
  }, [historyCursor, historyExpanded, historyResult]);

  const handleRun = useCallback(async () => {
    cancelRef.current = false;
    setSaveStatus("idle");
    setSaveMessage(null);
    setScan({
      running: true,
      done: false,
      error: null,
      scannedByTable: createEmptyScannedByTable(),
      missingNumericIdInGalaxies: 0,
      phase: diagnosticsTables[0],
    });

    try {
      const scannedByTable = createEmptyScannedByTable();
      let missingNumericIdInGalaxies = 0;

      for (const table of diagnosticsTables) {
        if (cancelRef.current) break;

        let tableCursor: string | undefined = undefined;
        while (!cancelRef.current) {
          const result = await computeBatch({
            table,
            cursor: tableCursor,
            batchSize: 5000,
          });

          scannedByTable[table] += result.batchCount;
          if (table === "galaxies") {
            missingNumericIdInGalaxies += result.missingNumericIdInBatch ?? 0;
          }

          setScan((prev) => ({
            ...prev,
            phase: table,
            scannedByTable: { ...scannedByTable },
            missingNumericIdInGalaxies,
          }));

          if (result.isDone || !result.nextCursor) break;
          tableCursor = result.nextCursor;
        }
      }

      if (!cancelRef.current) {
        setSaveStatus("saving");
        setSaveMessage("Saving diagnostics snapshot…");

        try {
          await saveDiagnosticsResult({
            tableScanCounts: scannedByTable,
            missingNumericIdInGalaxies,
            aggregateCounts: {
              galaxyIdsAggregate: summary?.aggregateCounts?.galaxyIdsAggregate ?? null,
              galaxiesById: summary?.aggregateCounts?.galaxiesById ?? null,
              galaxiesByNumericId: summary?.aggregateCounts?.galaxiesByNumericId ?? null,
              classificationsByCreated: summary?.aggregateCounts?.classificationsByCreated ?? null,
            },
            blacklistDetails: {
              totalRows: summary?.blacklistedCount ?? 0,
              uniqueExternalIds: summary?.blacklistDetails?.uniqueExternalIds ?? 0,
              presentInGalaxies: summary?.blacklistDetails?.presentInGalaxies ?? 0,
              missingFromGalaxies: summary?.blacklistDetails?.missingFromGalaxies ?? 0,
            },
            derivedCounts: {
              eligibleGalaxiesFromAggregate:
                summary?.derivedCounts?.eligibleGalaxiesFromAggregate ?? null,
              eligibleGalaxyIdsFromAggregate:
                summary?.derivedCounts?.eligibleGalaxyIdsFromAggregate ?? null,
            },
          });

          setSaveStatus("saved");
          setSaveMessage("Diagnostics snapshot saved.");

          if (historyExpanded) {
            setHistoryCursor(undefined);
          }
        } catch (saveErr) {
          const msg = (saveErr as Error)?.message ?? "Failed to save diagnostics snapshot";
          setSaveStatus("error");
          setSaveMessage(msg);
        }
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
      setSaveStatus("error");
      setSaveMessage("Scan failed; no snapshot saved.");
    }
  }, [computeBatch, historyExpanded, saveDiagnosticsResult, summary]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setScan((prev) => ({ ...prev, running: false }));
  }, []);

  const handleLoadMoreHistory = useCallback(() => {
    if (!historyNextCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    setHistoryCursor(historyNextCursor);
  }, [historyLoadingMore, historyNextCursor]);

  const handleConfirmDeleteHistory = useCallback(async () => {
    if (!deleteTarget || deleteInProgress) return;

    setDeleteInProgress(true);
    try {
      await deleteDiagnosticsRecord({ historyId: deleteTarget._id });
      setHistoryItems((prev) => prev.filter((item) => item._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch {
      // Keep modal open so user can retry or cancel.
    } finally {
      setDeleteInProgress(false);
    }
  }, [deleteDiagnosticsRecord, deleteInProgress, deleteTarget]);

  const aggregateGalaxyIds = summary?.aggregateCounts?.galaxyIdsAggregate ?? null;
  const aggregateGalaxiesById = summary?.aggregateCounts?.galaxiesById ?? null;
  const aggregateGalaxiesByNumericId = summary?.aggregateCounts?.galaxiesByNumericId ?? null;
  const aggregateClassifications = summary?.aggregateCounts?.classificationsByCreated ?? null;

  const blacklistedUnique = summary?.blacklistDetails?.uniqueExternalIds ?? 0;
  const blacklistedPresentInGalaxies = summary?.blacklistDetails?.presentInGalaxies ?? 0;
  const blacklistedMissingFromGalaxies = summary?.blacklistDetails?.missingFromGalaxies ?? 0;

  const scannedGalaxies = scan.scannedByTable.galaxies;
  const scannedGalaxyIds = scan.scannedByTable.galaxyIds;
  const scannedClassifications = scan.scannedByTable.classifications;
  const scannedUserGalaxyClassifications = scan.scannedByTable.userGalaxyClassifications;

  const progressEstimateTotal = useMemo(() => {
    const estimatedCounts = summary?.estimatedTableCounts;
    if (!estimatedCounts) return null;

    const total = diagnosticsTables.reduce((sum, table) => {
      const n = estimatedCounts[table];
      return n === null || n === undefined ? sum : sum + n;
    }, 0);

    return total > 0 ? total : null;
  }, [summary?.estimatedTableCounts]);

  const progressCurrent = diagnosticsTables.reduce(
    (sum, table) => sum + scan.scannedByTable[table],
    0
  );
  const progressPct =
    scan.done
      ? 100
      : progressEstimateTotal && progressEstimateTotal > 0
      ? Math.min(100, (progressCurrent / progressEstimateTotal) * 100)
      : null;

  const deltaGalaxiesVsGalaxyIds = scan.done ? scannedGalaxies - scannedGalaxyIds : null;
  const deltaGalaxiesVsAggregateById =
    scan.done && aggregateGalaxiesById !== null
      ? scannedGalaxies - aggregateGalaxiesById
      : null;
  const deltaGalaxyIdsVsAggregate =
    scan.done && aggregateGalaxyIds !== null
      ? scannedGalaxyIds - aggregateGalaxyIds
      : null;

  const deltaClassificationsVsAggregate =
    scan.done && aggregateClassifications !== null
      ? scannedClassifications - aggregateClassifications
      : null;

  const eligibleFromScan =
    scan.done ? scannedGalaxies - blacklistedPresentInGalaxies : null;
  const deltaEligibleScanVsAggregate =
    scan.done && summary?.derivedCounts?.eligibleGalaxiesFromAggregate !== null
      ? (eligibleFromScan ?? 0) - summary.derivedCounts.eligibleGalaxiesFromAggregate
      : null;

  const deltaClassificationMirror =
    scan.done ? scannedUserGalaxyClassifications - scannedClassifications : null;

  const metricsRows = useMemo<DiagnosticsMetricRow[]>(() => {
    const importantScanTables: DiagnosticsTable[] = [
      "galaxies",
      "galaxyIds",
      "classifications",
      "userGalaxyClassifications",
      "galaxyBlacklist",
    ];

    const additionalScanTables = diagnosticsTables.filter(
      (table) => !importantScanTables.includes(table)
    );

    const scanRows: DiagnosticsMetricRow[] = [
      ...importantScanTables,
      ...additionalScanTables,
    ].map((table) => {
      const expected = summary?.estimatedTableCounts?.[table] ?? null;
      const scanned = scan.scannedByTable[table];
      const delta = scan.done && expected !== null ? scanned - expected : null;

      return {
        key: `scan_${table}`,
        label: `Scanned ${tableLabels[table]}`,
        value: scan.running || scan.done ? fmt(scanned) : "—",
        delta: scan.done ? signedDelta(delta) : "—",
        important: importantScanTables.includes(table),
      };
    });

    const aggregateAndBlacklistRows: DiagnosticsMetricRow[] = [
      {
        key: "agg_galaxies_by_id",
        label: "Aggregate galaxiesById",
        value: fmt(aggregateGalaxiesById),
        delta: "—",
        important: true,
      },
      {
        key: "agg_galaxy_ids",
        label: "Aggregate galaxyIdsAggregate",
        value: fmt(aggregateGalaxyIds),
        delta: "—",
        important: true,
      },
      {
        key: "agg_classifications",
        label: "Aggregate classificationsByCreated",
        value: fmt(aggregateClassifications),
        delta: "—",
        important: true,
      },
      {
        key: "blacklist_unique",
        label: "Blacklist unique external IDs",
        value: fmt(blacklistedUnique),
        delta: "—",
        important: true,
      },
      {
        key: "blacklist_found",
        label: "Blacklisted IDs found in galaxies",
        value: fmt(blacklistedPresentInGalaxies),
        delta: "—",
        important: true,
      },
      {
        key: "blacklist_missing",
        label: "Blacklisted IDs missing from galaxies",
        value: fmt(blacklistedMissingFromGalaxies),
        delta: "—",
        important: true,
      },
      {
        key: "missing_numeric_id",
        label: "Galaxies missing numericId (scan)",
        value: scan.done ? fmt(scan.missingNumericIdInGalaxies) : "—",
        delta: "—",
        important: true,
      },
      {
        key: "agg_galaxies_by_numeric_id",
        label: "Aggregate galaxiesByNumericId",
        value: fmt(aggregateGalaxiesByNumericId),
        delta: "—",
        important: false,
      },
      {
        key: "blacklist_total",
        label: "Blacklist rows (total)",
        value: fmt(summary?.blacklistedCount),
        delta: "—",
        important: false,
      },
    ];

    return [...scanRows, ...aggregateAndBlacklistRows];
  }, [
    aggregateClassifications,
    aggregateGalaxyIds,
    aggregateGalaxiesById,
    aggregateGalaxiesByNumericId,
    blacklistedMissingFromGalaxies,
    blacklistedPresentInGalaxies,
    blacklistedUnique,
    scan.done,
    scan.missingNumericIdInGalaxies,
    scan.running,
    scan.scannedByTable,
    summary?.blacklistedCount,
    summary?.estimatedTableCounts,
  ]);

  const visibleMetricRows =
    tableViewMode === "all"
      ? metricsRows
      : tableViewMode === "important"
      ? metricsRows.filter((row) => row.important)
      : [];

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTableViewMode("folded")}
          className={`inline-flex items-center justify-center text-xs font-medium py-1.5 px-3 rounded-md border transition-colors ${
            tableViewMode === "folded"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          }`}
        >
          Folded
        </button>
        <button
          type="button"
          onClick={() => setTableViewMode("important")}
          className={`inline-flex items-center justify-center text-xs font-medium py-1.5 px-3 rounded-md border transition-colors ${
            tableViewMode === "important"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          }`}
        >
          Important (default)
        </button>
        <button
          type="button"
          onClick={() => setTableViewMode("all")}
          className={`inline-flex items-center justify-center text-xs font-medium py-1.5 px-3 rounded-md border transition-colors ${
            tableViewMode === "all"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          }`}
        >
          Unfolded (all)
        </button>
      </div>

      {(scan.running || scan.done) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {scan.running ? "Scanning…" : "Scan complete"} phase: {scan.phase}
            </span>
            <span>
              scanned {fmt(progressCurrent)} rows across {diagnosticsTables.length} tables
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

      {saveMessage && (
        <div
          className={`p-3 rounded-lg border text-sm ${
            saveStatus === "saved"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300"
              : saveStatus === "saving"
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
          }`}
        >
          {saveMessage}
        </div>
      )}

      {tableViewMode === "folded" ? (
        <div className="text-sm text-gray-600 dark:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
          Diagnostics table is folded.
        </div>
      ) : (
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
              {visibleMetricRows.map((row, index) => (
                <tr
                  key={row.key}
                  className={index < visibleMetricRows.length - 1 ? "border-b border-gray-100 dark:border-gray-700/60" : ""}
                >
                  <td className="py-2 pr-4 text-gray-900 dark:text-white">{row.label}</td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-gray-200">{row.value}</td>
                  <td className="py-2 text-right text-gray-500 dark:text-gray-400">{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setHistoryExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-2 text-left"
        >
          <span className="text-sm font-medium text-gray-900 dark:text-white">Older analysis results</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{historyExpanded ? "Hide" : "Show"}</span>
        </button>

        {historyExpanded && (
          <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Filter by date</label>
                <input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                type="button"
                onClick={() => setHistoryDateFilter("")}
                className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                Clear
              </button>
            </div>

            {!historyResult && (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading history…</div>
            )}

            {historyResult && historyItems.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">No stored diagnostics runs for this filter.</div>
            )}

            {historyItems.length > 0 && (
              <div className="space-y-2">
                {historyItems.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{fmtDateTime(item.createdAt)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          by {item.createdByName} ({item.createdByEmail}) • run date {item.runDate}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <div>galaxies: {fmt(item.tableScanCounts.galaxies)}</div>
                      <div>galaxyIds: {fmt(item.tableScanCounts.galaxyIds)}</div>
                      <div>classifications: {fmt(item.tableScanCounts.classifications)}</div>
                      <div>missing numericId: {fmt(item.missingNumericIdInGalaxies)}</div>
                      <div>blacklist unique: {fmt(item.blacklistDetails.uniqueExternalIds)}</div>
                      <div>eligible galaxies: {fmt(item.derivedCounts.eligibleGalaxiesFromAggregate ?? null)}</div>
                    </div>
                  </div>
                ))}

                {historyNextCursor && (
                  <button
                    type="button"
                    onClick={handleLoadMoreHistory}
                    disabled={historyLoadingMore}
                    className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium py-2 px-3 rounded-md transition-colors disabled:opacity-50"
                  >
                    {historyLoadingMore ? "Loading…" : "Load older"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {scan.done && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className={`rounded-md border p-3 text-sm ${deltaGalaxiesVsGalaxyIds === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            galaxies table vs galaxyIds table: {signedDelta(deltaGalaxiesVsGalaxyIds)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${deltaGalaxiesVsAggregateById === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            galaxies scan vs galaxiesById aggregate: {signedDelta(deltaGalaxiesVsAggregateById)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${deltaGalaxyIdsVsAggregate === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            galaxyIds scan vs aggregate: {signedDelta(deltaGalaxyIdsVsAggregate)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${deltaClassificationsVsAggregate === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            classifications scan vs aggregate: {signedDelta(deltaClassificationsVsAggregate)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${deltaClassificationMirror === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            userGalaxyClassifications vs classifications: {signedDelta(deltaClassificationMirror)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${deltaEligibleScanVsAggregate === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            eligible galaxies (scan minus blacklist-in-galaxies) vs derived aggregate: {signedDelta(deltaEligibleScanVsAggregate)}
          </div>
          <div className={`rounded-md border p-3 text-sm ${scan.missingNumericIdInGalaxies === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
            Missing numericId in galaxies: {fmt(scan.missingNumericIdInGalaxies)}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete stored result?</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                This will permanently remove the diagnostics record from {fmtDateTime(deleteTarget.createdAt)}.
              </p>
            </div>
            <div className="p-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteInProgress}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteHistory()}
                disabled={deleteInProgress}
                className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deleteInProgress ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
