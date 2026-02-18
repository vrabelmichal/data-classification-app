import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

type ReportStatus = "open" | "in_progress" | "resolved" | "closed";

export function IssueReportsTab() {
  const reports = useQuery(api.issueReports.getAllReports, {});
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});

  const updateStatus = useMutation(api.issueReports.updateReportStatus);
  const deleteReport = useMutation(api.issueReports.deleteReport);

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
        const newState = { ...prev };
        delete newState[reportId];
        return newState;
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

  if (reports === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredReports =
    filterStatus === "all"
      ? reports
      : reports.filter((r: any) => r.status === filterStatus);

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Issue Reports
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Total: {reports.length} | Showing: {filteredReports.length}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "in_progress", "resolved", "closed"].map(
            (status) => (
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
            )
          )}
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
          {filteredReports.map((report: any) => (
            <div
              key={report._id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {report.userName} ({report.userEmail})
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          statusConfig[report.status as ReportStatus].bgColor
                        } ${statusConfig[report.status as ReportStatus].color}`}
                      >
                        {statusConfig[report.status as ReportStatus]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(report.createdAt).toLocaleString()}
                      {report.resolvedAt && (
                        <>
                          {" • Resolved: "}
                          {new Date(report.resolvedAt).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === report._id ? null : report._id)
                    }
                    className="ml-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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

                    {report.adminNotes && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Admin Notes
                        </h4>
                        <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-sm">
                          {report.adminNotes}
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Update Status & Notes
                      </h4>
                      <div className="space-y-2">
                        <select
                          value={report.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as ReportStatus;
                            handleStatusChange(
                              report._id,
                              newStatus,
                              editingNotes[report._id] || report.adminNotes || ""
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                        >
                          {Object.entries(statusConfig).map(([value, config]) => (
                            <option key={value} value={value}>
                              {config.label}
                            </option>
                          ))}
                        </select>

                        <textarea
                          value={editingNotes[report._id] ?? report.adminNotes ?? ""}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({
                              ...prev,
                              [report._id]: e.target.value,
                            }))
                          }
                          placeholder="Add admin notes..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm resize-none"
                          rows={3}
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleStatusChange(
                                report._id,
                                report.status,
                                editingNotes[report._id] || report.adminNotes || ""
                              )
                            }
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => handleDelete(report._id)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
