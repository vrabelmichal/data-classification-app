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
  loadedRecordsCount,
  loadedAtLabel,
  loadState,
  onLoadDataset,
  onCancelLoad,
  onExportReport,
  onExportJson,
  canExportReport,
}: {
  summary: DatasetSummary;
  hasDataset: boolean;
  loadedRecordsCount: number;
  loadedAtLabel: string | null;
  loadState: DataLoadState;
  onLoadDataset: () => void;
  onCancelLoad: () => void;
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

        <div className="w-full max-w-md rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Analysis run
          </div>
          <div className="mt-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
            {hasDataset ? "Dataset ready" : "Dataset not loaded"}
          </div>
          <p className="mt-2 text-sm text-blue-800/90 dark:text-blue-200/90">
            {hasDataset
              ? `Loaded ${loadedRecordsCount.toLocaleString()} galaxies${loadedAtLabel ? ` at ${loadedAtLabel}` : ""}. Query edits now stay fully local.`
              : "Fetching happens in paged requests so the page stays within Convex limits while still pulling large client-side analysis batches."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onLoadDataset}
              disabled={loadState.status === "loading"}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
            >
              {loadState.status === "loading"
                ? "Loading dataset..."
                : hasDataset
                  ? "Reload dataset"
                  : "Load data and run analysis"}
            </button>

            {loadState.status === "loading" ? (
              <button
                type="button"
                onClick={onCancelLoad}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-blue-300 bg-white px-4 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
            >
              <JsonExportIcon />
              <span>Export JSON</span>
            </button>
          </div>

          {loadState.cancelled && loadState.status === "idle" ? (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              Loading was cancelled before the local dataset finished building.
            </p>
          ) : null}
          {loadState.error ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">
              {loadState.error}
            </p>
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

function HtmlExportIcon() {
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
      className="h-5 w-5"
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