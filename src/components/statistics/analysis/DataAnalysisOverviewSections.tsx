import { type ChangeEvent, useRef } from "react";

import { AnalysisHistogram } from "./AnalysisHistogram";
import type { HistogramDatum } from "./helpers";
import type {
  DataLoadState,
  DatasetNotice,
  DatasetSummary,
  LoadedDatasetSource,
  PreparedDataset,
  ZeroBucketState,
} from "./tabTypes";
import { formatLoadedAt, formatPercent } from "./tabUtils";

function getLoadedSourceLabel(loadedSource: LoadedDatasetSource | null) {
  switch (loadedSource?.kind) {
    case "database":
      return "Live fetch";
    case "browserCache":
      return "Browser cache";
    case "file":
      return "Dataset file";
    default:
      return null;
  }
}

function getAnalysisStatusMessage({
  hasDataset,
  loadedRecordsCount,
  loadedAtLabel,
  loadedSource,
}: {
  hasDataset: boolean;
  loadedRecordsCount: number;
  loadedAtLabel: string | null;
  loadedSource: LoadedDatasetSource | null;
}) {
  if (!hasDataset) {
    return "Fetch the dataset or upload a portable ZIP snapshot to enable histograms and query cards.";
  }

  if (loadedSource?.kind === "file") {
    const exportedAtLabel = formatLoadedAt(loadedSource.exportedAt);

    return `Loaded ${loadedRecordsCount.toLocaleString()} galaxies from ${loadedSource.fileName}.${exportedAtLabel ? ` File exported ${exportedAtLabel}.` : ""}${loadedAtLabel ? ` Snapshot captured ${loadedAtLabel}.` : ""} Query edits stay fully local.`;
  }

  if (loadedSource?.kind === "browserCache") {
    const cacheSavedAtLabel = formatLoadedAt(loadedSource.savedAt);

    return `Loaded ${loadedRecordsCount.toLocaleString()} galaxies from browser cache.${cacheSavedAtLabel ? ` Cache saved ${cacheSavedAtLabel}.` : ""}${loadedAtLabel ? ` Snapshot captured ${loadedAtLabel}.` : ""} Query edits stay fully local.`;
  }

  return `Loaded ${loadedRecordsCount.toLocaleString()} galaxies${loadedAtLabel ? ` at ${loadedAtLabel}` : ""} from the live dataset. Query edits stay fully local.`;
}

function getPortableDatasetMessage({
  hasDataset,
  loadedSource,
}: {
  hasDataset: boolean;
  loadedSource: LoadedDatasetSource | null;
}) {
  if (loadedSource?.kind === "file") {
    const exportedAtLabel = formatLoadedAt(loadedSource.exportedAt);

    return `${loadedSource.fileName}${exportedAtLabel ? ` · exported ${exportedAtLabel}` : ""}`;
  }

  if (hasDataset) {
    return "Download the exact local snapshot currently in memory as one ZIP file, then upload it elsewhere to continue the analysis without re-fetching every page.";
  }

  return "Upload a ZIP exported from this page to work on a prepared dataset without querying the live tables first.";
}

function getAnalysisSetupStatusClass(
  tone: "neutral" | "success" | "warning"
) {
  switch (tone) {
    case "success":
      return "text-emerald-700 dark:text-emerald-300";
    case "warning":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{value}</div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function ProgressRail({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(100, (current / safeTotal) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        <span>
          {current.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ZeroBucketToggle({
  hideZeroBucket,
  onToggle,
}: {
  hideZeroBucket: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={hideZeroBucket ? "Show 0 bucket" : "Hide 0 bucket"}
      aria-label={hideZeroBucket ? "Show 0 bucket" : "Hide 0 bucket"}
      className="inline-flex whitespace-nowrap rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <span className="inline-flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {hideZeroBucket ? (
            <>
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          ) : (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-4 4.8" />
              <path d="M6.7 6.7C4 8.5 2 12 2 12s3.5 6 10 6a9.7 9.7 0 0 0 3-.5" />
            </>
          )}
        </svg>
        <span>0 bucket</span>
      </span>
    </button>
  );
}

function HistogramCard({
  title,
  description,
  data,
  zeroBucketHidden,
  onToggleZeroBucket,
}: {
  title: string;
  description: string;
  data: HistogramDatum[];
  zeroBucketHidden?: boolean;
  onToggleZeroBucket?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {onToggleZeroBucket && zeroBucketHidden !== undefined ? (
          <ZeroBucketToggle
            hideZeroBucket={zeroBucketHidden}
            onToggle={onToggleZeroBucket}
          />
        ) : null}
      </div>

      <AnalysisHistogram data={data} />
    </div>
  );
}

const TOOLBAR_BUTTON_CLASS =
  "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition xl:flex-nowrap";

export function AnalysisLoadSection({
  summary,
  hasDataset,
  hasStoredDataset,
  storedDatasetRecordCount,
  storedDatasetSavedAtLabel,
  datasetNotice,
  loadedRecordsCount,
  loadedAtLabel,
  loadedSource,
  loadState,
  onLoadDataset,
  onLoadStoredDataset,
  onCancelLoad,
  onSaveDatasetToStorage,
  onDownloadDatasetArchive,
  onImportDatasetFile,
  onClearStoredDataset,
  onExportReport,
  onExportJson,
  canDownloadDatasetArchive,
  canImportDatasetArchive,
  canExportReport,
  analysisSetupName,
  hasSavedAnalysisSetup,
  analysisSetupStatusMessage,
  analysisSetupStatusTone,
  isAnalysisSetupLoading,
  isAnalysisSetupSaving,
  onSaveAnalysisSetup,
  onLoadAnalysisSetup,
  onRestoreDefaultAnalysisSetup,
}: {
  summary: DatasetSummary;
  hasDataset: boolean;
  hasStoredDataset: boolean;
  storedDatasetRecordCount: number;
  storedDatasetSavedAtLabel: string | null;
  datasetNotice: DatasetNotice;
  loadedRecordsCount: number;
  loadedAtLabel: string | null;
  loadedSource: LoadedDatasetSource | null;
  loadState: DataLoadState;
  onLoadDataset: () => void;
  onLoadStoredDataset: () => void;
  onCancelLoad: () => void;
  onSaveDatasetToStorage: () => void;
  onDownloadDatasetArchive: () => void;
  onImportDatasetFile: (file: File) => void;
  onClearStoredDataset: () => void;
  onExportReport: () => void;
  onExportJson: () => void;
  canDownloadDatasetArchive: boolean;
  canImportDatasetArchive: boolean;
  canExportReport: boolean;
  analysisSetupName: string;
  hasSavedAnalysisSetup: boolean;
  analysisSetupStatusMessage: string;
  analysisSetupStatusTone: "neutral" | "success" | "warning";
  isAnalysisSetupLoading: boolean;
  isAnalysisSetupSaving: boolean;
  onSaveAnalysisSetup: () => void;
  onLoadAnalysisSetup: () => void;
  onRestoreDefaultAnalysisSetup: () => void;
}) {
  const datasetFileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedSourceLabel = getLoadedSourceLabel(loadedSource);
  const statusMessage = getAnalysisStatusMessage({
    hasDataset,
    loadedRecordsCount,
    loadedAtLabel,
    loadedSource,
  });
  const portableDatasetMessage = getPortableDatasetMessage({
    hasDataset,
    loadedSource,
  });
  const analysisSetupStatusClass = getAnalysisSetupStatusClass(
    analysisSetupStatusTone
  );

  const handleDatasetFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!nextFile) {
      return;
    }

    onImportDatasetFile(nextFile);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-sky-50 shadow-sm dark:border-blue-900/60 dark:from-blue-950/30 dark:via-gray-900 dark:to-slate-950">
        <div className="border-b border-blue-200/70 px-5 py-4 dark:border-blue-900/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">
                  Analysis run
                </span>
                {loadedSourceLabel ? (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    {loadedSourceLabel}
                  </span>
                ) : null}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    loadState.status === "loading"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : hasDataset
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-400"
                  }`}
                >
                  {loadState.status === "loading"
                    ? "Loading"
                    : hasDataset
                      ? "Ready"
                      : "Not loaded"}
                </span>
              </div>
              <p className="text-sm leading-6 text-blue-900/85 dark:text-blue-100/85">
                {statusMessage}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={datasetFileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={handleDatasetFileChange}
          disabled={!canImportDatasetArchive}
          className="hidden"
        />

        <div className="grid gap-px bg-blue-200/60 md:grid-cols-2 xl:grid-cols-4 dark:bg-blue-900/40">
          <div className="flex min-h-full flex-col gap-4 bg-white/90 px-5 py-4 dark:bg-gray-900/85">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Load dataset
            </p>
            <div className="flex min-h-[2.25rem] flex-wrap items-start gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={onLoadDataset}
                disabled={loadState.status === "loading"}
                className={`${TOOLBAR_BUTTON_CLASS} bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800`}
              >
                {loadState.status === "loading" ? <LoadSpinnerIcon /> : <RefreshDataIcon />}
                <span>
                  {loadState.status === "loading"
                    ? "Loading…"
                    : hasDataset
                      ? "Reload"
                      : "Load dataset"}
                </span>
              </button>
              {hasStoredDataset && loadState.status !== "loading" ? (
                <button
                  type="button"
                  onClick={onLoadStoredDataset}
                  className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700`}
                >
                  <CacheLoadIcon />
                  <span>Load from cache</span>
                </button>
              ) : null}
              {loadState.status === "loading" ? (
                <button
                  type="button"
                  onClick={onCancelLoad}
                  className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700`}
                >
                  <CancelLoadIcon />
                  <span>Cancel</span>
                </button>
              ) : null}
            </div>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              Pull the latest galaxy and classification pages into this browser session.
            </p>
          </div>

          <div className="flex min-h-full flex-col gap-4 bg-white/90 px-5 py-4 dark:bg-gray-900/85">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Browser cache
            </p>
            <div className="flex min-h-[2.25rem] flex-wrap items-start gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={onSaveDatasetToStorage}
                disabled={!hasDataset || loadState.status === "loading"}
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <SaveCacheIcon />
                <span>Save to cache</span>
              </button>
              {hasStoredDataset ? (
                <button
                  type="button"
                  onClick={onClearStoredDataset}
                  disabled={loadState.status === "loading"}
                  className={`${TOOLBAR_BUTTON_CLASS} border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-900/60 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
                >
                  <ClearCacheIcon />
                  <span>Clear cache</span>
                </button>
              ) : null}
            </div>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              {hasStoredDataset
                ? `${storedDatasetRecordCount.toLocaleString()} galaxies saved${storedDatasetSavedAtLabel ? ` · ${storedDatasetSavedAtLabel}` : ""}`
                : "No saved cache."}
            </p>
          </div>

          <div className="flex min-h-full flex-col gap-4 bg-white/90 px-5 py-4 dark:bg-gray-900/85">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Portable dataset file
              </p>
            </div>
            <div className="flex min-h-[2.25rem] flex-wrap items-start gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={onDownloadDatasetArchive}
                disabled={!canDownloadDatasetArchive}
                title={
                  canDownloadDatasetArchive
                    ? "Download the current local dataset as a portable ZIP file"
                    : "Load or import a dataset before downloading a ZIP snapshot"
                }
                aria-label="Download portable dataset ZIP"
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <DownloadArchiveIcon />
                <span>Download ZIP</span>
              </button>
              <button
                type="button"
                onClick={() => datasetFileInputRef.current?.click()}
                disabled={!canImportDatasetArchive}
                title="Upload a portable dataset ZIP exported from another browser session"
                aria-label="Upload portable dataset ZIP"
                className={`${TOOLBAR_BUTTON_CLASS} bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:disabled:bg-indigo-900/60`}
              >
                <UploadArchiveIcon />
                <span>Upload ZIP</span>
              </button>
            </div>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              {portableDatasetMessage}
            </p>
          </div>

          <div className="flex min-h-full flex-col gap-4 bg-white/90 px-5 py-4 dark:bg-gray-900/85">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Export
            </p>
            <div className="flex min-h-[2.25rem] flex-wrap items-start gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={onExportReport}
                disabled={!canExportReport}
                title={
                  canExportReport
                    ? "Download a standalone HTML report of the current analysis"
                    : "Load the dataset before exporting the analysis report"
                }
                aria-label="Export HTML report"
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <HtmlExportIcon />
                <span>Export HTML</span>
              </button>
              <button
                type="button"
                onClick={onExportJson}
                disabled={!canExportReport}
                title={
                  canExportReport
                    ? "Download a JSON file with the current analysis statistics"
                    : "Load the dataset before exporting analysis statistics"
                }
                aria-label="Export JSON stats"
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <JsonExportIcon />
                <span>Export JSON</span>
              </button>
            </div>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              Download a standalone report or raw statistics from the current local snapshot.
            </p>
          </div>
        </div>

        <div className="border-t border-blue-200/70 px-5 py-4 dark:border-blue-900/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Saved analysis setup
                </span>
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  {analysisSetupName}
                </span>
                {hasSavedAnalysisSetup ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Server copy available
                  </span>
                ) : null}
              </div>
              <p className={`text-sm leading-6 ${analysisSetupStatusClass}`}>
                {analysisSetupStatusMessage}
              </p>
            </div>

            <div className="flex shrink-0 flex-nowrap items-start gap-2 lg:justify-end">
              <button
                type="button"
                onClick={onSaveAnalysisSetup}
                disabled={isAnalysisSetupSaving}
                className={`${TOOLBAR_BUTTON_CLASS} bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-500 dark:disabled:text-slate-200`}
              >
                <SaveCacheIcon />
                <span>{isAnalysisSetupSaving ? "Saving…" : "Save current"}</span>
              </button>
              <button
                type="button"
                onClick={onLoadAnalysisSetup}
                disabled={isAnalysisSetupLoading || !hasSavedAnalysisSetup || isAnalysisSetupSaving}
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <CacheLoadIcon />
                <span>{isAnalysisSetupLoading ? "Checking…" : "Load saved"}</span>
              </button>
              <button
                type="button"
                onClick={onRestoreDefaultAnalysisSetup}
                disabled={isAnalysisSetupSaving}
                className={`${TOOLBAR_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500`}
              >
                <RefreshDataIcon />
                <span>Restore defaults</span>
              </button>
            </div>
          </div>
        </div>

        {datasetNotice !== null ||
        loadState.error !== null ||
        (loadState.cancelled && loadState.status === "idle") ? (
          <div className="space-y-1.5 border-t border-blue-200/70 px-5 py-3 dark:border-blue-900/50">
            {loadState.cancelled && loadState.status === "idle" ? (
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <NoticeWarningIcon />
                Loading was cancelled before the local dataset finished building.
              </p>
            ) : null}
            {datasetNotice ? (
              <p
                className={`flex items-start gap-2 text-sm ${
                  datasetNotice.tone === "error"
                    ? "text-red-700 dark:text-red-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {datasetNotice.tone === "error" ? <NoticeErrorIcon /> : <NoticeSuccessIcon />}
                {datasetNotice.message}
              </p>
            ) : null}
            {loadState.error ? (
              <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                <NoticeErrorIcon />
                {loadState.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {loadState.status === "loading" ? (
          <div className="border-t border-blue-200/70 px-5 py-4 dark:border-blue-900/50">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Loading in pages
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Phase: {loadState.phase}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <ProgressRail
                  label="Galaxy pages"
                  current={loadState.galaxiesLoaded}
                  total={summary.totalGalaxies}
                />
                <ProgressRail
                  label="Classification pages"
                  current={loadState.classificationRowsLoaded}
                  total={summary.totalClassifications}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="max-w-3xl space-y-3">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Client-side classification analysis
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This workspace pulls the raw galaxy and classification data in
              pages of up to 2,500 rows, then evaluates every histogram and
              query locally in your browser. Nothing runs automatically: click
              the button to fetch the dataset, then adjust or add as many query
              cards as you need.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Galaxy catalog"
              value={summary.totalGalaxies.toLocaleString()}
              detail="Total galaxy rows that will be paged into the local analysis dataset."
            />
            <StatCard
              label="Classification rows"
              value={summary.totalClassifications.toLocaleString()}
              detail="Raw classification rows available for vote aggregation."
            />
            <StatCard
              label="Catalog nuclei"
              value={summary.catalogNucleusGalaxies.toLocaleString()}
              detail="Galaxies marked with a nucleus in the input catalog."
            />
            <StatCard
              label="Configured papers"
              value={summary.availablePapers.length.toLocaleString()}
              detail="Paper filters available in the query builder. Empty paper stays selectable."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalysisDatasetStats({
  dataset,
  totalGalaxies,
}: {
  dataset: PreparedDataset;
  totalGalaxies: number;
}) {
  const unclassifiedGalaxies = Math.max(totalGalaxies - dataset.classifiedGalaxyCount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Classified galaxies"
        value={dataset.classifiedGalaxyCount.toLocaleString()}
        detail={`${formatPercent(dataset.classifiedGalaxyCount / Math.max(totalGalaxies, 1))} of the full catalog currently has at least one classification.`}
      />
      <StatCard
        label="Unclassified galaxies"
        value={unclassifiedGalaxies.toLocaleString()}
        detail="Rows that still have zero classifications in the loaded dataset."
      />
      <StatCard
        label="Max classifications on one item"
        value={dataset.maxClassificationsPerGalaxy.toLocaleString()}
        detail="Highest per-item classification count currently present in the local analysis dataset."
      />
      <StatCard
        label="Classifications with comments"
        value={dataset.totalCommentedClassifications.toLocaleString()}
        detail="Submitted classifications that included a non-empty written comment."
      />
      <StatCard
        label="Average comment length"
        value={dataset.averageCommentLength === null ? "-" : dataset.averageCommentLength.toFixed(1)}
        detail="Average number of characters across all non-empty classification comments."
      />
      <StatCard
        label="Maximum comment length"
        value={dataset.maxCommentLength.toLocaleString()}
        detail="Longest written classification comment found in the loaded dataset."
      />
      <StatCard
        label="Awesome votes"
        value={dataset.totalAwesomeVotes.toLocaleString()}
        detail="Total awesome flags summed locally across the loaded rows."
      />
      <StatCard
        label="Visible-nucleus votes"
        value={dataset.totalVisibleNucleusVotes.toLocaleString()}
        detail="Confirmation votes that can be compared to the catalog nucleus field."
      />
      <StatCard
        label="Failed-fitting votes"
        value={dataset.totalFailedFittingVotes.toLocaleString()}
        detail="Legacy and checkbox failed-fitting votes are normalized into one count."
      />
      <StatCard
        label="Integrity watch"
        value={dataset.orphanedGalaxyCount.toLocaleString()}
        detail={
          dataset.orphanedClassificationCount > 0
            ? `Classification-only galaxy IDs missing from the current galaxy table. (${dataset.orphanedClassificationCount.toLocaleString()} classification rows)`
            : "Classification-only galaxy IDs missing from the current galaxy table."
        }
      />
    </div>
  );
}

export function AnalysisGlobalHistogramSection({
  histograms,
  hideZeroBuckets,
  onToggleZeroBucket,
}: {
  histograms: {
    classificationCoverage: HistogramDatum[];
    lsbAgreementCount: HistogramDatum[];
    morphologyAgreementCount: HistogramDatum[];
    visibleNucleusAgreementCount: HistogramDatum[];
    awesomeVotes: HistogramDatum[];
    failedFittingVotes: HistogramDatum[];
    nucleusConfirmation: HistogramDatum[];
  };
  hideZeroBuckets: ZeroBucketState;
  onToggleZeroBucket: (key: keyof ZeroBucketState) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
      <HistogramCard
        title="Classification coverage by item"
        description="How many galaxies have exactly 1, 2, 3, and more classifications. This excludes the zero-classification rows, which are summarized above."
        data={histograms.classificationCoverage}
      />
      <HistogramCard
        title="Is-LSB agreement counts"
        description="For each classified galaxy, how many comparable Is-LSB votes landed in the dominant LSB or Non-LSB branch."
        data={histograms.lsbAgreementCount}
      />
      <HistogramCard
        title="Morphology agreement counts inside LSB-majority galaxies"
        description="After the top-level Is-LSB call lands on LSB, this shows how many morphology votes align on the dominant morphology."
        data={histograms.morphologyAgreementCount}
      />
      <HistogramCard
        title="Visible-nucleus agreement counts inside LSB-majority galaxies"
        description="Agreement counts on the visible-nucleus question inside LSB-majority galaxies. The hidden zero bucket corresponds to galaxies with no visible-nucleus responses."
        data={histograms.visibleNucleusAgreementCount}
        zeroBucketHidden={hideZeroBuckets.visibleNucleusAgreementCount}
        onToggleZeroBucket={() => onToggleZeroBucket("visibleNucleusAgreementCount")}
      />
      <HistogramCard
        title="Awesome-vote distribution"
        description="Which part of the catalog is attracting repeated follow-up interest. Zero is hidden by default so the tail is easier to inspect."
        data={histograms.awesomeVotes}
        zeroBucketHidden={hideZeroBuckets.awesomeVotes}
        onToggleZeroBucket={() => onToggleZeroBucket("awesomeVotes")}
      />
      <HistogramCard
        title="Failed-fitting vote distribution"
        description="How often galaxies accumulate explicit failed-fitting responses. Zero is hidden by default."
        data={histograms.failedFittingVotes}
        zeroBucketHidden={hideZeroBuckets.failedFittingVotes}
        onToggleZeroBucket={() => onToggleZeroBucket("failedFittingVotes")}
      />
      <HistogramCard
        title="Catalog nucleus confirmations"
        description="Visible-nucleus confirmation rate for galaxies whose catalog row already says nucleus."
        data={histograms.nucleusConfirmation}
      />
    </div>
  );
}

function ExpandAllIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  );
}

function QuerySearchIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function RefreshDataIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function LoadSpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CacheLoadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function CancelLoadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function SaveCacheIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function DownloadArchiveIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 12v6" />
      <path d="m9.5 15.5 2.5 2.5 2.5-2.5" />
    </svg>
  );
}

function UploadArchiveIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" />
      <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
    </svg>
  );
}

function ClearCacheIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function NoticeSuccessIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function NoticeWarningIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function NoticeErrorIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function HtmlExportIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <g strokeWidth="1.2">
        <path d="M8.5 14.5l-1.5 1.5 1.5 1.5" />
        <path d="M15.5 14.5l1.5 1.5-1.5 1.5" />
        <line x1="12.5" y1="13.5" x2="11.5" y2="18.5" />
      </g>
    </svg>
  );
}

function JsonExportIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <g strokeWidth="1.2">
        <path d="M8 13.5c-0.6 0-1 0.4-1 1s0.4 0.5 0.4 0.5S7 15.4 7 16s0.4 1 1 1" />
        <path d="M16 13.5c0.6 0 1 0.4 1 1s-0.4 0.5-0.4 0.5s0.4 0.4 0.4 1s-0.4 1-1 1" />
        <circle cx="12" cy="14.2" r="0.45" fill="currentColor" stroke="none" />
        <circle cx="12" cy="16.3" r="0.45" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function AnalysisQueryToolbar({
  onAddQuery,
  onCollapseAll,
  onExpandAll,
}: {
  onAddQuery: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-shrink">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Interactive query cards
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Stack several local questions on one page. Each card filters the same
          loaded dataset with its own thresholds, histogram, and top-galaxy list.
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onAddQuery}
          title="Add query"
          aria-label="Add query"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <QuerySearchIcon />
          <span>Add</span>
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          aria-label="Collapse all query cards"
          title="Collapse all query cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <CollapseAllIcon />
        </button>
        <button
          type="button"
          onClick={onExpandAll}
          aria-label="Expand all query cards"
          title="Expand all query cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <ExpandAllIcon />
        </button>
      </div>
    </div>
  );
}

export function AnalysisDistributionToolbar({
  onAddDistribution,
  onCollapseAll,
  onExpandAll,
}: {
  onAddDistribution: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-shrink">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Threshold-split distributions
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compare the same histogram metric for galaxies that pass your thresholds versus galaxies in the same scope that fail them.
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onAddDistribution}
          title="Add distribution split card"
          aria-label="Add distribution split card"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <QuerySearchIcon />
          <span>Add</span>
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          aria-label="Collapse all distribution cards"
          title="Collapse all distribution cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <CollapseAllIcon />
        </button>
        <button
          type="button"
          onClick={onExpandAll}
          aria-label="Expand all distribution cards"
          title="Expand all distribution cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <ExpandAllIcon />
        </button>
      </div>
    </div>
  );
}

export function AnalysisClassificationDistributionToolbar({
  onAddDistribution,
  onCollapseAll,
  onExpandAll,
}: {
  onAddDistribution: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-shrink">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Classification threshold-split distributions
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compare the same histogram metric for individual classifications that pass your thresholds versus classifications in the same scope that fail them.
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onAddDistribution}
          title="Add classification distribution split card"
          aria-label="Add classification distribution split card"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <QuerySearchIcon />
          <span>Add</span>
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          aria-label="Collapse all classification distribution cards"
          title="Collapse all classification distribution cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <CollapseAllIcon />
        </button>
        <button
          type="button"
          onClick={onExpandAll}
          aria-label="Expand all classification distribution cards"
          title="Expand all classification distribution cards"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <ExpandAllIcon />
        </button>
      </div>
    </div>
  );
}