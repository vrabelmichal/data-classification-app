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
      className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {hideZeroBucket ? "Show 0 bucket" : "Hide 0 bucket"}
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
}: {
  summary: DatasetSummary;
  hasDataset: boolean;
  loadedRecordsCount: number;
  loadedAtLabel: string | null;
  loadState: DataLoadState;
  onLoadDataset: () => void;
  onCancelLoad: () => void;
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
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <StatCard
        label="Classified galaxies"
        value={dataset.classifiedGalaxyCount.toLocaleString()}
        detail={`${formatPercent(dataset.classifiedGalaxyCount / Math.max(totalGalaxies, 1))} of the full catalog currently has at least one classification.`}
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
    <span
      className="inline-flex h-4 w-4 items-center justify-center text-base font-semibold"
      aria-hidden="true"
    >
      +
    </span>
  );
}

function CollapseAllIcon() {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center text-base font-semibold"
      aria-hidden="true"
    >
      −
    </span>
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
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Interactive query cards
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Stack several local questions on one page. Each card filters the same
          loaded dataset with its own thresholds, histogram, and top-galaxy list.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddQuery}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Add query
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