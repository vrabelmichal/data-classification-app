export type AnalysisConditionMetric =
  | "totalClassifications"
  | "lsbVotes"
  | "nonLsbVotes"
  | "failedFittingVotes"
  | "featurelessVotes"
  | "irregularVotes"
  | "ltgVotes"
  | "etgVotes"
  | "awesomeVotes"
  | "validRedshiftVotes"
  | "visibleNucleusVotes";

export type AnalysisRatioMetric =
  | "agreementScore"
  | "disagreementScore"
  | "lsbAgreement"
  | "morphologyAgreement"
  | "nucleusConfirmationRate";

export type AnalysisMetric = AnalysisConditionMetric | AnalysisRatioMetric;

export type AnalysisOperator = "atLeast" | "atMost" | "exactly";
export type QuerySortDirection = "desc" | "asc";
export type CatalogNucleusFilter = "any" | "yes" | "no";

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
  featurelessVotes: number;
  irregularVotes: number;
  ltgVotes: number;
  etgVotes: number;
  awesomeVotes: number;
  validRedshiftVotes: number;
  visibleNucleusVotes: number;
}

export interface AnalysisAgreement {
  lsb: number;
  morphology: number;
  overall: number;
}

export interface AnalysisRecord {
  galaxy: AnalysisGalaxy;
  aggregate: AnalysisAggregate;
  votes: AnalysisClassificationVote[];
  agreement: AnalysisAgreement;
  disagreement: number;
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
  conditions: AnalysisQueryCondition[];
  sortBy: AnalysisMetric;
  sortDirection: QuerySortDirection;
  histogramMetric: AnalysisMetric;
  previewLimit: number;
}

export interface AnalysisQueryResult {
  matchedCount: number;
  previewRecords: AnalysisRecord[];
  histogram: HistogramDatum[];
  totalMatchingClassifications: number;
  averageAgreement: number | null;
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
    label: "Failed-fitting votes",
    shortLabel: "Failed",
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
    label: "Visible-nucleus votes",
    shortLabel: "Visible nucleus",
    isRatio: false,
  },
  agreementScore: {
    label: "Overall agreement",
    shortLabel: "Agreement",
    isRatio: true,
  },
  disagreementScore: {
    label: "Overall disagreement",
    shortLabel: "Disagreement",
    isRatio: true,
  },
  lsbAgreement: {
    label: "LSB agreement",
    shortLabel: "LSB agreement",
    isRatio: true,
  },
  morphologyAgreement: {
    label: "Morphology agreement",
    shortLabel: "Morph agreement",
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
} as const;

const MORPHOLOGY_LABELS = {
  featureless: "Featureless",
  irregular: "Irr/other",
  ltg: "LTG (Sp)",
  etg: "ETG (Ell)",
} as const;

export const analysisConditionMetricOptions: Array<
  SelectOption<AnalysisConditionMetric>
> = [
  { value: "totalClassifications", label: "Total classifications" },
  { value: "lsbVotes", label: "LSB votes" },
  { value: "nonLsbVotes", label: "Non-LSB votes" },
  { value: "failedFittingVotes", label: "Failed-fitting votes" },
  { value: "featurelessVotes", label: "Featureless votes" },
  { value: "irregularVotes", label: "Irr/other votes" },
  { value: "ltgVotes", label: "LTG votes" },
  { value: "etgVotes", label: "ETG votes" },
  { value: "awesomeVotes", label: "Awesome votes" },
  { value: "validRedshiftVotes", label: "Valid-redshift votes" },
  { value: "visibleNucleusVotes", label: "Visible-nucleus votes" },
];

export const analysisSortMetricOptions: Array<SelectOption<AnalysisMetric>> = [
  { value: "agreementScore", label: "Overall agreement" },
  { value: "disagreementScore", label: "Overall disagreement" },
  { value: "totalClassifications", label: "Total classifications" },
  { value: "awesomeVotes", label: "Awesome votes" },
  { value: "visibleNucleusVotes", label: "Visible-nucleus votes" },
  { value: "nucleusConfirmationRate", label: "Visible-nucleus confirmation rate" },
  { value: "lsbVotes", label: "LSB votes" },
  { value: "etgVotes", label: "ETG votes" },
  { value: "lsbAgreement", label: "LSB agreement" },
  { value: "morphologyAgreement", label: "Morphology agreement" },
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
      name: "Most agreed galaxies",
      description:
        "Galaxies with at least three classifications, ranked by how strongly the votes line up across LSB, morphology, and the binary flags.",
      paper: "__any__",
      catalogNucleus: "any",
      conditions: [createAnalysisCondition("totalClassifications", "atLeast", 3)],
      sortBy: "agreementScore",
      sortDirection: "desc",
      histogramMetric: "agreementScore",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Most disputed galaxies",
      description:
        "Galaxies where multiple users weighed in but the votes split the hardest.",
      paper: "__any__",
      catalogNucleus: "any",
      conditions: [createAnalysisCondition("totalClassifications", "atLeast", 4)],
      sortBy: "disagreementScore",
      sortDirection: "desc",
      histogramMetric: "disagreementScore",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Awesome-flag standouts",
      description:
        "Targets that attracted repeated awesome flags, ordered by the strongest follow-up interest.",
      paper: "__any__",
      catalogNucleus: "any",
      conditions: [createAnalysisCondition("awesomeVotes", "atLeast", 2)],
      sortBy: "awesomeVotes",
      sortDirection: "desc",
      histogramMetric: "awesomeVotes",
      previewLimit: 5,
    },
    {
      id: createAnalysisLocalId(),
      name: "Catalog nucleus confirmations",
      description:
        "Catalog nuclei that users repeatedly confirmed with the visible-nucleus flag.",
      paper: "__any__",
      catalogNucleus: "yes",
      conditions: [
        createAnalysisCondition("visibleNucleusVotes", "atLeast", 2),
        createAnalysisCondition("totalClassifications", "atLeast", 2),
      ],
      sortBy: "nucleusConfirmationRate",
      sortDirection: "desc",
      histogramMetric: "visibleNucleusVotes",
      previewLimit: 10,
    },
    {
      id: createAnalysisLocalId(),
      name: "LSB ETG nucleus candidates",
      description:
        "A stronger composite question: galaxies called LSB by at least three people, ETG by at least two, with repeated visible-nucleus and awesome votes.",
      paper: "__any__",
      catalogNucleus: "any",
      conditions: [
        createAnalysisCondition("lsbVotes", "atLeast", 3),
        createAnalysisCondition("etgVotes", "atLeast", 2),
        createAnalysisCondition("visibleNucleusVotes", "atLeast", 2),
        createAnalysisCondition("awesomeVotes", "atLeast", 2),
      ],
      sortBy: "agreementScore",
      sortDirection: "desc",
      histogramMetric: "awesomeVotes",
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
    featurelessVotes: 0,
    irregularVotes: 0,
    ltgVotes: 0,
    etgVotes: 0,
    awesomeVotes: 0,
    validRedshiftVotes: 0,
    visibleNucleusVotes: 0,
  };
}

export function accumulateClassificationVote(
  aggregate: AnalysisAggregate,
  vote: AnalysisClassificationVote
) {
  aggregate.totalClassifications += 1;

  const failedFittingVote = vote.failed_fitting === true || vote.lsb_class === -1;
  if (failedFittingVote) {
    aggregate.failedFittingVotes += 1;
  } else if (vote.lsb_class === 1) {
    aggregate.lsbVotes += 1;
  } else {
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
  if (vote.visible_nucleus) {
    aggregate.visibleNucleusVotes += 1;
  }
}

function getDominantLabel(
  values: Array<{ label: string; count: number }>,
  fallback: string
) {
  const dominant = values.reduce<{ label: string; count: number } | null>(
    (current, candidate) => {
      if (!current || candidate.count > current.count) {
        return candidate;
      }
      return current;
    },
    null
  );

  if (!dominant || dominant.count <= 0) {
    return fallback;
  }

  return dominant.label;
}

function calculateDominantShare(values: number[], total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.max(...values) / total;
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
  const lsbAgreement = calculateDominantShare(
    [aggregate.failedFittingVotes, aggregate.nonLsbVotes, aggregate.lsbVotes],
    total
  );
  const morphologyAgreement = calculateDominantShare(
    [
      aggregate.featurelessVotes,
      aggregate.irregularVotes,
      aggregate.ltgVotes,
      aggregate.etgVotes,
    ],
    total
  );
  const awesomeAgreement = calculateDominantShare(
    [aggregate.awesomeVotes, Math.max(total - aggregate.awesomeVotes, 0)],
    total
  );
  const validRedshiftAgreement = calculateDominantShare(
    [
      aggregate.validRedshiftVotes,
      Math.max(total - aggregate.validRedshiftVotes, 0),
    ],
    total
  );
  const visibleNucleusAgreement = calculateDominantShare(
    [
      aggregate.visibleNucleusVotes,
      Math.max(total - aggregate.visibleNucleusVotes, 0),
    ],
    total
  );

  const agreementValues = [
    lsbAgreement,
    morphologyAgreement,
    awesomeAgreement,
    validRedshiftAgreement,
    visibleNucleusAgreement,
  ];
  const overallAgreement =
    agreementValues.reduce((sum, value) => sum + value, 0) /
    agreementValues.length;

  return {
    galaxy,
    aggregate,
    votes: sortedVotes,
    agreement: {
      lsb: lsbAgreement,
      morphology: morphologyAgreement,
      overall: total > 0 ? overallAgreement : 0,
    },
    disagreement: total > 0 ? 1 - overallAgreement : 0,
    nucleusConfirmationRate:
      total > 0 ? aggregate.visibleNucleusVotes / total : null,
    dominantLsbLabel: getDominantLabel(
      [
        { label: LSB_LABELS.failed, count: aggregate.failedFittingVotes },
        { label: LSB_LABELS.nonLsb, count: aggregate.nonLsbVotes },
        { label: LSB_LABELS.lsb, count: aggregate.lsbVotes },
      ],
      "No classifications"
    ),
    dominantMorphologyLabel: getDominantLabel(
      [
        {
          label: MORPHOLOGY_LABELS.featureless,
          count: aggregate.featurelessVotes,
        },
        { label: MORPHOLOGY_LABELS.irregular, count: aggregate.irregularVotes },
        { label: MORPHOLOGY_LABELS.ltg, count: aggregate.ltgVotes },
        { label: MORPHOLOGY_LABELS.etg, count: aggregate.etgVotes },
      ],
      "No classifications"
    ),
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
    case "lsbVotes":
      return record.aggregate.lsbVotes;
    case "nonLsbVotes":
      return record.aggregate.nonLsbVotes;
    case "failedFittingVotes":
      return record.aggregate.failedFittingVotes;
    case "featurelessVotes":
      return record.aggregate.featurelessVotes;
    case "irregularVotes":
      return record.aggregate.irregularVotes;
    case "ltgVotes":
      return record.aggregate.ltgVotes;
    case "etgVotes":
      return record.aggregate.etgVotes;
    case "awesomeVotes":
      return record.aggregate.awesomeVotes;
    case "validRedshiftVotes":
      return record.aggregate.validRedshiftVotes;
    case "visibleNucleusVotes":
      return record.aggregate.visibleNucleusVotes;
    case "agreementScore":
      return record.agreement.overall;
    case "disagreementScore":
      return record.disagreement;
    case "lsbAgreement":
      return record.agreement.lsb;
    case "morphologyAgreement":
      return record.agreement.morphology;
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

    return query.conditions.every((condition) => matchesCondition(record, condition));
  });

  const sorted = [...filtered].sort((left, right) =>
    compareRecords(left, right, query.sortBy, query.sortDirection)
  );
  const previewLimit = clampPreviewLimit(query.previewLimit);

  return {
    matchedCount: sorted.length,
    previewRecords: sorted.slice(0, previewLimit),
    histogram: buildHistogramData(sorted, query.histogramMetric),
    totalMatchingClassifications: sorted.reduce(
      (sum, record) => sum + record.aggregate.totalClassifications,
      0
    ),
    averageAgreement:
      sorted.length > 0
        ? sorted.reduce((sum, record) => sum + record.agreement.overall, 0) /
          sorted.length
        : null,
  };
}

export function buildGlobalSummaryHistograms(records: AnalysisRecord[]) {
  const classifiedRecords = records.filter(
    (record) => record.aggregate.totalClassifications > 0
  );

  return {
    agreement: buildHistogramData(classifiedRecords, "agreementScore"),
    awesomeVotes: buildHistogramData(classifiedRecords, "awesomeVotes"),
    visibleNucleusVotes: buildHistogramData(
      classifiedRecords,
      "visibleNucleusVotes"
    ),
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