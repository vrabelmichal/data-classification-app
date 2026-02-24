import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type Row = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  isActive: boolean;
  isConfirmed: boolean | null;
  joinedAt: number;
  lastActiveAt: number | null;
  classificationsCount: number;
  awesomeCount: number;
  visibleNucleusCount: number;
  validRedshiftCount: number;
  failedFittingCount: number;
  assignedGalaxies: number;
  classifiedInSequence: number;
  skippedInSequence: number;
  completedInSequence: number;
  remainingInSequence: number;
  completionPercent: number;
};

type ColumnKey =
  | "user"
  | "labels"
  | "assigned"
  | "completed"
  | "completion"
  | "lastActive"
  | "active"
  | "role"
  | "joined"
  | "awesome"
  | "visibleNucleus"
  | "validRedshift"
  | "failedFitting"
  | "skipped"
  | "remaining";

const columns: Array<{ key: ColumnKey; label: string; defaultVisible: boolean }> = [
  { key: "user", label: "User", defaultVisible: true },
  { key: "labels", label: "Labels", defaultVisible: true },
  { key: "assigned", label: "Assigned", defaultVisible: true },
  { key: "completed", label: "Completed", defaultVisible: true },
  { key: "completion", label: "Completion %", defaultVisible: true },
  { key: "lastActive", label: "Last Active", defaultVisible: true },
  { key: "active", label: "Active", defaultVisible: true },
  { key: "role", label: "Role", defaultVisible: false },
  { key: "joined", label: "Joined", defaultVisible: false },
  { key: "awesome", label: "Awesome", defaultVisible: false },
  { key: "visibleNucleus", label: "Visible Nucleus", defaultVisible: false },
  { key: "validRedshift", label: "Valid Redshift", defaultVisible: false },
  { key: "failedFitting", label: "Failed Fitting", defaultVisible: false },
  { key: "skipped", label: "Skipped", defaultVisible: false },
  { key: "remaining", label: "Remaining", defaultVisible: false },
];

const defaultVisibility: Record<ColumnKey, boolean> = columns.reduce((acc, col) => {
  acc[col.key] = col.defaultVisible;
  return acc;
}, {} as Record<ColumnKey, boolean>);

function formatDate(value: number | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function UsersStatisticsTab() {
  const rows = useQuery(api.users.getUsersStatisticsOverview) as Row[] | undefined;
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibility);

  const summary = useMemo(() => {
    if (!rows || rows.length === 0) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        usersWithAssignments: 0,
        totalLabels: 0,
        avgCompletion: 0,
      };
    }

    const totalUsers = rows.length;
    const activeUsers = rows.filter((row) => row.isActive).length;
    const usersWithAssignments = rows.filter((row) => row.assignedGalaxies > 0).length;
    const totalLabels = rows.reduce((sum, row) => sum + row.classificationsCount, 0);
    const avgCompletion =
      usersWithAssignments > 0
        ? rows
            .filter((row) => row.assignedGalaxies > 0)
            .reduce((sum, row) => sum + row.completionPercent, 0) / usersWithAssignments
        : 0;

    return {
      totalUsers,
      activeUsers,
      usersWithAssignments,
      totalLabels,
      avgCompletion,
    };
  }, [rows]);

  if (rows === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="h-10 w-10 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Users</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Active</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.activeUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">With Assignments</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.usersWithAssignments.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Labels</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalLabels.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Completion</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.avgCompletion.toFixed(1)}%</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Per-user statistics</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toggle columns to focus on key metrics without losing access to detailed counters.
            </p>
          </div>
          <details className="group">
            <summary className="cursor-pointer select-none text-sm font-medium text-blue-600 dark:text-blue-400">
              Choose visible columns
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
              {columns.map((column) => (
                <label key={column.key} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={(event) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [column.key]: event.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {column.label}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setVisibleColumns(defaultVisibility)}
                className="text-left text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset to defaults
              </button>
            </div>
          </details>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-300">
                {visibleColumns.user && <th className="py-2 pr-4 font-semibold">User</th>}
                {visibleColumns.labels && <th className="py-2 pr-4 font-semibold">Labels</th>}
                {visibleColumns.assigned && <th className="py-2 pr-4 font-semibold">Assigned</th>}
                {visibleColumns.completed && <th className="py-2 pr-4 font-semibold">Completed</th>}
                {visibleColumns.completion && <th className="py-2 pr-4 font-semibold">Completion %</th>}
                {visibleColumns.lastActive && <th className="py-2 pr-4 font-semibold">Last Active</th>}
                {visibleColumns.active && <th className="py-2 pr-4 font-semibold">Active</th>}
                {visibleColumns.role && <th className="py-2 pr-4 font-semibold">Role</th>}
                {visibleColumns.joined && <th className="py-2 pr-4 font-semibold">Joined</th>}
                {visibleColumns.awesome && <th className="py-2 pr-4 font-semibold">Awesome</th>}
                {visibleColumns.visibleNucleus && <th className="py-2 pr-4 font-semibold">Visible Nucleus</th>}
                {visibleColumns.validRedshift && <th className="py-2 pr-4 font-semibold">Valid Redshift</th>}
                {visibleColumns.failedFitting && <th className="py-2 pr-4 font-semibold">Failed Fitting</th>}
                {visibleColumns.skipped && <th className="py-2 pr-4 font-semibold">Skipped</th>}
                {visibleColumns.remaining && <th className="py-2 pr-4 font-semibold">Remaining</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const displayName = row.name || row.email || row.userId;
                return (
                  <tr
                    key={row.userId}
                    className="border-b border-gray-100 dark:border-gray-700/60 text-gray-700 dark:text-gray-200"
                  >
                    {visibleColumns.user && (
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900 dark:text-white">{displayName}</div>
                        {row.email && <div className="text-xs text-gray-500 dark:text-gray-400">{row.email}</div>}
                      </td>
                    )}
                    {visibleColumns.labels && <td className="py-3 pr-4">{row.classificationsCount.toLocaleString()}</td>}
                    {visibleColumns.assigned && <td className="py-3 pr-4">{row.assignedGalaxies.toLocaleString()}</td>}
                    {visibleColumns.completed && <td className="py-3 pr-4">{row.completedInSequence.toLocaleString()}</td>}
                    {visibleColumns.completion && <td className="py-3 pr-4">{row.completionPercent.toFixed(1)}%</td>}
                    {visibleColumns.lastActive && <td className="py-3 pr-4">{formatDate(row.lastActiveAt)}</td>}
                    {visibleColumns.active && <td className="py-3 pr-4">{row.isActive ? "Yes" : "No"}</td>}
                    {visibleColumns.role && <td className="py-3 pr-4">{row.role}</td>}
                    {visibleColumns.joined && <td className="py-3 pr-4">{formatDate(row.joinedAt)}</td>}
                    {visibleColumns.awesome && <td className="py-3 pr-4">{row.awesomeCount.toLocaleString()}</td>}
                    {visibleColumns.visibleNucleus && (
                      <td className="py-3 pr-4">{row.visibleNucleusCount.toLocaleString()}</td>
                    )}
                    {visibleColumns.validRedshift && (
                      <td className="py-3 pr-4">{row.validRedshiftCount.toLocaleString()}</td>
                    )}
                    {visibleColumns.failedFitting && (
                      <td className="py-3 pr-4">{row.failedFittingCount.toLocaleString()}</td>
                    )}
                    {visibleColumns.skipped && <td className="py-3 pr-4">{row.skippedInSequence.toLocaleString()}</td>}
                    {visibleColumns.remaining && <td className="py-3 pr-4">{row.remainingInSequence.toLocaleString()}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
