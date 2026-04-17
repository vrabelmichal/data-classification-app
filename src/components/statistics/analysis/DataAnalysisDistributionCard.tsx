import { useState } from "react";

import { AnalysisComparisonHistogram } from "./AnalysisComparisonHistogram";
import {
  analysisConditionMetricOptions,
  analysisHistogramMetricOptions,
  analysisOperatorOptions,
  buildComparisonHistogramData,
  catalogNucleusOptions,
  createAnalysisCondition,
  dominantLsbOptions,
  duplicateAnalysisDistributionComparison,
  formatConditionThreshold,
  formatMetricValue,
  formatPaperLabel,
  getConditionMetricLabel,
  getMetricLabel,
  isDateTimeConditionMetric,
  parseDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
  type AnalysisDistributionComparisonConfig,
  type AnalysisDistributionComparisonResult,
  type AnalysisQueryCondition,
} from "./helpers";
import type { DatasetSummary } from "./tabTypes";

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

function ComparisonConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: AnalysisQueryCondition;
  onChange: (nextCondition: AnalysisQueryCondition) => void;
  onRemove: () => void;
}) {
  const isDateTimeMetric = isDateTimeConditionMetric(condition.metric);

  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,180px)_44px]">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Metric
        </span>
        <select
          value={condition.metric}
          onChange={(event) => {
            const nextMetric = event.target.value as AnalysisQueryCondition["metric"];
            const metricTypeChanged =
              isDateTimeConditionMetric(nextMetric) !==
              isDateTimeConditionMetric(condition.metric);

            onChange({
              ...condition,
              metric: nextMetric,
              count: metricTypeChanged
                ? isDateTimeConditionMetric(nextMetric)
                  ? Date.now()
                  : 0
                : condition.count,
            });
          }}
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
          {isDateTimeMetric ? "Date and time" : "Count"}
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
  metric: AnalysisDistributionComparisonConfig["histogramMetric"];
  metricLabel: string;
  stats: AnalysisDistributionComparisonResult["matchedStats"];
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
          Summary statistics for the selected histogram metric inside this subset.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryChip label="Galaxies" value={stats.recordCount.toLocaleString()} />
        <SummaryChip
          label="Share of scope"
          value={stats.shareOfScope === null ? "-" : `${(stats.shareOfScope * 100).toFixed(1)}%`}
        />
        <SummaryChip
          label={`Mean ${metricLabel}`}
          value={formatMetricValueFromSelectedMetric(metric, stats.averageMetric)}
        />
        <SummaryChip
          label={`Median ${metricLabel}`}
          value={formatMetricValueFromSelectedMetric(metric, stats.medianMetric)}
        />
        <SummaryChip
          label={`Min ${metricLabel}`}
          value={formatMetricValueFromSelectedMetric(metric, stats.minMetric)}
        />
        <SummaryChip
          label={`Max ${metricLabel}`}
          value={formatMetricValueFromSelectedMetric(metric, stats.maxMetric)}
        />
      </div>
    </div>
  );
}

function formatMetricValueFromSelectedMetric(
  metric: AnalysisDistributionComparisonConfig["histogramMetric"],
  value: number | null
) {
  return formatMetricValue(metric, value);
}

export function DataAnalysisDistributionCard({
  comparison,
  result,
  summary,
  isCollapsed,
  hasDataset,
  canRemove,
  onToggleCollapsed,
  onDuplicate,
  onRemove,
  onUpdateComparison,
}: {
  comparison: AnalysisDistributionComparisonConfig;
  result: AnalysisDistributionComparisonResult | undefined;
  summary: DatasetSummary;
  isCollapsed: boolean;
  hasDataset: boolean;
  canRemove: boolean;
  onToggleCollapsed: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdateComparison: (
    comparisonId: string,
    updater: (
      comparison: AnalysisDistributionComparisonConfig
    ) => AnalysisDistributionComparisonConfig
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

  return (
    <section
      id={`analysis-distribution-${comparison.id}`}
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
                  {comparison.name || "Untitled distribution split"}
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
                isCollapsed ? "Expand distribution card" : "Collapse distribution card"
              }
              title={isCollapsed ? "Expand distribution card" : "Collapse distribution card"}
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
                aria-label="Duplicate distribution card"
                title="Duplicate distribution card"
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
                aria-label="Remove distribution card"
                title="Remove distribution card"
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
                  placeholder="Optional note about what this split is meant to compare."
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
              Scoped set {result.scopedCount.toLocaleString()}
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
            <div className="grid flex-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
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
                      catalogNucleus: event.target.value as AnalysisDistributionComparisonConfig["catalogNucleus"],
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
                      dominantLsb: event.target.value as AnalysisDistributionComparisonConfig["dominantLsb"],
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
                  Histogram metric
                </span>
                <select
                  value={comparison.histogramMetric}
                  onChange={(event) =>
                    onUpdateComparison(comparison.id, (currentComparison) => ({
                      ...currentComparison,
                      histogramMetric: event.target.value as AnalysisDistributionComparisonConfig["histogramMetric"],
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
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Thresholds
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Records that satisfy every threshold fall into the matching subset. Records in the same scope that miss one or more thresholds fall into the failing subset.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateComparison(comparison.id, (currentComparison) => ({
                    ...currentComparison,
                    conditions: [
                      ...currentComparison.conditions,
                      createAnalysisCondition(),
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
                <ComparisonConditionEditor
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
                    label="Scoped records"
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
                    label="Histogram metric"
                    value={getMetricLabel(comparison.histogramMetric)}
                  />
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Threshold summary
                    </div>
                    <div className="mt-1 space-y-1 text-sm font-medium text-gray-900 dark:text-white">
                      {comparison.conditions.map((condition) => (
                        <div key={condition.id}>
                          {getConditionMetricLabel(condition.metric)} {condition.operator === "atLeast" ? "at least" : condition.operator === "atMost" ? "at most" : "exactly"} {formatConditionThreshold(condition.metric, condition.count)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Load the dataset first to evaluate this distribution split locally.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Combined distribution comparison
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hasDataset && result
                    ? `Step-style comparison of ${getMetricLabel(comparison.histogramMetric).toLowerCase()} for galaxies that pass versus fail the thresholds.`
                    : "Load the dataset to build this comparison histogram."}
                </p>
              </div>
              <AnalysisComparisonHistogram data={comparisonPlotData} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <SubsetStatsCard
              title="Matches thresholds"
              tone="match"
              metric={comparison.histogramMetric}
              metricLabel={getMetricLabel(comparison.histogramMetric)}
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
              title="Fails thresholds"
              tone="fail"
              metric={comparison.histogramMetric}
              metricLabel={getMetricLabel(comparison.histogramMetric)}
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
        </>
      ) : null}
    </section>
  );
}

export { duplicateAnalysisDistributionComparison };