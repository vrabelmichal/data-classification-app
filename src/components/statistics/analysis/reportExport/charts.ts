import type {
  AnalysisClassificationCountLinePlot,
  AnalysisClassificationDistributionComparisonConfig,
  AnalysisClassificationFrequencyPlot,
  AnalysisDistributionComparisonScale,
  AnalysisDistributionSubsetStats,
  ComparisonHistogramDatum,
} from "../helpers";
import { formatPercent } from "../tabUtils";
import {
  buildClassificationPreviewPoint,
  buildPreviewRecord,
  escapeHtml,
  formatAgreementSummary,
  formatAnsweredVoteSummary,
  formatBooleanValue,
} from "./shared";

export function renderEmptyState(message: string) {
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

export function renderSubsetStatsCard({
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

export function renderComparisonStepChart({
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

export function renderClassificationFrequencyScatterChart({
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
  const displayedXTicks = buildDisplayedXTicks(plot.xTickLabels);
  const needsAngledTicks = plot.xTickLabels.length > 10;
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

export function renderClassificationFrequencyLineChart({
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

export function renderClassificationCountLineChart({
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

export function renderGalaxySubsetPreviewTable({
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
                        record.numericId === null
                          ? record.galaxyId
                          : `${record.galaxyId} (#${record.numericId.toLocaleString()})`
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

export function renderClassificationSubsetPreviewTable({
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