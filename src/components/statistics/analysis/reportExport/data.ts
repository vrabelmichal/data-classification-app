import {
  buildComparisonHistogramData,
  buildGlobalSummaryHistograms,
  evaluateAnalysisClassificationDistributionComparison,
  evaluateAnalysisDistributionComparison,
  evaluateAnalysisQuery,
  filterZeroCountHistogram,
  formatClassificationConditionThreshold,
  formatConditionThreshold,
  formatPaperLabel,
  getClassificationComparisonPlotTypeLabel,
  getClassificationConditionMetricLabel,
  getClassificationMetricLabel,
  getConditionMetricLabel,
  getDistributionScaleLabel,
  getMetricLabel,
  type AnalysisClassificationComparisonCondition,
  type AnalysisQueryCondition,
} from "../helpers";
import { formatLoadedAt } from "../tabUtils";
import {
  buildClassificationPreviewPoint,
  buildPreviewRecord,
  CATALOG_NUCLEUS_LABELS,
  DOMINANT_LSB_LABELS,
  type ExportInput,
  GLOBAL_HISTOGRAM_SECTIONS,
  type ReportHistogramSection,
  QUERY_OPERATOR_LABELS,
} from "./shared";

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

export function buildReportData({
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

export type AnalysisReportData = ReturnType<typeof buildReportData>;

export function buildStatsOnlyExport(reportData: AnalysisReportData) {
  return reportData;
}