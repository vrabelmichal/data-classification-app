import { useRef, useState } from "react";

import { AnalysisClassificationFrequencyLinePlot } from "./AnalysisClassificationFrequencyLinePlot";
import { AnalysisClassificationFrequencyPlot } from "./AnalysisClassificationFrequencyPlot";
import { AnalysisComparisonHistogram } from "./AnalysisComparisonHistogram";
import {
  ANALYSIS_MAX_PREVIEW_LIMIT,
  analysisClassificationComparisonPlotTypeOptions,
  analysisClassificationFrequencyBinningModeOptions,
  analysisClassificationConditionMetricOptions,
  analysisClassificationHistogramMetricOptions,
  analysisDistributionScaleOptions,
  analysisOperatorOptions,
  buildComparisonHistogramData,
  catalogNucleusOptions,
  clampClassificationFrequencyBinCount,
  clampClassificationFrequencyPointsPerBin,
  clampPreviewLimit,
  createAnalysisClassificationCondition,
  dominantLsbOptions,
  duplicateAnalysisClassificationDistributionComparison,
  formatClassificationConditionThreshold,
  formatClassificationMetricValue,
  formatPaperLabel,
  getClassificationComparisonPlotTypeLabel,
  getClassificationConditionMetricLabel,
  getClassificationMetricLabel,
  getDistributionScaleLabel,
  getNormalizedComment,
  isDateTimeClassificationConditionMetric,
  parseDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
  type AnalysisClassificationPoint,
  type AnalysisClassificationComparisonCondition,
  type AnalysisClassificationDistributionComparisonConfig,
  type AnalysisClassificationDistributionComparisonResult,
  type AnalysisRecord,
} from "./helpers";
import type { DatasetSummary } from "./tabTypes";

const classificationDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatClassificationDate(timestamp: number) {
  return classificationDateFormatter.format(new Date(timestamp));
}

function formatClassificationBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "-";
  }

  return value ? "Yes" : "No";
}

function getCommentPreview(comment: string, previewLength = 36) {
  if (comment.length <= previewLength) {
    return comment;
  }

  return `${comment.slice(0, previewLength).trimEnd()}...`;
}

function DetailsIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function getDisplayName(
  userId: string,
  userDisplayNames: Record<string, string>
) {
  return userDisplayNames[userId] ?? `User ${userId.slice(-6)}`;
}

function ClassificationPreviewTable({
  title,
  description,
  points,
  userDisplayNames,
  onOpenDetails,
}: {
  title: string;
  description: string;
  points: AnalysisClassificationPoint[];
  userDisplayNames: Record<string, string>;
  onOpenDetails: (record: AnalysisRecord) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {points.length > 0 ? (
        <div className="max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-[860px] divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Galaxy</th>
                <th className="px-3 py-3">Details</th>
                <th className="px-3 py-3">Failed fitting</th>
                <th className="px-3 py-3">Visible nucleus</th>
                <th className="px-3 py-3">Awesome</th>
                <th className="px-3 py-3">Valid z</th>
                <th className="px-3 py-3">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {points.map((point) => {
                const comment = getNormalizedComment(point.vote.comments);
                const commentPreview = comment ? getCommentPreview(comment) : null;
                return (
                  <tr key={point.id} className="align-top text-gray-700 dark:text-gray-200">
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatClassificationDate(point.vote._creationTime)}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      {getDisplayName(point.vote.userId, userDisplayNames)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{point.record.galaxy.id}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(point.record)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        aria-label={`View details for ${point.record.galaxy.id}`}
                        title={`View details for ${point.record.galaxy.id}`}
                      >
                        <DetailsIcon />
                      </button>
                    </td>
                    <td className="px-3 py-3">{formatClassificationBoolean(point.vote.failed_fitting)}</td>
                    <td className="px-3 py-3">{formatClassificationBoolean(point.vote.visible_nucleus)}</td>
                    <td className="px-3 py-3">{point.vote.awesome_flag ? "Yes" : "No"}</td>
                    <td className="px-3 py-3">{point.vote.valid_redshift ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 min-w-[120px] max-w-[180px] break-words">
                      {commentPreview ? (
                        <span title={comment ?? undefined}>{commentPreview}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          No classifications in this preview.
        </div>
      )}
    </div>
  );
}

function ExpandIcon() {
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

function CollapseIcon() {
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

function EditIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
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

function DuplicateIcon() {
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
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function InfoIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ClassificationConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: AnalysisClassificationComparisonCondition;
  onChange: (nextCondition: AnalysisClassificationComparisonCondition) => void;
  onRemove: () => void;
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const isTooltipOpenedByClickRef = useRef(false);
  const isDateTimeMetric = isDateTimeClassificationConditionMetric(condition.metric);

  const handleClickInfo = () => {
    if (isTooltipOpenedByClickRef.current) {
      // Already click-opened, so close it
      setIsTooltipOpen(false);
      isTooltipOpenedByClickRef.current = false;
    } else {
      // Not yet click-opened, so keep open and mark as click-opened
      setIsTooltipOpen(true);
      isTooltipOpenedByClickRef.current = true;
    }
  };

  const handleCloseTooltip = () => {
    setIsTooltipOpen(false);
    isTooltipOpenedByClickRef.current = false;
  };

  const handleMouseEnter = () => {
    if (!isTooltipOpenedByClickRef.current) {
      setIsTooltipOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isTooltipOpenedByClickRef.current) {
      setIsTooltipOpen(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,180px)_auto_44px]">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Metric
        </span>
        <select
          value={condition.metric}
          onChange={(event) => {
            const nextMetric =
              event.target.value as AnalysisClassificationComparisonCondition["metric"];
            const metricTypeChanged =
              isDateTimeClassificationConditionMetric(nextMetric) !==
              isDateTimeClassificationConditionMetric(condition.metric);

            onChange({
              ...condition,
              metric: nextMetric,
              count: metricTypeChanged
                ? isDateTimeClassificationConditionMetric(nextMetric)
                  ? Date.now()
                  : 0
                : condition.count,
            });
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisClassificationConditionMetricOptions.map((option) => (
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
              operator:
                event.target.value as AnalysisClassificationComparisonCondition["operator"],
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

      <label className="flex flex-col items-start justify-end">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          {isDateTimeMetric ? "Date and time" : "Value"}
        </span>
        <input
          type={isDateTimeMetric ? "datetime-local" : "number"}
          min={isDateTimeMetric ? undefined : 0}
          step={isDateTimeMetric ? 60 : 1}
          value={
            isDateTimeMetric
              ? toDateTimeLocalInputValue(condition.count || Date.now())
              : condition.count
          }
          onChange={(event) => {
            if (isDateTimeMetric) {
              const timestamp = parseDateTimeLocalInputValue(event.target.value);
              if (timestamp === null) {
                return;
              }

              onChange({
                ...condition,
                count: timestamp,
              });
              return;
            }

            onChange({
              ...condition,
              count: Math.max(0, Math.floor(Number(event.target.value) || 0)),
            });
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>

      {isDateTimeMetric ? (
        <div className="relative flex items-end">
          <button
            type="button"
            onClick={handleClickInfo}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="More information"
          >
            <InfoIcon />
          </button>
          {isTooltipOpen && (
            <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 flex items-center gap-2 min-w-[280px] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-700">
              <span>Compares against the classification row creation timestamp.</span>
              <button
                type="button"
                onClick={handleCloseTooltip}
                className="flex-shrink-0 text-gray-300 hover:text-white transition"
                aria-label="Close tooltip"
              >
                ×
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          aria-label="Remove condition"
          title="Remove condition"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-1 font-medium text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function SubsetStatsCard({
  title,
  tone,
  metric,
  metricLabel,
  stats,
}: {
  title: string;
  tone: "match" | "fail";
  metric: AnalysisClassificationDistributionComparisonConfig["histogramMetric"];
  metricLabel: string;
  stats: AnalysisClassificationDistributionComparisonResult["matchedStats"];
}) {
  const toneClasses =
    tone === "match"
      ? "border-emerald-200 dark:border-emerald-900/60"
      : "border-rose-200 dark:border-rose-900/60";

  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-gray-800 ${toneClasses}`}>
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Summary statistics for the selected classification histogram metric inside this subset.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryChip label="Classifications" value={stats.recordCount.toLocaleString()} />
        <SummaryChip
          label="Share of scope"
          value={stats.shareOfScope === null ? "-" : `${(stats.shareOfScope * 100).toFixed(1)}%`}
        />
        <SummaryChip
          label={`Mean ${metricLabel}`}
          value={formatClassificationMetricValue(metric, stats.averageMetric)}
        />
        <SummaryChip
          label={`Median ${metricLabel}`}
          value={formatClassificationMetricValue(metric, stats.medianMetric)}
        />
        <SummaryChip
          label={`Min ${metricLabel}`}
          value={formatClassificationMetricValue(metric, stats.minMetric)}
        />
        <SummaryChip
          label={`Max ${metricLabel}`}
          value={formatClassificationMetricValue(metric, stats.maxMetric)}
        />
      </div>
    </div>
  );
}

export function DataAnalysisClassificationDistributionCard({
  comparison,
  result,
  summary,
  isCollapsed,
  hasDataset,
  userDisplayNames,
  canRemove,
  onOpenDetails,
  onToggleCollapsed,
  onDuplicate,
  onRemove,
  onUpdateComparison,
}: {
  comparison: AnalysisClassificationDistributionComparisonConfig;
  result: AnalysisClassificationDistributionComparisonResult | undefined;
  summary: DatasetSummary;
  isCollapsed: boolean;
  hasDataset: boolean;
  userDisplayNames: Record<string, string>;
  canRemove: boolean;
  onOpenDetails: (record: AnalysisRecord) => void;
  onToggleCollapsed: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdateComparison: (
    comparisonId: string,
    updater: (
      comparison: AnalysisClassificationDistributionComparisonConfig
    ) => AnalysisClassificationDistributionComparisonConfig
  ) => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const comparisonPlotData = result
    ? buildComparisonHistogramData(
        result.scopedHistogram,
        result.matchedHistogram,
        result.failedHistogram
      )
    : [];
  const previewSortLabel =
    comparison.plotType !== "histogram"
      ? getClassificationConditionMetricLabel(comparison.plotXAxisMetric)
      : getClassificationMetricLabel(comparison.histogramMetric);
  const metricControlLabel =
    comparison.plotType !== "histogram" ? "Y axis metric" : "Histogram metric";
  const scaleControlLabel =
    comparison.plotType !== "histogram" ? "Frequency scale" : "Histogram scale";
  const showsTimeBinningControls =
    comparison.plotType !== "histogram" &&
    comparison.plotXAxisMetric === "classificationCreationTime";

  return (
    <section
      id={`analysis-classification-distribution-${comparison.id}`}
      className="scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={comparison.name}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      name: event.target.value,
                    }))
                  }
                  onBlur={() => setIsEditingTitle(false)}
                  className="min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {comparison.name || "Untitled classification split"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  title="Edit distribution title"
                  aria-label="Edit distribution title"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <EditIcon />
                </button>
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 md:w-auto md:justify-start">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={
                isCollapsed ? "Expand classification distribution card" : "Collapse classification distribution card"
              }
              title={
                isCollapsed ? "Expand classification distribution card" : "Collapse classification distribution card"
              }
              className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition ${
                isCollapsed
                  ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
              }`}
            >
              <span className="mr-2">
                {isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
              </span>
              {isCollapsed ? "Expand" : "Minimize"}
            </button>
            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={onDuplicate}
                aria-label="Duplicate classification distribution card"
                title="Duplicate classification distribution card"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:px-4"
              >
                <span className="sm:mr-2">
                  <DuplicateIcon />
                </span>
                <span className="hidden sm:inline">Duplicate</span>
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={!canRemove}
                aria-label="Remove classification distribution card"
                title="Remove classification distribution card"
                className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/20 dark:disabled:border-gray-700 dark:disabled:text-gray-500 sm:px-4"
              >
                <span className="sm:mr-2">
                  <TrashIcon />
                </span>
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => setIsEditingDescription(true)}
            title={comparison.description.trim().length > 0 ? "Edit description" : "Add description"}
            aria-label={comparison.description.trim().length > 0 ? "Edit description" : "Add description"}
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <EditIcon />
          </button>
          <div className="min-w-0 flex-1">
            {isEditingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={comparison.description}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional note about what this classification split is meant to compare."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(false)}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {comparison.description.trim() || "No description added yet."}
              </p>
            )}
          </div>
        </div>

        {hasDataset && result ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              Scoped classifications {result.scopedCount.toLocaleString()}
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              Matches thresholds {result.matchedCount.toLocaleString()}
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
              Fails thresholds {result.failedCount.toLocaleString()}
            </span>
          </div>
        ) : null}
      </div>

      {!isCollapsed ? (
        <>
          <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Paper filter
                </span>
                <select
                  value={comparison.paper}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
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

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Catalog nucleus filter
                </span>
                <select
                  value={comparison.catalogNucleus}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      catalogNucleus:
                        event.target.value as AnalysisClassificationDistributionComparisonConfig["catalogNucleus"],
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
                  value={comparison.dominantLsb}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      dominantLsb:
                        event.target.value as AnalysisClassificationDistributionComparisonConfig["dominantLsb"],
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
                  Visualization
                </span>
                <select
                  value={comparison.plotType}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      plotType:
                        event.target
                          .value as AnalysisClassificationDistributionComparisonConfig["plotType"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {analysisClassificationComparisonPlotTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {comparison.plotType !== "histogram" ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    X axis metric
                  </span>
                  <select
                    value={comparison.plotXAxisMetric}
                    onChange={(event) =>
                      onUpdateComparison(comparison.id, (currentComparison) => ({
                        ...currentComparison,
                        plotXAxisMetric:
                          event.target
                            .value as AnalysisClassificationDistributionComparisonConfig["plotXAxisMetric"],
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {analysisClassificationConditionMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showsTimeBinningControls ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Time binning
                  </span>
                  <select
                    value={comparison.plotXAxisBinningMode}
                    onChange={(event) =>
                      onUpdateComparison(comparison.id, (currentComparison) => ({
                        ...currentComparison,
                        plotXAxisBinningMode:
                          event.target
                            .value as AnalysisClassificationDistributionComparisonConfig["plotXAxisBinningMode"],
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {analysisClassificationFrequencyBinningModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showsTimeBinningControls ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {comparison.plotXAxisBinningMode === "pointsPerBin"
                      ? "Values per point"
                      : "Total bins"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={comparison.plotXAxisBinningMode === "pointsPerBin" ? 1200 : 120}
                    step={1}
                    value={
                      comparison.plotXAxisBinningMode === "pointsPerBin"
                        ? comparison.plotXAxisPointsPerBin
                        : comparison.plotXAxisBinCount
                    }
                    onChange={(event) =>
                      onUpdateComparison(comparison.id, (currentComparison) => ({
                        ...currentComparison,
                        ...(currentComparison.plotXAxisBinningMode === "pointsPerBin"
                          ? {
                              plotXAxisPointsPerBin:
                                clampClassificationFrequencyPointsPerBin(
                                  Number(event.target.value) || 0
                                ),
                            }
                          : {
                              plotXAxisBinCount: clampClassificationFrequencyBinCount(
                                Number(event.target.value) || 0
                              ),
                            }),
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </label>
              ) : null}

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {metricControlLabel}
                </span>
                <select
                  value={comparison.histogramMetric}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      histogramMetric:
                        event.target.value as AnalysisClassificationDistributionComparisonConfig["histogramMetric"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {analysisClassificationHistogramMetricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {scaleControlLabel}
                </span>
                <select
                  value={comparison.histogramScale}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      histogramScale:
                        event.target.value as AnalysisClassificationDistributionComparisonConfig["histogramScale"],
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {analysisDistributionScaleOptions.map((option) => (
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
                  max={ANALYSIS_MAX_PREVIEW_LIMIT}
                  step={1}
                  value={comparison.previewLimit}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      previewLimit: clampPreviewLimit(
                        Number(event.target.value) || 0
                      ),
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
                  Scope Thresholds
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Only classifications that satisfy every scope threshold remain in the plot and previews. The matching and failing subsets are both computed from this filtered scope.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateComparison(comparison.id, (currentComparison) => ({
                    ...currentComparison,
                    scopeConditions: [
                      ...currentComparison.scopeConditions,
                      createAnalysisClassificationCondition(),
                    ],
                  }))
                }
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Add scope threshold
              </button>
            </div>

            {comparison.scopeConditions.length > 0 ? (
              <div className="space-y-3">
                {comparison.scopeConditions.map((condition) => (
                  <ClassificationConditionEditor
                    key={condition.id}
                    condition={condition}
                    onChange={(nextCondition) =>
                      onUpdateComparison(comparison.id, (currentComparison) => ({
                        ...currentComparison,
                        scopeConditions: currentComparison.scopeConditions.map((candidate) =>
                          candidate.id === nextCondition.id ? nextCondition : candidate
                        ),
                      }))
                    }
                    onRemove={() =>
                      onUpdateComparison(comparison.id, (currentComparison) => ({
                        ...currentComparison,
                        scopeConditions: currentComparison.scopeConditions.filter(
                          (candidate) => candidate.id !== condition.id
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                No scope thresholds yet. All classifications that pass the galaxy-level paper, catalog nucleus, and dominant Is-LSB filters stay in the split.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Split Thresholds
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Each threshold is applied to individual classification rows after the galaxy-level scope filters.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateComparison(comparison.id, (currentComparison) => ({
                    ...currentComparison,
                    conditions: [
                      ...currentComparison.conditions,
                      createAnalysisClassificationCondition(),
                    ],
                  }))
                }
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Add condition
              </button>
            </div>

            <div className="space-y-3">
              {comparison.conditions.map((condition) => (
                <ClassificationConditionEditor
                  key={condition.id}
                  condition={condition}
                  onChange={(nextCondition) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      conditions: currentComparison.conditions.map((candidate) =>
                        candidate.id === nextCondition.id ? nextCondition : candidate
                      ),
                    }))
                  }
                  onRemove={() =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      conditions:
                        currentComparison.conditions.length > 1
                          ? currentComparison.conditions.filter(
                              (candidate) => candidate.id !== condition.id
                            )
                          : currentComparison.conditions,
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Split summary
              </div>
              {hasDataset && result ? (
                <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                  <SummaryChip
                    label="Scoped classifications"
                    value={result.scopedCount.toLocaleString()}
                  />
                  <SummaryChip
                    label="Matching subset"
                    value={result.matchedCount.toLocaleString()}
                  />
                  <SummaryChip
                    label="Failing subset"
                    value={result.failedCount.toLocaleString()}
                  />
                  <SummaryChip
                    label="Visualization"
                    value={getClassificationComparisonPlotTypeLabel(comparison.plotType)}
                  />
                  <SummaryChip
                    label={metricControlLabel}
                    value={getClassificationMetricLabel(comparison.histogramMetric)}
                  />
                  {comparison.plotType !== "histogram" ? (
                    <SummaryChip
                      label="X axis metric"
                      value={getClassificationConditionMetricLabel(
                        comparison.plotXAxisMetric
                      )}
                    />
                  ) : null}
                  {showsTimeBinningControls ? (
                    <SummaryChip
                      label={
                        comparison.plotXAxisBinningMode === "pointsPerBin"
                          ? "Values per point"
                          : "Total bins"
                      }
                      value={
                        comparison.plotXAxisBinningMode === "pointsPerBin"
                          ? clampClassificationFrequencyPointsPerBin(
                              comparison.plotXAxisPointsPerBin
                            ).toLocaleString()
                          : clampClassificationFrequencyBinCount(
                              comparison.plotXAxisBinCount
                            ).toLocaleString()
                      }
                    />
                  ) : null}
                  <SummaryChip
                    label={scaleControlLabel}
                    value={getDistributionScaleLabel(comparison.histogramScale)}
                  />
                  <SummaryChip
                    label="Preview rows"
                    value={clampPreviewLimit(comparison.previewLimit).toLocaleString()}
                  />
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Scope threshold summary
                    </div>
                    <div className="mt-1 space-y-1 text-sm font-medium text-gray-900 dark:text-white">
                      {comparison.scopeConditions.length > 0 ? (
                        comparison.scopeConditions.map((condition) => (
                          <div key={condition.id}>
                            {getClassificationConditionMetricLabel(condition.metric)} {condition.operator === "atLeast" ? "at least" : condition.operator === "atMost" ? "at most" : "exactly"} {formatClassificationConditionThreshold(
                              condition.metric,
                              condition.count
                            )}
                          </div>
                        ))
                      ) : (
                        <div>No extra scope thresholds.</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Split threshold summary
                    </div>
                    <div className="mt-1 space-y-1 text-sm font-medium text-gray-900 dark:text-white">
                      {comparison.conditions.map((condition) => (
                        <div key={condition.id}>
                          {getClassificationConditionMetricLabel(condition.metric)} {condition.operator === "atLeast" ? "at least" : condition.operator === "atMost" ? "at most" : "exactly"} {formatClassificationConditionThreshold(
                            condition.metric,
                            condition.count
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Load the dataset first to evaluate this classification distribution split locally.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {comparison.plotType === "histogram"
                    ? "Combined classification comparison"
                    : comparison.plotType === "frequencyLine"
                      ? "Classification frequency lines"
                      : "Classification frequency plot"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hasDataset && result
                    ? comparison.plotType === "frequencyScatter"
                      ? `Bubble-style frequency view of ${getClassificationMetricLabel(comparison.histogramMetric).toLowerCase()} across ordered bins of ${getClassificationConditionMetricLabel(comparison.plotXAxisMetric).toLowerCase()}, with bubble size shown as ${getDistributionScaleLabel(comparison.histogramScale).toLowerCase()}.`
                      : comparison.plotType === "frequencyLine"
                        ? `Line view of ${getClassificationMetricLabel(comparison.histogramMetric).toLowerCase()} across ordered bins of ${getClassificationConditionMetricLabel(comparison.plotXAxisMetric).toLowerCase()}, with vertical markers for split thresholds that use the same X-axis metric.`
                        : `Step-style comparison of ${getClassificationMetricLabel(comparison.histogramMetric).toLowerCase()} for classifications that pass versus fail the thresholds, shown as ${getDistributionScaleLabel(comparison.histogramScale).toLowerCase()}.`
                    : comparison.plotType === "histogram"
                      ? "Load the dataset to build this comparison histogram."
                      : "Load the dataset to build this frequency plot."}
                </p>
              </div>
              {comparison.plotType !== "histogram" ? (
                result ? (
                  comparison.plotType === "frequencyLine" ? (
                    <AnalysisClassificationFrequencyLinePlot
                      plot={result.frequencyPlot}
                      scale={comparison.histogramScale}
                    />
                  ) : (
                    <AnalysisClassificationFrequencyPlot
                      plot={result.frequencyPlot}
                      scale={comparison.histogramScale}
                    />
                  )
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                    Load the dataset to build this frequency plot.
                  </div>
                )
              ) : (
                <AnalysisComparisonHistogram
                  data={comparisonPlotData}
                  scale={comparison.histogramScale}
                  subjectLabelPlural="classifications"
                />
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <SubsetStatsCard
              title="Classifications that match thresholds"
              tone="match"
              metric={comparison.histogramMetric}
              metricLabel={getClassificationMetricLabel(comparison.histogramMetric)}
              stats={
                result?.matchedStats ?? {
                  recordCount: 0,
                  shareOfScope: null,
                  averageMetric: null,
                  medianMetric: null,
                  minMetric: null,
                  maxMetric: null,
                }
              }
            />
            <SubsetStatsCard
              title="Classifications that fail thresholds"
              tone="fail"
              metric={comparison.histogramMetric}
              metricLabel={getClassificationMetricLabel(comparison.histogramMetric)}
              stats={
                result?.failedStats ?? {
                  recordCount: 0,
                  shareOfScope: null,
                  averageMetric: null,
                  medianMetric: null,
                  minMetric: null,
                  maxMetric: null,
                }
              }
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ClassificationPreviewTable
              title="Matching classifications"
              description={`Showing up to ${clampPreviewLimit(comparison.previewLimit)} classifications ranked by ${previewSortLabel.toLowerCase()} inside the subset that passes the thresholds.`}
              points={result?.matchedPreviewPoints ?? []}
              userDisplayNames={userDisplayNames}
              onOpenDetails={onOpenDetails}
            />
            <ClassificationPreviewTable
              title="Failing classifications"
              description={`Showing up to ${clampPreviewLimit(comparison.previewLimit)} classifications ranked by ${previewSortLabel.toLowerCase()} inside the subset that fails one or more thresholds.`}
              points={result?.failedPreviewPoints ?? []}
              userDisplayNames={userDisplayNames}
              onOpenDetails={onOpenDetails}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

export { duplicateAnalysisClassificationDistributionComparison };
