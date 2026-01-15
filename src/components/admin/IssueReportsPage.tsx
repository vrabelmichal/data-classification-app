import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { usePageTitle } from "../../hooks/usePageTitle";

type ReportStatus = "open" | "in_progress" | "resolved" | "closed";

type EnrichedReport = {
  _id: Id<"issueReports">;
  userId: Id<"users">;
  description: string;
  status: ReportStatus;
  createdAt: number;
  resolvedAt?: number;
  adminNotes?: string;
  url?: string;
  userEmail?: string;
  userName?: string;
};

const statusConfig: Record<
  ReportStatus,
  { label: string; color: string; bgColor: string }
> = {
  open: {
    label: "Open",
    color: "text-red-700",
    bgColor: "bg-red-100 dark:bg-red-900/20",
  },
  in_progress: {
    label: "In Progress",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
  },
  resolved: {
    label: "Resolved",
    color: "text-green-700",
    bgColor: "bg-green-100 dark:bg-green-900/20",
  },
  closed: {
    label: "Closed",
    color: "text-gray-700",
    bgColor: "bg-gray-100 dark:bg-gray-900/20",
  },
};

export function IssueReportsPage() {
  usePageTitle("Issue Reports");

  const userProfile = useQuery(api.users.getUserProfile);
  const reports = useQuery(api.issueReports.getAllReports) as
    | EnrichedReport[]
    | undefined
    | null;

  const isAdmin = userProfile?.role === "admin";

  const [filterStatus, setFilterStatus] = useState<ReportStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, ReportStatus>>({});

  const updateStatus = useMutation(api.issueReports.updateReportStatus);
  const deleteReport = useMutation(api.issueReports.deleteReport);

  if (userProfile === undefined || reports === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-300">
            You need administrator privileges to view issue reports.
          </p>
        </div>
      </div>
    );
  }

  const filteredReports =
    filterStatus === "all"
      ? reports || []
      : (reports || []).filter((r) => r.status === filterStatus);

  const handleStatusChange = async (
    reportId: Id<"issueReports">,
    newStatus: ReportStatus,
    notes: string
  ) => {
    try {
      await updateStatus({
        reportId,
        status: newStatus,
        adminNotes: notes || undefined,
      });
      toast.success("Report updated successfully");
      setEditingNotes((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      setStatusDrafts((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    } catch (error) {
      console.error("Failed to update report:", error);
      toast.error("Failed to update report");
    }
  };

  const handleDelete = async (reportId: Id<"issueReports">) => {
    if (!window.confirm("Are you sure you want to delete this report?")) {
      return;
    }
    try {
      await deleteReport({ reportId });
      toast.success("Report deleted successfully");
    } catch (error) {
      console.error("Failed to delete report:", error);
      toast.error("Failed to delete report");
    }
  };

  const renderStatusSelector = (report: EnrichedReport) => {
    const current = statusDrafts[report._id] ?? report.status;
    return (
      <select
        value={current}
        onChange={(e) =>
          setStatusDrafts((prev) => ({
            ...prev,
            [report._id]: e.target.value as ReportStatus,
          }))
        }
        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
      >
        {(
          ["open", "in_progress", "resolved", "closed"] as ReportStatus[]
        ).map((status) => (
          <option key={status} value={status}>
            {statusConfig[status].label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Issue Reports</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Total: {(reports || []).length} | Showing: {filteredReports.length}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "in_progress", "resolved", "closed"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as ReportStatus | "all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {status === "all" ? "All" : statusConfig[status as ReportStatus]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            {filterStatus === "all"
              ? "No issue reports yet."
              : `No ${statusConfig[filterStatus as ReportStatus]?.label.toLowerCase()} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const currentStatus = statusDrafts[report._id] ?? report.status;
            const showResolvedTimestamp = Boolean(
              report.resolvedAt && currentStatus === "resolved"
            );

            return (
              <div
                key={report._id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {report.userName || "Unknown"} ({report.userEmail || "Unknown"})
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            statusConfig[currentStatus as ReportStatus].bgColor
                          } ${statusConfig[currentStatus as ReportStatus].color}`}
                        >
                          {statusConfig[currentStatus as ReportStatus]?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(report.createdAt).toLocaleString()}
                        {showResolvedTimestamp && (
                          <>
                            {" • Resolved: "}
                            {new Date(report.resolvedAt as number).toLocaleString()}
                          </>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-all">
                        <span className="font-medium">Reported URL:</span>{" "}
                        {report.url ? (
                          <a
                            href={report.url}
                            className="text-blue-600 dark:text-blue-400 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {report.url}
                          </a>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Not provided</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === report._id ? null : report._id)}
                      className="ml-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label="Toggle details"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          expandedId === report._id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </button>
                  </div>

                  {expandedId === report._id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Issue Description
                        </h4>
                        <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-sm">
                          {report.description}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Reported URL
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
                          {report.url ? (
                            <a
                              href={report.url}
                              className="text-blue-600 dark:text-blue-400 underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {report.url}
                            </a>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Not provided</span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Status
                          </h4>
                          {renderStatusSelector(report)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Admin Notes
                          </h4>
                          <textarea
                            value={editingNotes[report._id] ?? report.adminNotes ?? ""}
                            onChange={(e) =>
                              setEditingNotes((prev) => ({
                                ...prev,
                                [report._id]: e.target.value,
                              }))
                            }
                            rows={4}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                            placeholder="Add internal notes"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() =>
                            handleStatusChange(
                              report._id,
                              currentStatus,
                              editingNotes[report._id] ?? report.adminNotes ?? ""
                            )
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Save changes
                        </button>
                        <button
                          onClick={() => handleDelete(report._id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                        {showResolvedTimestamp && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Resolved at {new Date(report.resolvedAt as number).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {report.adminNotes && !editingNotes[report._id] && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Showing last saved notes. Editing above will overwrite after saving.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
