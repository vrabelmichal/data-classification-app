import { getImageUrl } from "../../../images";
import { getPreviewImageName } from "../../../images/displaySettings";
import {
  buildGlobalSummaryHistograms,
  evaluateAnalysisQuery,
  filterZeroCountHistogram,
  formatPaperLabel,
  getMetricLabel,
  getVotePreview,
  type AnalysisQueryConfig,
  type AnalysisRecord,
  type HistogramDatum,
} from "./helpers";
import type { DatasetSummary, PreparedDataset, ZeroBucketState } from "./tabTypes";
import { formatLoadedAt, formatPercent } from "./tabUtils";

type GlobalHistogramKey =
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
  hideZeroBuckets: ZeroBucketState;
  imageQuality: "high" | "medium" | "low";
  generatedAt: Date;
};

type AnalysisReportData = ReturnType<typeof buildReportData>;

const GLOBAL_HISTOGRAM_SECTIONS: Array<{
  id: GlobalHistogramKey;
  title: string;
  description: string;
}> = [
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
        <p>Jump directly to the dataset summary, global histograms, or any exported query card.</p>
      </div>
      <div class="report-nav-grid">
        <section class="report-nav-group">
          <h3>Sections</h3>
          <div class="report-nav-links">
            <a href="#dataset-overview">Dataset overview</a>
            <a href="#dataset-stats">Loaded dataset statistics</a>
            <a href="#global-histograms">Global histograms</a>
            <a href="#queries">Query cards</a>
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
      </div>
    </nav>
  `;
}

function buildStatsOnlyExport(reportData: AnalysisReportData) {
  return {
    reportType: reportData.reportType,
    reportVersion: reportData.reportVersion,
    generatedAtIso: reportData.generatedAtIso,
    generatedAtLabel: reportData.generatedAtLabel,
    datasetLoadedAtIso: reportData.datasetLoadedAtIso,
    datasetLoadedAtLabel: reportData.datasetLoadedAtLabel,
    datasetSummary: reportData.datasetSummary,
    datasetStats: reportData.datasetStats,
    globalHistograms: reportData.globalHistograms.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      zeroBucketHidden: section.zeroBucketHidden,
      displayBins: section.displayBins,
      allBins: section.allBins,
    })),
    queries: reportData.queries.map((query) => ({
      id: query.id,
      name: query.name,
      description: query.description,
      config: query.config,
      summary: query.summary,
      histogram: {
        id: query.histogram.id,
        title: query.histogram.title,
        description: query.histogram.description,
        zeroBucketHidden: query.histogram.zeroBucketHidden,
        displayBins: query.histogram.displayBins,
        allBins: query.histogram.allBins,
      },
    })),
  };
}

function buildReportData({
  summary,
  dataset,
  queries,
  hideZeroBuckets,
  imageQuality,
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
        conditions: query.conditions.map(
          (condition) =>
            `${getMetricLabel(condition.metric)} ${QUERY_OPERATOR_LABELS[condition.operator].toLowerCase()} ${condition.count.toLocaleString()}`
        ),
      },
      summary: {
        matchedCount: result.matchedCount,
        totalMatchingClassifications: result.totalMatchingClassifications,
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

  return {
    reportType: "classification-analysis",
    reportVersion: 1,
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
      totalAwesomeVotes: dataset.totalAwesomeVotes,
      totalVisibleNucleusVotes: dataset.totalVisibleNucleusVotes,
      totalFailedFittingVotes: dataset.totalFailedFittingVotes,
      orphanedGalaxyCount: dataset.orphanedGalaxyCount,
      orphanedClassificationCount: dataset.orphanedClassificationCount,
    },
    globalHistograms,
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
                <th scope="col">Catalog nucleus</th>
                <th scope="col">Dominant Is-LSB</th>
                <th scope="col">Dominant morphology</th>
                <th scope="col">Classifications</th>
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
                      <td>${record.catalogNucleus ? "Yes" : "No"}</td>
                      <td>${escapeHtml(record.dominantLsb.label)}</td>
                      <td>${escapeHtml(record.dominantMorphology.label)}</td>
                      <td>${escapeHtml(record.totalClassifications.toLocaleString())}</td>
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
              <td>${escapeHtml(query.config.conditions.join("; "))}</td>
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
      key: "totalAwesomeVotes",
      label: "Awesome votes",
      value: reportData.datasetStats.totalAwesomeVotes.toLocaleString(),
      detail: "Total awesome flags summed locally across the loaded rows.",
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
      }
    </style>
  </head>
  <body>
    <main data-report-type="classification-analysis" data-report-version="1">
      <section class="hero">
        <h1>Classification analysis report</h1>
        <p class="lead">
          Standalone export from the Statistics / Data Analysis page. This file preserves
          the visible report structure and includes machine-readable histogram bin counts
          and summary data in the embedded JSON payload.
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
      </section>

      <script id="analysis-report-data" type="application/json">${serializeJsonForHtml(reportData)}</script>
    </main>
  </body>
</html>`;
}