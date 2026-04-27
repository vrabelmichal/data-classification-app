import { v } from "convex/values";

const analysisQueryConditionValidator = v.object({
  id: v.string(),
  metric: v.string(),
  operator: v.string(),
  count: v.number(),
});

const analysisCommentRuleValidator = v.object({
  id: v.string(),
  mode: v.string(),
  terms: v.string(),
});

const analysisQueryConfigValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  paper: v.string(),
  catalogNucleus: v.string(),
  dominantLsb: v.string(),
  conditions: v.array(analysisQueryConditionValidator),
  commentRules: v.array(analysisCommentRuleValidator),
  sortBy: v.string(),
  sortDirection: v.string(),
  histogramMetric: v.string(),
  previewLimit: v.number(),
});

const analysisDistributionComparisonConfigValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  paper: v.string(),
  catalogNucleus: v.string(),
  dominantLsb: v.string(),
  scopeConditions: v.array(analysisQueryConditionValidator),
  conditions: v.array(analysisQueryConditionValidator),
  histogramMetric: v.string(),
  histogramScale: v.string(),
  previewLimit: v.number(),
});

const analysisClassificationComparisonConditionValidator = v.object({
  id: v.string(),
  metric: v.string(),
  operator: v.string(),
  count: v.number(),
});

const analysisClassificationDistributionComparisonConfigValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  paper: v.string(),
  catalogNucleus: v.string(),
  dominantLsb: v.string(),
  scopeConditions: v.array(analysisClassificationComparisonConditionValidator),
  conditions: v.array(analysisClassificationComparisonConditionValidator),
  histogramMetric: v.string(),
  histogramScale: v.string(),
  plotType: v.string(),
  plotXAxisMetric: v.string(),
  plotXAxisBinningMode: v.string(),
  plotXAxisBinCount: v.number(),
  plotXAxisPointsPerBin: v.number(),
  plotXAxisTimeBinDays: v.number(),
  previewLimit: v.number(),
});

export const analysisFrameworkStateValidator = v.object({
  queries: v.array(analysisQueryConfigValidator),
  comparisons: v.array(analysisDistributionComparisonConfigValidator),
  classificationComparisons: v.array(
    analysisClassificationDistributionComparisonConfigValidator
  ),
});

export const analysisFrameworkConfigValidator = v.object({
  configKey: v.string(),
  name: v.string(),
  state: analysisFrameworkStateValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});
