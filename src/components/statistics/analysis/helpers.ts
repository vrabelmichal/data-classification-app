export type AnalysisConditionMetric =
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
  | "visibleNucleusVotes"
  | "visibleNucleusComparableVotes"
  | "visibleNucleusAgreementCount"
  | "failedFittingComparableVotes"
  | "failedFittingAgreementCount";

export type AnalysisRatioMetric =
  | "lsbAgreementRate"
  | "morphologyAgreementRate"
  | "visibleNucleusAgreementRate"
  | "failedFittingAgreementRate"
  | "nucleusConfirmationRate";

export type AnalysisMetric = AnalysisConditionMetric | AnalysisRatioMetric;

export type AnalysisOperator = "atLeast" | "atMost" | "exactly";
export type QuerySortDirection = "desc" | "asc";
export type CatalogNucleusFilter = "any" | "yes" | "no";
export type DominantLsbFilter =
  | "any"
  | "lsb"
  | "nonLsb"
  | "split"
  | "noComparableVotes";

export interface AnalysisGalaxy {
  _id: string;
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

export interface AnalysisQueryCondition {
  id: string;
  metric: AnalysisConditionMetric;
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
  sortBy: AnalysisMetric;
  sortDirection: QuerySortDirection;
  histogramMetric: AnalysisMetric;
  previewLimit: number;
}

export interface AnalysisDominantLsbBreakdown {
  lsb: number;
  nonLsb: number;
  split: number;
  noComparableVotes: number;
}

export interface AnalysisQueryResult {
  matchedCount: number;
  previewRecords: AnalysisRecord[];
  histogram: HistogramDatum[];
  totalMatchingClassifications: number;
  averageLsbAgreementRate: number | null;
  averageMorphologyAgreementRate: number | null;
  averageVisibleNucleusAgreementRate: number | null;
  averageFailedFittingAgreementRate: number | null;
  dominantLsbBreakdown: AnalysisDominantLsbBreakdown;
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

const LSB_LABELS = {
  failed: "Failed fitting",
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

export const analysisOperatorOptions: Array<SelectOption<AnalysisOperator>> = [
  { value: "atLeast", label: "At least" },
  { value: "exactly", label: "Exactly" },
  { value: "atMost", label: "At most" },
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

export function createBlankAnalysisQuery(): AnalysisQueryConfig {
  return {
    id: createAnalysisLocalId(),
    name: "Custom query",
    description: "",
    paper: "__any__",
    catalogNucleus: "any",
    dominantLsb: "any",
    conditions: [createAnalysisCondition("totalClassifications", "atLeast", 1)],
    sortBy: "totalClassifications",
    sortDirection: "desc",
    histogramMetric: "totalClassifications",
    previewLimit: 10,
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
      sortBy: "lsbAgreementRate",
      sortDirection: "desc",
      histogramMetric: "lsbAgreementCount",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Split Is-LSB decisions",
      description:
        "Galaxies where the first decision in the tree, Is-LSB, is the most contested after requiring four comparable votes.",
      paper: "__any__",
      catalogNucleus: "any",
      dominantLsb: "any",
      conditions: [createAnalysisCondition("lsbComparableVotes", "atLeast", 4)],
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
      sortBy: "failedFittingVotes",
      sortDirection: "desc",
      histogramMetric: "failedFittingVotes",
      previewLimit: 10,
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
    visibleNucleusVotes: 0,
    visibleNucleusComparableVotes: 0,
  };
}

export function accumulateClassificationVote(
  aggregate: AnalysisAggregate,
  vote: AnalysisClassificationVote
) {
  aggregate.totalClassifications += 1;

  const failedFittingComparableVote =
    vote.failed_fitting !== undefined || vote.lsb_class === -1;
  const failedFittingVote =
    vote.failed_fitting === true || vote.lsb_class === -1;

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
  if (vote.failed_fitting === true || vote.lsb_class === -1) {
    return LSB_LABELS.failed;
  }

  if (vote.lsb_class === 1) {
    return LSB_LABELS.lsb;
  }

  return LSB_LABELS.nonLsb;
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

export function getMetricShortLabel(metric: AnalysisMetric) {
  return METRIC_META[metric].shortLabel;
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

export function formatPaperLabel(paper: string | null | undefined) {
  if (!paper) {
    return "No paper";
  }

  return paper;
}

export function clampPreviewLimit(value: number) {
  return Math.max(1, Math.min(Math.floor(value || 0), 10));
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

function matchesCondition(
  record: AnalysisRecord,
  condition: AnalysisQueryCondition
) {
  const value = getMetricValue(record, condition.metric);
  const threshold = Math.max(0, Math.floor(condition.count));

  switch (condition.operator) {
    case "atLeast":
      return value >= threshold;
    case "atMost":
      return value <= threshold;
    case "exactly":
      return value === threshold;
  }
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

  const values = records.map((record) => Math.max(0, Math.round(getMetricValue(record, metric))));
  const maxValue = Math.max(...values);
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

export function evaluateAnalysisQuery(
  records: AnalysisRecord[],
  query: AnalysisQueryConfig
): AnalysisQueryResult {
  const filtered = records.filter((record) => {
    if (query.paper !== "__any__") {
      const recordPaper = record.galaxy.paper ?? "";
      if (recordPaper !== query.paper) {
        return false;
      }
    }

    if (query.catalogNucleus === "yes" && !record.galaxy.nucleus) {
      return false;
    }
    if (query.catalogNucleus === "no" && record.galaxy.nucleus) {
      return false;
    }

    if (query.dominantLsb !== "any" && record.lsb.state !== query.dominantLsb) {
      return false;
    }

    return query.conditions.every((condition) => matchesCondition(record, condition));
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
    previewRecords: sorted.slice(0, previewLimit),
    histogram: buildHistogramData(sorted, query.histogramMetric),
    totalMatchingClassifications: sorted.reduce(
      (sum, record) => sum + record.aggregate.totalClassifications,
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

export function buildGlobalSummaryHistograms(records: AnalysisRecord[]) {
  const classifiedRecords = records.filter(
    (record) => record.aggregate.totalClassifications > 0
  );
  const lsbMajorityRecords = classifiedRecords.filter(
    (record) => record.lsb.state === "lsb"
  );

  return {
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