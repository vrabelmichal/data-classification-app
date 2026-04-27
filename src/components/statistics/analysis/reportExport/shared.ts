import { getImageUrl } from "../../../../images";
import { getPreviewImageName } from "../../../../images/displaySettings";
import {
  formatPaperLabel,
  getVotePreview,
  type AnalysisClassificationPoint,
  type AnalysisClassificationDistributionComparisonConfig,
  type AnalysisDistributionComparisonConfig,
  type AnalysisQueryConfig,
  type AnalysisRecord,
  type HistogramDatum,
} from "../helpers";
import type { DatasetSummary, PreparedDataset, ZeroBucketState } from "../tabTypes";
import { formatPercent } from "../tabUtils";

export type GlobalHistogramKey =
  | "classificationCoverage"
  | "lsbAgreementCount"
  | "morphologyAgreementCount"
  | "visibleNucleusAgreementCount"
  | "awesomeVotes"
  | "failedFittingVotes"
  | "nucleusConfirmation";

export type ReportHistogramSection = {
  id: string;
  title: string;
  description: string;
  displayBins: HistogramDatum[];
  allBins: HistogramDatum[];
  zeroBucketHidden: boolean;
};

export type ExportInput = {
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

export const GLOBAL_HISTOGRAM_SECTIONS: Array<{
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

export const QUERY_OPERATOR_LABELS = {
  atLeast: "At least",
  atMost: "At most",
  exactly: "Exactly",
} as const;

export const CATALOG_NUCLEUS_LABELS = {
  any: "Any catalog nucleus state",
  yes: "Catalog says nucleus",
  no: "Catalog says no nucleus",
} as const;

export const DOMINANT_LSB_LABELS = {
  any: "Any Is-LSB outcome",
  lsb: "Dominant Is-LSB = LSB",
  nonLsb: "Dominant Is-LSB = Non-LSB",
  split: "Split Is-LSB votes",
  noComparableVotes: "No comparable Is-LSB votes",
} as const;

export function escapeHtml(value: unknown) {
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

export function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e");
}

export function formatFixed(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatAgreementSummary(
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

export function formatAnsweredVoteSummary(yesVotes: number, comparableVotes: number) {
  if (comparableVotes <= 0) {
    return "-";
  }

  return `${yesVotes}/${comparableVotes}`;
}

export function buildPreviewRecord(
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

export function getUserDisplayName(
  userId: string,
  userDisplayNames: Record<string, string>
) {
  return userDisplayNames[userId] ?? `User ${userId.slice(-6)}`;
}

export function getCommentPreview(comment: string, previewLength = 36) {
  if (comment.length <= previewLength) {
    return comment;
  }

  return `${comment.slice(0, previewLength).trimEnd()}...`;
}

export function formatBooleanValue(value: boolean | undefined) {
  if (value === undefined) {
    return "-";
  }

  return value ? "Yes" : "No";
}

export function buildClassificationPreviewPoint(
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

export type PreviewRecord = ReturnType<typeof buildPreviewRecord>;
export type ClassificationPreviewPointExport = ReturnType<
  typeof buildClassificationPreviewPoint
>;