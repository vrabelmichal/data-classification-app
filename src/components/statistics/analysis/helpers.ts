export type AnalysisCountMetric =
  | "totalClassifications"
  | "lsbComparableVotes"
  | "lsbVotes"
  | "nonLsbVotes"
  | "failedFittingVotes"
  | "lsbAgreementCount"
  | "featurelessVotes"
  | "irregularVotes"
  | "ltgVotes"
  | "etgVotes"
  | "morphologyAgreementCount"
  | "awesomeVotes"
  | "validRedshiftVotes"
  | "commentedClassifications"
  | "maxCommentLength"
  | "averageCommentLength"
  | "visibleNucleusVotes"
  | "visibleNucleusComparableVotes"
  | "visibleNucleusAgreementCount"
  | "failedFittingComparableVotes"
  | "failedFittingAgreementCount";

export type AnalysisConditionMetric =
  | AnalysisCountMetric
  | "galaxyCreationTime"
  | "firstClassificationTime";

export type AnalysisRatioMetric =
  | "lsbAgreementRate"
  | "morphologyAgreementRate"
  | "visibleNucleusAgreementRate"
  | "failedFittingAgreementRate"
  | "nucleusConfirmationRate";

export type AnalysisMetric = AnalysisCountMetric | AnalysisRatioMetric;

export type AnalysisClassificationMetric =
  | "failedFittingFlag"
  | "failedFittingAnsweredFlag"
  | "visibleNucleusFlag"
  | "visibleNucleusAnsweredFlag"
  | "awesomeFlag"
  | "validRedshiftFlag"
  | "hasComment"
  | "commentLength";

export type AnalysisClassificationConditionMetric =
  | AnalysisClassificationMetric
  | "classificationCreationTime";

export type AnalysisOperator = "atLeast" | "atMost" | "exactly";
export type QuerySortDirection = "desc" | "asc";
export type AnalysisDistributionComparisonScale =
  | "count"
  | "relativeFrequency";
export type CatalogNucleusFilter = "any" | "yes" | "no";
export type DominantLsbFilter =
  | "any"
  | "lsb"
  | "nonLsb"
  | "split"
  | "noComparableVotes";
export type AnalysisCommentRuleMode = "containsAny" | "notContainsAny";

export interface AnalysisGalaxy {
  _id: string;
  _creationTime: number;
  id: string;
  numericId: number | null;
  ra: number;
  dec: number;
  reff: number;
  q: number;
  nucleus: boolean;
  mag: number | null;
  mean_mue: number | null;
  paper: string | null;
  totalClassifications: number;
  numVisibleNucleus: number;
  numAwesomeFlag: number;
  numFailedFitting: number;
}

export interface AnalysisClassificationVote {
  _id: string;
  _creationTime: number;
  userId: string;
  galaxyExternalId: string;
  lsb_class: number;
  morphology: number;
  awesome_flag: boolean;
  valid_redshift: boolean;
  visible_nucleus?: boolean;
  failed_fitting?: boolean;
  comments?: string;
}

export interface AnalysisUserDirectoryEntry {
  userId: string;
  displayName: string;
}

export interface AnalysisAggregate {
  totalClassifications: number;
  lsbVotes: number;
  nonLsbVotes: number;
  failedFittingVotes: number;
  failedFittingComparableVotes: number;
  featurelessVotes: number;
  irregularVotes: number;
  ltgVotes: number;
  etgVotes: number;
  awesomeVotes: number;
  validRedshiftVotes: number;
  commentedClassifications: number;
  totalCommentLength: number;
  maxCommentLength: number;
  visibleNucleusVotes: number;
  visibleNucleusComparableVotes: number;
}

export interface AnalysisDecisionSummary<State extends string = string> {
  state: State;
  label: string;
  agreementCount: number;
  agreementRate: number | null;
  comparableVotes: number;
}

export interface AnalysisRecord {
  galaxy: AnalysisGalaxy;
  aggregate: AnalysisAggregate;
  votes: AnalysisClassificationVote[];
  firstClassificationTime: number | null;
  averageCommentLength: number | null;
  commentSearchTexts: string[];
  lsb: AnalysisDecisionSummary<Exclude<DominantLsbFilter, "any">>;
  morphology: AnalysisDecisionSummary<
    "featureless" | "irregular" | "ltg" | "etg" | "split" | "noClassifications"
  >;
  visibleNucleus: AnalysisDecisionSummary<"yes" | "no" | "split" | "noResponses">;
  failedFitting: AnalysisDecisionSummary<"yes" | "no" | "split" | "noResponses">;
  nucleusConfirmationRate: number | null;
  dominantLsbLabel: string;
  dominantMorphologyLabel: string;
}

export interface AnalysisCommentRule {
  id: string;
  mode: AnalysisCommentRuleMode;
  terms: string;
}

export interface AnalysisClassificationPoint {
  id: string;
  vote: AnalysisClassificationVote;
  record: AnalysisRecord;
  normalizedComment: string | null;
  commentLength: number;
}

export interface AnalysisQueryCondition {
  id: string;
  metric: AnalysisConditionMetric;
  operator: AnalysisOperator;
  count: number;
}

export interface AnalysisClassificationComparisonCondition {
  id: string;
  metric: AnalysisClassificationConditionMetric;
  operator: AnalysisOperator;
  count: number;
}

export interface AnalysisQueryConfig {
  id: string;
  name: string;
  description: string;
  paper: string | "__any__";
  catalogNucleus: CatalogNucleusFilter;
  dominantLsb: DominantLsbFilter;
  conditions: AnalysisQueryCondition[];
  commentRules: AnalysisCommentRule[];
  sortBy: AnalysisMetric;
  sortDirection: QuerySortDirection;
  histogramMetric: AnalysisMetric;
  previewLimit: number;
}

export interface AnalysisDistributionComparisonConfig {
  id: string;
  name: string;
  description: string;
  paper: string | "__any__";
  catalogNucleus: CatalogNucleusFilter;
  dominantLsb: DominantLsbFilter;
  conditions: AnalysisQueryCondition[];
  histogramMetric: AnalysisMetric;
  histogramScale: AnalysisDistributionComparisonScale;
}

export interface AnalysisClassificationDistributionComparisonConfig {
  id: string;
  name: string;
  description: string;
  paper: string | "__any__";
  catalogNucleus: CatalogNucleusFilter;
  dominantLsb: DominantLsbFilter;
  conditions: AnalysisClassificationComparisonCondition[];
  histogramMetric: AnalysisClassificationMetric;
  histogramScale: AnalysisDistributionComparisonScale;
}

export interface AnalysisDominantLsbBreakdown {
  lsb: number;
  nonLsb: number;
  split: number;
  noComparableVotes: number;
}

export interface AnalysisQueryResult {
  matchedCount: number;
  matchedRecords: AnalysisRecord[];
  previewRecords: AnalysisRecord[];
  histogram: HistogramDatum[];
  totalMatchingClassifications: number;
  totalMatchingCommentedClassifications: number;
  averageMatchingCommentLength: number | null;
  maxMatchingCommentLength: number;
  averageLsbAgreementRate: number | null;
  averageMorphologyAgreementRate: number | null;
  averageVisibleNucleusAgreementRate: number | null;
  averageFailedFittingAgreementRate: number | null;
  dominantLsbBreakdown: AnalysisDominantLsbBreakdown;
}

export interface AnalysisDistributionComparisonResult {
  scopedCount: number;
  matchedCount: number;
  failedCount: number;
  scopedHistogram: HistogramDatum[];
  matchedHistogram: HistogramDatum[];
  failedHistogram: HistogramDatum[];
  matchedStats: AnalysisDistributionSubsetStats;
  failedStats: AnalysisDistributionSubsetStats;
}

export interface AnalysisClassificationDistributionComparisonResult {
  scopedCount: number;
  matchedCount: number;
  failedCount: number;
  scopedHistogram: HistogramDatum[];
  matchedHistogram: HistogramDatum[];
  failedHistogram: HistogramDatum[];
  matchedStats: AnalysisDistributionSubsetStats;
  failedStats: AnalysisDistributionSubsetStats;
}

export interface AnalysisDistributionSubsetStats {
  recordCount: number;
  shareOfScope: number | null;
  averageMetric: number | null;
  medianMetric: number | null;
  minMetric: number | null;
  maxMetric: number | null;
}

export interface ComparisonHistogramDatum {
  key: string;
  label: string;
  metricLabel: string;
  matchedCount: number;
  failedCount: number;
  matchedRelativeFrequency: number | null;
  failedRelativeFrequency: number | null;
  totalCount: number;
}

export interface HistogramDatum {
  key: string;
  label: string;
  count: number;
  metricLabel: string;
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

type MetricMeta = {
  label: string;
  shortLabel: string;
  isRatio: boolean;
};

type ClassificationMetricMeta = {
  label: string;
  shortLabel: string;
};

export const ANALYSIS_MAX_PREVIEW_LIMIT = 100;

const DISTRIBUTION_EXAMPLE_SPLIT_TIME =
  new Date(2026, 1, 16, 0, 0, 0, 0).getTime() - 1;

const METRIC_META: Record<AnalysisMetric, MetricMeta> = {
  totalClassifications: {
    label: "Total classifications",
    shortLabel: "Classifications",
    isRatio: false,
  },
  lsbComparableVotes: {
    label: "Comparable Is-LSB votes",
    shortLabel: "Comparable Is-LSB",
    isRatio: false,
  },
  lsbVotes: {
    label: "LSB votes",
    shortLabel: "LSB",
    isRatio: false,
  },
  nonLsbVotes: {
    label: "Non-LSB votes",
    shortLabel: "Non-LSB",
    isRatio: false,
  },
  failedFittingVotes: {
    label: "Failed-fitting yes votes",
    shortLabel: "Failed",
    isRatio: false,
  },
  lsbAgreementCount: {
    label: "Is-LSB agreement count",
    shortLabel: "Is-LSB agree",
    isRatio: false,
  },
  featurelessVotes: {
    label: "Featureless votes",
    shortLabel: "Featureless",
    isRatio: false,
  },
  irregularVotes: {
    label: "Irregular / not-sure votes",
    shortLabel: "Irr/other",
    isRatio: false,
  },
  ltgVotes: {
    label: "LTG votes",
    shortLabel: "LTG",
    isRatio: false,
  },
  etgVotes: {
    label: "ETG votes",
    shortLabel: "ETG",
    isRatio: false,
  },
  morphologyAgreementCount: {
    label: "Morphology agreement count",
    shortLabel: "Morph agree",
    isRatio: false,
  },
  awesomeVotes: {
    label: "Awesome votes",
    shortLabel: "Awesome",
    isRatio: false,
  },
  validRedshiftVotes: {
    label: "Valid-redshift votes",
    shortLabel: "Valid z",
    isRatio: false,
  },
  commentedClassifications: {
    label: "Classifications with comments",
    shortLabel: "Comments",
    isRatio: false,
  },
  maxCommentLength: {
    label: "Maximum comment length",
    shortLabel: "Max comment",
    isRatio: false,
  },
  averageCommentLength: {
    label: "Average comment length",
    shortLabel: "Avg comment",
    isRatio: false,
  },
  visibleNucleusVotes: {
    label: "Visible-nucleus yes votes",
    shortLabel: "Visible yes",
    isRatio: false,
  },
  visibleNucleusComparableVotes: {
    label: "Visible-nucleus answered votes",
    shortLabel: "Visible answered",
    isRatio: false,
  },
  visibleNucleusAgreementCount: {
    label: "Visible-nucleus agreement count",
    shortLabel: "Visible agree",
    isRatio: false,
  },
  failedFittingComparableVotes: {
    label: "Failed-fitting answered votes",
    shortLabel: "Failed answered",
    isRatio: false,
  },
  failedFittingAgreementCount: {
    label: "Failed-fitting agreement count",
    shortLabel: "Failed agree",
    isRatio: false,
  },
  lsbAgreementRate: {
    label: "Is-LSB agreement rate",
    shortLabel: "Is-LSB rate",
    isRatio: true,
  },
  morphologyAgreementRate: {
    label: "Morphology agreement rate",
    shortLabel: "Morph rate",
    isRatio: true,
  },
  visibleNucleusAgreementRate: {
    label: "Visible-nucleus agreement rate",
    shortLabel: "Visible rate",
    isRatio: true,
  },
  failedFittingAgreementRate: {
    label: "Failed-fitting agreement rate",
    shortLabel: "Failed rate",
    isRatio: true,
  },
  nucleusConfirmationRate: {
    label: "Visible-nucleus confirmation rate",
    shortLabel: "Nucleus confirmation",
    isRatio: true,
  },
};

const CLASSIFICATION_METRIC_META: Record<
  AnalysisClassificationMetric,
  ClassificationMetricMeta
> = {
  failedFittingFlag: {
    label: "Failed-fitting yes flag",
    shortLabel: "Failed yes",
  },
  failedFittingAnsweredFlag: {
    label: "Failed-fitting answered flag",
    shortLabel: "Failed answered",
  },
  visibleNucleusFlag: {
    label: "Visible-nucleus yes flag",
    shortLabel: "Visible yes",
  },
  visibleNucleusAnsweredFlag: {
    label: "Visible-nucleus answered flag",
    shortLabel: "Visible answered",
  },
  awesomeFlag: {
    label: "Awesome flag",
    shortLabel: "Awesome",
  },
  validRedshiftFlag: {
    label: "Valid-redshift flag",
    shortLabel: "Valid z",
  },
  hasComment: {
    label: "Has comment",
    shortLabel: "Comment",
  },
  commentLength: {
    label: "Comment length",
    shortLabel: "Comment length",
  },
};

const LSB_LABELS = {
  lsb: "LSB",
  nonLsb: "Non-LSB",
  split: "Split LSB / Non-LSB",
  noComparableVotes: "No comparable Is-LSB votes",
} as const;

const MORPHOLOGY_LABELS = {
  featureless: "Featureless",
  irregular: "Irr/other",
  ltg: "LTG (Sp)",
  etg: "ETG (Ell)",
  split: "Split morphology",
  noClassifications: "No classifications",
} as const;

const VISIBLE_NUCLEUS_LABELS = {
  yes: "Visible nucleus",
  no: "No visible nucleus",
  split: "Split yes / no",
  noResponses: "No visible-nucleus votes",
} as const;

const FAILED_FITTING_LABELS = {
  yes: "Failed fitting",
  no: "No failed fitting",
  split: "Split yes / no",
  noResponses: "No failed-fitting votes",
} as const;

export const analysisConditionMetricOptions: Array<
  SelectOption<AnalysisConditionMetric>
> = [
  { value: "totalClassifications", label: "Total classifications" },
  { value: "galaxyCreationTime", label: "Galaxy row creation time" },
  { value: "firstClassificationTime", label: "First classification time" },
  { value: "lsbComparableVotes", label: "Comparable Is-LSB votes" },
  { value: "lsbVotes", label: "LSB votes" },
  { value: "nonLsbVotes", label: "Non-LSB votes" },
  { value: "failedFittingVotes", label: "Failed-fitting yes votes" },
  { value: "lsbAgreementCount", label: "Is-LSB agreement count" },
  { value: "featurelessVotes", label: "Featureless votes" },
  { value: "irregularVotes", label: "Irr/other votes" },
  { value: "ltgVotes", label: "LTG votes" },
  { value: "etgVotes", label: "ETG votes" },
  { value: "morphologyAgreementCount", label: "Morphology agreement count" },
  { value: "awesomeVotes", label: "Awesome votes" },
  { value: "validRedshiftVotes", label: "Valid-redshift votes" },
  {
    value: "commentedClassifications",
    label: "Classifications with comments",
  },
  { value: "maxCommentLength", label: "Maximum comment length" },
  { value: "averageCommentLength", label: "Average comment length" },
  { value: "visibleNucleusVotes", label: "Visible-nucleus yes votes" },
  {
    value: "visibleNucleusComparableVotes",
    label: "Visible-nucleus answered votes",
  },
  {
    value: "visibleNucleusAgreementCount",
    label: "Visible-nucleus agreement count",
  },
  {
    value: "failedFittingComparableVotes",
    label: "Failed-fitting answered votes",
  },
  {
    value: "failedFittingAgreementCount",
    label: "Failed-fitting agreement count",
  },
];

export const analysisClassificationConditionMetricOptions: Array<
  SelectOption<AnalysisClassificationConditionMetric>
> = [
  {
    value: "classificationCreationTime",
    label: "Classification creation time",
  },
  { value: "failedFittingFlag", label: "Failed-fitting yes flag" },
  {
    value: "failedFittingAnsweredFlag",
    label: "Failed-fitting answered flag",
  },
  { value: "visibleNucleusFlag", label: "Visible-nucleus yes flag" },
  {
    value: "visibleNucleusAnsweredFlag",
    label: "Visible-nucleus answered flag",
  },
  { value: "awesomeFlag", label: "Awesome flag" },
  { value: "validRedshiftFlag", label: "Valid-redshift flag" },
  { value: "hasComment", label: "Has comment" },
  { value: "commentLength", label: "Comment length" },
];

export const analysisSortMetricOptions: Array<SelectOption<AnalysisMetric>> = [
  { value: "totalClassifications", label: "Total classifications" },
  { value: "lsbAgreementCount", label: "Is-LSB agreement count" },
  { value: "lsbAgreementRate", label: "Is-LSB agreement rate" },
  { value: "lsbComparableVotes", label: "Comparable Is-LSB votes" },
  { value: "lsbVotes", label: "LSB votes" },
  { value: "nonLsbVotes", label: "Non-LSB votes" },
  { value: "morphologyAgreementCount", label: "Morphology agreement count" },
  { value: "morphologyAgreementRate", label: "Morphology agreement rate" },
  { value: "featurelessVotes", label: "Featureless votes" },
  { value: "irregularVotes", label: "Irr/other votes" },
  { value: "ltgVotes", label: "LTG votes" },
  { value: "etgVotes", label: "ETG votes" },
  { value: "awesomeVotes", label: "Awesome votes" },
  { value: "validRedshiftVotes", label: "Valid-redshift votes" },
  {
    value: "commentedClassifications",
    label: "Classifications with comments",
  },
  { value: "maxCommentLength", label: "Maximum comment length" },
  { value: "averageCommentLength", label: "Average comment length" },
  { value: "visibleNucleusVotes", label: "Visible-nucleus yes votes" },
  {
    value: "visibleNucleusComparableVotes",
    label: "Visible-nucleus answered votes",
  },
  {
    value: "visibleNucleusAgreementCount",
    label: "Visible-nucleus agreement count",
  },
  {
    value: "visibleNucleusAgreementRate",
    label: "Visible-nucleus agreement rate",
  },
  { value: "failedFittingVotes", label: "Failed-fitting yes votes" },
  {
    value: "failedFittingComparableVotes",
    label: "Failed-fitting answered votes",
  },
  {
    value: "failedFittingAgreementCount",
    label: "Failed-fitting agreement count",
  },
  {
    value: "failedFittingAgreementRate",
    label: "Failed-fitting agreement rate",
  },
  {
    value: "nucleusConfirmationRate",
    label: "Visible-nucleus confirmation rate",
  },
];

export const analysisHistogramMetricOptions: Array<
  SelectOption<AnalysisMetric>
> = [...analysisSortMetricOptions];

export const analysisClassificationHistogramMetricOptions: Array<
  SelectOption<AnalysisClassificationMetric>
> = [
  { value: "failedFittingFlag", label: "Failed-fitting yes flag" },
  {
    value: "failedFittingAnsweredFlag",
    label: "Failed-fitting answered flag",
  },
  { value: "visibleNucleusFlag", label: "Visible-nucleus yes flag" },
  {
    value: "visibleNucleusAnsweredFlag",
    label: "Visible-nucleus answered flag",
  },
  { value: "awesomeFlag", label: "Awesome flag" },
  { value: "validRedshiftFlag", label: "Valid-redshift flag" },
  { value: "hasComment", label: "Has comment" },
  { value: "commentLength", label: "Comment length" },
];

export const analysisDistributionScaleOptions: Array<
  SelectOption<AnalysisDistributionComparisonScale>
> = [
  { value: "count", label: "Counts" },
  { value: "relativeFrequency", label: "Relative frequency" },
];

export const analysisOperatorOptions: Array<SelectOption<AnalysisOperator>> = [
  { value: "atLeast", label: "At least" },
  { value: "exactly", label: "Exactly" },
  { value: "atMost", label: "At most" },
];

export const analysisCommentRuleModeOptions: Array<
  SelectOption<AnalysisCommentRuleMode>
> = [
  { value: "containsAny", label: "Contains any term" },
  { value: "notContainsAny", label: "Does not contain any term" },
];

export const catalogNucleusOptions: Array<
  SelectOption<CatalogNucleusFilter>
> = [
  { value: "any", label: "Any catalog nucleus state" },
  { value: "yes", label: "Catalog says nucleus" },
  { value: "no", label: "Catalog says no nucleus" },
];

export const dominantLsbOptions: Array<SelectOption<DominantLsbFilter>> = [
  { value: "any", label: "Any Is-LSB outcome" },
  { value: "lsb", label: "Dominant Is-LSB = LSB" },
  { value: "nonLsb", label: "Dominant Is-LSB = Non-LSB" },
  { value: "split", label: "Split Is-LSB votes" },
  { value: "noComparableVotes", label: "No comparable Is-LSB votes" },
];

export function createAnalysisLocalId() {
  return `analysis-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createAnalysisCondition(
  metric: AnalysisConditionMetric = "totalClassifications",
  operator: AnalysisOperator = "atLeast",
  count = 1
): AnalysisQueryCondition {
  return {
    id: createAnalysisLocalId(),
    metric,
    operator,
    count,
  };
}

export function createAnalysisClassificationCondition(
  metric: AnalysisClassificationConditionMetric = "classificationCreationTime",
  operator: AnalysisOperator = "atMost",
  count = Date.now()
): AnalysisClassificationComparisonCondition {
  return {
    id: createAnalysisLocalId(),
    metric,
    operator,
    count,
  };
}

export function createAnalysisCommentRule(
  mode: AnalysisCommentRuleMode = "containsAny",
  terms = ""
): AnalysisCommentRule {
  return {
    id: createAnalysisLocalId(),
    mode,
    terms,
  };
}

export function createBlankAnalysisQuery(): AnalysisQueryConfig {
  return {
    id: createAnalysisLocalId(),
    name: "Custom query",
    description: "",
    paper: "__any__",
    catalogNucleus: "any",
    dominantLsb: "any",
    conditions: [createAnalysisCondition("totalClassifications", "atLeast", 1)],
    commentRules: [],
    sortBy: "totalClassifications",
    sortDirection: "desc",
    histogramMetric: "totalClassifications",
    previewLimit: 10,
  };
}

export function createBlankAnalysisDistributionComparison(): AnalysisDistributionComparisonConfig {
  return {
    id: createAnalysisLocalId(),
    name: "Threshold split histogram",
    description:
      "Compare the histogram metric for galaxies that pass the configured thresholds versus galaxies that fail them.",
    paper: "__any__",
    catalogNucleus: "any",
    dominantLsb: "any",
    conditions: [createAnalysisCondition("totalClassifications", "atLeast", 1)],
    histogramMetric: "totalClassifications",
    histogramScale: "count",
  };
}

export function createBlankAnalysisClassificationDistributionComparison(): AnalysisClassificationDistributionComparisonConfig {
  return {
    id: createAnalysisLocalId(),
    name: "Classification threshold split",
    description:
      "Compare a classification-level histogram metric for classifications that pass the configured thresholds versus classifications in the same scope that fail them.",
    paper: "__any__",
    catalogNucleus: "any",
    dominantLsb: "any",
    conditions: [
      createAnalysisClassificationCondition(
        "classificationCreationTime",
        "atLeast",
        Date.now()
      ),
    ],
    histogramMetric: "failedFittingFlag",
    histogramScale: "count",
  };
}

export function duplicateAnalysisQuery(
  query: AnalysisQueryConfig
): AnalysisQueryConfig {
  return {
    ...query,
    id: createAnalysisLocalId(),
    name: `${query.name} copy`,
    conditions: query.conditions.map((condition) => ({
      ...condition,
      id: createAnalysisLocalId(),
    })),
    commentRules: query.commentRules.map((rule) => ({
      ...rule,
      id: createAnalysisLocalId(),
    })),
  };
}

export function duplicateAnalysisDistributionComparison(
  comparison: AnalysisDistributionComparisonConfig
): AnalysisDistributionComparisonConfig {
  return {
    ...comparison,
    id: createAnalysisLocalId(),
    name: `${comparison.name} copy`,
    conditions: comparison.conditions.map((condition) => ({
      ...condition,
      id: createAnalysisLocalId(),
    })),
  };
}

export function duplicateAnalysisClassificationDistributionComparison(
  comparison: AnalysisClassificationDistributionComparisonConfig
): AnalysisClassificationDistributionComparisonConfig {
  return {
    ...comparison,
    id: createAnalysisLocalId(),
    name: `${comparison.name} copy`,
    conditions: comparison.conditions.map((condition) => ({
      ...condition,
      id: createAnalysisLocalId(),
    })),
  };
}

export function buildDefaultAnalysisQueries(): AnalysisQueryConfig[] {
  return [
    {
      id: createAnalysisLocalId(),
      name: "Strongest Is-LSB consensus",
      description:
        "Galaxies with at least three comparable Is-LSB votes, ordered by the clearest top-level LSB vs Non-LSB consensus.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("lsbComparableVotes", "atLeast", 3)],
      commentRules: [],
      sortBy: "lsbAgreementRate",
      sortDirection: "desc",
      histogramMetric: "lsbAgreementCount",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Split Is-LSB decisions",
      description:
        "Galaxies where the first decision in the tree, Is-LSB, is the most contested after requiring three comparable votes.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("lsbComparableVotes", "atLeast", 3)],
      commentRules: [],
      sortBy: "lsbAgreementRate",
      sortDirection: "asc",
      histogramMetric: "lsbAgreementCount",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "LSB-majority morphology consensus",
      description:
        "Among galaxies whose dominant Is-LSB outcome is LSB, surface the clearest morphology consensus.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "lsb",
      conditions: [
        createAnalysisCondition("lsbAgreementCount", "atLeast", 3),
        createAnalysisCondition("totalClassifications", "atLeast", 3),
      ],
      commentRules: [],
      sortBy: "morphologyAgreementRate",
      sortDirection: "desc",
      histogramMetric: "morphologyAgreementCount",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Visible-nucleus agreement inside LSB-majority galaxies",
      description:
        "For galaxies considered LSB first, inspect how strongly the visible-nucleus answers align when that question was answered.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "lsb",
      conditions: [
        createAnalysisCondition("lsbAgreementCount", "atLeast", 3),
        createAnalysisCondition("visibleNucleusComparableVotes", "atLeast", 2),
      ],
      commentRules: [],
      sortBy: "visibleNucleusAgreementRate",
      sortDirection: "desc",
      histogramMetric: "visibleNucleusAgreementCount",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "Awesome-flag standouts with stable Is-LSB calls",
      description:
        "Targets that attracted repeated awesome flags after the top-level Is-LSB call already looks stable.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [
        createAnalysisCondition("awesomeVotes", "atLeast", 2),
        createAnalysisCondition("lsbAgreementCount", "atLeast", 3),
      ],
      commentRules: [],
      sortBy: "awesomeVotes",
      sortDirection: "desc",
      histogramMetric: "awesomeVotes",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "Failed-fitting pileups",
      description:
        "Galaxies that accumulated repeated failed-fitting responses, kept separate from the Is-LSB decision itself.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("failedFittingVotes", "atLeast", 2)],
      commentRules: [],
      sortBy: "failedFittingVotes",
      sortDirection: "desc",
      histogramMetric: "failedFittingVotes",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "Highly commented targets",
      description:
        "Items that attracted multiple written comments, which can point to ambiguous or exceptional cases worth follow-up.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [
        createAnalysisCondition("commentedClassifications", "atLeast", 2),
      ],
      commentRules: [],
      sortBy: "commentedClassifications",
      sortDirection: "desc",
      histogramMetric: "commentedClassifications",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "Longest comment standouts",
      description:
        "Cases where at least one classifier left a long note, often a signal that the object looked unusual or difficult.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("commentedClassifications", "atLeast", 1)],
      commentRules: [],
      sortBy: "maxCommentLength",
      sortDirection: "desc",
      histogramMetric: "maxCommentLength",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "Consistently detailed comments",
      description:
        "Galaxies where the written comments were not just present, but consistently substantial across the commented classifications.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("commentedClassifications", "atLeast", 2)],
      commentRules: [],
      sortBy: "averageCommentLength",
      sortDirection: "desc",
      histogramMetric: "averageCommentLength",
      previewLimit: 10,
    },
  ];
}

export function buildDefaultAnalysisDistributionComparisons(): AnalysisDistributionComparisonConfig[] {
  return [];
}

export function buildDefaultAnalysisClassificationDistributionComparisons(): AnalysisClassificationDistributionComparisonConfig[] {
  return [
    {
      id: createAnalysisLocalId(),
      name: "Failed-fitting votes before Feb 16, 2026",
      description:
        "Compare classification-level failed-fitting labels before Feb 16, 2026 against classifications created on or after that date.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [
        createAnalysisClassificationCondition(
          "classificationCreationTime",
          "atMost",
          DISTRIBUTION_EXAMPLE_SPLIT_TIME
        ),
      ],
      histogramMetric: "failedFittingFlag",
      histogramScale: "relativeFrequency",
    },
  ];
}

export function createEmptyAggregate(): AnalysisAggregate {
  return {
    totalClassifications: 0,
    lsbVotes: 0,
    nonLsbVotes: 0,
    failedFittingVotes: 0,
    failedFittingComparableVotes: 0,
    featurelessVotes: 0,
    irregularVotes: 0,
    ltgVotes: 0,
    etgVotes: 0,
    awesomeVotes: 0,
    validRedshiftVotes: 0,
    commentedClassifications: 0,
    totalCommentLength: 0,
    maxCommentLength: 0,
    visibleNucleusVotes: 0,
    visibleNucleusComparableVotes: 0,
  };
}

export function getNormalizedComment(comment: string | undefined) {
  const trimmedComment = comment?.trim();
  return trimmedComment && trimmedComment.length > 0 ? trimmedComment : null;
}

export function accumulateClassificationVote(
  aggregate: AnalysisAggregate,
  vote: AnalysisClassificationVote
) {
  aggregate.totalClassifications += 1;

  const normalizedComment = getNormalizedComment(vote.comments);
  if (normalizedComment) {
    aggregate.commentedClassifications += 1;
    aggregate.totalCommentLength += normalizedComment.length;
    aggregate.maxCommentLength = Math.max(
      aggregate.maxCommentLength,
      normalizedComment.length
    );
  }

  const failedFittingComparableVote = vote.failed_fitting !== undefined;
  const failedFittingVote = vote.failed_fitting === true;

  if (failedFittingComparableVote) {
    aggregate.failedFittingComparableVotes += 1;
  }
  if (failedFittingVote) {
    aggregate.failedFittingVotes += 1;
  }

  if (vote.lsb_class === 1) {
    aggregate.lsbVotes += 1;
  } else if (vote.lsb_class === 0) {
    aggregate.nonLsbVotes += 1;
  }

  switch (vote.morphology) {
    case -1:
      aggregate.featurelessVotes += 1;
      break;
    case 0:
      aggregate.irregularVotes += 1;
      break;
    case 1:
      aggregate.ltgVotes += 1;
      break;
    case 2:
      aggregate.etgVotes += 1;
      break;
    default:
      break;
  }

  if (vote.awesome_flag) {
    aggregate.awesomeVotes += 1;
  }
  if (vote.valid_redshift) {
    aggregate.validRedshiftVotes += 1;
  }
  if (vote.visible_nucleus !== undefined) {
    aggregate.visibleNucleusComparableVotes += 1;
    if (vote.visible_nucleus) {
      aggregate.visibleNucleusVotes += 1;
    }
  }
}

function buildDecisionSummary<State extends string>(
  values: Array<{ state: State; label: string; count: number }>,
  comparableVotes: number,
  splitChoice: { state: State; label: string },
  emptyChoice: { state: State; label: string }
): AnalysisDecisionSummary<State> {
  if (comparableVotes <= 0) {
    return {
      state: emptyChoice.state,
      label: emptyChoice.label,
      agreementCount: 0,
      agreementRate: null,
      comparableVotes: 0,
    };
  }

  const maxCount = Math.max(...values.map((value) => value.count));
  const winners = values.filter((value) => value.count === maxCount && value.count > 0);

  if (winners.length !== 1) {
    return {
      state: splitChoice.state,
      label: splitChoice.label,
      agreementCount: maxCount,
      agreementRate: maxCount / comparableVotes,
      comparableVotes,
    };
  }

  return {
    state: winners[0].state,
    label: winners[0].label,
    agreementCount: maxCount,
    agreementRate: maxCount / comparableVotes,
    comparableVotes,
  };
}

function buildBinaryDecisionSummary(
  yesVotes: number,
  comparableVotes: number,
  labels: {
    yes: string;
    no: string;
    split: string;
    noResponses: string;
  }
): AnalysisDecisionSummary<"yes" | "no" | "split" | "noResponses"> {
  return buildDecisionSummary(
    [
      { state: "yes", label: labels.yes, count: yesVotes },
      {
        state: "no",
        label: labels.no,
        count: Math.max(comparableVotes - yesVotes, 0),
      },
    ],
    comparableVotes,
    { state: "split", label: labels.split },
    { state: "noResponses", label: labels.noResponses }
  );
}

export function getLsbVoteLabel(vote: Pick<AnalysisClassificationVote, "lsb_class" | "failed_fitting">) {
  if (vote.lsb_class === 1) {
    return LSB_LABELS.lsb;
  }

  if (vote.lsb_class === 0) {
    return LSB_LABELS.nonLsb;
  }

  return `Unexpected raw value (${vote.lsb_class})`;
}

export function getMorphologyVoteLabel(morphology: number) {
  switch (morphology) {
    case -1:
      return MORPHOLOGY_LABELS.featureless;
    case 1:
      return MORPHOLOGY_LABELS.ltg;
    case 2:
      return MORPHOLOGY_LABELS.etg;
    default:
      return MORPHOLOGY_LABELS.irregular;
  }
}

export function getVotePreview(
  votes: AnalysisClassificationVote[],
  metric: "lsb" | "morphology",
  limit = 5
) {
  return votes.slice(0, limit).map((vote) =>
    metric === "lsb" ? getLsbVoteLabel(vote) : getMorphologyVoteLabel(vote.morphology)
  );
}

export function buildAnalysisRecord(
  galaxy: AnalysisGalaxy,
  aggregate: AnalysisAggregate,
  votes: AnalysisClassificationVote[]
): AnalysisRecord {
  const total = aggregate.totalClassifications;
  const sortedVotes = [...votes].sort(
    (left, right) => left._creationTime - right._creationTime
  );
  const lsbComparableVotes = aggregate.lsbVotes + aggregate.nonLsbVotes;
  const lsb = buildDecisionSummary(
    [
      { state: "lsb", label: LSB_LABELS.lsb, count: aggregate.lsbVotes },
      {
        state: "nonLsb",
        label: LSB_LABELS.nonLsb,
        count: aggregate.nonLsbVotes,
      },
    ],
    lsbComparableVotes,
    { state: "split", label: LSB_LABELS.split },
    {
      state: "noComparableVotes",
      label: LSB_LABELS.noComparableVotes,
    }
  );
  const morphology = buildDecisionSummary(
    [
      {
        state: "featureless",
        label: MORPHOLOGY_LABELS.featureless,
        count: aggregate.featurelessVotes,
      },
      {
        state: "irregular",
        label: MORPHOLOGY_LABELS.irregular,
        count: aggregate.irregularVotes,
      },
      { state: "ltg", label: MORPHOLOGY_LABELS.ltg, count: aggregate.ltgVotes },
      { state: "etg", label: MORPHOLOGY_LABELS.etg, count: aggregate.etgVotes },
    ],
    total,
    { state: "split", label: MORPHOLOGY_LABELS.split },
    {
      state: "noClassifications",
      label: MORPHOLOGY_LABELS.noClassifications,
    }
  );
  const visibleNucleus = buildBinaryDecisionSummary(
    aggregate.visibleNucleusVotes,
    aggregate.visibleNucleusComparableVotes,
    VISIBLE_NUCLEUS_LABELS
  );
  const failedFitting = buildBinaryDecisionSummary(
    aggregate.failedFittingVotes,
    aggregate.failedFittingComparableVotes,
    FAILED_FITTING_LABELS
  );

  return {
    galaxy,
    aggregate,
    votes: sortedVotes,
    firstClassificationTime: sortedVotes[0]?._creationTime ?? null,
    averageCommentLength:
      aggregate.commentedClassifications > 0
        ? aggregate.totalCommentLength / aggregate.commentedClassifications
        : null,
    commentSearchTexts: sortedVotes
      .map((vote) => getNormalizedComment(vote.comments)?.toLowerCase() ?? null)
      .filter((comment): comment is string => comment !== null),
    lsb,
    morphology,
    visibleNucleus,
    failedFitting,
    nucleusConfirmationRate:
      aggregate.visibleNucleusComparableVotes > 0
        ? aggregate.visibleNucleusVotes / aggregate.visibleNucleusComparableVotes
        : null,
    dominantLsbLabel: lsb.label,
    dominantMorphologyLabel: morphology.label,
  };
}

export function getMetricLabel(metric: AnalysisMetric) {
  return METRIC_META[metric].label;
}

export function getClassificationMetricLabel(metric: AnalysisClassificationMetric) {
  return CLASSIFICATION_METRIC_META[metric].label;
}

export function getConditionMetricLabel(metric: AnalysisConditionMetric) {
  if (metric === "galaxyCreationTime") {
    return "Galaxy row creation time";
  }

  if (metric === "firstClassificationTime") {
    return "First classification time";
  }

  return getMetricLabel(metric);
}

export function getClassificationConditionMetricLabel(
  metric: AnalysisClassificationConditionMetric
) {
  if (metric === "classificationCreationTime") {
    return "Classification creation time";
  }

  return getClassificationMetricLabel(metric);
}

export function getDistributionScaleLabel(
  scale: AnalysisDistributionComparisonScale
) {
  return scale === "relativeFrequency" ? "Relative frequency" : "Counts";
}

export function getMetricShortLabel(metric: AnalysisMetric) {
  return METRIC_META[metric].shortLabel;
}

export function getClassificationMetricShortLabel(
  metric: AnalysisClassificationMetric
) {
  return CLASSIFICATION_METRIC_META[metric].shortLabel;
}

export function isRatioMetric(metric: AnalysisMetric) {
  return METRIC_META[metric].isRatio;
}

export function formatMetricValue(metric: AnalysisMetric, value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (isRatioMetric(metric)) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toLocaleString();
}

export function formatClassificationMetricValue(
  metric: AnalysisClassificationMetric,
  value: number | null
) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (metric === "commentLength") {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

export function formatPaperLabel(paper: string | null | undefined) {
  if (!paper) {
    return "No paper";
  }

  return paper;
}

export function isDateTimeConditionMetric(metric: AnalysisConditionMetric) {
  return metric === "galaxyCreationTime" || metric === "firstClassificationTime";
}

export function isDateTimeClassificationConditionMetric(
  metric: AnalysisClassificationConditionMetric
) {
  return metric === "classificationCreationTime";
}

export function formatAnalysisDateTime(timestamp: number | null | undefined) {
  if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp)) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatConditionThreshold(
  metric: AnalysisConditionMetric,
  value: number
) {
  if (isDateTimeConditionMetric(metric)) {
    return formatAnalysisDateTime(value);
  }

  return Math.max(0, Math.floor(value || 0)).toLocaleString();
}

export function formatClassificationConditionThreshold(
  metric: AnalysisClassificationConditionMetric,
  value: number
) {
  if (isDateTimeClassificationConditionMetric(metric)) {
    return formatAnalysisDateTime(value);
  }

  return Math.max(0, Math.floor(value || 0)).toLocaleString();
}

export function toDateTimeLocalInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeLocalInputValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function clampPreviewLimit(value: number) {
  return Math.max(1, Math.min(Math.floor(value || 0), ANALYSIS_MAX_PREVIEW_LIMIT));
}

function getMetricValue(record: AnalysisRecord, metric: AnalysisMetric) {
  switch (metric) {
    case "totalClassifications":
      return record.aggregate.totalClassifications;
    case "lsbComparableVotes":
      return record.lsb.comparableVotes;
    case "lsbVotes":
      return record.aggregate.lsbVotes;
    case "nonLsbVotes":
      return record.aggregate.nonLsbVotes;
    case "failedFittingVotes":
      return record.aggregate.failedFittingVotes;
    case "lsbAgreementCount":
      return record.lsb.agreementCount;
    case "featurelessVotes":
      return record.aggregate.featurelessVotes;
    case "irregularVotes":
      return record.aggregate.irregularVotes;
    case "ltgVotes":
      return record.aggregate.ltgVotes;
    case "etgVotes":
      return record.aggregate.etgVotes;
    case "morphologyAgreementCount":
      return record.morphology.agreementCount;
    case "awesomeVotes":
      return record.aggregate.awesomeVotes;
    case "validRedshiftVotes":
      return record.aggregate.validRedshiftVotes;
    case "commentedClassifications":
      return record.aggregate.commentedClassifications;
    case "maxCommentLength":
      return record.aggregate.maxCommentLength;
    case "averageCommentLength":
      return record.averageCommentLength ?? 0;
    case "visibleNucleusVotes":
      return record.aggregate.visibleNucleusVotes;
    case "visibleNucleusComparableVotes":
      return record.visibleNucleus.comparableVotes;
    case "visibleNucleusAgreementCount":
      return record.visibleNucleus.agreementCount;
    case "failedFittingComparableVotes":
      return record.failedFitting.comparableVotes;
    case "failedFittingAgreementCount":
      return record.failedFitting.agreementCount;
    case "lsbAgreementRate":
      return record.lsb.agreementRate ?? 0;
    case "morphologyAgreementRate":
      return record.morphology.agreementRate ?? 0;
    case "visibleNucleusAgreementRate":
      return record.visibleNucleus.agreementRate ?? 0;
    case "failedFittingAgreementRate":
      return record.failedFitting.agreementRate ?? 0;
    case "nucleusConfirmationRate":
      return record.nucleusConfirmationRate ?? 0;
  }
}

function getConditionMetricValue(
  record: AnalysisRecord,
  metric: AnalysisConditionMetric
) {
  if (metric === "galaxyCreationTime") {
    return record.galaxy._creationTime;
  }

  if (metric === "firstClassificationTime") {
    return record.firstClassificationTime;
  }

  return getMetricValue(record, metric);
}

function getClassificationMetricValue(
  point: AnalysisClassificationPoint,
  metric: AnalysisClassificationMetric
) {
  switch (metric) {
    case "failedFittingFlag":
      return point.vote.failed_fitting === true ? 1 : 0;
    case "failedFittingAnsweredFlag":
      return point.vote.failed_fitting !== undefined ? 1 : 0;
    case "visibleNucleusFlag":
      return point.vote.visible_nucleus === true ? 1 : 0;
    case "visibleNucleusAnsweredFlag":
      return point.vote.visible_nucleus !== undefined ? 1 : 0;
    case "awesomeFlag":
      return point.vote.awesome_flag ? 1 : 0;
    case "validRedshiftFlag":
      return point.vote.valid_redshift ? 1 : 0;
    case "hasComment":
      return point.normalizedComment ? 1 : 0;
    case "commentLength":
      return point.commentLength;
  }
}

function getClassificationConditionMetricValue(
  point: AnalysisClassificationPoint,
  metric: AnalysisClassificationConditionMetric
) {
  if (metric === "classificationCreationTime") {
    return point.vote._creationTime;
  }

  return getClassificationMetricValue(point, metric);
}

function normalizeConditionThreshold(
  metric: AnalysisConditionMetric,
  value: number
) {
  if (isDateTimeConditionMetric(metric)) {
    return value;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeClassificationConditionThreshold(
  metric: AnalysisClassificationConditionMetric,
  value: number
) {
  if (isDateTimeClassificationConditionMetric(metric)) {
    return value;
  }

  return Math.max(0, Math.floor(value));
}

function matchesCondition(
  record: AnalysisRecord,
  condition: AnalysisQueryCondition
) {
  const value = getConditionMetricValue(record, condition.metric);
  if (value === null) {
    return false;
  }
  const threshold = normalizeConditionThreshold(condition.metric, condition.count);

  switch (condition.operator) {
    case "atLeast":
      return value >= threshold;
    case "atMost":
      return value <= threshold;
    case "exactly":
      return value === threshold;
  }
}

function matchesClassificationCondition(
  point: AnalysisClassificationPoint,
  condition: AnalysisClassificationComparisonCondition
) {
  const value = getClassificationConditionMetricValue(point, condition.metric);
  const threshold = normalizeClassificationConditionThreshold(
    condition.metric,
    condition.count
  );

  switch (condition.operator) {
    case "atLeast":
      return value >= threshold;
    case "atMost":
      return value <= threshold;
    case "exactly":
      return value === threshold;
  }
}

function matchesSharedFilters(
  record: AnalysisRecord,
  filters: Pick<
    | AnalysisQueryConfig
    | AnalysisDistributionComparisonConfig
    | AnalysisClassificationDistributionComparisonConfig,
    "paper" | "catalogNucleus" | "dominantLsb"
  >
) {
  if (filters.paper !== "__any__") {
    const recordPaper = record.galaxy.paper ?? "";
    if (recordPaper !== filters.paper) {
      return false;
    }
  }

  if (filters.catalogNucleus === "yes" && !record.galaxy.nucleus) {
    return false;
  }
  if (filters.catalogNucleus === "no" && record.galaxy.nucleus) {
    return false;
  }

  if (filters.dominantLsb !== "any" && record.lsb.state !== filters.dominantLsb) {
    return false;
  }

  return true;
}

function matchesAllConditions(
  record: AnalysisRecord,
  conditions: AnalysisQueryCondition[]
) {
  return conditions.every((condition) => matchesCondition(record, condition));
}

function matchesAllClassificationConditions(
  point: AnalysisClassificationPoint,
  conditions: AnalysisClassificationComparisonCondition[]
) {
  return conditions.every((condition) =>
    matchesClassificationCondition(point, condition)
  );
}

function parseCommentTerms(input: string) {
  return input
    .split(/[\n,;]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}

function matchesCommentRule(record: AnalysisRecord, rule: AnalysisCommentRule) {
  const terms = parseCommentTerms(rule.terms);
  if (terms.length === 0) {
    return true;
  }

  const hasMatchingComment = record.commentSearchTexts.some((comment) =>
    terms.some((term) => comment.includes(term))
  );

  return rule.mode === "containsAny" ? hasMatchingComment : !hasMatchingComment;
}

function compareNumbers(
  left: number,
  right: number,
  direction: QuerySortDirection
) {
  if (left === right) {
    return 0;
  }

  if (direction === "asc") {
    return left < right ? -1 : 1;
  }

  return left > right ? -1 : 1;
}

function getRateTieBreakMetric(metric: AnalysisMetric): AnalysisMetric | null {
  switch (metric) {
    case "lsbAgreementRate":
      return "lsbAgreementCount";
    case "morphologyAgreementRate":
      return "morphologyAgreementCount";
    case "visibleNucleusAgreementRate":
      return "visibleNucleusAgreementCount";
    case "failedFittingAgreementRate":
      return "failedFittingAgreementCount";
    default:
      return null;
  }
}

function compareRecords(
  left: AnalysisRecord,
  right: AnalysisRecord,
  sortBy: AnalysisMetric,
  direction: QuerySortDirection
) {
  const primary = compareNumbers(
    getMetricValue(left, sortBy),
    getMetricValue(right, sortBy),
    direction
  );
  if (primary !== 0) {
    return primary;
  }

  const tieBreakMetric = getRateTieBreakMetric(sortBy);
  if (tieBreakMetric) {
    const secondary = compareNumbers(
      getMetricValue(left, tieBreakMetric),
      getMetricValue(right, tieBreakMetric),
      "desc"
    );
    if (secondary !== 0) {
      return secondary;
    }
  }

  const totalClassifications = compareNumbers(
    left.aggregate.totalClassifications,
    right.aggregate.totalClassifications,
    "desc"
  );
  if (totalClassifications !== 0) {
    return totalClassifications;
  }

  const leftNumericId = left.galaxy.numericId ?? Number.MAX_SAFE_INTEGER;
  const rightNumericId = right.galaxy.numericId ?? Number.MAX_SAFE_INTEGER;
  const numericIdComparison = compareNumbers(leftNumericId, rightNumericId, "asc");
  if (numericIdComparison !== 0) {
    return numericIdComparison;
  }

  return left.galaxy.id.localeCompare(right.galaxy.id);
}

export function buildHistogramData(
  records: AnalysisRecord[],
  metric: AnalysisMetric
): HistogramDatum[] {
  if (records.length === 0) {
    return [];
  }

  const metricLabel = getMetricLabel(metric);

  if (isRatioMetric(metric)) {
    const bucketCounts = Array.from({ length: 10 }, () => 0);
    for (const record of records) {
      const rawValue = Math.max(0, Math.min(1, getMetricValue(record, metric)));
      const bucketIndex = rawValue >= 1 ? 9 : Math.floor(rawValue * 10);
      bucketCounts[bucketIndex] += 1;
    }

    return bucketCounts.map((count, index) => {
      const start = index * 10;
      const end = index === 9 ? 100 : (index + 1) * 10;
      return {
        key: `${metric}-${index}`,
        label: index === 9 ? `${start}-${end}%` : `${start}-${end}%`,
        count,
        metricLabel,
      };
    });
  }

  const values = records.map((record) =>
    Math.max(0, Math.round(getMetricValue(record, metric)))
  );
  const maxValue = Math.max(...values);

  if (metric === "totalClassifications" || metric === "commentedClassifications") {
    return Array.from({ length: maxValue + 1 }, (_, index) => ({
      key: `${metric}-${index}`,
      label: String(index),
      count: values.filter((value) => value === index).length,
      metricLabel,
    }));
  }

  if (metric === "maxCommentLength" || metric === "averageCommentLength") {
    const targetBucketCount = 8;
    const stepCandidates = [10, 25, 50, 100, 250, 500, 1000];
    const rawStep = Math.max(1, Math.ceil((maxValue + 1) / targetBucketCount));
    const bucketSize =
      stepCandidates.find((candidate) => candidate >= rawStep) ?? rawStep;
    const bucketCount = Math.max(1, Math.ceil((maxValue + 1) / bucketSize));
    const bucketValues = Array.from({ length: bucketCount }, () => 0);

    for (const value of values) {
      const index = Math.min(Math.floor(value / bucketSize), bucketCount - 1);
      bucketValues[index] += 1;
    }

    return bucketValues.map((count, index) => {
      const start = index * bucketSize;
      const end = Math.min(maxValue, start + bucketSize - 1);
      return {
        key: `${metric}-${start}-${end}`,
        label: `${start}-${end}`,
        count,
        metricLabel,
      };
    });
  }
  const exactBucketMax = Math.min(maxValue, 12);
  const hasOverflowBucket = maxValue > 12;
  const bucketCount = hasOverflowBucket ? exactBucketMax + 1 : exactBucketMax + 1;
  const bucketValues = Array.from({ length: bucketCount }, () => 0);

  for (const value of values) {
    const index = hasOverflowBucket ? Math.min(value, exactBucketMax) : value;
    bucketValues[index] += 1;
  }

  return bucketValues.map((count, index) => ({
    key: `${metric}-${index}`,
    label:
      hasOverflowBucket && index === exactBucketMax
        ? `${exactBucketMax}+`
        : String(index),
    count,
    metricLabel,
  }));
}

export function buildClassificationHistogramData(
  points: AnalysisClassificationPoint[],
  metric: AnalysisClassificationMetric
): HistogramDatum[] {
  if (points.length === 0) {
    return [];
  }

  const metricLabel = getClassificationMetricLabel(metric);
  const values = points.map((point) =>
    Math.max(0, Math.round(getClassificationMetricValue(point, metric)))
  );
  const maxValue = Math.max(...values);

  if (metric === "commentLength") {
    const targetBucketCount = 8;
    const stepCandidates = [10, 25, 50, 100, 250, 500, 1000];
    const rawStep = Math.max(1, Math.ceil((maxValue + 1) / targetBucketCount));
    const bucketSize =
      stepCandidates.find((candidate) => candidate >= rawStep) ?? rawStep;
    const bucketCount = Math.max(1, Math.ceil((maxValue + 1) / bucketSize));
    const bucketValues = Array.from({ length: bucketCount }, () => 0);

    for (const value of values) {
      const index = Math.min(Math.floor(value / bucketSize), bucketCount - 1);
      bucketValues[index] += 1;
    }

    return bucketValues.map((count, index) => {
      const start = index * bucketSize;
      const end = Math.min(maxValue, start + bucketSize - 1);
      return {
        key: `${metric}-${start}-${end}`,
        label: `${start}-${end}`,
        count,
        metricLabel,
      };
    });
  }

  return Array.from({ length: Math.max(maxValue, 1) + 1 }, (_, index) => ({
    key: `${metric}-${index}`,
    label: String(index),
    count: values.filter((value) => value === index).length,
    metricLabel,
  }));
}

function averageDefined(values: Array<number | null>) {
  const definedValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value)
  );

  if (definedValues.length === 0) {
    return null;
  }

  return (
    definedValues.reduce((sum, value) => sum + value, 0) / definedValues.length
  );
}

function computeMedian(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }

  return sortedValues[middleIndex];
}

function summarizeDistributionSubset(
  records: AnalysisRecord[],
  metric: AnalysisMetric,
  scopedCount: number
): AnalysisDistributionSubsetStats {
  if (records.length === 0) {
    return {
      recordCount: 0,
      shareOfScope: scopedCount > 0 ? 0 : null,
      averageMetric: null,
      medianMetric: null,
      minMetric: null,
      maxMetric: null,
    };
  }

  const values = records.map((record) => getMetricValue(record, metric));

  return {
    recordCount: records.length,
    shareOfScope: scopedCount > 0 ? records.length / scopedCount : null,
    averageMetric: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianMetric: computeMedian(values),
    minMetric: Math.min(...values),
    maxMetric: Math.max(...values),
  };
}

function summarizeClassificationDistributionSubset(
  points: AnalysisClassificationPoint[],
  metric: AnalysisClassificationMetric,
  scopedCount: number
): AnalysisDistributionSubsetStats {
  if (points.length === 0) {
    return {
      recordCount: 0,
      shareOfScope: scopedCount > 0 ? 0 : null,
      averageMetric: null,
      medianMetric: null,
      minMetric: null,
      maxMetric: null,
    };
  }

  const values = points.map((point) => getClassificationMetricValue(point, metric));

  return {
    recordCount: points.length,
    shareOfScope: scopedCount > 0 ? points.length / scopedCount : null,
    averageMetric: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianMetric: computeMedian(values),
    minMetric: Math.min(...values),
    maxMetric: Math.max(...values),
  };
}

function buildClassificationPoints(
  records: AnalysisRecord[],
  filters: Pick<
    AnalysisClassificationDistributionComparisonConfig,
    "paper" | "catalogNucleus" | "dominantLsb"
  >
) {
  const points: AnalysisClassificationPoint[] = [];

  for (const record of records) {
    if (!matchesSharedFilters(record, filters)) {
      continue;
    }

    for (const vote of record.votes) {
      const normalizedComment = getNormalizedComment(vote.comments);
      points.push({
        id: vote._id,
        vote,
        record,
        normalizedComment,
        commentLength: normalizedComment?.length ?? 0,
      });
    }
  }

  return points;
}

export function buildComparisonHistogramData(
  scopedHistogram: HistogramDatum[],
  matchedHistogram: HistogramDatum[],
  failedHistogram: HistogramDatum[]
): ComparisonHistogramDatum[] {
  const matchedTotal = matchedHistogram.reduce((sum, datum) => sum + datum.count, 0);
  const failedTotal = failedHistogram.reduce((sum, datum) => sum + datum.count, 0);
  const matchedByKey = new Map(
    matchedHistogram.map((datum) => [datum.key, datum.count])
  );
  const failedByKey = new Map(
    failedHistogram.map((datum) => [datum.key, datum.count])
  );
  const fallbackOrder = [...matchedHistogram, ...failedHistogram];
  const orderedBins =
    scopedHistogram.length > 0
      ? scopedHistogram
      : fallbackOrder.filter(
          (datum, index, allBins) =>
            allBins.findIndex((candidate) => candidate.key === datum.key) === index
        );

  return orderedBins.map((datum) => {
    const matchedCount = matchedByKey.get(datum.key) ?? 0;
    const failedCount = failedByKey.get(datum.key) ?? 0;

    return {
      key: datum.key,
      label: datum.label,
      metricLabel: datum.metricLabel,
      matchedCount,
      failedCount,
      matchedRelativeFrequency:
        matchedTotal > 0 ? matchedCount / matchedTotal : null,
      failedRelativeFrequency:
        failedTotal > 0 ? failedCount / failedTotal : null,
      totalCount: matchedCount + failedCount,
    };
  });
}

export function evaluateAnalysisQuery(
  records: AnalysisRecord[],
  query: AnalysisQueryConfig
): AnalysisQueryResult {
  const filtered = records.filter((record) => {
    if (!matchesSharedFilters(record, query)) {
      return false;
    }

    return (
      matchesAllConditions(record, query.conditions) &&
      query.commentRules.every((rule) => matchesCommentRule(record, rule))
    );
  });

  const sorted = [...filtered].sort((left, right) =>
    compareRecords(left, right, query.sortBy, query.sortDirection)
  );
  const previewLimit = clampPreviewLimit(query.previewLimit);
  const dominantLsbBreakdown: AnalysisDominantLsbBreakdown = {
    lsb: 0,
    nonLsb: 0,
    split: 0,
    noComparableVotes: 0,
  };
  for (const record of sorted) {
    dominantLsbBreakdown[record.lsb.state] += 1;
  }

  return {
    matchedCount: sorted.length,
    matchedRecords: sorted,
    previewRecords: sorted.slice(0, previewLimit),
    histogram: buildHistogramData(sorted, query.histogramMetric),
    totalMatchingClassifications: sorted.reduce(
      (sum, record) => sum + record.aggregate.totalClassifications,
      0
    ),
    totalMatchingCommentedClassifications: sorted.reduce(
      (sum, record) => sum + record.aggregate.commentedClassifications,
      0
    ),
    averageMatchingCommentLength: (() => {
      const totalCommentedClassifications = sorted.reduce(
        (sum, record) => sum + record.aggregate.commentedClassifications,
        0
      );
      if (totalCommentedClassifications <= 0) {
        return null;
      }

      const totalCommentLength = sorted.reduce(
        (sum, record) => sum + record.aggregate.totalCommentLength,
        0
      );
      return totalCommentLength / totalCommentedClassifications;
    })(),
    maxMatchingCommentLength: sorted.reduce(
      (maxLength, record) => Math.max(maxLength, record.aggregate.maxCommentLength),
      0
    ),
    averageLsbAgreementRate: averageDefined(
      sorted.map((record) => record.lsb.agreementRate)
    ),
    averageMorphologyAgreementRate: averageDefined(
      sorted.map((record) => record.morphology.agreementRate)
    ),
    averageVisibleNucleusAgreementRate: averageDefined(
      sorted.map((record) => record.visibleNucleus.agreementRate)
    ),
    averageFailedFittingAgreementRate: averageDefined(
      sorted.map((record) => record.failedFitting.agreementRate)
    ),
    dominantLsbBreakdown,
  };
}

export function evaluateAnalysisDistributionComparison(
  records: AnalysisRecord[],
  comparison: AnalysisDistributionComparisonConfig
): AnalysisDistributionComparisonResult {
  const scopedRecords = records.filter((record) =>
    matchesSharedFilters(record, comparison)
  );
  const matchedRecords = scopedRecords.filter((record) =>
    matchesAllConditions(record, comparison.conditions)
  );
  const failedRecords = scopedRecords.filter(
    (record) => !matchesAllConditions(record, comparison.conditions)
  );

  return {
    scopedCount: scopedRecords.length,
    matchedCount: matchedRecords.length,
    failedCount: failedRecords.length,
    scopedHistogram: buildHistogramData(scopedRecords, comparison.histogramMetric),
    matchedHistogram: buildHistogramData(
      matchedRecords,
      comparison.histogramMetric
    ),
    failedHistogram: buildHistogramData(
      failedRecords,
      comparison.histogramMetric
    ),
    matchedStats: summarizeDistributionSubset(
      matchedRecords,
      comparison.histogramMetric,
      scopedRecords.length
    ),
    failedStats: summarizeDistributionSubset(
      failedRecords,
      comparison.histogramMetric,
      scopedRecords.length
    ),
  };
}

export function evaluateAnalysisClassificationDistributionComparison(
  records: AnalysisRecord[],
  comparison: AnalysisClassificationDistributionComparisonConfig
): AnalysisClassificationDistributionComparisonResult {
  const scopedPoints = buildClassificationPoints(records, comparison);
  const matchedPoints = scopedPoints.filter((point) =>
    matchesAllClassificationConditions(point, comparison.conditions)
  );
  const failedPoints = scopedPoints.filter(
    (point) => !matchesAllClassificationConditions(point, comparison.conditions)
  );

  return {
    scopedCount: scopedPoints.length,
    matchedCount: matchedPoints.length,
    failedCount: failedPoints.length,
    scopedHistogram: buildClassificationHistogramData(
      scopedPoints,
      comparison.histogramMetric
    ),
    matchedHistogram: buildClassificationHistogramData(
      matchedPoints,
      comparison.histogramMetric
    ),
    failedHistogram: buildClassificationHistogramData(
      failedPoints,
      comparison.histogramMetric
    ),
    matchedStats: summarizeClassificationDistributionSubset(
      matchedPoints,
      comparison.histogramMetric,
      scopedPoints.length
    ),
    failedStats: summarizeClassificationDistributionSubset(
      failedPoints,
      comparison.histogramMetric,
      scopedPoints.length
    ),
  };
}

export function buildGlobalSummaryHistograms(records: AnalysisRecord[]) {
  const classifiedRecords = records.filter(
    (record) => record.aggregate.totalClassifications > 0
  );
  const lsbMajorityRecords = classifiedRecords.filter(
    (record) => record.lsb.state === "lsb"
  );

  return {
    classificationCoverage: buildHistogramData(classifiedRecords, "totalClassifications"),
    lsbAgreementCount: buildHistogramData(classifiedRecords, "lsbAgreementCount"),
    morphologyAgreementCount: buildHistogramData(
      lsbMajorityRecords,
      "morphologyAgreementCount"
    ),
    visibleNucleusAgreementCount: buildHistogramData(
      lsbMajorityRecords,
      "visibleNucleusAgreementCount"
    ),
    awesomeVotes: buildHistogramData(classifiedRecords, "awesomeVotes"),
    failedFittingVotes: buildHistogramData(
      classifiedRecords,
      "failedFittingVotes"
    ),
    nucleusConfirmation: buildHistogramData(
      classifiedRecords.filter((record) => record.galaxy.nucleus),
      "nucleusConfirmationRate"
    ),
  };
}

export function filterZeroCountHistogram(
  data: HistogramDatum[],
  hideZeroBucket: boolean
) {
  if (!hideZeroBucket) {
    return data;
  }

  return data.filter((datum) => datum.label !== "0");
}