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

function stableJsonReplacer(_key: string, value: unknown) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  return Object.keys(objectValue)
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = objectValue[key];
      return accumulator;
    }, {});
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, stableJsonReplacer);
}

export function createCollapsedItemMap<T extends { id: string }>(
  items: T[]
): Record<string, boolean> {
  return Object.fromEntries(items.map((item) => [item.id, true]));
}

export function getAnalysisFrameworkSignature(state: AnalysisFrameworkState) {
  return stableStringify(state);
}

export function getNamedAnalysisFrameworkSignature(
  name: string,
  state: AnalysisFrameworkState
) {
  return stableStringify({
    name: name.trim(),
    state,
  });
}
