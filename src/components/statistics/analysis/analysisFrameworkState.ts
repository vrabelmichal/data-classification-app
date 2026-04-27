import type {
  AnalysisClassificationComparisonCondition,
  AnalysisClassificationDistributionComparisonConfig,
  AnalysisCommentRule,
  AnalysisDistributionComparisonConfig,
  AnalysisQueryCondition,
  AnalysisQueryConfig,
} from "./helpers";
import {
  buildDefaultAnalysisClassificationDistributionComparisons,
  buildDefaultAnalysisDistributionComparisons,
  buildDefaultAnalysisQueries,
} from "./helpers";

export const MY_ANALYSIS_FRAMEWORK_KEY = "my-analysis";
export const MY_ANALYSIS_FRAMEWORK_NAME = "My analysis";

export interface AnalysisFrameworkState {
  queries: AnalysisQueryConfig[];
  comparisons: AnalysisDistributionComparisonConfig[];
  classificationComparisons: AnalysisClassificationDistributionComparisonConfig[];
}

export interface SavedAnalysisFrameworkConfig {
  configKey: string;
  name: string;
  state: AnalysisFrameworkState;
  createdAt: number;
  updatedAt: number;
}

function cloneAnalysisQueryCondition(
  condition: AnalysisQueryCondition
): AnalysisQueryCondition {
  return { ...condition };
}

function cloneAnalysisClassificationCondition(
  condition: AnalysisClassificationComparisonCondition
): AnalysisClassificationComparisonCondition {
  return { ...condition };
}

function cloneAnalysisCommentRule(rule: AnalysisCommentRule): AnalysisCommentRule {
  return { ...rule };
}

function cloneAnalysisQuery(query: AnalysisQueryConfig): AnalysisQueryConfig {
  return {
    ...query,
    conditions: query.conditions.map(cloneAnalysisQueryCondition),
    commentRules: query.commentRules.map(cloneAnalysisCommentRule),
  };
}

function cloneAnalysisDistributionComparison(
  comparison: AnalysisDistributionComparisonConfig
): AnalysisDistributionComparisonConfig {
  return {
    ...comparison,
    scopeConditions: comparison.scopeConditions.map(cloneAnalysisQueryCondition),
    conditions: comparison.conditions.map(cloneAnalysisQueryCondition),
  };
}

function cloneAnalysisClassificationDistributionComparison(
  comparison: AnalysisClassificationDistributionComparisonConfig
): AnalysisClassificationDistributionComparisonConfig {
  return {
    ...comparison,
    scopeConditions: comparison.scopeConditions.map(
      cloneAnalysisClassificationCondition
    ),
    conditions: comparison.conditions.map(cloneAnalysisClassificationCondition),
  };
}

export function buildDefaultAnalysisFrameworkState(): AnalysisFrameworkState {
  return {
    queries: buildDefaultAnalysisQueries(),
    comparisons: buildDefaultAnalysisDistributionComparisons(),
    classificationComparisons:
      buildDefaultAnalysisClassificationDistributionComparisons(),
  };
}

export function cloneAnalysisFrameworkState(
  state: AnalysisFrameworkState
): AnalysisFrameworkState {
  return {
    queries: state.queries.map(cloneAnalysisQuery),
    comparisons: state.comparisons.map(cloneAnalysisDistributionComparison),
    classificationComparisons: state.classificationComparisons.map(
      cloneAnalysisClassificationDistributionComparison
    ),
  };
}

export function createCollapsedItemMap<T extends { id: string }>(
  items: T[]
): Record<string, boolean> {
  return Object.fromEntries(items.map((item) => [item.id, true]));
}

export function getAnalysisFrameworkSignature(state: AnalysisFrameworkState) {
  return JSON.stringify(state);
}
