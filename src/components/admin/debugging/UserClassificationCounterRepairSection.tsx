import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "../../../lib/utils";

const USER_COUNTER_DIAGNOSTICS_PAGE_SIZE = 5;
const USER_COUNTER_REPAIR_BATCH_SIZE = 5;

type UserClassificationCounterDiagnosticsRow = {
  userId: Id<"users">;
  name: string | null;
  email: string | null;
  isConsistent: boolean;
  hasInvalidStoredValues: boolean;
  changedFields: string[];
  cachedClassificationsCount: number;
  actualClassificationsCount: number;
  cachedLsbTotal: number;
  actualLsbTotal: number;
  cachedMorphologyTotal: number;
  actualMorphologyTotal: number;
  invalidLsbCount: number;
  invalidMorphologyCount: number;
};

type UserClassificationCounterDiagnosticsSummary = {
  requestedUsers: number;
  scannedUsers: number;
  missingProfiles: number;
  inconsistentUsers: number;
  invalidValueUsers: number;
};

type UserClassificationCounterDiagnosticsPage = UserClassificationCounterDiagnosticsSummary & {
  rows: UserClassificationCounterDiagnosticsRow[];
  isDone: boolean;
  nextCursor: string | null;
};

type UserClassificationCounterRepairProgress = {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  missingProfiles: number;
  invalidValueUsers: number;
};

function formatUserLabel(name: string | null, email: string | null, userId: Id<"users">) {
  return name || email || String(userId);
}

function compareDiagnosticRows(
  left: UserClassificationCounterDiagnosticsRow,
  right: UserClassificationCounterDiagnosticsRow
) {
  if (Number(left.isConsistent) !== Number(right.isConsistent)) {
    return Number(left.isConsistent) - Number(right.isConsistent);
  }

  if (right.changedFields.length !== left.changedFields.length) {
    return right.changedFields.length - left.changedFields.length;
  }

  if (right.actualClassificationsCount !== left.actualClassificationsCount) {
    return right.actualClassificationsCount - left.actualClassificationsCount;
  }

  const leftLabel = left.name || left.email || String(left.userId);
  const rightLabel = right.name || right.email || String(right.userId);
  return leftLabel.localeCompare(rightLabel);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function UserClassificationCounterRepairSection() {
  const convex = useConvex();
  const users = useQuery(api.users.getUsersForSelection);
  const repairCounters = useMutation(api.classifications.maintenance.repairUserClassificationCounters);

  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [repairSelection, setRepairSelection] = useState<Id<"users">[]>([]);
  const [includeConsistent, setIncludeConsistent] = useState(false);
  const [scanMode, setScanMode] = useState<"all" | "selected" | null>(null);
  const [scanSummary, setScanSummary] = useState<UserClassificationCounterDiagnosticsSummary | null>(null);
  const [scanRows, setScanRows] = useState<UserClassificationCounterDiagnosticsRow[]>([]);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState<UserClassificationCounterRepairProgress | null>(null);

  const rows = [...scanRows].sort(compareDiagnosticRows);
  const inconsistentRows = rows.filter((row) => !row.isConsistent);
  const selectedRepairUserIds = new Set(repairSelection.map((userId) => String(userId)));

  useEffect(() => {
    if (isScanning) return;
    setRepairSelection(scanRows.filter((row) => !row.isConsistent).map((row) => row.userId));
  }, [isScanning, scanRows]);

  const runScan = async (mode: "all" | "selected") => {
    const scanUserIds = mode === "selected" ? selectedUserIds : [];

    if (mode === "selected" && scanUserIds.length === 0) {
      toast.error("Select at least one user to scan.");
      return;
    }

    setScanMode(mode);
    setIsScanning(true);
    setScanRows([]);
    setRepairSelection([]);
    setScanSummary({
      requestedUsers: mode === "selected" ? scanUserIds.length : 0,
      scannedUsers: 0,
      missingProfiles: 0,
      inconsistentUsers: 0,
      invalidValueUsers: 0,
    });
    setScanStatusMessage(
      mode === "selected"
        ? `Scanning 0 of ${scanUserIds.length.toLocaleString()} selected user(s)...`
        : "Scanning user profiles against the classifications table..."
    );

    let nextCursor: string | undefined;
    let requestedUsers = mode === "selected" ? scanUserIds.length : 0;
    let scannedUsers = 0;
    let missingProfiles = 0;
    let inconsistentUsers = 0;
    let invalidValueUsers = 0;
    const accumulatedRows: UserClassificationCounterDiagnosticsRow[] = [];

    try {
      for (let pageIndex = 0; pageIndex < 10000; pageIndex += 1) {
        const result = (await convex.query(api.classifications.maintenance.getUserClassificationCounterDiagnostics, {
          userIds: mode === "selected" ? scanUserIds : undefined,
          includeConsistent,
          cursor: nextCursor,
          limit: USER_COUNTER_DIAGNOSTICS_PAGE_SIZE,
        })) as UserClassificationCounterDiagnosticsPage;

        requestedUsers = result.requestedUsers;
        scannedUsers += result.scannedUsers;
        missingProfiles += result.missingProfiles;
        inconsistentUsers += result.inconsistentUsers;
        invalidValueUsers += result.invalidValueUsers;
        accumulatedRows.push(...result.rows);

        setScanRows([...accumulatedRows]);
        setScanSummary({
          requestedUsers,
          scannedUsers,
          missingProfiles,
          inconsistentUsers,
          invalidValueUsers,
        });
        setScanStatusMessage(
          `Scanned ${scannedUsers.toLocaleString()} of ${requestedUsers.toLocaleString()} user profile(s)...`
        );

        if (result.isDone || !result.nextCursor) {
          break;
        }

        nextCursor = result.nextCursor;
      }

      toast.success(
        `Scan finished. Checked ${scannedUsers.toLocaleString()} user profile(s) and found ${inconsistentUsers.toLocaleString()} inconsistent profile(s).`
      );
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to scan user counters."));
    } finally {
      setIsScanning(false);
      setScanStatusMessage(null);
    }
  };

  const handleSelectedUsersChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextUserIds = Array.from(event.target.selectedOptions, (option) => option.value as Id<"users">);
    setSelectedUserIds(nextUserIds);
  };

  const handleScanSelected = () => {
    void runScan("selected");
  };

  const handleScanAll = () => {
    void runScan("all");
  };

  const handleToggleRepairSelection = (userId: Id<"users">, checked: boolean) => {
    setRepairSelection((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }
      return current.filter((currentUserId) => currentUserId !== userId);
    });
  };

  const handleRepairSelected = async () => {
    if (repairSelection.length === 0) {
      toast.error("Select at least one inconsistent user to repair.");
      return;
    }

    const confirmed = confirm(
      `Recompute cached classification counters for ${repairSelection.length.toLocaleString()} selected user(s)?\n\n` +
        "Only changed counter fields will be patched. Healthy users are skipped."
    );
    if (!confirmed) return;

    setRepairing(true);
    setRepairProgress({
      total: repairSelection.length,
      processed: 0,
      updated: 0,
      skipped: 0,
      missingProfiles: 0,
      invalidValueUsers: 0,
    });

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let missingProfiles = 0;
    let invalidValueUsers = 0;

    try {
      for (let startIndex = 0; startIndex < repairSelection.length; startIndex += USER_COUNTER_REPAIR_BATCH_SIZE) {
        const batchUserIds = repairSelection.slice(startIndex, startIndex + USER_COUNTER_REPAIR_BATCH_SIZE);
        const result = await repairCounters({ userIds: batchUserIds });

        processed += result.processed;
        updated += result.updated;
        skipped += result.skipped;
        missingProfiles += result.missingProfiles;
        invalidValueUsers += result.invalidValueUsers;

        setRepairProgress({
          total: repairSelection.length,
          processed,
          updated,
          skipped,
          missingProfiles,
          invalidValueUsers,
        });
      }

      toast.success(
        `Repaired ${updated.toLocaleString()} user(s); ${skipped.toLocaleString()} already matched.`
      );
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to repair user counters."));
    } finally {
      setRepairing(false);
      setRepairProgress(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-2">
            User Classification Counter Diagnostics
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Scan cached per-user statistics against the live classifications table, then repair only the selected users that drifted.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={includeConsistent}
            onChange={(event) => setIncludeConsistent(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Include already consistent users in scan results
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="space-y-4">
          <div>
            <label htmlFor="counter-repair-user-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Candidate users
            </label>
            <select
              id="counter-repair-user-select"
              multiple
              value={selectedUserIds}
              onChange={handleSelectedUsersChange}
              className="h-64 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              {(users ?? []).map((user) => (
                <option key={user.userId} value={user.userId}>
                  {formatUserLabel(user.name, user.email, user.userId)} ({user.classificationsCount.toLocaleString()})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Multi-select users to limit the scan. Leave it empty and use the full scan to find every affected profile.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleScanSelected}
              disabled={isScanning || repairing || selectedUserIds.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isScanning && scanMode === "selected" ? "Scanning selected..." : "Scan selected users"}
            </button>

            <button
              type="button"
              onClick={handleScanAll}
              disabled={isScanning || repairing}
              className="inline-flex items-center justify-center rounded-lg bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isScanning && scanMode === "all" ? "Scanning all..." : "Scan all users"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {scanSummary && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Requested</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {scanSummary.requestedUsers.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Profiles scanned</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {scanSummary.scannedUsers.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
                <div className="text-xs uppercase tracking-wide text-red-600 dark:text-red-300">Inconsistent</div>
                <div className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-200">
                  {scanSummary.inconsistentUsers.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Invalid values</div>
                <div className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-200">
                  {scanSummary.invalidValueUsers.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Missing profiles</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {scanSummary.missingProfiles.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <button
                type="button"
                onClick={() => setRepairSelection(inconsistentRows.map((row) => row.userId))}
                disabled={isScanning || repairing}
                className="text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Select all inconsistent users
              </button>
              <button
                type="button"
                onClick={() => setRepairSelection([])}
                disabled={isScanning || repairing}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Clear repair selection
              </button>
              <button
                type="button"
                onClick={() => void handleRepairSelected()}
                disabled={repairing || isScanning || repairSelection.length === 0}
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {repairing
                  ? `Repairing ${repairProgress?.processed.toLocaleString() ?? "0"}/${repairProgress?.total.toLocaleString() ?? repairSelection.length.toLocaleString()}`
                  : `Repair selected (${repairSelection.length.toLocaleString()})`}
              </button>
              {repairProgress && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Processed {repairProgress.processed.toLocaleString()} / {repairProgress.total.toLocaleString()} selected user(s); updated {repairProgress.updated.toLocaleString()}.
                </div>
              )}
            </div>
          )}

          {!scanSummary && !isScanning && (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
              Run a scan to find users whose cached classification counters drifted away from the live classifications table.
            </div>
          )}

          {isScanning && (
            <div className="rounded-lg border border-gray-200 px-4 py-6 dark:border-gray-700">
              <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                {scanStatusMessage ?? "Scanning user profiles against live classification rows..."}
              </div>
            </div>
          )}

          {scanSummary && rows.length === 0 && !isScanning && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-200">
              No users matched this scan filter. Cached counters currently agree with the classifications table.
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Repair
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Cached totals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Live totals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {rows.map((row) => {
                    const canRepair = !row.isConsistent;
                    const label = formatUserLabel(row.name, row.email, row.userId);
                    const invalidCount = row.invalidLsbCount + row.invalidMorphologyCount;

                    return (
                      <tr
                        key={row.userId}
                        className={cn(
                          row.isConsistent
                            ? "bg-white dark:bg-gray-800"
                            : "bg-red-50/40 dark:bg-red-950/10"
                        )}
                      >
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selectedRepairUserIds.has(String(row.userId))}
                            disabled={!canRepair || repairing || isScanning}
                            onChange={(event) => handleToggleRepairSelection(row.userId, event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                          {row.email && row.name && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.email}</div>
                          )}
                          <div className="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium text-white bg-gray-700 dark:bg-gray-600">
                            {row.actualClassificationsCount.toLocaleString()} classifications
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                          <div>Total: {row.cachedClassificationsCount.toLocaleString()}</div>
                          <div className="mt-1">LSB sum: {row.cachedLsbTotal.toLocaleString()}</div>
                          <div className="mt-1">Morph sum: {row.cachedMorphologyTotal.toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                          <div>Total: {row.actualClassificationsCount.toLocaleString()}</div>
                          <div className="mt-1">LSB sum: {row.actualLsbTotal.toLocaleString()}</div>
                          <div className="mt-1">Morph sum: {row.actualMorphologyTotal.toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                          <div
                            className={cn(
                              "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                              row.isConsistent
                                ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                            )}
                          >
                            {row.isConsistent ? "Counters match" : `${row.changedFields.length} counter fields drifted`}
                          </div>
                          {row.changedFields.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Changed: {row.changedFields.join(", ")}
                            </div>
                          )}
                          {invalidCount > 0 && (
                            <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                              Invalid stored values detected: LSB {row.invalidLsbCount}, morphology {row.invalidMorphologyCount}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}