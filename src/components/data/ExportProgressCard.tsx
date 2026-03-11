import { ProgressBar } from "../statistics/overview/shared";
import type { PaginatedCsvDownloadState } from "../../hooks/usePaginatedCsvDownload";

type ExportProgressCardProps = {
  state: PaginatedCsvDownloadState;
  onCancel: () => void;
  onDismiss: () => void;
};

function getStatusTone(status: PaginatedCsvDownloadState["status"]) {
  switch (status) {
    case "success":
      return "border-green-200 bg-green-50/80 dark:border-green-800/60 dark:bg-green-950/20";
    case "error":
      return "border-red-200 bg-red-50/80 dark:border-red-800/60 dark:bg-red-950/20";
    case "cancelled":
      return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30";
    default:
      return "border-blue-200 bg-blue-50/80 dark:border-blue-800/60 dark:bg-blue-950/20";
  }
}

function getTitle(state: PaginatedCsvDownloadState) {
  switch (state.status) {
    case "success":
      return "CSV ready";
    case "error":
      return "Export failed";
    case "cancelled":
      return "Export cancelled";
    default:
      return "Collecting classifications";
  }
}

function getDescription(state: PaginatedCsvDownloadState) {
  switch (state.status) {
    case "success":
      return `${state.processedRows.toLocaleString()} classification row(s) were downloaded.`;
    case "error":
      return state.errorMessage ?? "The export stopped before the CSV could be created.";
    case "cancelled":
      return "The export was stopped before the CSV was generated.";
    default:
      return state.label
        ? `Fetching ${state.label.toLowerCase()} in batches and building the CSV in your browser.`
        : "Fetching classifications in batches and building the CSV in your browser.";
  }
}

export function ExportProgressCard({ state, onCancel, onDismiss }: ExportProgressCardProps) {
  if (state.status === "idle") {
    return null;
  }

  const isRunning = state.status === "running";
  const totalRows = state.totalRows > 0 ? state.totalRows : state.processedRows;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${getStatusTone(state.status)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getTitle(state)}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{getDescription(state)}</p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>{state.label ?? "Classification export"}</span>
          <span>
            {state.processedRows.toLocaleString()} / {totalRows.toLocaleString()} rows
          </span>
        </div>
        <ProgressBar percent={state.percent} isLoading={isRunning} ariaLabel="Classification export progress" />
        <div className="text-xs text-gray-500 dark:text-gray-400">{state.percent.toFixed(0)}%</div>
      </div>
    </div>
  );
}