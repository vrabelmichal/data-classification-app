import { Link } from "react-router";

import { getImageUrl } from "../../../images";
import { getPreviewImageName } from "../../../images/displaySettings";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "../../classification/GalaxyImages";
import { ImageViewer } from "../../classification/ImageViewer";
import type { UserPreferences } from "../../classification/types";
import { AnalysisHistogram } from "./AnalysisHistogram";
import {
  analysisConditionMetricOptions,
  analysisHistogramMetricOptions,
  analysisOperatorOptions,
  analysisSortMetricOptions,
  catalogNucleusOptions,
  clampPreviewLimit,
  createAnalysisCondition,
  dominantLsbOptions,
  duplicateAnalysisQuery,
  formatPaperLabel,
  getMetricLabel,
  getMetricShortLabel,
  getVotePreview,
  type AnalysisQueryConfig,
  type AnalysisQueryCondition,
  type AnalysisQueryResult,
  type AnalysisRecord,
} from "./helpers";
import type { DatasetSummary } from "./tabTypes";
import { formatPercent } from "./tabUtils";

function QueryConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: AnalysisQueryCondition;
  onChange: (nextCondition: AnalysisQueryCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_112px_44px]">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Metric
        </span>
        <select
          value={condition.metric}
          onChange={(event) =>
            onChange({
              ...condition,
              metric: event.target.value as AnalysisQueryCondition["metric"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisConditionMetricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Operator
        </span>
        <select
          value={condition.operator}
          onChange={(event) =>
            onChange({
              ...condition,
              operator: event.target.value as AnalysisQueryCondition["operator"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisOperatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Count
        </span>
        <input
          type="number"
          min={0}
          step={1}
          value={condition.count}
          onChange={(event) =>
            onChange({
              ...condition,
              count: Math.max(0, Math.floor(Number(event.target.value) || 0)),
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          aria-label="Remove condition"
          title="Remove condition"
        >
          x
        </button>
      </div>
    </div>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
      <path d="M6.5 6 7.25 19A2 2 0 0 0 9.24 21h5.52a2 2 0 0 0 1.99-2L17.5 6" />
      <path d="M10 10.5v6" />
      <path d="M14 10.5v6" />
    </svg>
  );
}

function VotePreviewRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value, index) => (
            <span
              key={`${label}-${index}-${value}`}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {index + 1}. {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">No votes loaded.</span>
        )}
      </div>
    </div>
  );
}

function formatAgreementSummary(
  summary: Pick<AnalysisRecord["lsb"], "agreementCount" | "agreementRate" | "comparableVotes" | "label">
) {
  if (summary.agreementRate === null || summary.comparableVotes <= 0) {
    return summary.label;
  }

  return `${summary.agreementCount}/${summary.comparableVotes} (${formatPercent(summary.agreementRate)})`;
}

function formatAnsweredVoteSummary(yesVotes: number, comparableVotes: number) {
  if (comparableVotes <= 0) {
    return "-";
  }

  return `${yesVotes}/${comparableVotes}`;
}

function formatDominantLsbBreakdown(
  breakdown: AnalysisQueryResult["dominantLsbBreakdown"]
) {
  return `LSB ${breakdown.lsb.toLocaleString()} • Non-LSB ${breakdown.nonLsb.toLocaleString()} • Split ${breakdown.split.toLocaleString()} • No Is-LSB ${breakdown.noComparableVotes.toLocaleString()}`;
}

function AnalysisGalaxyCard({
  record,
  imageQuality,
  userPreferences,
  onOpenDetails,
}: {
  record: AnalysisRecord;
  imageQuality: "high" | "medium" | "low";
  userPreferences: UserPreferences | null | undefined;
  onOpenDetails: (record: AnalysisRecord) => void;
}) {
  const { galaxy, aggregate } = record;
  const previewImageName = getPreviewImageName();
  const lsbVotePreview = getVotePreview(record.votes, "lsb");
  const morphologyVotePreview = getVotePreview(record.votes, "morphology");

  return (
    <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:grid-cols-[180px_minmax(0,1fr)]">
      <div className="rounded-lg border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="overflow-hidden rounded-lg">
          <ImageViewer
            imageUrl={getImageUrl(galaxy.id, previewImageName, {
              quality: imageQuality,
            })}
            alt={`Preview of galaxy ${galaxy.id}`}
            preferences={userPreferences}
            defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Click the preview to open the zoom viewer.
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/classify/${galaxy.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                {galaxy.id}
              </Link>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                #{galaxy.numericId?.toLocaleString() ?? "-"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Paper: {formatPaperLabel(galaxy.paper)}
              <span className="mx-2">•</span>
              Catalog nucleus: {galaxy.nucleus ? "Yes" : "No"}
            </p>
          </div>

          <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {record.lsb.agreementRate === null
              ? "No Is-LSB votes"
              : `${record.lsb.label} • ${record.lsb.agreementCount}/${record.lsb.comparableVotes}`}
          </div>
        </div>

        <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dominant Is-LSB
            </div>
            <div className="mt-1 font-medium">{record.dominantLsbLabel}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dominant morphology
            </div>
            <div className="mt-1 font-medium">{record.dominantMorphologyLabel}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Classifications
            </div>
            <div className="mt-1 font-medium">
              {aggregate.totalClassifications.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Is-LSB agreement
            </div>
            <div className="mt-1 font-medium">
              {formatAgreementSummary(record.lsb)}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Morphology agreement
            </div>
            <div className="mt-1 font-medium">
              {formatAgreementSummary(record.morphology)}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Visible nucleus agreement
            </div>
            <div className="mt-1 font-medium">
              {formatAgreementSummary(record.visibleNucleus)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/20 lg:grid-cols-2">
          <VotePreviewRow label="First 5 LSB votes" values={lsbVotePreview} />
          <VotePreviewRow label="First 5 morphology votes" values={morphologyVotePreview} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>RA {galaxy.ra.toFixed(4)} deg</span>
          <span>Dec {galaxy.dec.toFixed(4)} deg</span>
          <span>Reff {galaxy.reff.toFixed(2)}</span>
          <span>q {galaxy.q.toFixed(3)}</span>
          <span>Mag {galaxy.mag === null ? "-" : galaxy.mag.toFixed(2)}</span>
          <span>
            mu0 {galaxy.mean_mue === null ? "-" : galaxy.mean_mue.toFixed(2)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/classify/${galaxy.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Classify in new tab
          </Link>
          <button
            type="button"
            onClick={() => onOpenDetails(record)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            View classifications
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Awesome {aggregate.awesomeVotes.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Failed fitting yes {formatAnsweredVoteSummary(
              aggregate.failedFittingVotes,
              record.failedFitting.comparableVotes
            )}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Nucleus confirmation {formatPercent(record.nucleusConfirmationRate)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DataAnalysisQueryCard({
  query,
  result,
  summary,
  isCollapsed,
  hasDataset,
  imageQuality,
  userPreferences,
  canRemove,
  onOpenDetails,
  onToggleCollapsed,
  onDuplicate,
  onRemove,
  onUpdateQuery,
}: {
  query: AnalysisQueryConfig;
  result: AnalysisQueryResult | undefined;
  summary: DatasetSummary;
  isCollapsed: boolean;
  hasDataset: boolean;
  imageQuality: "high" | "medium" | "low";
  userPreferences: UserPreferences | null | undefined;
  canRemove: boolean;
  onOpenDetails: (record: AnalysisRecord) => void;
  onToggleCollapsed: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdateQuery: (
    queryId: string,
    updater: (query: AnalysisQueryConfig) => AnalysisQueryConfig
  ) => void;
}) {
  return (
    <section
      id={`analysis-query-${query.id}`}
      className="scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {query.name || "Untitled query"}
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
              {isCollapsed ? "Collapsed" : "Expanded"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {query.description.trim() || "No description added yet."}
          </p>
          {hasDataset && result ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                {result.matchedCount.toLocaleString()} matches
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                Avg Is-LSB agreement {formatPercent(result.averageLsbAgreementRate)}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {result.totalMatchingClassifications.toLocaleString()} classifications
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand query card" : "Collapse query card"}
            title={isCollapsed ? "Expand query card" : "Collapse query card"}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span className="mr-2">
              <CollapseIcon collapsed={isCollapsed} />
            </span>
            {isCollapsed ? "Expand" : "Minimize"}
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="Remove query card"
            title="Remove query card"
            className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
          >
            <span className="mr-2">
              <TrashIcon />
            </span>
            Remove
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Query name
                </span>
                <input
                  type="text"
                  value={query.name}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Paper filter
                </span>
                <select
                  value={query.paper}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      paper: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="__any__">All papers</option>
                  {summary.availablePapers.map((paper) => (
                    <option key={paper || "__empty__"} value={paper}>
                      {formatPaperLabel(paper)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 lg:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Description
                </span>
                <textarea
                  value={query.description}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional note about what this card is trying to surface."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Catalog nucleus filter
                </span>
                <select
                  value={query.catalogNucleus}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      catalogNucleus: event.target.value as AnalysisQueryConfig["catalogNucleus"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {catalogNucleusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Dominant Is-LSB
                </span>
                <select
                  value={query.dominantLsb}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      dominantLsb: event.target.value as AnalysisQueryConfig["dominantLsb"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {dominantLsbOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Sort results by
                </span>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <select
                    value={query.sortBy}
                    onChange={(event) =>
                      onUpdateQuery(query.id, (currentQuery) => ({
                        ...currentQuery,
                        sortBy: event.target.value as AnalysisQueryConfig["sortBy"],
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {analysisSortMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={query.sortDirection}
                    onChange={(event) =>
                      onUpdateQuery(query.id, (currentQuery) => ({
                        ...currentQuery,
                        sortDirection: event.target.value as AnalysisQueryConfig["sortDirection"],
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="desc">Highest first</option>
                    <option value="asc">Lowest first</option>
                  </select>
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Histogram metric
                </span>
                <select
                  value={query.histogramMetric}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      histogramMetric: event.target.value as AnalysisQueryConfig["histogramMetric"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {analysisHistogramMetricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Preview rows
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={query.previewLimit}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      previewLimit: clampPreviewLimit(Number(event.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Thresholds
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Each condition is an AND filter applied to the local per-galaxy aggregates.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateQuery(query.id, (currentQuery) => ({
                    ...currentQuery,
                    conditions: [...currentQuery.conditions, createAnalysisCondition()],
                  }))
                }
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Add condition
              </button>
            </div>

            <div className="space-y-3">
              {query.conditions.map((condition) => (
                <QueryConditionEditor
                  key={condition.id}
                  condition={condition}
                  onChange={(nextCondition) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      conditions: currentQuery.conditions.map((candidate) =>
                        candidate.id === nextCondition.id ? nextCondition : candidate
                      ),
                    }))
                  }
                  onRemove={() =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
                      conditions:
                        currentQuery.conditions.length > 1
                          ? currentQuery.conditions.filter(
                              (candidate) => candidate.id !== condition.id
                            )
                          : currentQuery.conditions,
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Result summary
              </div>
              {hasDataset && result ? (
                <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                  <div>
                    <div className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {result.matchedCount.toLocaleString()}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Matching galaxies in the loaded dataset.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Total classifications in matches
                    </div>
                    <div className="mt-1 font-medium">
                      {result.totalMatchingClassifications.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Avg Is-LSB agreement
                    </div>
                    <div className="mt-1 font-medium">
                      {formatPercent(result.averageLsbAgreementRate)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Avg morphology agreement
                    </div>
                    <div className="mt-1 font-medium">
                      {formatPercent(result.averageMorphologyAgreementRate)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Avg visible-nucleus agreement
                    </div>
                    <div className="mt-1 font-medium">
                      {formatPercent(result.averageVisibleNucleusAgreementRate)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Dominant Is-LSB breakdown
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDominantLsbBreakdown(result.dominantLsbBreakdown)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Sort metric
                    </div>
                    <div className="mt-1 font-medium">{getMetricLabel(query.sortBy)}</div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Histogram metric
                    </div>
                    <div className="mt-1 font-medium">
                      {getMetricLabel(query.histogramMetric)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Load the dataset first to evaluate this query locally.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {query.name || "Untitled query"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {query.description.trim() || "No description added yet."}
                </p>
              </div>
              <AnalysisHistogram data={result?.histogram ?? []} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top matches
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing up to {clampPreviewLimit(query.previewLimit)} galaxies ranked by {getMetricShortLabel(query.sortBy).toLowerCase()}.
                </p>
              </div>
            </div>

            {!hasDataset ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                Load the dataset to preview galaxies here.
              </div>
            ) : result && result.previewRecords.length > 0 ? (
              <div className="space-y-4">
                {result.previewRecords.map((record) => (
                  <AnalysisGalaxyCard
                    key={`${query.id}-${record.galaxy._id}`}
                    record={record}
                    imageQuality={imageQuality}
                    userPreferences={userPreferences}
                    onOpenDetails={onOpenDetails}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                No galaxies matched this query. Try relaxing one or more vote thresholds.
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

export { duplicateAnalysisQuery };