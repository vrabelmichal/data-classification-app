import { getOptionalUserId } from "../../lib/auth";
import {
  galaxiesByDec,
  galaxiesByMag,
  galaxiesByMeanMue,
  galaxiesByNucleus,
  galaxiesByNumAwesomeFlag,
  galaxiesByNumVisibleNucleus,
  galaxiesByPa,
  galaxiesByQ,
  galaxiesByRa,
  galaxiesByReff,
  galaxiesByTotalAssigned,
  galaxiesByTotalClassifications,
} from "../aggregates";
import { buildGalaxyBrowseQuery } from "./queryBuilder";
import {
  createEmptyBrowseResult,
  createEmptySearchBounds,
  type GalaxySearchFilters,
  computeBounds,
  allowedSort,
  type Sortable,
} from "./shared";
import {
  handleClassifiedGalaxies,
  handleMySequenceGalaxies,
  handleSkippedGalaxies,
} from "./specialFilters";

const CLASSIFICATION_SEARCH_OPTIONS = {
  lsbClasses: [-1, 0, 1],
  morphologies: [-1, 0, 1, 2],
} as const;

const pickGalaxySearchFilters = (source: any): GalaxySearchFilters => ({
  searchId: source.searchId,
  searchRaMin: source.searchRaMin,
  searchRaMax: source.searchRaMax,
  searchDecMin: source.searchDecMin,
  searchDecMax: source.searchDecMax,
  searchReffMin: source.searchReffMin,
  searchReffMax: source.searchReffMax,
  searchQMin: source.searchQMin,
  searchQMax: source.searchQMax,
  searchPaMin: source.searchPaMin,
  searchPaMax: source.searchPaMax,
  searchMagMin: source.searchMagMin,
  searchMagMax: source.searchMagMax,
  searchMeanMueMin: source.searchMeanMueMin,
  searchMeanMueMax: source.searchMeanMueMax,
  searchNucleus: source.searchNucleus,
  searchTotalClassificationsMin: source.searchTotalClassificationsMin,
  searchTotalClassificationsMax: source.searchTotalClassificationsMax,
  searchNumVisibleNucleusMin: source.searchNumVisibleNucleusMin,
  searchNumVisibleNucleusMax: source.searchNumVisibleNucleusMax,
  searchNumAwesomeFlagMin: source.searchNumAwesomeFlagMin,
  searchNumAwesomeFlagMax: source.searchNumAwesomeFlagMax,
  searchNumFailedFittingMin: source.searchNumFailedFittingMin,
  searchNumFailedFittingMax: source.searchNumFailedFittingMax,
  searchTotalAssignedMin: source.searchTotalAssignedMin,
  searchTotalAssignedMax: source.searchTotalAssignedMax,
});

export const browseGalaxiesHandler = async (ctx: any, args: any) => {
  const userId = await getOptionalUserId(ctx);
  if (!userId) {
    return createEmptyBrowseResult();
  }

  const {
    cursor = null,
    numItems = 100,
    sortBy = "numericId",
    sortOrder = "asc",
    filter,
  } = args;

  const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";
  const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
    ? (sortBy as Sortable)
    : "numericId";
  const filters = pickGalaxySearchFilters(args);

  if (filter === "skipped") {
    return handleSkippedGalaxies({
      ctx,
      userId,
      cursor,
      numItems,
      sortOrder: normalizedSortOrder,
      requestedSort,
      filters,
    });
  }

  if (filter === "my_sequence") {
    return handleMySequenceGalaxies({
      ctx,
      userId,
      cursor,
      numItems,
      sortOrder: normalizedSortOrder,
      requestedSort,
      filters,
    });
  }

  if (filter === "classified" || filter === "unclassified") {
    return handleClassifiedGalaxies({
      ctx,
      userId,
      cursor,
      numItems,
      sortOrder: normalizedSortOrder,
      requestedSort,
      filterType: filter,
      filters,
    });
  }

  const q = buildGalaxyBrowseQuery(ctx, requestedSort, normalizedSortOrder, filters);
  const { page, isDone, continueCursor } = await q.paginate({ numItems, cursor: cursor || null });
  const galaxies: any[] = page;

  return {
    galaxies,
    hasNext: !isDone,
    hasPrevious: Boolean(cursor),
    aggregatesPopulated: false,
    cursor: continueCursor,
    isDone,
    currentBounds: computeBounds(galaxies),
  };
};

export const getGalaxySearchBoundsHandler = async (ctx: any) => {
  const userId = await getOptionalUserId(ctx);
  if (!userId) {
    return createEmptySearchBounds();
  }

  const [
    galaxiesByRaMin,
    galaxiesByRaMax,
    galaxiesByDecMin,
    galaxiesByDecMax,
    galaxiesByReffMin,
    galaxiesByReffMax,
    galaxiesByQMin,
    galaxiesByQMax,
    galaxiesByPaMin,
    galaxiesByPaMax,
    galaxiesByMagMin,
    galaxiesByMagMax,
    galaxiesByMeanMueMin,
    galaxiesByMeanMueMax,
    nucleusTrueCount,
    totalGalaxiesCount,
    galaxiesByTotalClassificationsMin,
    galaxiesByTotalClassificationsMax,
    galaxiesByNumVisibleNucleusMin,
    galaxiesByNumVisibleNucleusMax,
    galaxiesByNumAwesomeFlagMin,
    galaxiesByNumAwesomeFlagMax,
    galaxiesByTotalAssignedMin,
    galaxiesByTotalAssignedMax,
  ] = await Promise.all([
    galaxiesByRa.min(ctx).then((item) => item?.key),
    galaxiesByRa.max(ctx).then((item) => item?.key),
    galaxiesByDec.min(ctx).then((item) => item?.key),
    galaxiesByDec.max(ctx).then((item) => item?.key),
    galaxiesByReff.min(ctx).then((item) => item?.key),
    galaxiesByReff.max(ctx).then((item) => item?.key),
    galaxiesByQ.min(ctx).then((item) => item?.key),
    galaxiesByQ.max(ctx).then((item) => item?.key),
    galaxiesByPa.min(ctx).then((item) => item?.key),
    galaxiesByPa.max(ctx).then((item) => item?.key),
    galaxiesByMag.min(ctx).then((item) => item?.key),
    galaxiesByMag.max(ctx).then((item) => item?.key),
    galaxiesByMeanMue.min(ctx).then((item) => item?.key),
    galaxiesByMeanMue.max(ctx).then((item) => item?.key),
    galaxiesByNucleus.count(ctx, {
      bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } },
    }),
    galaxiesByNucleus.count(ctx),
    galaxiesByTotalClassifications.min(ctx).then((item) => item?.key),
    galaxiesByTotalClassifications.max(ctx).then((item) => item?.key),
    galaxiesByNumVisibleNucleus.min(ctx).then((item) => item?.key),
    galaxiesByNumVisibleNucleus.max(ctx).then((item) => item?.key),
    galaxiesByNumAwesomeFlag.min(ctx).then((item) => item?.key),
    galaxiesByNumAwesomeFlag.max(ctx).then((item) => item?.key),
    galaxiesByTotalAssigned.min(ctx).then((item) => item?.key),
    galaxiesByTotalAssigned.max(ctx).then((item) => item?.key),
  ]);

  return {
    ra: {
      min: galaxiesByRaMin ?? null,
      max: galaxiesByRaMax ?? null,
    },
    dec: {
      min: galaxiesByDecMin ?? null,
      max: galaxiesByDecMax ?? null,
    },
    reff: {
      min: galaxiesByReffMin ?? null,
      max: galaxiesByReffMax ?? null,
    },
    q: {
      min: galaxiesByQMin ?? null,
      max: galaxiesByQMax ?? null,
    },
    pa: {
      min: galaxiesByPaMin ?? null,
      max: galaxiesByPaMax ?? null,
    },
    mag: {
      min: galaxiesByMagMin ?? null,
      max: galaxiesByMagMax ?? null,
    },
    mean_mue: {
      min: galaxiesByMeanMueMin ?? null,
      max: galaxiesByMeanMueMax ?? null,
    },
    nucleus: {
      hasNucleus: nucleusTrueCount > 0,
      totalCount: totalGalaxiesCount,
    },
    totalClassifications: {
      min: galaxiesByTotalClassificationsMin ?? null,
      max: galaxiesByTotalClassificationsMax ?? null,
    },
    numVisibleNucleus: {
      min: galaxiesByNumVisibleNucleusMin ?? null,
      max: galaxiesByNumVisibleNucleusMax ?? null,
    },
    numAwesomeFlag: {
      min: galaxiesByNumAwesomeFlagMin ?? null,
      max: galaxiesByNumAwesomeFlagMax ?? null,
    },
    totalAssigned: {
      min: galaxiesByTotalAssignedMin ?? null,
      max: galaxiesByTotalAssignedMax ?? null,
    },
  };
};

export const getClassificationSearchOptionsHandler = async (ctx: any) => {
  const userId = await getOptionalUserId(ctx);
  if (!userId) {
    return {
      lsbClasses: [],
      morphologies: [],
    };
  }

  return {
    lsbClasses: [...CLASSIFICATION_SEARCH_OPTIONS.lsbClasses],
    morphologies: [...CLASSIFICATION_SEARCH_OPTIONS.morphologies],
  };
};
