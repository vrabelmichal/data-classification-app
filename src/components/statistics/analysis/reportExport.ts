import { getImageUrl } from "../../../images";
import { getPreviewImageName } from "../../../images/displaySettings";
import {
  buildComparisonHistogramData,
  buildGlobalSummaryHistograms,
  evaluateAnalysisClassificationDistributionComparison,
  evaluateAnalysisDistributionComparison,
  evaluateAnalysisQuery,
  filterZeroCountHistogram,
  formatClassificationConditionThreshold,
  formatClassificationMetricValue,
  formatConditionThreshold,
  formatMetricValue,
  formatPaperLabel,
  getClassificationComparisonPlotTypeLabel,
  getClassificationConditionMetricLabel,
  getClassificationMetricLabel,
  getConditionMetricLabel,
  getDistributionScaleLabel,
  getMetricLabel,
  getVotePreview,
  type AnalysisClassificationCountLinePlot,
  type AnalysisClassificationFrequencyPlot,
  type AnalysisClassificationPoint,
  type AnalysisClassificationComparisonCondition,
  type AnalysisClassificationDistributionComparisonConfig,
  type AnalysisDistributionComparisonConfig,
  type AnalysisDistributionComparisonScale,
  type AnalysisDistributionSubsetStats,
  type AnalysisQueryCondition,
  type AnalysisQueryConfig,
  type AnalysisRecord,
  type ComparisonHistogramDatum,
  type HistogramDatum,
} from "./helpers";
import type { DatasetSummary, PreparedDataset, ZeroBucketState } from "./tabTypes";
import { formatLoadedAt, formatPercent } from "./tabUtils";

type GlobalHistogramKey =
  | "classificationCoverage"
  | "lsbAgreementCount"
  | "morphologyAgreementCount"
  | "visibleNucleusAgreementCount"
  | "awesomeVotes"
  | "failedFittingVotes"
  | "nucleusConfirmation";

type ReportHistogramSection = {
  id: string;
  title: string;
  description: string;
  displayBins: HistogramDatum[];
  allBins: HistogramDatum[];
  zeroBucketHidden: boolean;
};

type ExportInput = {
  summary: DatasetSummary;
  dataset: PreparedDataset;
  queries: AnalysisQueryConfig[];
  comparisons: AnalysisDistributionComparisonConfig[];
  classificationComparisons: AnalysisClassificationDistributionComparisonConfig[];
  hideZeroBuckets: ZeroBucketState;
  imageQuality: "high" | "medium" | "low";
  userDisplayNames: Record<string, string>;
  generatedAt: Date;
};

type AnalysisReportData = ReturnType<typeof buildReportData>;

const GLOBAL_HISTOGRAM_SECTIONS: Array<{
  id: GlobalHistogramKey;
  title: string;
  description: string;
}> = [
  {
    id: "classificationCoverage",
    title: "Classification coverage by item",
    description:
      "How many galaxies have exactly 1, 2, 3, and more classifications. This excludes zero-classification rows so the non-zero coverage is easier to compare.",
  },
  {
    id: "lsbAgreementCount",
    title: "Is-LSB agreement counts",
    description:
      "For each classified galaxy, how many comparable Is-LSB votes landed in the dominant LSB or Non-LSB branch.",
  },
  {
    id: "morphologyAgreementCount",
    title: "Morphology agreement counts inside LSB-majority galaxies",
    description:
      "After the top-level Is-LSB call lands on LSB, this shows how many morphology votes align on the dominant morphology.",
  },
  {
    id: "visibleNucleusAgreementCount",
    title: "Visible-nucleus agreement counts inside LSB-majority galaxies",
    description:
      "Agreement counts on the visible-nucleus question inside LSB-majority galaxies. The hidden zero bucket corresponds to galaxies with no visible-nucleus responses.",
  },
  {
    id: "awesomeVotes",
    title: "Awesome-vote distribution",
    description:
      "Which part of the catalog is attracting repeated follow-up interest. Zero is hidden by default so the tail is easier to inspect.",
  },
  {
    id: "failedFittingVotes",
    title: "Failed-fitting vote distribution",
    description:
      "How often galaxies accumulate explicit failed-fitting responses. Zero is hidden by default.",
  },
  {
    id: "nucleusConfirmation",
    title: "Catalog nucleus confirmations",
    description:
      "Visible-nucleus confirmation rate for galaxies whose catalog row already says nucleus.",
  },
];

const QUERY_OPERATOR_LABELS = {
  atLeast: "At least",
  atMost: "At most",
  exactly: "Exactly",
} as const;

const CATALOG_NUCLEUS_LABELS = {
  any: "Any catalog nucleus state",
  yes: "Catalog says nucleus",
  no: "Catalog says no nucleus",
} as const;

const DOMINANT_LSB_LABELS = {
  any: "Any Is-LSB outcome",
  lsb: "Dominant Is-LSB = LSB",
  nonLsb: "Dominant Is-LSB = Non-LSB",
  split: "Split Is-LSB votes",
  noComparableVotes: "No comparable Is-LSB votes",
} as const;

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e");
}

function formatFixed(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatAgreementSummary(
  summary: Pick<
    AnalysisRecord["lsb"],
    "label" | "agreementCount" | "agreementRate" | "comparableVotes"
  >
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

function buildPreviewRecord(
  record: AnalysisRecord,
  imageQuality: ExportInput["imageQuality"]
) {
  const previewImageName = getPreviewImageName();

  return {
    galaxyId: record.galaxy.id,
    numericId: record.galaxy.numericId,
    galaxyCreationTimeIso: new Date(record.galaxy._creationTime).toISOString(),
    galaxyCreationTimeLabel: new Date(record.galaxy._creationTime).toLocaleString(),
    firstClassificationTimeIso:
      record.firstClassificationTime === null
        ? null
        : new Date(record.firstClassificationTime).toISOString(),
    firstClassificationTimeLabel:
      record.firstClassificationTime === null
        ? "-"
        : new Date(record.firstClassificationTime).toLocaleString(),
    previewImageUrl: getImageUrl(record.galaxy.id, previewImageName, {
      quality: imageQuality,
    }),
    paper: record.galaxy.paper,
    paperLabel: formatPaperLabel(record.galaxy.paper),
    catalogNucleus: record.galaxy.nucleus,
    dominantLsb: record.lsb,
    dominantMorphology: record.morphology,
    visibleNucleus: record.visibleNucleus,
    failedFitting: record.failedFitting,
    totalClassifications: record.aggregate.totalClassifications,
    commentedClassifications: record.aggregate.commentedClassifications,
    averageCommentLength: record.averageCommentLength,
    maxCommentLength: record.aggregate.maxCommentLength,
    awesomeVotes: record.aggregate.awesomeVotes,
    failedFittingVotes: record.aggregate.failedFittingVotes,
    failedFittingComparableVotes: record.failedFitting.comparableVotes,
    nucleusConfirmationRate: record.nucleusConfirmationRate,
    ra: record.galaxy.ra,
    dec: record.galaxy.dec,
    reff: record.galaxy.reff,
    q: record.galaxy.q,
    mag: record.galaxy.mag,
    meanMue: record.galaxy.mean_mue,
    lsbVotePreview: getVotePreview(record.votes, "lsb"),
    morphologyVotePreview: getVotePreview(record.votes, "morphology"),
  };
}

function getUserDisplayName(
  userId: string,
  userDisplayNames: Record<string, string>
) {
  return userDisplayNames[userId] ?? `User ${userId.slice(-6)}`;
}

function getCommentPreview(comment: string, previewLength = 36) {
  if (comment.length <= previewLength) {
    return comment;
  }

  return `${comment.slice(0, previewLength).trimEnd()}...`;
}

function formatBooleanValue(value: boolean | undefined) {
  if (value === undefined) {
    return "-";
  }

  return value ? "Yes" : "No";
}

function buildClassificationPreviewPoint(
  point: AnalysisClassificationPoint,
  userDisplayNames: Record<string, string>
) {
  return {
    id: point.id,
    createdAtIso: new Date(point.vote._creationTime).toISOString(),
    createdAtLabel: new Date(point.vote._creationTime).toLocaleString(),
    userId: point.vote.userId,
    userDisplayName: getUserDisplayName(point.vote.userId, userDisplayNames),
    galaxyId: point.record.galaxy.id,
    galaxyNumericId: point.record.galaxy.numericId,
    failedFitting: point.vote.failed_fitting,
    visibleNucleus: point.vote.visible_nucleus,
    awesome: point.vote.awesome_flag,
    validRedshift: point.vote.valid_redshift,
    comment: point.normalizedComment,
    commentPreview:
      point.normalizedComment === null
        ? null
        : getCommentPreview(point.normalizedComment),
  };
}

function renderMetadataTable(rows: Array<{ label: string; value: string }>) {
  return `
    <table class="meta-table">
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <th scope="row">${escapeHtml(row.label)}</th>
                <td>${escapeHtml(row.value)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStatCards(
  cards: Array<{ key: string; label: string; value: string; detail: string }>
) {
  return `
    <div class="stat-grid">
      ${cards
        .map(
          (card) => `
            <article class="stat-card" data-stat-key="${escapeHtml(card.key)}">
              <div class="stat-label">${escapeHtml(card.label)}</div>
              <div class="stat-value">${escapeHtml(card.value)}</div>
              <p class="stat-detail">${escapeHtml(card.detail)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderEmptyState(message: string) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderSummaryChip(label: string, value: string) {
  return `
    <div class="summary-chip">
      <div class="summary-chip-label">${escapeHtml(label)}</div>
      <div class="summary-chip-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderSubsetStatsCard({
  title,
  tone,
  description,
  subjectLabel,
  metricLabel,
  stats,
  formatMetric,
}: {
  title: string;
  tone: "match" | "fail";
  description: string;
  subjectLabel: string;
  metricLabel: string;
  stats: AnalysisDistributionSubsetStats;
  formatMetric: (value: number | null) => string;
}) {
  const toneClass =
    tone === "match" ? "subset-card subset-card-match" : "subset-card subset-card-fail";

  return `
    <section class="${toneClass}">
      <div class="subset-card-header">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="subset-chip-grid">
        ${renderSummaryChip(subjectLabel, stats.recordCount.toLocaleString())}
        ${renderSummaryChip(
          "Share of scope",
          stats.shareOfScope === null ? "-" : formatPercent(stats.shareOfScope)
        )}
        ${renderSummaryChip(`Mean ${metricLabel}`, formatMetric(stats.averageMetric))}
        ${renderSummaryChip(`Median ${metricLabel}`, formatMetric(stats.medianMetric))}
        ${renderSummaryChip(`Min ${metricLabel}`, formatMetric(stats.minMetric))}
        ${renderSummaryChip(`Max ${metricLabel}`, formatMetric(stats.maxMetric))}
      </div>
    </section>
  `;
}

function buildDisplayedXTicks(tickLabels: string[]) {
  if (tickLabels.length <= 12) {
    return tickLabels.map((_, index) => index);
  }

  const maxDisplayedTicks = tickLabels.length > 48 ? 8 : 12;
  const step = Math.max(1, Math.ceil((tickLabels.length - 1) / (maxDisplayedTicks - 1)));
  const ticks: number[] = [];

  for (let index = 0; index < tickLabels.length; index += step) {
    ticks.push(index);
  }

  const lastIndex = tickLabels.length - 1;
  if (ticks[ticks.length - 1] !== lastIndex) {
    ticks.push(lastIndex);
  }

  return ticks;
}

function buildYAxisTicks(
  maxValue: number,
  scale: AnalysisDistributionComparisonScale
) {
  if (scale === "relativeFrequency") {
    return [0, 0.25, 0.5, 0.75, 1];
  }

  if (maxValue <= 0) {
    return [0];
  }

  return Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index);
}

function formatChartValue(
  scale: AnalysisDistributionComparisonScale,
  value: number
) {
  return scale === "relativeFrequency"
    ? formatPercent(value)
    : Math.round(value).toLocaleString();
}

function buildLinePath(
  points: Array<{ x: number; y: number }>,
  mode: "linear" | "stepAfter"
) {
  if (points.length === 0) {
    return "";
  }

  const [firstPoint, ...rest] = points;
  let path = `M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`;

  if (mode === "linear") {
    for (const point of rest) {
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
    return path;
  }

  let previousPoint = firstPoint;
  for (const point of rest) {
    path += ` L ${point.x.toFixed(2)} ${previousPoint.y.toFixed(2)}`;
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    previousPoint = point;
  }

  return path;
}

function renderLegendPills(items: Array<{ label: string; color: string }>) {
  return `
    <div class="chart-legend" aria-label="Chart legend">
      ${items
        .map(
          (item) => `
            <span class="chart-legend-item">
              <span class="chart-legend-swatch" style="background:${escapeHtml(item.color)}"></span>
              <span>${escapeHtml(item.label)}</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderChartNotes(notes: string[]) {
  const presentNotes = notes.filter((note) => note.trim().length > 0);
  if (presentNotes.length === 0) {
    return "";
  }

  return `
    <div class="chart-notes">
      ${presentNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </div>
  `;
}

const MAX_EXPORTED_PLOT_ASPECT_RATIO = 32 / 9;

function clampPlotHeightForAspectRatio(width: number, height: number) {
  const minHeightFromAspectRatio = Math.ceil(width / MAX_EXPORTED_PLOT_ASPECT_RATIO);
  return Math.max(height, minHeightFromAspectRatio, 150);
}

function calculateExportedChartWidth({
  xValueCount,
  displayedTickCount,
  minWidth,
  maxWidth,
  perValueWidth,
  perDisplayedTickWidth,
  basePadding,
}: {
  xValueCount: number;
  displayedTickCount: number;
  minWidth: number;
  maxWidth: number;
  perValueWidth: number;
  perDisplayedTickWidth: number;
  basePadding: number;
}) {
  const computedWidth =
    basePadding +
    xValueCount * perValueWidth +
    Math.max(displayedTickCount, 1) * perDisplayedTickWidth;

  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(computedWidth)));
}

function formatExportScalar(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function renderPlotDataToggle({
  title,
  tables,
}: {
  title: string;
  tables: Array<{
    label: string;
    tableAttributes?: string;
    headers: string[];
    rows: unknown[][];
  }>;
}) {
  const availableTables = tables.filter((table) => table.headers.length > 0);
  if (availableTables.length === 0) {
    return "";
  }

  return `
    <details class="chart-data-toggle">
      <summary>${escapeHtml(title)}</summary>
      <div class="chart-data-toggle-body">
        ${availableTables
          .map(
            (table) => `
              <div class="chart-data-table-block">
                <h5>${escapeHtml(table.label)}</h5>
                <div class="table-wrap">
                  <table class="data-table plot-data-table" ${table.tableAttributes ?? ""}>
                    <thead>
                      <tr>
                        ${table.headers
                          .map((header) => `<th scope="col">${escapeHtml(header)}</th>`)
                          .join("")}
                      </tr>
                    </thead>
                    <tbody>
                      ${table.rows
                        .map(
                          (row) => `
                            <tr>
                              ${row
                                .map(
                                  (cell) => `<td>${escapeHtml(formatExportScalar(cell))}</td>`
                                )
                                .join("")}
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderStandaloneLineChart({
  title,
  description,
  xTickLabels,
  xAxisLabel,
  yAxisLabel,
  series,
  thresholdMarkers,
  scale,
  maxValue,
  lineMode,
  notes,
  plotDataTables,
}: {
  title: string;
  description: string;
  xTickLabels: string[];
  xAxisLabel: string;
  yAxisLabel: string;
  series: Array<{ key: string; label: string; color: string; values: number[] }>;
  thresholdMarkers: Array<{ key: string; xPosition: number; label: string }>;
  scale: AnalysisDistributionComparisonScale;
  maxValue: number;
  lineMode: "linear" | "stepAfter";
  notes: string[];
  plotDataTables: Array<{
    label: string;
    tableAttributes?: string;
    headers: string[];
    rows: unknown[][];
  }>;
}) {
  if (xTickLabels.length === 0 || series.length === 0) {
    return `
      <div class="subsection chart-section">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
        ${renderEmptyState("No plot data available for this chart.")}
      </div>
    `;
  }

  const displayedXTicks = buildDisplayedXTicks(xTickLabels);
  const needsAngledTicks = displayedXTicks.length > 8;
  const width = calculateExportedChartWidth({
    xValueCount: xTickLabels.length,
    displayedTickCount: displayedXTicks.length,
    minWidth: 860,
    maxWidth: 2200,
    perValueWidth: 12,
    perDisplayedTickWidth: needsAngledTicks ? 72 : 54,
    basePadding: 220,
  });
  const height = clampPlotHeightForAspectRatio(width, needsAngledTicks ? 390 : 340);
  const margin = {
    top: 46,
    right: 24,
    bottom: needsAngledTicks ? 108 : 76,
    left: 82,
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const safeMax = scale === "relativeFrequency" ? 1 : Math.max(1, maxValue);
  const xCount = Math.max(xTickLabels.length, 1);
  const toX = (value: number) =>
    margin.left + ((value + 0.5) / xCount) * plotWidth;
  const toY = (value: number) =>
    margin.top + plotHeight - (Math.max(0, value) / safeMax) * plotHeight;
  const yTicks = buildYAxisTicks(safeMax, scale);
  const thresholdMarkup = thresholdMarkers
    .map((marker, index) => {
      const x = toX(marker.xPosition);
      const labelY = margin.top - 14 - (index % 2) * 14;
      return `
        <line x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${(
          margin.top + plotHeight
        ).toFixed(2)}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6" />
        <text x="${x.toFixed(2)}" y="${labelY}" text-anchor="middle" class="chart-marker-label">${escapeHtml(
          marker.label
        )}</text>
      `;
    })
    .join("");
  const pathMarkup = series
    .map((candidate) => {
      const points = candidate.values.map((value, index) => ({
        x: toX(index),
        y: toY(value),
      }));
      const path = buildLinePath(points, lineMode);
      return `
        <path d="${path}" fill="none" stroke="${escapeHtml(
          candidate.color
        )}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      `;
    })
    .join("");
  const xTickMarkup = displayedXTicks
    .map((index) => {
      const x = toX(index);
      const y = margin.top + plotHeight + 22;
      if (needsAngledTicks) {
        return `
          <text x="${x.toFixed(2)}" y="${y}" transform="rotate(-30 ${x.toFixed(
            2
          )} ${y})" text-anchor="end" class="chart-axis-tick">${escapeHtml(
            xTickLabels[index] ?? ""
          )}</text>
        `;
      }

      return `<text x="${x.toFixed(2)}" y="${y}" text-anchor="middle" class="chart-axis-tick">${escapeHtml(
        xTickLabels[index] ?? ""
      )}</text>`;
    })
    .join("");
  const yTickMarkup = yTicks
    .map((tick) => {
      const y = toY(tick);
      return `
        <line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(
          margin.left + plotWidth
        ).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#d7e0ec" stroke-width="1" />
        <text x="${(margin.left - 12).toFixed(2)}" y="${(y + 4).toFixed(
          2
        )}" text-anchor="end" class="chart-axis-tick">${escapeHtml(
          formatChartValue(scale, tick)
        )}</text>
      `;
    })
    .join("");

  return `
    <div class="subsection chart-section">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
      ${renderLegendPills(series.map((candidate) => ({ label: candidate.label, color: candidate.color })))}
      <div class="chart-scroll">
        <svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
          title
        )}">
          <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="#fbfdff" stroke="#d7e0ec" />
          ${yTickMarkup}
          <line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(
            2
          )}" x2="${(margin.left + plotWidth).toFixed(2)}" y2="${(
            margin.top + plotHeight
          ).toFixed(2)}" stroke="#94a3b8" stroke-width="1.5" />
          <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(
            margin.top + plotHeight
          ).toFixed(2)}" stroke="#94a3b8" stroke-width="1.5" />
          ${thresholdMarkup}
          ${pathMarkup}
          ${xTickMarkup}
          <text x="${(margin.left + plotWidth / 2).toFixed(2)}" y="${(
            height - 18
          ).toFixed(2)}" text-anchor="middle" class="chart-axis-label">${escapeHtml(
            xAxisLabel
          )}</text>
          <text x="24" y="${(margin.top + plotHeight / 2).toFixed(
            2
          )}" transform="rotate(-90 24 ${(margin.top + plotHeight / 2).toFixed(
            2
          )})" text-anchor="middle" class="chart-axis-label">${escapeHtml(
            yAxisLabel
          )}</text>
        </svg>
      </div>
      ${renderChartNotes(notes)}
      ${renderPlotDataToggle({
        title: "Show plotted data tables",
        tables: plotDataTables,
      })}
    </div>
  `;
}

function renderComparisonStepChart({
  title,
  description,
  data,
  scale,
  subjectLabelPlural,
}: {
  title: string;
  description: string;
  data: ComparisonHistogramDatum[];
  scale: AnalysisDistributionComparisonScale;
  subjectLabelPlural: string;
}) {
  return renderStandaloneLineChart({
    title,
    description,
    xTickLabels: data.map((datum) => datum.label),
    xAxisLabel: data[0]?.metricLabel ?? "Bins",
    yAxisLabel:
      scale === "relativeFrequency"
        ? `Relative frequency (${subjectLabelPlural})`
        : `Count (${subjectLabelPlural})`,
    series: [
      {
        key: "matched",
        label: "Matches thresholds",
        color: "#059669",
        values: data.map((datum) =>
          scale === "relativeFrequency"
            ? datum.matchedRelativeFrequency ?? 0
            : datum.matchedCount
        ),
      },
      {
        key: "failed",
        label: "Fails thresholds",
        color: "#e11d48",
        values: data.map((datum) =>
          scale === "relativeFrequency"
            ? datum.failedRelativeFrequency ?? 0
            : datum.failedCount
        ),
      },
    ],
    thresholdMarkers: [],
    scale,
    maxValue:
      scale === "relativeFrequency"
        ? 1
        : Math.max(
            1,
            ...data.map((datum) => Math.max(datum.matchedCount, datum.failedCount))
          ),
    lineMode: "stepAfter",
    notes: [
      `Step-style comparison of matching and failing ${subjectLabelPlural} across the shared histogram bins.`,
    ],
    plotDataTables: [
      {
        label: "Comparison histogram bins",
        tableAttributes: `data-plot-data-table="comparison-histogram"`,
        headers: [
          "bin_key",
          "bin_label",
          "metric_label",
          "matched_count",
          "failed_count",
          "matched_relative_frequency",
          "failed_relative_frequency",
        ],
        rows: data.map((datum) => [
          datum.key,
          datum.label,
          datum.metricLabel,
          datum.matchedCount,
          datum.failedCount,
          datum.matchedRelativeFrequency,
          datum.failedRelativeFrequency,
        ]),
      },
    ],
  });
}

function renderClassificationFrequencyScatterChart({
  title,
  description,
  plot,
  scale,
}: {
  title: string;
  description: string;
  plot: AnalysisClassificationFrequencyPlot;
  scale: AnalysisDistributionComparisonScale;
}) {
  if (plot.cells.length === 0) {
    return `
      <div class="subsection chart-section">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
        ${renderEmptyState("No classifications available for this frequency plot.")}
      </div>
    `;
  }

  const xCount = Math.max(plot.xTickLabels.length, 1);
  const yCount = Math.max(plot.yTickLabels.length, 1);
  const needsAngledTicks = plot.xTickLabels.length > 10;
  const displayedXTicks = buildDisplayedXTicks(plot.xTickLabels);
  const width = calculateExportedChartWidth({
    xValueCount: plot.xTickLabels.length,
    displayedTickCount: displayedXTicks.length,
    minWidth: 900,
    maxWidth: 2400,
    perValueWidth: 16,
    perDisplayedTickWidth: needsAngledTicks ? 78 : 58,
    basePadding: 260,
  });
  const height = clampPlotHeightForAspectRatio(
    width,
    Math.max(420, plot.yTickLabels.length * 48 + 160)
  );
  const margin = {
    top: 54,
    right: 32,
    bottom: needsAngledTicks ? 112 : 78,
    left: 140,
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxBubbleValue =
    scale === "relativeFrequency"
      ? Math.max(plot.maxRelativeFrequency, 0.001)
      : Math.max(plot.maxCount, 1);
  const cellWidth = plotWidth / xCount;
  const cellHeight = plotHeight / yCount;
  const toXFromIndex = (index: number, offset = 0) =>
    margin.left + cellWidth * (index + 0.5 + offset);
  const toXFromPosition = (position: number) =>
    margin.left + ((position + 0.5) / xCount) * plotWidth;
  const toYFromIndex = (index: number) =>
    margin.top + plotHeight - cellHeight * (index + 0.5);
  const radiusFor = (value: number) =>
    value <= 0 ? 0 : 6 + Math.sqrt(value / maxBubbleValue) * 18;
  const markerMarkup = plot.thresholdMarkers
    .map((marker, index) => {
      const x = toXFromPosition(marker.xPosition);
      const labelY = margin.top - 18 - (index % 2) * 14;
      return `
        <line x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${(
          margin.top + plotHeight
        ).toFixed(2)}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6" />
        <text x="${x.toFixed(2)}" y="${labelY}" text-anchor="middle" class="chart-marker-label">${escapeHtml(
          marker.label
        )}</text>
      `;
    })
    .join("");
  const gridMarkup = Array.from({ length: xCount + 1 }, (_, index) => {
    const x = margin.left + index * cellWidth;
    return `<line x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${(
      margin.top + plotHeight
    ).toFixed(2)}" stroke="#e2e8f0" stroke-width="1" />`;
  }).join("");
  const horizontalGridMarkup = Array.from({ length: yCount + 1 }, (_, index) => {
    const y = margin.top + index * cellHeight;
    return `<line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(
      margin.left + plotWidth
    ).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e2e8f0" stroke-width="1" />`;
  }).join("");
  const bubbleMarkup = plot.cells
    .flatMap((cell) => {
      const matchedValue =
        scale === "relativeFrequency"
          ? cell.matchedRelativeFrequency ?? 0
          : cell.matchedCount;
      const failedValue =
        scale === "relativeFrequency"
          ? cell.failedRelativeFrequency ?? 0
          : cell.failedCount;
      const y = toYFromIndex(cell.yIndex);
      const entries: string[] = [];

      if (cell.matchedCount > 0) {
        entries.push(`
          <circle cx="${toXFromIndex(cell.xIndex, -0.16).toFixed(2)}" cy="${y.toFixed(
            2
          )}" r="${radiusFor(matchedValue).toFixed(2)}" fill="#059669" fill-opacity="0.72" stroke="#047857" stroke-width="1.5">
            <title>Matches thresholds | X bin: ${escapeHtml(cell.xLabel)} | Y bucket: ${escapeHtml(
              cell.yLabel
            )} | Count: ${cell.matchedCount.toLocaleString()} | ${escapeHtml(
              scale === "relativeFrequency"
                ? `Relative frequency: ${formatPercent(cell.matchedRelativeFrequency)}`
                : `Count: ${cell.matchedCount.toLocaleString()}`
            )}</title>
          </circle>
        `);
      }

      if (cell.failedCount > 0) {
        entries.push(`
          <circle cx="${toXFromIndex(cell.xIndex, 0.16).toFixed(2)}" cy="${y.toFixed(
            2
          )}" r="${radiusFor(failedValue).toFixed(2)}" fill="#e11d48" fill-opacity="0.58" stroke="#be123c" stroke-width="1.5">
            <title>Fails thresholds | X bin: ${escapeHtml(cell.xLabel)} | Y bucket: ${escapeHtml(
              cell.yLabel
            )} | Count: ${cell.failedCount.toLocaleString()} | ${escapeHtml(
              scale === "relativeFrequency"
                ? `Relative frequency: ${formatPercent(cell.failedRelativeFrequency)}`
                : `Count: ${cell.failedCount.toLocaleString()}`
            )}</title>
          </circle>
        `);
      }

      return entries;
    })
    .join("");
  const xTickMarkup = plot.xTickLabels
    .map((label, index) => {
      const x = toXFromIndex(index);
      const y = margin.top + plotHeight + 22;
      if (needsAngledTicks) {
        return `
          <text x="${x.toFixed(2)}" y="${y}" transform="rotate(-30 ${x.toFixed(
            2
          )} ${y})" text-anchor="end" class="chart-axis-tick">${escapeHtml(
            label
          )}</text>
        `;
      }
      return `<text x="${x.toFixed(2)}" y="${y}" text-anchor="middle" class="chart-axis-tick">${escapeHtml(
        label
      )}</text>`;
    })
    .join("");
  const yTickMarkup = plot.yTickLabels
    .map((label, index) => {
      const y = toYFromIndex(index) + 4;
      return `<text x="${(margin.left - 12).toFixed(2)}" y="${y.toFixed(
        2
      )}" text-anchor="end" class="chart-axis-tick">${escapeHtml(label)}</text>`;
    })
    .join("");

  return `
    <div class="subsection chart-section">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
      ${renderLegendPills([
        { label: "Matches thresholds", color: "#059669" },
        { label: "Fails thresholds", color: "#e11d48" },
      ])}
      <div class="chart-scroll">
        <svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
          title
        )}">
          <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="#fbfdff" stroke="#d7e0ec" />
          ${gridMarkup}
          ${horizontalGridMarkup}
          <line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(
            2
          )}" x2="${(margin.left + plotWidth).toFixed(2)}" y2="${(
            margin.top + plotHeight
          ).toFixed(2)}" stroke="#94a3b8" stroke-width="1.5" />
          <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(
            margin.top + plotHeight
          ).toFixed(2)}" stroke="#94a3b8" stroke-width="1.5" />
          ${markerMarkup}
          ${bubbleMarkup}
          ${xTickMarkup}
          ${yTickMarkup}
          <text x="${(margin.left + plotWidth / 2).toFixed(2)}" y="${(
            height - 18
          ).toFixed(2)}" text-anchor="middle" class="chart-axis-label">${escapeHtml(
            plot.xAxisLabel
          )}</text>
          <text x="24" y="${(margin.top + plotHeight / 2).toFixed(
            2
          )}" transform="rotate(-90 24 ${(margin.top + plotHeight / 2).toFixed(
            2
          )})" text-anchor="middle" class="chart-axis-label">${escapeHtml(
            plot.yAxisLabel
          )}</text>
        </svg>
      </div>
      ${renderChartNotes([
        `Bubble size uses ${
          scale === "relativeFrequency" ? "relative frequency" : "count"
        } per X/Y bin.`,
        plot.thresholdMarkers.length > 0
          ? `Split thresholds on the X axis are marked with vertical reference lines: ${plot.thresholdMarkers
              .map((marker) => marker.label)
              .join("; ")}.`
          : "",
        plot.note ?? "",
      ])}
      ${renderPlotDataToggle({
        title: "Show plotted data tables",
        tables: [
          {
            label: "Frequency plot cells",
            tableAttributes: `data-plot-data-table="classification-frequency-scatter-cells"`,
            headers: [
              "cell_key",
              "x_index",
              "x_label",
              "x_short_label",
              "y_index",
              "y_label",
              "total_count",
              "x_bin_total_count",
              "matched_count",
              "failed_count",
              "total_relative_frequency",
              "x_bin_relative_frequency",
              "matched_relative_frequency",
              "failed_relative_frequency",
            ],
            rows: plot.cells.map((cell) => [
              cell.key,
              cell.xIndex,
              cell.xLabel,
              cell.xShortLabel,
              cell.yIndex,
              cell.yLabel,
              cell.totalCount,
              cell.xBinTotalCount,
              cell.matchedCount,
              cell.failedCount,
              cell.totalRelativeFrequency,
              cell.xBinRelativeFrequency,
              cell.matchedRelativeFrequency,
              cell.failedRelativeFrequency,
            ]),
          },
          {
            label: "Threshold markers",
            tableAttributes: `data-plot-data-table="classification-frequency-scatter-threshold-markers"`,
            headers: ["marker_key", "x_position", "label"],
            rows: plot.thresholdMarkers.map((marker) => [
              marker.key,
              marker.xPosition,
              marker.label,
            ]),
          },
        ],
      })}
    </div>
  `;
}

function renderClassificationFrequencyLineChart({
  title,
  description,
  plot,
  scale,
}: {
  title: string;
  description: string;
  plot: AnalysisClassificationFrequencyPlot;
  scale: AnalysisDistributionComparisonScale;
}) {
  const lineColors = [
    "#2563eb",
    "#dc2626",
    "#059669",
    "#d97706",
    "#7c3aed",
    "#0891b2",
    "#be123c",
    "#4f46e5",
  ];

  const series = plot.yTickLabels.map((label, yIndex) => ({
    key: `series-${yIndex}`,
    label,
    color: lineColors[yIndex % lineColors.length],
    values: plot.xTickLabels.map((_, xIndex) => {
      const cell = plot.cells.find(
        (candidate) => candidate.xIndex === xIndex && candidate.yIndex === yIndex
      );
      return scale === "relativeFrequency"
        ? cell?.xBinRelativeFrequency ?? 0
        : cell?.totalCount ?? 0;
    }),
  }));

  return renderStandaloneLineChart({
    title,
    description,
    xTickLabels: plot.xTickLabels,
    xAxisLabel: plot.xAxisLabel,
    yAxisLabel:
      scale === "relativeFrequency" ? "Share within each X bin" : plot.yAxisLabel,
    series,
    thresholdMarkers: plot.thresholdMarkers,
    scale,
    maxValue: scale === "relativeFrequency" ? 1 : Math.max(plot.maxCount, 1),
    lineMode: "linear",
    notes: [
      `Line height uses ${
        scale === "relativeFrequency" ? "share within each X bin" : "count"
      } per X bin.`,
      plot.thresholdMarkers.length > 0
        ? `Split thresholds on the X axis are marked with vertical reference lines: ${plot.thresholdMarkers
            .map((marker) => marker.label)
            .join("; ")}.`
        : "",
      plot.note ?? "",
    ],
    plotDataTables: [
      {
        label: "Frequency line values by X bin",
        tableAttributes: `data-plot-data-table="classification-frequency-line-series"`,
        headers: [
          "x_index",
          "x_label",
          ...plot.yTickLabels.map((label) => `${label}__${scale}`),
        ],
        rows: plot.xTickLabels.map((xLabel, xIndex) => [
          xIndex,
          xLabel,
          ...plot.yTickLabels.map((_, yIndex) => {
            const cell = plot.cells.find(
              (candidate) => candidate.xIndex === xIndex && candidate.yIndex === yIndex
            );
            return scale === "relativeFrequency"
              ? cell?.xBinRelativeFrequency ?? 0
              : cell?.totalCount ?? 0;
          }),
        ]),
      },
      {
        label: "Threshold markers",
        tableAttributes: `data-plot-data-table="classification-frequency-line-threshold-markers"`,
        headers: ["marker_key", "x_position", "label"],
        rows: plot.thresholdMarkers.map((marker) => [
          marker.key,
          marker.xPosition,
          marker.label,
        ]),
      },
    ],
  });
}

function renderClassificationCountLineChart({
  title,
  description,
  plot,
  scale,
}: {
  title: string;
  description: string;
  plot: AnalysisClassificationCountLinePlot;
  scale: AnalysisDistributionComparisonScale;
}) {
  const hasFailedSeries = plot.bins.some((bin) => bin.failedCount > 0);
  const showScopedSeries =
    !hasFailedSeries && plot.bins.every((bin) => bin.matchedCount === bin.scopedCount);
  const series = showScopedSeries
    ? [
        {
          key: "scoped",
          label: "Scoped classifications",
          color: "#2563eb",
          values: plot.bins.map((bin) =>
            scale === "relativeFrequency"
              ? bin.scopedRelativeFrequency ?? 0
              : bin.scopedCount
          ),
        },
      ]
    : [
        {
          key: "matched",
          label: "Matches thresholds",
          color: "#059669",
          values: plot.bins.map((bin) =>
            scale === "relativeFrequency"
              ? bin.matchedRelativeFrequency ?? 0
              : bin.matchedCount
          ),
        },
        ...(hasFailedSeries
          ? [
              {
                key: "failed",
                label: "Fails thresholds",
                color: "#dc2626",
                values: plot.bins.map((bin) =>
                  scale === "relativeFrequency"
                    ? bin.failedRelativeFrequency ?? 0
                    : bin.failedCount
                ),
              },
            ]
          : []),
      ];

  return renderStandaloneLineChart({
    title,
    description,
    xTickLabels: plot.xTickLabels,
    xAxisLabel: plot.xAxisLabel,
    yAxisLabel:
      scale === "relativeFrequency" ? "Share within subset" : plot.yAxisLabel,
    series,
    thresholdMarkers: plot.thresholdMarkers,
    scale,
    maxValue: scale === "relativeFrequency" ? 1 : Math.max(plot.maxCount, 1),
    lineMode: "linear",
    notes: [
      `Line height uses ${
        scale === "relativeFrequency"
          ? "share across each subset over time"
          : "classification count per X bin"
      }.`,
      plot.thresholdMarkers.length > 0
        ? `Split thresholds on the X axis are marked with vertical reference lines: ${plot.thresholdMarkers
            .map((marker) => marker.label)
            .join("; ")}.`
        : "",
      plot.note ?? "",
    ],
    plotDataTables: [
      {
        label: "Count line values by X bin",
        tableAttributes: `data-plot-data-table="classification-count-line-series"`,
        headers: [
          "bin_key",
          "x_index",
          "x_label",
          "x_short_label",
          "scoped_count",
          "matched_count",
          "failed_count",
          "scoped_relative_frequency",
          "matched_relative_frequency",
          "failed_relative_frequency",
        ],
        rows: plot.bins.map((bin) => [
          bin.key,
          bin.xIndex,
          bin.xLabel,
          bin.xShortLabel,
          bin.scopedCount,
          bin.matchedCount,
          bin.failedCount,
          bin.scopedRelativeFrequency,
          bin.matchedRelativeFrequency,
          bin.failedRelativeFrequency,
        ]),
      },
      {
        label: "Threshold markers",
        tableAttributes: `data-plot-data-table="classification-count-line-threshold-markers"`,
        headers: ["marker_key", "x_position", "label"],
        rows: plot.thresholdMarkers.map((marker) => [
          marker.key,
          marker.xPosition,
          marker.label,
        ]),
      },
    ],
  });
}

function renderGalaxySubsetPreviewTable({
  title,
  description,
  records,
}: {
  title: string;
  description: string;
  records: Array<ReturnType<typeof buildPreviewRecord>>;
}) {
  const content =
    records.length > 0
      ? `
        <div class="table-wrap">
          <table class="data-table preview-table">
            <thead>
              <tr>
                <th scope="col">Preview</th>
                <th scope="col">Galaxy</th>
                <th scope="col">Paper</th>
                <th scope="col">Created</th>
                <th scope="col">Classifications</th>
                <th scope="col">Comments</th>
                <th scope="col">Is-LSB agreement</th>
                <th scope="col">Morphology agreement</th>
                <th scope="col">Awesome</th>
                <th scope="col">Failed fitting yes</th>
                <th scope="col">Nucleus confirmation</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>
                        <img
                          class="preview-image"
                          src="${escapeHtml(record.previewImageUrl)}"
                          alt="Preview of galaxy ${escapeHtml(record.galaxyId)}"
                          loading="lazy"
                        />
                      </td>
                      <th scope="row">${escapeHtml(
                        record.galaxyNumericId === null
                          ? record.galaxyId
                          : `${record.galaxyId} (#${record.galaxyNumericId.toLocaleString()})`
                      )}</th>
                      <td>${escapeHtml(record.paperLabel)}</td>
                      <td>${escapeHtml(record.galaxyCreationTimeLabel)}</td>
                      <td>${escapeHtml(record.totalClassifications.toLocaleString())}</td>
                      <td>${escapeHtml(record.commentedClassifications.toLocaleString())}</td>
                      <td>${escapeHtml(formatAgreementSummary(record.dominantLsb))}</td>
                      <td>${escapeHtml(formatAgreementSummary(record.dominantMorphology))}</td>
                      <td>${escapeHtml(record.awesomeVotes.toLocaleString())}</td>
                      <td>${escapeHtml(
                        formatAnsweredVoteSummary(
                          record.failedFittingVotes,
                          record.failedFittingComparableVotes
                        )
                      )}</td>
                      <td>${escapeHtml(formatPercent(record.nucleusConfirmationRate))}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : renderEmptyState(`No galaxies in the ${title.toLowerCase()} preview.`);

  return `
    <section class="preview-card">
      <div class="preview-card-header">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
      </div>
      ${content}
    </section>
  `;
}

function renderClassificationSubsetPreviewTable({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points: Array<ReturnType<typeof buildClassificationPreviewPoint>>;
}) {
  const content =
    points.length > 0
      ? `
        <div class="table-wrap">
          <table class="data-table preview-table">
            <thead>
              <tr>
                <th scope="col">Created</th>
                <th scope="col">User</th>
                <th scope="col">Galaxy</th>
                <th scope="col">Failed fitting</th>
                <th scope="col">Visible nucleus</th>
                <th scope="col">Awesome</th>
                <th scope="col">Valid z</th>
                <th scope="col">Comment</th>
              </tr>
            </thead>
            <tbody>
              ${points
                .map(
                  (point) => `
                    <tr>
                      <td>${escapeHtml(point.createdAtLabel)}</td>
                      <td>${escapeHtml(point.userDisplayName)}</td>
                      <td>${escapeHtml(
                        point.galaxyNumericId === null
                          ? point.galaxyId
                          : `${point.galaxyId} (#${point.galaxyNumericId.toLocaleString()})`
                      )}</td>
                      <td>${escapeHtml(formatBooleanValue(point.failedFitting))}</td>
                      <td>${escapeHtml(formatBooleanValue(point.visibleNucleus))}</td>
                      <td>${point.awesome ? "Yes" : "No"}</td>
                      <td>${point.validRedshift ? "Yes" : "No"}</td>
                      <td>${
                        point.commentPreview === null
                          ? '<span class="muted-inline">-</span>'
                          : `<span title="${escapeHtml(point.comment ?? "")}">${escapeHtml(
                              point.commentPreview
                            )}</span>`
                      }</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : renderEmptyState(`No classifications in the ${title.toLowerCase()} preview.`);

  return `
    <section class="preview-card">
      <div class="preview-card-header">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
      </div>
      ${content}
    </section>
  `;
}

function renderHistogram(section: ReportHistogramSection) {
  const maxDisplayCount = Math.max(1, ...section.displayBins.map((bin) => bin.count));
  const totalAllBins = section.allBins.reduce((sum, bin) => sum + bin.count, 0);

  const displayMarkup =
    section.displayBins.length > 0
      ? `
        <div class="histogram-bars" data-histogram-id="${escapeHtml(section.id)}">
          ${section.displayBins
            .map((bin) => {
              const widthPercent = (bin.count / maxDisplayCount) * 100;
              return `
                <div
                  class="histogram-row"
                  data-bin-key="${escapeHtml(bin.key)}"
                  data-bin-label="${escapeHtml(bin.label)}"
                  data-bin-count="${escapeHtml(bin.count)}"
                >
                  <div class="histogram-label">${escapeHtml(bin.label)}</div>
                  <div class="histogram-track">
                    <div class="histogram-fill" style="width: ${widthPercent.toFixed(2)}%"></div>
                  </div>
                  <div class="histogram-count">${escapeHtml(bin.count.toLocaleString())}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      `
      : '<p class="empty-state">No matching galaxies for this histogram.</p>';

  return `
    <article class="section-card" data-histogram-section="${escapeHtml(section.id)}">
      <div class="section-header">
        <div>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.description)}</p>
        </div>
        ${section.zeroBucketHidden ? '<div class="section-note">Zero bucket hidden in plotted view</div>' : ""}
      </div>
      ${displayMarkup}
      <div class="table-wrap">
        <table class="data-table histogram-table" data-histogram-id="${escapeHtml(section.id)}">
          <thead>
            <tr>
              <th scope="col">Bin</th>
              <th scope="col">Count</th>
              <th scope="col">Share</th>
              <th scope="col">Hidden from plotted view</th>
            </tr>
          </thead>
          <tbody>
            ${section.allBins
              .map((bin) => {
                const share = totalAllBins > 0 ? bin.count / totalAllBins : 0;
                const hidden = section.zeroBucketHidden && bin.label === "0";
                return `
                  <tr
                    data-bin-key="${escapeHtml(bin.key)}"
                    data-bin-label="${escapeHtml(bin.label)}"
                    data-bin-count="${escapeHtml(bin.count)}"
                    data-hidden-from-chart="${hidden ? "true" : "false"}"
                  >
                    <th scope="row">${escapeHtml(bin.label)}</th>
                    <td>${escapeHtml(bin.count.toLocaleString())}</td>
                    <td>${escapeHtml(formatPercent(share))}</td>
                    <td>${hidden ? "Yes" : "No"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderReportNavigation(reportData: AnalysisReportData) {
  return `
    <nav class="report-nav" aria-label="Report navigation">
      <div class="report-nav-header">
        <h2>Navigate report</h2>
        <p>Jump directly to the dataset summary, global histograms, threshold-split distributions, or any exported query card.</p>
      </div>
      <div class="report-nav-grid">
        <section class="report-nav-group">
          <h3>Sections</h3>
          <div class="report-nav-links">
            <a href="#dataset-overview">Dataset overview</a>
            <a href="#dataset-stats">Loaded dataset statistics</a>
            <a href="#global-histograms">Global histograms</a>
            <a href="#queries">Query cards</a>
            <a href="#distribution-comparisons">Galaxy threshold-split distributions</a>
            <a href="#classification-distribution-comparisons">Classification threshold-split distributions</a>
          </div>
        </section>
        <section class="report-nav-group">
          <h3>Queries</h3>
          <div class="report-nav-links">
            ${reportData.queries
              .map(
                (query) =>
                  `<a href="#query-${escapeHtml(query.id)}">${escapeHtml(query.name)}</a>`
              )
              .join("")}
          </div>
        </section>
        <section class="report-nav-group">
          <h3>Distribution splits</h3>
          <div class="report-nav-links">
            ${reportData.distributionComparisons
              .map(
                (comparison) =>
                  `<a href="#comparison-${escapeHtml(comparison.id)}">${escapeHtml(comparison.name)}</a>`
              )
              .join("")}
          </div>
        </section>
        <section class="report-nav-group">
          <h3>Classification splits</h3>
          <div class="report-nav-links">
            ${reportData.classificationDistributionComparisons
              .map(
                (comparison) =>
                  `<a href="#classification-comparison-${escapeHtml(comparison.id)}">${escapeHtml(comparison.name)}</a>`
              )
              .join("")}
          </div>
        </section>
      </div>
    </nav>
  `;
}

function buildStatsOnlyExport(reportData: AnalysisReportData) {
  return reportData;
}

function buildConditionExport(condition: AnalysisQueryCondition) {
  return {
    metric: condition.metric,
    metricLabel: getConditionMetricLabel(condition.metric),
    operator: condition.operator,
    operatorLabel: QUERY_OPERATOR_LABELS[condition.operator],
    thresholdValue: condition.count,
    thresholdDisplay: formatConditionThreshold(condition.metric, condition.count),
  };
}

function buildClassificationConditionExport(
  condition: AnalysisClassificationComparisonCondition
) {
  return {
    metric: condition.metric,
    metricLabel: getClassificationConditionMetricLabel(condition.metric),
    operator: condition.operator,
    operatorLabel: QUERY_OPERATOR_LABELS[condition.operator],
    thresholdValue: condition.count,
    thresholdDisplay: formatClassificationConditionThreshold(
      condition.metric,
      condition.count
    ),
  };
}

function buildReportData({
  summary,
  dataset,
  queries,
  comparisons,
  classificationComparisons,
  hideZeroBuckets,
  imageQuality,
  userDisplayNames,
  generatedAt,
}: ExportInput) {
  const fullGlobalHistograms = buildGlobalSummaryHistograms(dataset.records);
  const globalHistograms: ReportHistogramSection[] = GLOBAL_HISTOGRAM_SECTIONS.map(
    (section) => {
      const allBins = fullGlobalHistograms[section.id];
      const zeroBucketHidden =
        section.id === "awesomeVotes"
          ? hideZeroBuckets.awesomeVotes
          : section.id === "visibleNucleusAgreementCount"
            ? hideZeroBuckets.visibleNucleusAgreementCount
            : section.id === "failedFittingVotes"
              ? hideZeroBuckets.failedFittingVotes
              : false;

      return {
        id: section.id,
        title: section.title,
        description: section.description,
        allBins,
        displayBins: filterZeroCountHistogram(allBins, zeroBucketHidden),
        zeroBucketHidden,
      };
    }
  );

  const querySections = queries.map((query) => {
    const result = evaluateAnalysisQuery(dataset.records, query);
    return {
      id: query.id,
      name: query.name || "Untitled query",
      description: query.description.trim() || "No description added yet.",
      config: {
        paper:
          query.paper === "__any__" ? "All papers" : formatPaperLabel(query.paper),
        catalogNucleus: CATALOG_NUCLEUS_LABELS[query.catalogNucleus],
        dominantLsb: DOMINANT_LSB_LABELS[query.dominantLsb],
        sortBy: getMetricLabel(query.sortBy),
        sortDirection: query.sortDirection === "desc" ? "Highest first" : "Lowest first",
        histogramMetric: getMetricLabel(query.histogramMetric),
        previewLimit: query.previewLimit,
        conditions: query.conditions.map(buildConditionExport),
        commentRules: query.commentRules.map((rule) => ({
          mode:
            rule.mode === "containsAny"
              ? "Contains any term"
              : "Does not contain any term",
          terms: rule.terms,
        })),
      },
      summary: {
        matchedCount: result.matchedCount,
        totalMatchingClassifications: result.totalMatchingClassifications,
        totalMatchingCommentedClassifications:
          result.totalMatchingCommentedClassifications,
        averageMatchingCommentLength: result.averageMatchingCommentLength,
        maxMatchingCommentLength: result.maxMatchingCommentLength,
        averageLsbAgreementRate: result.averageLsbAgreementRate,
        averageMorphologyAgreementRate: result.averageMorphologyAgreementRate,
        averageVisibleNucleusAgreementRate: result.averageVisibleNucleusAgreementRate,
        averageFailedFittingAgreementRate: result.averageFailedFittingAgreementRate,
        dominantLsbBreakdown: result.dominantLsbBreakdown,
      },
      histogram: {
        id: `query-${query.id}-histogram`,
        title: query.name || "Untitled query",
        description: `Histogram metric: ${getMetricLabel(query.histogramMetric)}`,
        displayBins: result.histogram,
        allBins: result.histogram,
        zeroBucketHidden: false,
      },
      topMatches: result.previewRecords.map((record) =>
        buildPreviewRecord(record, imageQuality)
      ),
    };
  });

  const comparisonSections = comparisons.map((comparison) => {
    const result = evaluateAnalysisDistributionComparison(dataset.records, comparison);
    return {
      id: comparison.id,
      name: comparison.name || "Untitled distribution split",
      description: comparison.description.trim() || "No description added yet.",
      config: {
        paper:
          comparison.paper === "__any__"
            ? "All papers"
            : formatPaperLabel(comparison.paper),
        catalogNucleus: CATALOG_NUCLEUS_LABELS[comparison.catalogNucleus],
        dominantLsb: DOMINANT_LSB_LABELS[comparison.dominantLsb],
        scopeConditions: comparison.scopeConditions.map(buildConditionExport),
        histogramMetricKey: comparison.histogramMetric,
        histogramMetric: getMetricLabel(comparison.histogramMetric),
        histogramScaleKey: comparison.histogramScale,
        histogramScale: getDistributionScaleLabel(comparison.histogramScale),
        conditions: comparison.conditions.map(buildConditionExport),
      },
      summary: {
        scopedCount: result.scopedCount,
        matchedCount: result.matchedCount,
        failedCount: result.failedCount,
        matchedStats: result.matchedStats,
        failedStats: result.failedStats,
      },
      matchedPreviewRecords: result.matchedPreviewRecords.map((record) =>
        buildPreviewRecord(record, imageQuality)
      ),
      failedPreviewRecords: result.failedPreviewRecords.map((record) =>
        buildPreviewRecord(record, imageQuality)
      ),
      comparisonHistogram: buildComparisonHistogramData(
        result.scopedHistogram,
        result.matchedHistogram,
        result.failedHistogram
      ),
    };
  });

  const classificationComparisonSections = classificationComparisons.map(
    (comparison) => {
      const result = evaluateAnalysisClassificationDistributionComparison(
        dataset.records,
        comparison
      );
      return {
        id: comparison.id,
        name: comparison.name || "Untitled classification distribution split",
        description: comparison.description.trim() || "No description added yet.",
        config: {
          paper:
            comparison.paper === "__any__"
              ? "All papers"
              : formatPaperLabel(comparison.paper),
          catalogNucleus: CATALOG_NUCLEUS_LABELS[comparison.catalogNucleus],
          dominantLsb: DOMINANT_LSB_LABELS[comparison.dominantLsb],
          scopeConditions: comparison.scopeConditions.map(
            buildClassificationConditionExport
          ),
          plotTypeKey: comparison.plotType,
          plotType: getClassificationComparisonPlotTypeLabel(comparison.plotType),
          plotXAxisMetricKey: comparison.plotXAxisMetric,
          plotXAxisMetric: getClassificationConditionMetricLabel(
            comparison.plotXAxisMetric
          ),
          plotXAxisBinningMode: comparison.plotXAxisBinningMode,
          plotXAxisBinningModeLabel:
            comparison.plotXAxisBinningMode === "pointsPerBin"
              ? "Values per point"
              : comparison.plotXAxisBinningMode === "timeInterval"
                ? "Days per bin"
                : "Total bins",
          plotXAxisBinCount: comparison.plotXAxisBinCount,
          plotXAxisPointsPerBin: comparison.plotXAxisPointsPerBin,
          plotXAxisTimeBinDays: comparison.plotXAxisTimeBinDays,
          histogramMetricKey: comparison.histogramMetric,
          histogramMetric: getClassificationMetricLabel(comparison.histogramMetric),
          histogramScaleKey: comparison.histogramScale,
          histogramScale: getDistributionScaleLabel(comparison.histogramScale),
          conditions: comparison.conditions.map(buildClassificationConditionExport),
        },
        summary: {
          scopedCount: result.scopedCount,
          matchedCount: result.matchedCount,
          failedCount: result.failedCount,
          matchedStats: result.matchedStats,
          failedStats: result.failedStats,
        },
        matchedPreviewPoints: result.matchedPreviewPoints.map((point) =>
          buildClassificationPreviewPoint(point, userDisplayNames)
        ),
        failedPreviewPoints: result.failedPreviewPoints.map((point) =>
          buildClassificationPreviewPoint(point, userDisplayNames)
        ),
        comparisonHistogram: buildComparisonHistogramData(
          result.scopedHistogram,
          result.matchedHistogram,
          result.failedHistogram
        ),
        frequencyPlot: result.frequencyPlot,
        countLinePlot: result.countLinePlot,
      };
    }
  );

  return {
    reportType: "classification-analysis",
    reportVersion: 11,
    generatedAtIso: generatedAt.toISOString(),
    generatedAtLabel: generatedAt.toLocaleString(),
    datasetLoadedAtIso: new Date(dataset.loadedAt).toISOString(),
    datasetLoadedAtLabel: formatLoadedAt(dataset.loadedAt) ?? "-",
    datasetSummary: summary,
    datasetStats: {
      loadedGalaxyRecords: dataset.records.length,
      classifiedGalaxyCount: dataset.classifiedGalaxyCount,
      classifiedGalaxyPercent:
        summary.totalGalaxies > 0
          ? dataset.classifiedGalaxyCount / summary.totalGalaxies
          : null,
      unclassifiedGalaxyCount: Math.max(
        summary.totalGalaxies - dataset.classifiedGalaxyCount,
        0
      ),
      maxClassificationsPerGalaxy: dataset.maxClassificationsPerGalaxy,
      totalAwesomeVotes: dataset.totalAwesomeVotes,
      totalVisibleNucleusVotes: dataset.totalVisibleNucleusVotes,
      totalFailedFittingVotes: dataset.totalFailedFittingVotes,
      totalCommentedClassifications: dataset.totalCommentedClassifications,
      averageCommentLength: dataset.averageCommentLength,
      maxCommentLength: dataset.maxCommentLength,
      orphanedGalaxyCount: dataset.orphanedGalaxyCount,
      orphanedClassificationCount: dataset.orphanedClassificationCount,
    },
    globalHistograms,
    distributionComparisons: comparisonSections,
    classificationDistributionComparisons: classificationComparisonSections,
    queries: querySections,
  };
}

function renderQueryCard(query: ReturnType<typeof buildReportData>["queries"][number]) {
  const topMatchesMarkup =
    query.topMatches.length > 0
      ? `
        <div class="table-wrap">
          <table class="data-table" data-query-top-matches="${escapeHtml(query.id)}">
            <thead>
              <tr>
                <th scope="col">Preview</th>
                <th scope="col">Galaxy</th>
                <th scope="col">Paper</th>
                <th scope="col">Galaxy created</th>
                <th scope="col">Catalog nucleus</th>
                <th scope="col">Dominant Is-LSB</th>
                <th scope="col">Dominant morphology</th>
                <th scope="col">Classifications</th>
                <th scope="col">Comments</th>
                <th scope="col">Avg comment length</th>
                <th scope="col">Max comment length</th>
                <th scope="col">Is-LSB agreement</th>
                <th scope="col">Morphology agreement</th>
                <th scope="col">Visible nucleus agreement</th>
                <th scope="col">Awesome votes</th>
                <th scope="col">Failed fitting yes</th>
                <th scope="col">Nucleus confirmation</th>
                <th scope="col">RA</th>
                <th scope="col">Dec</th>
                <th scope="col">Reff</th>
                <th scope="col">q</th>
                <th scope="col">Mag</th>
                <th scope="col">mu0</th>
                <th scope="col">First 5 LSB votes</th>
                <th scope="col">First 5 morphology votes</th>
              </tr>
            </thead>
            <tbody>
              ${query.topMatches
                .map(
                  (record) => `
                    <tr data-galaxy-id="${escapeHtml(record.galaxyId)}">
                      <td>
                        <img
                          class="preview-image"
                          src="${escapeHtml(record.previewImageUrl)}"
                          alt="Preview of galaxy ${escapeHtml(record.galaxyId)}"
                          loading="lazy"
                        />
                      </td>
                      <th scope="row">${escapeHtml(
                        record.numericId === null
                          ? record.galaxyId
                          : `${record.galaxyId} (#${record.numericId.toLocaleString()})`
                      )}</th>
                      <td>${escapeHtml(record.paperLabel)}</td>
                      <td>${escapeHtml(record.galaxyCreationTimeLabel)}</td>
                      <td>${record.catalogNucleus ? "Yes" : "No"}</td>
                      <td>${escapeHtml(record.dominantLsb.label)}</td>
                      <td>${escapeHtml(record.dominantMorphology.label)}</td>
                      <td>${escapeHtml(record.totalClassifications.toLocaleString())}</td>
                      <td>${escapeHtml(record.commentedClassifications.toLocaleString())}</td>
                      <td>${escapeHtml(formatFixed(record.averageCommentLength, 1))}</td>
                      <td>${escapeHtml(record.maxCommentLength.toLocaleString())}</td>
                      <td>${escapeHtml(formatAgreementSummary(record.dominantLsb))}</td>
                      <td>${escapeHtml(formatAgreementSummary(record.dominantMorphology))}</td>
                      <td>${escapeHtml(formatAgreementSummary(record.visibleNucleus))}</td>
                      <td>${escapeHtml(record.awesomeVotes.toLocaleString())}</td>
                      <td>${escapeHtml(
                        formatAnsweredVoteSummary(
                          record.failedFittingVotes,
                          record.failedFittingComparableVotes
                        )
                      )}</td>
                      <td>${escapeHtml(formatPercent(record.nucleusConfirmationRate))}</td>
                      <td>${escapeHtml(formatFixed(record.ra, 4))}</td>
                      <td>${escapeHtml(formatFixed(record.dec, 4))}</td>
                      <td>${escapeHtml(formatFixed(record.reff, 2))}</td>
                      <td>${escapeHtml(formatFixed(record.q, 3))}</td>
                      <td>${escapeHtml(formatFixed(record.mag, 2))}</td>
                      <td>${escapeHtml(formatFixed(record.meanMue, 2))}</td>
                      <td>${escapeHtml(record.lsbVotePreview.join(" | ") || "-")}</td>
                      <td>${escapeHtml(record.morphologyVotePreview.join(" | ") || "-")}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : '<p class="empty-state">No galaxies matched this query.</p>';

  return `
    <article id="query-${escapeHtml(query.id)}" class="query-card" data-query-id="${escapeHtml(query.id)}">
      <header class="query-header">
        <div>
          <h3>${escapeHtml(query.name)}</h3>
          <p>${escapeHtml(query.description)}</p>
        </div>
        <div class="query-badge">${escapeHtml(query.summary.matchedCount.toLocaleString())} matches</div>
      </header>

      <div class="table-wrap">
        <table class="meta-table" data-query-config="${escapeHtml(query.id)}">
          <tbody>
            <tr>
              <th scope="row">Paper filter</th>
              <td>${escapeHtml(query.config.paper)}</td>
            </tr>
            <tr>
              <th scope="row">Catalog nucleus filter</th>
              <td>${escapeHtml(query.config.catalogNucleus)}</td>
            </tr>
            <tr>
              <th scope="row">Dominant Is-LSB filter</th>
              <td>${escapeHtml(query.config.dominantLsb)}</td>
            </tr>
            <tr>
              <th scope="row">Sort metric</th>
              <td>${escapeHtml(query.config.sortBy)} (${escapeHtml(query.config.sortDirection)})</td>
            </tr>
            <tr>
              <th scope="row">Histogram metric</th>
              <td>${escapeHtml(query.config.histogramMetric)}</td>
            </tr>
            <tr>
              <th scope="row">Preview rows</th>
              <td>${escapeHtml(query.config.previewLimit.toLocaleString())}</td>
            </tr>
            <tr>
              <th scope="row">Conditions</th>
              <td>${escapeHtml(
                query.config.conditions
                  .map(
                    (condition) =>
                      `${condition.metricLabel} ${condition.operatorLabel.toLowerCase()} ${condition.thresholdDisplay}`
                  )
                  .join("; ")
              )}</td>
            </tr>
            <tr>
              <th scope="row">Comment rules</th>
              <td>${escapeHtml(
                query.config.commentRules.length > 0
                  ? query.config.commentRules
                      .map((rule) => `${rule.mode}: ${rule.terms}`)
                      .join("; ")
                  : "None"
              )}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${renderStatCards([
        {
          key: `${query.id}-matchedCount`,
          label: "Matching galaxies",
          value: query.summary.matchedCount.toLocaleString(),
          detail: "Galaxies in the loaded dataset matching every filter on this card.",
        },
        {
          key: `${query.id}-classifications`,
          label: "Total classifications in matches",
          value: query.summary.totalMatchingClassifications.toLocaleString(),
          detail: "Summed classifications across all currently matching galaxies.",
        },
        {
          key: `${query.id}-commentedClassifications`,
          label: "Commented classifications",
          value: query.summary.totalMatchingCommentedClassifications.toLocaleString(),
          detail: "Non-empty written comments submitted inside the matching set.",
        },
        {
          key: `${query.id}-averageCommentLength`,
          label: "Avg comment length",
          value: formatFixed(query.summary.averageMatchingCommentLength, 1),
          detail: "Average comment length across non-empty comments in the matching set.",
        },
        {
          key: `${query.id}-maxCommentLength`,
          label: "Max comment length",
          value: query.summary.maxMatchingCommentLength.toLocaleString(),
          detail: "Longest single comment found among the current matches.",
        },
        {
          key: `${query.id}-lsbAgreement`,
          label: "Avg Is-LSB agreement",
          value: formatPercent(query.summary.averageLsbAgreementRate),
          detail: "Average dominant-branch agreement rate for the Is-LSB question.",
        },
        {
          key: `${query.id}-morphAgreement`,
          label: "Avg morphology agreement",
          value: formatPercent(query.summary.averageMorphologyAgreementRate),
          detail: "Average morphology agreement rate across the matching galaxies.",
        },
        {
          key: `${query.id}-visibleAgreement`,
          label: "Avg visible-nucleus agreement",
          value: formatPercent(query.summary.averageVisibleNucleusAgreementRate),
          detail: "Average visible-nucleus agreement rate across the matching galaxies.",
        },
        {
          key: `${query.id}-failedAgreement`,
          label: "Avg failed-fitting agreement",
          value: formatPercent(query.summary.averageFailedFittingAgreementRate),
          detail: "Average failed-fitting agreement rate across the matching galaxies.",
        },
      ])}

      <div class="table-wrap">
        <table class="data-table" data-query-breakdown="${escapeHtml(query.id)}">
          <thead>
            <tr>
              <th scope="col">Dominant Is-LSB outcome</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">LSB</th><td>${escapeHtml(query.summary.dominantLsbBreakdown.lsb.toLocaleString())}</td></tr>
            <tr><th scope="row">Non-LSB</th><td>${escapeHtml(query.summary.dominantLsbBreakdown.nonLsb.toLocaleString())}</td></tr>
            <tr><th scope="row">Split</th><td>${escapeHtml(query.summary.dominantLsbBreakdown.split.toLocaleString())}</td></tr>
            <tr><th scope="row">No comparable votes</th><td>${escapeHtml(query.summary.dominantLsbBreakdown.noComparableVotes.toLocaleString())}</td></tr>
          </tbody>
        </table>
      </div>

      ${renderHistogram(query.histogram)}

      <div class="subsection">
        <h4>Top matches</h4>
        <p>Showing up to ${escapeHtml(query.config.previewLimit.toLocaleString())} galaxies ranked by ${escapeHtml(query.config.sortBy.toLowerCase())}.</p>
        ${topMatchesMarkup}
      </div>
    </article>
  `;
}

function renderDistributionComparisonCard(
  comparison: ReturnType<typeof buildReportData>["distributionComparisons"][number]
) {
  return `
    <article id="comparison-${escapeHtml(comparison.id)}" class="query-card" data-comparison-id="${escapeHtml(comparison.id)}">
      <header class="query-header">
        <div>
          <h3>${escapeHtml(comparison.name)}</h3>
          <p>${escapeHtml(comparison.description)}</p>
        </div>
        <div class="query-badge">${escapeHtml(comparison.summary.scopedCount.toLocaleString())} scoped</div>
      </header>

      <div class="table-wrap">
        <table class="meta-table" data-comparison-config="${escapeHtml(comparison.id)}">
          <tbody>
            <tr>
              <th scope="row">Paper filter</th>
              <td>${escapeHtml(comparison.config.paper)}</td>
            </tr>
            <tr>
              <th scope="row">Catalog nucleus filter</th>
              <td>${escapeHtml(comparison.config.catalogNucleus)}</td>
            </tr>
            <tr>
              <th scope="row">Dominant Is-LSB filter</th>
              <td>${escapeHtml(comparison.config.dominantLsb)}</td>
            </tr>
            <tr>
              <th scope="row">Histogram metric</th>
              <td>${escapeHtml(comparison.config.histogramMetric)}</td>
            </tr>
            <tr>
              <th scope="row">Histogram scale</th>
              <td>${escapeHtml(comparison.config.histogramScale)}</td>
            </tr>
            <tr>
              <th scope="row">Scope thresholds</th>
              <td>${escapeHtml(
                comparison.config.scopeConditions.length > 0
                  ? comparison.config.scopeConditions
                      .map(
                        (condition) =>
                          `${condition.metricLabel} ${condition.operatorLabel.toLowerCase()} ${condition.thresholdDisplay}`
                      )
                      .join("; ")
                  : "None"
              )}</td>
            </tr>
            <tr>
              <th scope="row">Split thresholds</th>
              <td>${escapeHtml(
                comparison.config.conditions
                  .map(
                    (condition) =>
                      `${condition.metricLabel} ${condition.operatorLabel.toLowerCase()} ${condition.thresholdDisplay}`
                  )
                  .join("; ")
              )}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${renderStatCards([
        {
          key: `${comparison.id}-scopedCount`,
          label: "Scoped galaxies",
          value: comparison.summary.scopedCount.toLocaleString(),
          detail: "Galaxies remaining after the paper, catalog nucleus, dominant Is-LSB, and scope-threshold filters.",
        },
        {
          key: `${comparison.id}-matchedCount`,
          label: "Matching subset",
          value: comparison.summary.matchedCount.toLocaleString(),
          detail: "Galaxies in scope that satisfy every split threshold on this card.",
        },
        {
          key: `${comparison.id}-matchedShareOfScope`,
          label: "Matching share of scope",
          value: formatPercent(comparison.summary.matchedStats.shareOfScope),
          detail: "Share of scoped galaxies that satisfy every threshold on this card.",
        },
        {
          key: `${comparison.id}-failedCount`,
          label: "Failing subset",
          value: comparison.summary.failedCount.toLocaleString(),
          detail: "Galaxies in the same filtered scope that miss one or more split thresholds.",
        },
        {
          key: `${comparison.id}-failedShareOfScope`,
          label: "Failing share of scope",
          value: formatPercent(comparison.summary.failedStats.shareOfScope),
          detail: "Share of scoped galaxies that miss at least one threshold on this card.",
        },
      ])}

      ${renderComparisonStepChart({
        title: "Combined distribution comparison",
        description: `Step-style comparison of ${comparison.config.histogramMetric.toLowerCase()} for galaxies that pass versus fail the thresholds, shown as ${comparison.config.histogramScale.toLowerCase()}.`,
        data: comparison.comparisonHistogram,
        scale: comparison.config.histogramScaleKey,
        subjectLabelPlural: "galaxies",
      })}

      <div class="subset-grid">
        ${renderSubsetStatsCard({
          title: "Matches thresholds",
          tone: "match",
          description:
            "Summary statistics for the selected histogram metric inside the matching subset.",
          subjectLabel: "Galaxies",
          metricLabel: comparison.config.histogramMetric,
          stats: comparison.summary.matchedStats,
          formatMetric: (value) =>
            formatMetricValueRaw(comparison.config.histogramMetricKey, value),
        })}
        ${renderSubsetStatsCard({
          title: "Fails thresholds",
          tone: "fail",
          description:
            "Summary statistics for the selected histogram metric inside the failing subset.",
          subjectLabel: "Galaxies",
          metricLabel: comparison.config.histogramMetric,
          stats: comparison.summary.failedStats,
          formatMetric: (value) =>
            formatMetricValueRaw(comparison.config.histogramMetricKey, value),
        })}
      </div>

      <div class="preview-grid">
        ${renderGalaxySubsetPreviewTable({
          title: "Matching galaxies",
          description: `Showing the exported preview rows ranked by ${comparison.config.histogramMetric.toLowerCase()} inside the subset that passes the thresholds.`,
          records: comparison.matchedPreviewRecords,
        })}
        ${renderGalaxySubsetPreviewTable({
          title: "Failing galaxies",
          description: `Showing the exported preview rows ranked by ${comparison.config.histogramMetric.toLowerCase()} inside the subset that fails one or more thresholds.`,
          records: comparison.failedPreviewRecords,
        })}
      </div>
    </article>
  `;
}

function renderClassificationDistributionComparisonCard(
  comparison: ReturnType<typeof buildReportData>["classificationDistributionComparisons"][number]
) {
  const plotMarkup =
    comparison.config.plotTypeKey === "frequencyScatter"
      ? renderClassificationFrequencyScatterChart({
          title: "Classification frequency plot",
          description: `Bubble-style frequency view of ${comparison.config.histogramMetric.toLowerCase()} across ordered bins of ${comparison.config.plotXAxisMetric.toLowerCase()}, with bubble size shown as ${comparison.config.histogramScale.toLowerCase()}.`,
          plot: comparison.frequencyPlot,
          scale: comparison.config.histogramScaleKey,
        })
      : comparison.config.plotTypeKey === "frequencyLine"
        ? renderClassificationFrequencyLineChart({
            title: "Classification frequency lines",
            description: `Line view of ${comparison.config.histogramMetric.toLowerCase()} across ordered bins of ${comparison.config.plotXAxisMetric.toLowerCase()}, with vertical markers for split thresholds that use the same X-axis metric.`,
            plot: comparison.frequencyPlot,
            scale: comparison.config.histogramScaleKey,
          })
        : comparison.config.plotTypeKey === "countLine"
          ? renderClassificationCountLineChart({
              title: "Classification count lines",
              description: `Line view of classification counts across ${comparison.config.plotXAxisMetric.toLowerCase()} bins, shown as ${comparison.config.histogramScale.toLowerCase()}.`,
              plot: comparison.countLinePlot,
              scale: comparison.config.histogramScaleKey,
            })
          : renderComparisonStepChart({
              title: "Combined classification comparison",
              description: `Step-style comparison of ${comparison.config.histogramMetric.toLowerCase()} for classifications that pass versus fail the thresholds, shown as ${comparison.config.histogramScale.toLowerCase()}.`,
              data: comparison.comparisonHistogram,
              scale: comparison.config.histogramScaleKey,
              subjectLabelPlural: "classifications",
            });

  return `
    <article id="classification-comparison-${escapeHtml(comparison.id)}" class="query-card" data-classification-comparison-id="${escapeHtml(comparison.id)}">
      <header class="query-header">
        <div>
          <h3>${escapeHtml(comparison.name)}</h3>
          <p>${escapeHtml(comparison.description)}</p>
        </div>
        <div class="query-badge">${escapeHtml(comparison.summary.scopedCount.toLocaleString())} scoped</div>
      </header>

      <div class="table-wrap">
        <table class="meta-table" data-classification-comparison-config="${escapeHtml(comparison.id)}">
          <tbody>
            <tr>
              <th scope="row">Paper filter</th>
              <td>${escapeHtml(comparison.config.paper)}</td>
            </tr>
            <tr>
              <th scope="row">Catalog nucleus filter</th>
              <td>${escapeHtml(comparison.config.catalogNucleus)}</td>
            </tr>
            <tr>
              <th scope="row">Dominant Is-LSB filter</th>
              <td>${escapeHtml(comparison.config.dominantLsb)}</td>
            </tr>
            <tr>
              <th scope="row">Plot type</th>
              <td>${escapeHtml(comparison.config.plotType)}</td>
            </tr>
            <tr>
              <th scope="row">X axis metric</th>
              <td>${escapeHtml(comparison.config.plotXAxisMetric)}</td>
            </tr>
            ${comparison.config.plotXAxisMetricKey === "classificationCreationTime" ? `<tr>
              <th scope="row">Time binning</th>
              <td>${escapeHtml(comparison.config.plotXAxisBinningModeLabel)}: ${escapeHtml(
                (
                  comparison.config.plotXAxisBinningMode === "pointsPerBin"
                    ? comparison.config.plotXAxisPointsPerBin
                    : comparison.config.plotXAxisBinningMode === "timeInterval"
                      ? comparison.config.plotXAxisTimeBinDays
                    : comparison.config.plotXAxisBinCount
                ).toLocaleString()
              )}</td>
            </tr>` : ""}
            <tr>
              <th scope="row">Histogram metric</th>
              <td>${escapeHtml(comparison.config.histogramMetric)}</td>
            </tr>
            <tr>
              <th scope="row">Histogram scale</th>
              <td>${escapeHtml(comparison.config.histogramScale)}</td>
            </tr>
            <tr>
              <th scope="row">Scope thresholds</th>
              <td>${escapeHtml(
                comparison.config.scopeConditions.length > 0
                  ? comparison.config.scopeConditions
                      .map(
                        (condition) =>
                          `${condition.metricLabel} ${condition.operatorLabel.toLowerCase()} ${condition.thresholdDisplay}`
                      )
                      .join("; ")
                  : "None"
              )}</td>
            </tr>
            <tr>
              <th scope="row">Split thresholds</th>
              <td>${escapeHtml(
                comparison.config.conditions.length > 0
                  ? comparison.config.conditions
                      .map(
                        (condition) =>
                          `${condition.metricLabel} ${condition.operatorLabel.toLowerCase()} ${condition.thresholdDisplay}`
                      )
                      .join("; ")
                  : "None"
              )}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${renderStatCards([
        {
          key: `${comparison.id}-scopedCount`,
          label: "Scoped classifications",
          value: comparison.summary.scopedCount.toLocaleString(),
          detail: "Classification rows remaining after the galaxy-level paper, catalog nucleus, dominant Is-LSB, and scope-threshold filters.",
        },
        {
          key: `${comparison.id}-matchedCount`,
          label: "Matching subset",
          value: comparison.summary.matchedCount.toLocaleString(),
          detail: "Classifications in scope that satisfy every split threshold on this card.",
        },
        {
          key: `${comparison.id}-matchedShareOfScope`,
          label: "Matching share of scope",
          value: formatPercent(comparison.summary.matchedStats.shareOfScope),
          detail: "Share of scoped classifications that satisfy every threshold on this card.",
        },
        {
          key: `${comparison.id}-failedCount`,
          label: "Failing subset",
          value: comparison.summary.failedCount.toLocaleString(),
          detail: "Classifications in the same filtered scope that miss one or more split thresholds.",
        },
        {
          key: `${comparison.id}-failedShareOfScope`,
          label: "Failing share of scope",
          value: formatPercent(comparison.summary.failedStats.shareOfScope),
          detail: "Share of scoped classifications that miss at least one threshold on this card.",
        },
      ])}

      ${plotMarkup}

      <div class="subset-grid">
        ${renderSubsetStatsCard({
          title: "Classifications that match thresholds",
          tone: "match",
          description:
            "Summary statistics for the selected classification histogram metric inside the matching subset.",
          subjectLabel: "Classifications",
          metricLabel: comparison.config.histogramMetric,
          stats: comparison.summary.matchedStats,
          formatMetric: (value) =>
            formatClassificationMetricValueRaw(
              comparison.config.histogramMetricKey,
              value
            ),
        })}
        ${renderSubsetStatsCard({
          title: "Classifications that fail thresholds",
          tone: "fail",
          description:
            "Summary statistics for the selected classification histogram metric inside the failing subset.",
          subjectLabel: "Classifications",
          metricLabel: comparison.config.histogramMetric,
          stats: comparison.summary.failedStats,
          formatMetric: (value) =>
            formatClassificationMetricValueRaw(
              comparison.config.histogramMetricKey,
              value
            ),
        })}
      </div>

      <div class="preview-grid">
        ${renderClassificationSubsetPreviewTable({
          title: "Matching classifications",
          description: `Showing the exported preview rows ranked by ${
            comparison.config.plotTypeKey === "histogram"
              ? comparison.config.histogramMetric.toLowerCase()
              : comparison.config.plotXAxisMetric.toLowerCase()
          } inside the subset that passes the thresholds.`,
          points: comparison.matchedPreviewPoints,
        })}
        ${renderClassificationSubsetPreviewTable({
          title: "Failing classifications",
          description: `Showing the exported preview rows ranked by ${
            comparison.config.plotTypeKey === "histogram"
              ? comparison.config.histogramMetric.toLowerCase()
              : comparison.config.plotXAxisMetric.toLowerCase()
          } inside the subset that fails one or more thresholds.`,
          points: comparison.failedPreviewPoints,
        })}
      </div>
    </article>
  `;
}

function formatMetricValueRaw(
  metric: AnalysisDistributionComparisonConfig["histogramMetric"],
  value: number | null
) {
  return formatMetricValue(metric, value);
}

function formatClassificationMetricValueRaw(
  metric: AnalysisClassificationDistributionComparisonConfig["histogramMetric"],
  value: number | null
) {
  return formatClassificationMetricValue(metric, value);
}

export function buildAnalysisStatsExport(input: ExportInput) {
  return buildStatsOnlyExport(buildReportData(input));
}

export function buildAnalysisHtmlReport(input: ExportInput) {
  const reportData = buildReportData(input);

  const overviewCards = [
    {
      key: "totalGalaxies",
      label: "Galaxy catalog",
      value: reportData.datasetSummary.totalGalaxies.toLocaleString(),
      detail: "Total galaxy rows that were paged into the local analysis dataset.",
    },
    {
      key: "totalClassifications",
      label: "Classification rows",
      value: reportData.datasetSummary.totalClassifications.toLocaleString(),
      detail: "Raw classification rows available for vote aggregation.",
    },
    {
      key: "catalogNucleusGalaxies",
      label: "Catalog nuclei",
      value: reportData.datasetSummary.catalogNucleusGalaxies.toLocaleString(),
      detail: "Galaxies marked with a nucleus in the input catalog.",
    },
    {
      key: "availablePapers",
      label: "Configured papers",
      value: reportData.datasetSummary.availablePapers.length.toLocaleString(),
      detail: `Available paper filters: ${reportData.datasetSummary.availablePapers
        .map((paper) => formatPaperLabel(paper))
        .join(", ") || "None"}.`,
    },
  ];

  const datasetCards = [
    {
      key: "loadedGalaxyRecords",
      label: "Loaded galaxy records",
      value: reportData.datasetStats.loadedGalaxyRecords.toLocaleString(),
      detail: "Galaxy records available in this exported local analysis run.",
    },
    {
      key: "classifiedGalaxyCount",
      label: "Classified galaxies",
      value: reportData.datasetStats.classifiedGalaxyCount.toLocaleString(),
      detail: `${formatPercent(reportData.datasetStats.classifiedGalaxyPercent)} of the full catalog currently has at least one classification.`,
    },
    {
      key: "unclassifiedGalaxyCount",
      label: "Unclassified galaxies",
      value: reportData.datasetStats.unclassifiedGalaxyCount.toLocaleString(),
      detail: "Rows that still have zero classifications in the current export.",
    },
    {
      key: "maxClassificationsPerGalaxy",
      label: "Max classifications on one item",
      value: reportData.datasetStats.maxClassificationsPerGalaxy.toLocaleString(),
      detail: "Highest per-item classification count seen in this exported analysis run.",
    },
    {
      key: "totalAwesomeVotes",
      label: "Awesome votes",
      value: reportData.datasetStats.totalAwesomeVotes.toLocaleString(),
      detail: "Total awesome flags summed locally across the loaded rows.",
    },
    {
      key: "totalCommentedClassifications",
      label: "Classifications with comments",
      value: reportData.datasetStats.totalCommentedClassifications.toLocaleString(),
      detail: "Submitted classifications that included a non-empty written comment.",
    },
    {
      key: "averageCommentLength",
      label: "Average comment length",
      value: formatFixed(reportData.datasetStats.averageCommentLength, 1),
      detail: "Average number of characters across all non-empty comments.",
    },
    {
      key: "maxCommentLength",
      label: "Maximum comment length",
      value: reportData.datasetStats.maxCommentLength.toLocaleString(),
      detail: "Longest written comment present in the export dataset.",
    },
    {
      key: "totalVisibleNucleusVotes",
      label: "Visible-nucleus votes",
      value: reportData.datasetStats.totalVisibleNucleusVotes.toLocaleString(),
      detail: "Confirmation votes that can be compared to the catalog nucleus field.",
    },
    {
      key: "totalFailedFittingVotes",
      label: "Failed-fitting votes",
      value: reportData.datasetStats.totalFailedFittingVotes.toLocaleString(),
      detail: "Legacy and checkbox failed-fitting votes normalized into one count.",
    },
    {
      key: "orphanedGalaxyCount",
      label: "Integrity watch",
      value: reportData.datasetStats.orphanedGalaxyCount.toLocaleString(),
      detail:
        reportData.datasetStats.orphanedClassificationCount > 0
          ? `Classification-only galaxy IDs missing from the current galaxy table. (${reportData.datasetStats.orphanedClassificationCount.toLocaleString()} classification rows)`
          : "Classification-only galaxy IDs missing from the current galaxy table.",
    },
  ];

  const paperRows =
    reportData.datasetSummary.availablePapers.length > 0
      ? reportData.datasetSummary.availablePapers.map((paper, index) => ({
          label: `Paper ${index + 1}`,
          value: formatPaperLabel(paper),
        }))
      : [{ label: "Paper filters", value: "None" }];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Classification analysis report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f7fb;
        --surface: #ffffff;
        --border: #d7e0ec;
        --text: #142033;
        --muted: #4e6078;
        --accent: #1d4ed8;
        --accent-soft: #dbeafe;
        --shadow: 0 14px 34px rgba(20, 32, 51, 0.08);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
        color: var(--text);
      }

      main {
        max-width: 1480px;
        margin: 0 auto;
        padding: 32px 20px 56px;
      }

      h1, h2, h3, h4, p { margin-top: 0; }
      h1 { font-size: 2.4rem; margin-bottom: 10px; }
      h2 { font-size: 1.6rem; margin-bottom: 14px; }
      h3 { font-size: 1.15rem; margin-bottom: 6px; }

      .lead {
        max-width: 80ch;
        color: var(--muted);
        line-height: 1.55;
      }

      .hero, .section-card, .query-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: var(--shadow);
      }

      .hero { padding: 28px; margin-bottom: 28px; }
      .report-nav { padding: 22px 24px; margin-bottom: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); }
      .section-stack { display: grid; gap: 20px; min-width: 0; }
      .section-card, .query-card { padding: 22px; min-width: 0; }

      .report-nav-header p,
      .report-nav-group p { color: var(--muted); line-height: 1.5; }

      .report-nav-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        margin-top: 14px;
      }

      .report-nav-group {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }

      .report-nav-group h3 {
        margin-bottom: 10px;
      }

      .report-nav-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .report-nav-links a {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.95rem;
        font-weight: 600;
        text-decoration: none;
      }

      .report-nav-links a:hover {
        background: #cfe0ff;
      }

      .section-header, .query-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }

      .section-header p, .query-header p, .subsection p { color: var(--muted); line-height: 1.5; }

      .section-note, .query-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        padding: 8px 12px;
        font-size: 0.9rem;
        font-weight: 600;
        white-space: nowrap;
      }

      .meta-grid, .stat-grid { display: grid; gap: 16px; }
      .meta-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-top: 18px; }
      .stat-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin: 18px 0 0; }

      .stat-card {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }

      .stat-label {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
      }

      .stat-value {
        font-size: 1.8rem;
        font-weight: 700;
        margin: 8px 0 10px;
      }

      .stat-detail { color: var(--muted); line-height: 1.45; margin-bottom: 0; }

      .meta-table, .data-table { width: 100%; border-collapse: collapse; }

      .meta-table th,
      .meta-table td,
      .data-table th,
      .data-table td {
        border-bottom: 1px solid var(--border);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }

      .meta-table th, .data-table thead th { font-size: 0.92rem; font-weight: 700; }
      .meta-table th { width: 220px; color: var(--muted); }
      .table-wrap {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: auto;
      }

      .query-list,
      .subsection {
        min-width: 0;
      }

      .data-table[data-query-top-matches] {
        width: max-content;
        min-width: 100%;
      }

      .muted-inline { color: #94a3b8; }

      .histogram-bars { display: grid; gap: 12px; margin: 18px 0 20px; }

      .histogram-row {
        display: grid;
        grid-template-columns: minmax(90px, 140px) minmax(180px, 1fr) 100px;
        gap: 12px;
        align-items: center;
      }

      .histogram-track {
        height: 16px;
        border-radius: 999px;
        background: #e6edf7;
        overflow: hidden;
      }

      .histogram-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
      }

      .comparison-histogram-bars {
        display: grid;
        gap: 12px;
        margin: 18px 0 20px;
      }

      .comparison-row {
        display: grid;
        grid-template-columns: minmax(90px, 140px) minmax(220px, 1fr) minmax(100px, 140px);
        gap: 12px;
        align-items: center;
      }

      .comparison-track-wrap {
        display: grid;
        gap: 8px;
      }

      .comparison-track {
        position: relative;
        height: 16px;
        border-radius: 999px;
        background: #f8fbff;
        border: 1px solid var(--border);
        overflow: hidden;
      }

      .comparison-line {
        position: absolute;
        top: 50%;
        height: 0;
        border-top-width: 3px;
        border-top-style: solid;
        transform: translateY(-50%);
      }

      .comparison-line-match { border-top-color: #059669; }
      .comparison-line-fail { border-top-color: #e11d48; }
      .comparison-counts { font-size: 0.9rem; color: var(--muted); }

      .chart-section {
        margin-top: 22px;
      }

      .chart-scroll {
        width: 100%;
        overflow-x: auto;
        min-height: 150px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }

      .chart-svg {
        display: block;
        width: auto;
        max-width: none;
        min-width: 760px;
        min-height: 150px;
        height: auto;
      }

      .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 14px 0 12px;
      }

      .chart-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 7px 12px;
        background: #ffffff;
        color: var(--text);
        font-size: 0.92rem;
      }

      .chart-legend-swatch {
        width: 11px;
        height: 11px;
        border-radius: 999px;
        flex: 0 0 auto;
      }

      .chart-axis-tick {
        fill: var(--muted);
        font-size: 12px;
      }

      .chart-axis-label {
        fill: var(--text);
        font-size: 13px;
        font-weight: 600;
      }

      .chart-marker-label {
        fill: #475569;
        font-size: 11px;
        font-weight: 600;
      }

      .chart-notes {
        display: grid;
        gap: 6px;
        margin-top: 12px;
      }

      .chart-notes p {
        margin-bottom: 0;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .chart-data-toggle {
        margin-top: 14px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: #ffffff;
      }

      .chart-data-toggle summary {
        cursor: pointer;
        padding: 12px 14px;
        font-weight: 600;
        color: var(--accent);
        list-style: none;
      }

      .chart-data-toggle summary::-webkit-details-marker {
        display: none;
      }

      .chart-data-toggle summary::before {
        content: ">";
        display: inline-block;
        margin-right: 8px;
        transform: rotate(0deg);
        transition: transform 0.16s ease;
      }

      .chart-data-toggle[open] summary::before {
        transform: rotate(90deg);
      }

      .chart-data-toggle-body {
        display: grid;
        gap: 16px;
        padding: 0 14px 14px;
      }

      .chart-data-table-block h5 {
        margin-bottom: 8px;
        font-size: 0.92rem;
        color: var(--muted);
      }

      .plot-data-table {
        font-size: 0.72rem;
        line-height: 1.3;
        width: max-content;
        min-width: 100%;
      }

      .plot-data-table th,
      .plot-data-table td {
        padding: 6px 8px;
        white-space: nowrap;
      }

      .subset-grid,
      .preview-grid {
        display: grid;
        gap: 18px;
        margin-top: 22px;
      }

      .subset-grid,
      .preview-grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }

      .subset-card,
      .preview-card {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }

      .subset-card-match {
        border-color: #a7f3d0;
      }

      .subset-card-fail {
        border-color: #fecdd3;
      }

      .subset-card-header p,
      .preview-card-header p {
        color: var(--muted);
        line-height: 1.5;
      }

      .subset-chip-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin-top: 14px;
      }

      .summary-chip {
        border-radius: 14px;
        padding: 12px 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
      }

      .summary-chip-label {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
      }

      .summary-chip-value {
        margin-top: 6px;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text);
      }

      .preview-table {
        width: max-content;
        min-width: 100%;
      }

      .empty-state {
        padding: 18px;
        border-radius: 14px;
        background: #f8fbff;
        border: 1px dashed var(--border);
        color: var(--muted);
      }

      .preview-image {
        display: block;
        width: 96px;
        min-width: 96px;
        height: 96px;
        object-fit: cover;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #f8fbff;
      }

      .subsection { margin-top: 22px; }
      .subsection h4 { font-size: 1rem; margin-bottom: 8px; }
      .query-list { display: grid; gap: 22px; }

      @media (max-width: 900px) {
        .section-header, .query-header { flex-direction: column; }
        .histogram-row { grid-template-columns: 1fr; }
        .comparison-row { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main data-report-type="classification-analysis" data-report-version="${escapeHtml(
      reportData.reportVersion
    )}">
      <section class="hero">
        <h1>Classification analysis report</h1>
        <p class="lead">
          Standalone export from the Statistics / Data Analysis page. This file preserves
          the visible report structure, renders standalone inline SVG versions of the plotted
          threshold-split charts, and includes machine-readable summary data in the embedded JSON
          payload together with the exported preview rows.
        </p>
        <div class="meta-grid">
          <section class="section-card">
            <h2>Run metadata</h2>
            ${renderMetadataTable([
              { label: "Generated at", value: reportData.generatedAtLabel },
              { label: "Generated at (ISO)", value: reportData.generatedAtIso },
              { label: "Dataset loaded at", value: reportData.datasetLoadedAtLabel },
              { label: "Dataset loaded at (ISO)", value: reportData.datasetLoadedAtIso },
              {
                label: "Loaded galaxy records",
                value: reportData.datasetStats.loadedGalaxyRecords.toLocaleString(),
              },
              {
                label: "Query cards exported",
                value: reportData.queries.length.toLocaleString(),
              },
              {
                label: "Distribution cards exported",
                value: reportData.distributionComparisons.length.toLocaleString(),
              },
              {
                label: "Classification distribution cards exported",
                value: reportData.classificationDistributionComparisons.length.toLocaleString(),
              },
            ])}
          </section>
          <section class="section-card">
            <h2>Paper filters</h2>
            ${renderMetadataTable(paperRows)}
          </section>
        </div>
      </section>

      ${renderReportNavigation(reportData)}

      <section class="section-stack">
        <section id="dataset-overview" class="section-card" data-section="dataset-overview">
          <h2>Dataset overview</h2>
          ${renderStatCards(overviewCards)}
        </section>

        <section id="dataset-stats" class="section-card" data-section="dataset-stats">
          <h2>Loaded dataset statistics</h2>
          ${renderStatCards(datasetCards)}
        </section>

        <section id="global-histograms" class="section-card" data-section="global-histograms">
          <h2>Global histograms</h2>
          <div class="section-stack">
            ${reportData.globalHistograms.map((histogram) => renderHistogram(histogram)).join("")}
          </div>
        </section>

        <section id="queries" class="section-card" data-section="queries">
          <h2>Query cards</h2>
          <div class="query-list">
            ${reportData.queries.map((query) => renderQueryCard(query)).join("")}
          </div>
        </section>

        <section id="distribution-comparisons" class="section-card" data-section="distribution-comparisons">
          <h2>Galaxy threshold-split distributions</h2>
          <div class="query-list">
            ${reportData.distributionComparisons
              .map((comparison) => renderDistributionComparisonCard(comparison))
              .join("")}
          </div>
        </section>

        <section id="classification-distribution-comparisons" class="section-card" data-section="classification-distribution-comparisons">
          <h2>Classification threshold-split distributions</h2>
          <div class="query-list">
            ${reportData.classificationDistributionComparisons
              .map((comparison) =>
                renderClassificationDistributionComparisonCard(comparison)
              )
              .join("")}
          </div>
        </section>
      </section>

      <script id="analysis-report-data" type="application/json">${serializeJsonForHtml(reportData)}</script>
    </main>
  </body>
</html>`;
}