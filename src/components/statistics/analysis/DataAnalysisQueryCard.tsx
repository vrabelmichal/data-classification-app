import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { getImageUrl } from "../../../images";
import { getPreviewImageName } from "../../../images/displaySettings";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "../../classification/GalaxyImages";
import { ImageViewer } from "../../classification/ImageViewer";
import type { UserPreferences } from "../../classification/types";
import { AnalysisHistogram } from "./AnalysisHistogram";
import {
  ANALYSIS_MAX_PREVIEW_LIMIT,
  analysisCommentRuleModeOptions,
  analysisConditionMetricOptions,
  analysisHistogramMetricOptions,
  analysisOperatorOptions,
  analysisSortMetricOptions,
  catalogNucleusOptions,
  clampPreviewLimit,
  createAnalysisCommentRule,
  createAnalysisCondition,
  dominantLsbOptions,
  duplicateAnalysisQuery,
  formatAnalysisDateTime,
  formatPaperLabel,
  getNormalizedComment,
  getMetricLabel,
  getMetricShortLabel,
  getVotePreview,
  isDateTimeConditionMetric,
  parseDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
  type AnalysisCommentRule,
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
  const isDateTimeMetric = isDateTimeConditionMetric(condition.metric);

  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_112px_44px]">
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
        {isDateTimeMetric ? (
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Compares against the galaxy row creation timestamp.
          </span>
        ) : null}
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

function CommentRuleEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: AnalysisCommentRule;
  onChange: (nextRule: AnalysisCommentRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30 md:grid-cols-[180px_minmax(0,1fr)_44px]">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Rule
        </span>
        <select
          value={rule.mode}
          onChange={(event) =>
            onChange({
              ...rule,
              mode: event.target.value as AnalysisCommentRule["mode"],
            })
          }
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {analysisCommentRuleModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Terms
        </span>
        <textarea
          value={rule.terms}
          onChange={(event) =>
            onChange({
              ...rule,
              terms: event.target.value,
            })
          }
          rows={2}
          placeholder="One term per line, or separate multiple OR terms with commas."
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          aria-label="Remove comment rule"
          title="Remove comment rule"
        >
          x
        </button>
      </div>
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

function VotePreviewPopoverButton({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setIsOpen((currentState) => !currentState)}
        aria-label={`Show ${label.toLowerCase()}`}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        className="inline-flex h-6 items-center justify-center rounded-full border border-gray-300 bg-white px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      >
        First 5
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-8 z-20 w-[min(22rem,calc(100vw-4rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          <VotePreviewRow label={label} values={values} />
        </div>
      ) : null}
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
        {/* <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Click the preview to open the zoom viewer.
        </p> */}
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
            <div className="mt-1 flex items-center gap-2">
              <span className="font-medium">{record.dominantLsbLabel}</span>
              <VotePreviewPopoverButton
                label="First 5 LSB votes"
                values={lsbVotePreview}
              />
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/30">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dominant morphology
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-medium">{record.dominantMorphologyLabel}</span>
              <VotePreviewPopoverButton
                label="First 5 morphology votes"
                values={morphologyVotePreview}
              />
            </div>
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

        <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>Created {formatAnalysisDateTime(galaxy._creationTime)}</span>
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
            Comments {aggregate.commentedClassifications.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Max comment {aggregate.maxCommentLength.toLocaleString()} chars
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Avg comment {record.averageCommentLength === null ? "-" : `${record.averageCommentLength.toFixed(1)} chars`}
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
  onDownloadQueryIdsTxt,
  onDownloadQueryMatchesCsv,
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
  onDownloadQueryIdsTxt: (
    query: AnalysisQueryConfig,
    result: AnalysisQueryResult
  ) => void;
  onDownloadQueryMatchesCsv: (
    query: AnalysisQueryConfig,
    result: AnalysisQueryResult
  ) => void;
  onToggleCollapsed: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdateQuery: (
    queryId: string,
    updater: (query: AnalysisQueryConfig) => AnalysisQueryConfig
  ) => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  return (
    <section
      id={`analysis-query-${query.id}`}
      className="scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={query.name}
                  onChange={(event) =>
                    onUpdateQuery(query.id, (currentQuery) => ({
                      ...currentQuery,
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
                  {query.name || "Untitled query"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  title="Edit query title"
                  aria-label="Edit query title"
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
              aria-label={isCollapsed ? "Expand query card" : "Collapse query card"}
              title={isCollapsed ? "Expand query card" : "Collapse query card"}
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
                aria-label="Duplicate query card"
                title="Duplicate query card"
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
                aria-label="Remove query card"
                title="Remove query card"
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
          title={query.description.trim().length > 0 ? "Edit description" : "Add description"}
          aria-label={query.description.trim().length > 0 ? "Edit description" : "Add description"}
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <EditIcon />
        </button>
        <div className="min-w-0 flex-1">
          {isEditingDescription ? (
            <div className="space-y-2">
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
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(false)}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(false)}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {query.description.trim() || "No description added yet."}
            </p>
          )}
        </div>
        </div>

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
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              {result.totalMatchingCommentedClassifications.toLocaleString()} commented classifications
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
                  max={ANALYSIS_MAX_PREVIEW_LIMIT}
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

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Comment text filters
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Terms inside one rule behave as OR. Multiple rules are combined as AND, so you can stack positive and negative comment requirements.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateQuery(query.id, (currentQuery) => ({
                    ...currentQuery,
                    commentRules: [...currentQuery.commentRules, createAnalysisCommentRule()],
                  }))
                }
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Add comment rule
              </button>
            </div>

            {query.commentRules.length > 0 ? (
              <div className="space-y-3">
                {query.commentRules.map((rule) => (
                  <CommentRuleEditor
                    key={rule.id}
                    rule={rule}
                    onChange={(nextRule) =>
                      onUpdateQuery(query.id, (currentQuery) => ({
                        ...currentQuery,
                        commentRules: currentQuery.commentRules.map((candidate) =>
                          candidate.id === nextRule.id ? nextRule : candidate
                        ),
                      }))
                    }
                    onRemove={() =>
                      onUpdateQuery(query.id, (currentQuery) => ({
                        ...currentQuery,
                        commentRules: currentQuery.commentRules.filter(
                          (candidate) => candidate.id !== rule.id
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                No comment text rules configured for this query.
              </div>
            )}
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
                      Commented classifications
                    </div>
                    <div className="mt-1 font-medium">
                      {result.totalMatchingCommentedClassifications.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Avg comment length
                    </div>
                    <div className="mt-1 font-medium">
                      {result.averageMatchingCommentLength === null
                        ? "-"
                        : `${result.averageMatchingCommentLength.toFixed(1)} chars`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-800">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Max comment length
                    </div>
                    <div className="mt-1 font-medium">
                      {result.maxMatchingCommentLength.toLocaleString()} chars
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top matches
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing up to {clampPreviewLimit(query.previewLimit)} galaxies ranked by {getMetricShortLabel(query.sortBy).toLowerCase()}.
                </p>
              </div>
              {hasDataset && result && result.matchedCount > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDownloadQueryIdsTxt(query, result)}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Download IDs (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadQueryMatchesCsv(query, result)}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Download IDs + aggregates (.csv)
                  </button>
                </div>
              ) : null}
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