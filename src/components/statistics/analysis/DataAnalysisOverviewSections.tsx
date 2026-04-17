import { AnalysisHistogram } from "./AnalysisHistogram";
import type { HistogramDatum } from "./helpers";
import type {
  DataLoadState,
  DatasetSummary,
  PreparedDataset,
  ZeroBucketState,
} from "./tabTypes";
import { formatPercent } from "./tabUtils";

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

export function AnalysisLoadSection({
  summary,
  hasDataset,
  hasStoredDataset,
  storedDatasetRecordCount,
  storedDatasetSavedAtLabel,
  storageNotice,
  loadedRecordsCount,
  loadedAtLabel,
  loadState,
  onLoadDataset,
  onLoadStoredDataset,
  onCancelLoad,
  onSaveDatasetToStorage,
  onClearStoredDataset,
  onExportReport,
  onExportJson,
  canExportReport,
}: {
  summary: DatasetSummary;
  hasDataset: boolean;
  hasStoredDataset: boolean;
  storedDatasetRecordCount: number;
  storedDatasetSavedAtLabel: string | null;
  storageNotice: { tone: "success" | "error"; message: string } | null;
  loadedRecordsCount: number;
  loadedAtLabel: string | null;
  loadState: DataLoadState;
  onLoadDataset: () => void;
  onLoadStoredDataset: () => void;
  onCancelLoad: () => void;
  onSaveDatasetToStorage: () => void;
  onClearStoredDataset: () => void;
  onExportReport: () => void;
  onExportJson: () => void;
  canExportReport: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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

        <div className="w-full max-w-sm shrink-0 divide-y divide-blue-200/60 overflow-hidden rounded-xl border border-blue-200 bg-blue-50 dark:divide-blue-900/40 dark:border-blue-900/60 dark:bg-blue-950/20">

          {/* ── Status ─────────────────────────────────── */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Analysis run
              </span>
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
            <p className="mt-2 text-sm text-blue-800/80 dark:text-blue-200/80">
              {hasDataset
                ? `Loaded ${loadedRecordsCount.toLocaleString()} galaxies${loadedAtLabel ? ` at ${loadedAtLabel}` : ""}. Query edits stay fully local.`
                : "Fetch the dataset to enable histograms and query cards."}
            </p>
          </div>

          {/* ── Load dataset ────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Load dataset
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLoadDataset}
                disabled={loadState.status === "loading"}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
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
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <CacheLoadIcon />
                  <span>Load from cache</span>
                </button>
              ) : null}
              {loadState.status === "loading" ? (
                <button
                  type="button"
                  onClick={onCancelLoad}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <CancelLoadIcon />
                  <span>Cancel</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Browser cache ───────────────────────────── */}
          <div className="px-5 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Browser cache
            </p>
            {hasStoredDataset ? (
              <p className="mb-3 text-xs text-blue-700 dark:text-blue-300">
                {`${storedDatasetRecordCount.toLocaleString()} galaxies saved${storedDatasetSavedAtLabel ? ` · ${storedDatasetSavedAtLabel}` : ""}`}
              </p>
            ) : (
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">No saved cache.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSaveDatasetToStorage}
                disabled={!hasDataset || loadState.status === "loading"}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
              >
                <SaveCacheIcon />
                <span>Save to cache</span>
              </button>
              {hasStoredDataset ? (
                <button
                  type="button"
                  onClick={onClearStoredDataset}
                  disabled={loadState.status === "loading"}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-900/60 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
                >
                  <ClearCacheIcon />
                  <span>Clear cache</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Export ──────────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Export
            </p>
            <div className="flex flex-wrap gap-2">
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
                className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
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
                className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
              >
                <JsonExportIcon />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* ── Notices ─────────────────────────────────── */}
          {storageNotice !== null ||
          loadState.error !== null ||
          (loadState.cancelled && loadState.status === "idle") ? (
            <div className="space-y-1.5 px-5 py-3">
              {loadState.cancelled && loadState.status === "idle" ? (
                <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <NoticeWarningIcon />
                  Loading was cancelled before the local dataset finished building.
                </p>
              ) : null}
              {storageNotice ? (
                <p
                  className={`flex items-start gap-2 text-sm ${
                    storageNotice.tone === "error"
                      ? "text-red-700 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {storageNotice.tone === "error" ? <NoticeErrorIcon /> : <NoticeSuccessIcon />}
                  {storageNotice.message}
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
        </div>
      </div>

      {loadState.status === "loading" ? (
        <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
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
      ) : null}
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