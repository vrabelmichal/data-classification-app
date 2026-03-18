import { v } from "convex/values";
import { query } from "../_generated/server";
import { getOptionalUserId } from "../lib/auth";
import {
  galaxiesByRa,
  galaxiesByDec,
  galaxiesByReff,
  galaxiesByQ,
  galaxiesByPa,
  galaxiesByMag,
  galaxiesByMeanMue,
  galaxiesByNucleus,
  galaxiesByTotalClassifications,
  galaxiesByNumVisibleNucleus,
  galaxiesByNumAwesomeFlag,
  galaxiesByNumFailedFitting,
  galaxiesByTotalAssigned,
} from "./aggregates";
// Aggregates are not used in this implementation; we rely on Convex indexes + paginate


const SKIPPED_CURSOR_PREFIX = "SKIPPED:";

/**
 * Safely convert a string to BigInt, returning null on invalid input.
 */
const safeBigInt = (value: string | undefined | null): bigint | null => {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const parseSkippedCursor = (cursor: string | null) => {
  if (!cursor || !cursor.startsWith(SKIPPED_CURSOR_PREFIX)) {
    return 0;
  }
  const rawOffset = Number.parseInt(cursor.slice(SKIPPED_CURSOR_PREFIX.length), 10);
  return Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
};

const serializeSkippedCursor = (offset: number) => `${SKIPPED_CURSOR_PREFIX}${offset}`;

const computeBounds = (galaxies: any[]) => {
  const raValues = galaxies.map((g) => g.ra).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const decValues = galaxies.map((g) => g.dec).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const reffValues = galaxies.map((g) => g.reff).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const qValues = galaxies.map((g) => g.q).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const paValues = galaxies.map((g) => g.pa).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const magValues = galaxies.map((g) => g.mag).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const meanMueValues = galaxies.map((g) => g.mean_mue).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const nucleusCount = galaxies.filter((g) => g.nucleus === true).length;

  return {
    ra: {
      min: raValues.length > 0 ? Math.min(...raValues) : null,
      max: raValues.length > 0 ? Math.max(...raValues) : null,
    },
    dec: {
      min: decValues.length > 0 ? Math.min(...decValues) : null,
      max: decValues.length > 0 ? Math.max(...decValues) : null,
    },
    reff: {
      min: reffValues.length > 0 ? Math.min(...reffValues) : null,
      max: reffValues.length > 0 ? Math.max(...reffValues) : null,
    },
    q: {
      min: qValues.length > 0 ? Math.min(...qValues) : null,
      max: qValues.length > 0 ? Math.max(...qValues) : null,
    },
    pa: {
      min: paValues.length > 0 ? Math.min(...paValues) : null,
      max: paValues.length > 0 ? Math.max(...paValues) : null,
    },
    mag: {
      min: magValues.length > 0 ? Math.min(...magValues) : null,
      max: magValues.length > 0 ? Math.max(...magValues) : null,
    },
    mean_mue: {
      min: meanMueValues.length > 0 ? Math.min(...meanMueValues) : null,
      max: meanMueValues.length > 0 ? Math.max(...meanMueValues) : null,
    },
    nucleus: {
      hasNucleus: nucleusCount > 0,
      totalCount: galaxies.length,
    },
  };
};

type Sortable =
  | "numericId"
  | "id"
  | "ra"
  | "dec"
  | "reff"
  | "q"
  | "pa"
  | "mag"
  | "mean_mue"
  | "nucleus"
  | "totalClassifications"
  | "numVisibleNucleus"
  | "numAwesomeFlag"
  | "numFailedFitting"
  | "totalAssigned";

type GalaxySearchFilters = {
  searchId?: string;
  searchRaMin?: string;
  searchRaMax?: string;
  searchDecMin?: string;
  searchDecMax?: string;
  searchReffMin?: string;
  searchReffMax?: string;
  searchQMin?: string;
  searchQMax?: string;
  searchPaMin?: string;
  searchPaMax?: string;
  searchMagMin?: string;
  searchMagMax?: string;
  searchMeanMueMin?: string;
  searchMeanMueMax?: string;
  searchNucleus?: boolean;
  searchTotalClassificationsMin?: string;
  searchTotalClassificationsMax?: string;
  searchNumVisibleNucleusMin?: string;
  searchNumVisibleNucleusMax?: string;
  searchNumAwesomeFlagMin?: string;
  searchNumAwesomeFlagMax?: string;
  searchNumFailedFittingMin?: string;
  searchNumFailedFittingMax?: string;
  searchTotalAssignedMin?: string;
  searchTotalAssignedMax?: string;
};

const allowedSort: Record<Sortable, { index: string; field: string }> = {
  numericId: { index: "by_numeric_id", field: "numericId" },
  id: { index: "by_external_id", field: "id" },
  ra: { index: "by_ra", field: "ra" },
  dec: { index: "by_dec", field: "dec" },
  reff: { index: "by_reff", field: "reff" },
  q: { index: "by_q", field: "q" },
  pa: { index: "by_pa", field: "pa" },
  mag: { index: "by_mag", field: "mag" },
  mean_mue: { index: "by_mean_mue", field: "mean_mue" },
  nucleus: { index: "by_nucleus", field: "nucleus" },
  totalClassifications: { index: "by_totalClassifications", field: "totalClassifications" },
  numVisibleNucleus: { index: "by_numVisibleNucleus", field: "numVisibleNucleus" },
  numAwesomeFlag: { index: "by_numAwesomeFlag", field: "numAwesomeFlag" },
  numFailedFitting: { index: "by_numFailedFitting", field: "numFailedFitting" },
  totalAssigned: { index: "by_totalAssigned_numericId", field: "totalAssigned" },
};

const buildGalaxyBrowseQuery = (
  ctx: any,
  requestedSort: Sortable,
  sortOrder: "asc" | "desc",
  filters: GalaxySearchFilters,
) => {
  const {
    searchId,
    searchRaMin,
    searchRaMax,
    searchDecMin,
    searchDecMax,
    searchReffMin,
    searchReffMax,
    searchQMin,
    searchQMax,
    searchPaMin,
    searchPaMax,
    searchMagMin,
    searchMagMax,
    searchMeanMueMin,
    searchMeanMueMax,
    searchNucleus,
    searchTotalClassificationsMin,
    searchTotalClassificationsMax,
    searchNumVisibleNucleusMin,
    searchNumVisibleNucleusMax,
    searchNumAwesomeFlagMin,
    searchNumAwesomeFlagMax,
    searchNumFailedFittingMin,
    searchNumFailedFittingMax,
    searchTotalAssignedMin,
    searchTotalAssignedMax,
  } = filters;

  let indexName = allowedSort[requestedSort].index;
  let indexBuilder: ((qb: any) => any) | undefined;

  const applyRange = (qb: any, field: string, min?: string, max?: string) => {
    let out = qb;
    if (min) out = out.gte(field, parseFloat(min));
    if (max) out = out.lte(field, parseFloat(max));
    return out;
  };

  const applyInt64Range = (qb: any, field: string, min?: string, max?: string) => {
    let out = qb;
    const minVal = safeBigInt(min);
    const maxVal = safeBigInt(max);
    if (minVal !== null) out = out.gte(field, minVal);
    if (maxVal !== null) out = out.lte(field, maxVal);
    return out;
  };

  switch (requestedSort) {
    case "numericId":
      if (searchMagMin || searchMagMax) {
        indexName = "by_numericId_mag";
      } else if (searchMeanMueMin || searchMeanMueMax) {
        indexName = "by_numericId_mean_mue";
      } else if (searchQMin || searchQMax) {
        indexName = "by_numericId_q";
      } else if (searchReffMin || searchReffMax) {
        indexName = "by_numericId_reff";
      }
      break;
    case "ra":
      if (searchDecMin || searchDecMax) {
        indexName = "by_ra_dec";
        indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
      } else if (searchRaMin || searchRaMax) {
        indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
      }
      break;
    case "reff":
      if (searchMeanMueMin || searchMeanMueMax) {
        indexName = "by_reff_mean_mue";
        indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
      } else if (searchMagMin || searchMagMax) {
        indexName = "by_reff_mag";
        indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
      } else if (searchReffMin || searchReffMax) {
        indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
      }
      break;
    case "mag":
      if (searchReffMin || searchReffMax) {
        indexName = "by_mag_reff";
        indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
      } else if (searchMagMin || searchMagMax) {
        indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
      }
      break;
    case "mean_mue":
      if (searchReffMin || searchReffMax) {
        indexName = "by_mean_mue_reff";
        indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
      } else if (searchMeanMueMin || searchMeanMueMax) {
        indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
      }
      break;
    case "q":
      if (searchReffMin || searchReffMax) {
        indexName = "by_q_reff";
        indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
      } else if (searchQMin || searchQMax) {
        indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
      }
      break;
    case "nucleus":
      if (searchNucleus !== undefined) {
        indexBuilder = (qb) => qb.eq("nucleus", !!searchNucleus);
        if (searchMagMin || searchMagMax) indexName = "by_nucleus_mag";
        else if (searchMeanMueMin || searchMeanMueMax) indexName = "by_nucleus_mean_mue";
        else if (searchQMin || searchQMax) indexName = "by_nucleus_q";
      }
      break;
    case "id":
      if (searchId) {
        indexBuilder = (qb) => qb.eq("id", searchId.trim());
      }
      break;
    case "dec":
      if (searchDecMin || searchDecMax) {
        indexBuilder = (qb) => applyRange(qb, "dec", searchDecMin, searchDecMax);
      }
      break;
    case "pa":
      if (searchPaMin || searchPaMax) {
        indexBuilder = (qb) => applyRange(qb, "pa", searchPaMin, searchPaMax);
      }
      break;
    case "totalClassifications":
      if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "totalClassifications", searchTotalClassificationsMin, searchTotalClassificationsMax);
      }
      break;
    case "numVisibleNucleus":
      if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numVisibleNucleus", searchNumVisibleNucleusMin, searchNumVisibleNucleusMax);
      }
      break;
    case "numAwesomeFlag":
      if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numAwesomeFlag", searchNumAwesomeFlagMin, searchNumAwesomeFlagMax);
      }
      break;
    case "numFailedFitting":
      if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numFailedFitting", searchNumFailedFittingMin, searchNumFailedFittingMax);
      }
      break;
    case "totalAssigned":
      if (searchTotalAssignedMin || searchTotalAssignedMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "totalAssigned", searchTotalAssignedMin, searchTotalAssignedMax);
      }
      break;
  }

  let qBase = ctx.db.query("galaxies");
  let q: any = indexBuilder
    ? qBase.withIndex(indexName as any, indexBuilder as any)
    : qBase.withIndex(indexName as any);

  q = q.order(sortOrder as any);

  if (searchId) q = q.filter((f: any) => f.eq(f.field("id"), searchId.trim()));
  if (searchRaMin) q = q.filter((f: any) => f.gte(f.field("ra"), parseFloat(searchRaMin)));
  if (searchRaMax) q = q.filter((f: any) => f.lte(f.field("ra"), parseFloat(searchRaMax)));
  if (searchDecMin) q = q.filter((f: any) => f.gte(f.field("dec"), parseFloat(searchDecMin)));
  if (searchDecMax) q = q.filter((f: any) => f.lte(f.field("dec"), parseFloat(searchDecMax)));
  if (searchReffMin) q = q.filter((f: any) => f.gte(f.field("reff"), parseFloat(searchReffMin)));
  if (searchReffMax) q = q.filter((f: any) => f.lte(f.field("reff"), parseFloat(searchReffMax)));
  if (searchQMin) q = q.filter((f: any) => f.gte(f.field("q"), parseFloat(searchQMin)));
  if (searchQMax) q = q.filter((f: any) => f.lte(f.field("q"), parseFloat(searchQMax)));
  if (searchPaMin) q = q.filter((f: any) => f.gte(f.field("pa"), parseFloat(searchPaMin)));
  if (searchPaMax) q = q.filter((f: any) => f.lte(f.field("pa"), parseFloat(searchPaMax)));
  if (searchMagMin) q = q.filter((f: any) => f.gte(f.field("mag"), parseFloat(searchMagMin)));
  if (searchMagMax) q = q.filter((f: any) => f.lte(f.field("mag"), parseFloat(searchMagMax)));
  if (searchMeanMueMin) q = q.filter((f: any) => f.gte(f.field("mean_mue"), parseFloat(searchMeanMueMin)));
  if (searchMeanMueMax) q = q.filter((f: any) => f.lte(f.field("mean_mue"), parseFloat(searchMeanMueMax)));
  if (searchNucleus !== undefined) q = q.filter((f: any) => f.eq(f.field("nucleus"), !!searchNucleus));

  const totalClassificationsMinVal = safeBigInt(searchTotalClassificationsMin);
  const totalClassificationsMaxVal = safeBigInt(searchTotalClassificationsMax);
  const numVisibleNucleusMinVal = safeBigInt(searchNumVisibleNucleusMin);
  const numVisibleNucleusMaxVal = safeBigInt(searchNumVisibleNucleusMax);
  const numAwesomeFlagMinVal = safeBigInt(searchNumAwesomeFlagMin);
  const numAwesomeFlagMaxVal = safeBigInt(searchNumAwesomeFlagMax);
  const numFailedFittingMinVal = safeBigInt(searchNumFailedFittingMin);
  const numFailedFittingMaxVal = safeBigInt(searchNumFailedFittingMax);
  const totalAssignedMinVal = safeBigInt(searchTotalAssignedMin);
  const totalAssignedMaxVal = safeBigInt(searchTotalAssignedMax);

  if (totalClassificationsMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("totalClassifications"), totalClassificationsMinVal));
  if (totalClassificationsMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("totalClassifications"), totalClassificationsMaxVal));
  if (numVisibleNucleusMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numVisibleNucleus"), numVisibleNucleusMinVal));
  if (numVisibleNucleusMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numVisibleNucleus"), numVisibleNucleusMaxVal));
  if (numAwesomeFlagMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numAwesomeFlag"), numAwesomeFlagMinVal));
  if (numAwesomeFlagMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numAwesomeFlag"), numAwesomeFlagMaxVal));
  if (numFailedFittingMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numFailedFitting"), numFailedFittingMinVal));
  if (numFailedFittingMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numFailedFitting"), numFailedFittingMaxVal));
  if (totalAssignedMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("totalAssigned"), totalAssignedMinVal));
  if (totalAssignedMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("totalAssigned"), totalAssignedMaxVal));

  return q;
};

// Browse galaxies with offset-based pagination for proper page navigation

export const browseGalaxies = query({
  args: {
    // Keep offset for backward-compat, but pagination now uses a cursor
    offset: v.number(),
    numItems: v.number(),
    cursor: v.optional(v.string()),
    sortBy: v.optional(v.union(
      v.literal("id"),
      v.literal("ra"),
      v.literal("dec"),
      v.literal("reff"),
      v.literal("q"),
      v.literal("pa"),
      v.literal("mag"),
      v.literal("mean_mue"),
      v.literal("nucleus"),
      v.literal("numericId"),
      v.literal("totalClassifications"),
      v.literal("numVisibleNucleus"),
      v.literal("numAwesomeFlag"),
      v.literal("numFailedFitting"),
      v.literal("totalAssigned")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
    )),
    searchTerm: v.optional(v.string()), // Keep for backward compatibility
    searchId: v.optional(v.string()),
    searchRaMin: v.optional(v.string()),
    searchRaMax: v.optional(v.string()),
    searchDecMin: v.optional(v.string()),
    searchDecMax: v.optional(v.string()),
    searchReffMin: v.optional(v.string()),
    searchReffMax: v.optional(v.string()),
    searchQMin: v.optional(v.string()),
    searchQMax: v.optional(v.string()),
    searchPaMin: v.optional(v.string()),
    searchPaMax: v.optional(v.string()),
    searchMagMin: v.optional(v.string()),
    searchMagMax: v.optional(v.string()),
    searchMeanMueMin: v.optional(v.string()),
    searchMeanMueMax: v.optional(v.string()),
    searchNucleus: v.optional(v.boolean()),
    searchTotalClassificationsMin: v.optional(v.string()),
    searchTotalClassificationsMax: v.optional(v.string()),
    searchNumVisibleNucleusMin: v.optional(v.string()),
    searchNumVisibleNucleusMax: v.optional(v.string()),
    searchNumAwesomeFlagMin: v.optional(v.string()),
    searchNumAwesomeFlagMax: v.optional(v.string()),
    searchNumFailedFittingMin: v.optional(v.string()),
    searchNumFailedFittingMax: v.optional(v.string()),
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return {
        galaxies: [],
        total: 0,
        hasNext: false,
        hasPrevious: false,
        totalPages: 0,
        aggregatesPopulated: false,
        currentBounds: {
          ra: { min: null, max: null },
          dec: { min: null, max: null },
          reff: { min: null, max: null },
          q: { min: null, max: null },
          pa: { min: null, max: null },
          mag: { min: null, max: null },
          mean_mue: { min: null, max: null },
          nucleus: { hasNucleus: false, totalCount: 0 },
        },
        cursor: null as any,
        isDone: true,
      };
    }
    const {
      cursor = null,
      numItems = 100,
      sortBy = "numericId",
      sortOrder = "asc",
      filter,
      searchTerm,
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
      searchAwesome,
      searchValidRedshift,
      searchVisibleNucleus,
    } = args;

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    if (filter === "skipped") {
      return await handleSkippedGalaxies({
        ctx,
        userId,
        cursor,
        numItems,
  sortOrder: normalizedSortOrder,
        requestedSort,
        sortField: allowedSort[requestedSort].field,
        searchId,
        searchRaMin,
        searchRaMax,
        searchDecMin,
        searchDecMax,
        searchReffMin,
        searchReffMax,
        searchQMin,
        searchQMax,
        searchPaMin,
        searchPaMax,
        searchMagMin,
        searchMagMax,
        searchMeanMueMin,
        searchMeanMueMax,
        searchNucleus,
        searchTotalClassificationsMin,
        searchTotalClassificationsMax,
        searchNumVisibleNucleusMin,
        searchNumVisibleNucleusMax,
        searchNumAwesomeFlagMin,
        searchNumAwesomeFlagMax,
        searchNumFailedFittingMin,
        searchNumFailedFittingMax,
        searchTotalAssignedMin,
        searchTotalAssignedMax,
      });
    }

    if (filter === "my_sequence") {
      return await handleMySequenceGalaxies({
        ctx,
        userId,
        cursor,
        numItems,
        sortOrder: normalizedSortOrder,
        requestedSort,
        sortField: allowedSort[requestedSort].field,
        searchId,
        searchRaMin,
        searchRaMax,
        searchDecMin,
        searchDecMax,
        searchReffMin,
        searchReffMax,
        searchQMin,
        searchQMax,
        searchPaMin,
        searchPaMax,
        searchMagMin,
        searchMagMax,
        searchMeanMueMin,
        searchMeanMueMax,
        searchNucleus,
        searchTotalClassificationsMin,
        searchTotalClassificationsMax,
        searchNumVisibleNucleusMin,
        searchNumVisibleNucleusMax,
        searchNumAwesomeFlagMin,
        searchNumAwesomeFlagMax,
        searchNumFailedFittingMin,
        searchNumFailedFittingMax,
        searchTotalAssignedMin,
        searchTotalAssignedMax,
      });
    }

    if (filter === "classified" || filter === "unclassified") {
      return await handleClassifiedGalaxies({
        ctx,
        userId,
        cursor,
        numItems,
        sortOrder: normalizedSortOrder,
        requestedSort,
        sortField: allowedSort[requestedSort].field,
        filterType: filter,
        searchId,
        searchRaMin,
        searchRaMax,
        searchDecMin,
        searchDecMax,
        searchReffMin,
        searchReffMax,
        searchQMin,
        searchQMax,
        searchPaMin,
        searchPaMax,
        searchMagMin,
        searchMagMax,
        searchMeanMueMin,
        searchMeanMueMax,
        searchNucleus,
        searchTotalClassificationsMin,
        searchTotalClassificationsMax,
        searchNumVisibleNucleusMin,
        searchNumVisibleNucleusMax,
        searchNumAwesomeFlagMin,
        searchNumAwesomeFlagMax,
        searchNumFailedFittingMin,
        searchNumFailedFittingMax,
        searchTotalAssignedMin,
        searchTotalAssignedMax,
      });
    }

    const q = buildGalaxyBrowseQuery(ctx, requestedSort, normalizedSortOrder, {
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    });

    const { page, isDone, continueCursor } = await q.paginate({ numItems, cursor: cursor || null });
    let galaxies: any[] = page;

    // We rely on server-side filtering above; no additional in-memory filtering/pagination here
    let searchFilteredTotal = 0;
    
    // Note: "classified", "unclassified", and "my_sequence" filters are handled by dedicated handlers above

    // totalClassifications, numVisibleNucleus, numAwesomeFlag, numFailedFitting, totalAssigned handled server-side above

    searchFilteredTotal = galaxies.length;

    // Get total count for pagination info
    const total = searchFilteredTotal; // unknown overall; 0 unless a specific narrow search was performed
    const totalPages = 0;
    const hasNext = !isDone;
    const hasPrevious = false; // client tracks previous cursors

    // Calculate bounds of current result set for placeholders

    const currentBounds = computeBounds(galaxies);

    return {
      galaxies: galaxies,
      total,
      hasNext,
      hasPrevious,
      totalPages,
      aggregatesPopulated: false,
      cursor: continueCursor,
      isDone,
      currentBounds,
    };
  },
});

interface HandleSkippedOptions {
  ctx: any;
  userId: string;
  cursor: string | null;
  numItems: number;
  sortOrder: "asc" | "desc";
  requestedSort: Sortable;
  sortField: string;
  searchId?: string;
  searchRaMin?: string;
  searchRaMax?: string;
  searchDecMin?: string;
  searchDecMax?: string;
  searchReffMin?: string;
  searchReffMax?: string;
  searchQMin?: string;
  searchQMax?: string;
  searchPaMin?: string;
  searchPaMax?: string;
  searchMagMin?: string;
  searchMagMax?: string;
  searchMeanMueMin?: string;
  searchMeanMueMax?: string;
  searchNucleus?: boolean;
  searchTotalClassificationsMin?: string;
  searchTotalClassificationsMax?: string;
  searchNumVisibleNucleusMin?: string;
  searchNumVisibleNucleusMax?: string;
  searchNumAwesomeFlagMin?: string;
  searchNumAwesomeFlagMax?: string;
  searchNumFailedFittingMin?: string;
  searchNumFailedFittingMax?: string;
  searchTotalAssignedMin?: string;
  searchTotalAssignedMax?: string;
}

interface HandleClassifiedOptions extends HandleSkippedOptions {
  filterType: "classified" | "unclassified";
}

const CLASSIFIED_CURSOR_PREFIX = "CLASSIFIED:";

const parseClassifiedCursor = (cursor: string | null): { offset: number; galaxyCursor: string | null } => {
  if (!cursor || !cursor.startsWith(CLASSIFIED_CURSOR_PREFIX)) {
    return { offset: 0, galaxyCursor: null };
  }
  const payload = cursor.slice(CLASSIFIED_CURSOR_PREFIX.length);
  try {
    const parsed = JSON.parse(payload);
    return {
      offset: typeof parsed.offset === "number" ? parsed.offset : 0,
      galaxyCursor: parsed.galaxyCursor ?? null,
    };
  } catch {
    // Legacy format: just offset
    const rawOffset = Number.parseInt(payload, 10);
    return {
      offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
      galaxyCursor: null,
    };
  }
};

const serializeClassifiedCursor = (offset: number, galaxyCursor?: string | null) => 
  `${CLASSIFIED_CURSOR_PREFIX}${JSON.stringify({ offset, galaxyCursor })}`;

type MembershipLookup = {
  has: (galaxyId: string) => boolean;
  getMeta?: (galaxyId: string) => any;
};

interface ScanMembershipFilteredOptions {
  ctx: any;
  numItems: number;
  sortOrder: "asc" | "desc";
  requestedSort: Sortable;
  filters: GalaxySearchFilters;
  initialOffset: number;
  lookup: MembershipLookup;
  includeMembers: boolean;
  serializeCursor: (offset: number) => string;
  augmentGalaxy?: (galaxy: any, metadata: any) => any;
}

const scanMembershipFilteredGalaxies = async (options: ScanMembershipFilteredOptions) => {
  const {
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters,
    initialOffset,
    lookup,
    includeMembers,
    serializeCursor,
    augmentGalaxy,
  } = options;

  const q = buildGalaxyBrowseQuery(ctx, requestedSort, sortOrder, filters);
  const collected: any[] = [];
  let matchedBeforePage = 0;
  let rawCursor: string | null = null;
  let hasMore = false;
  let iterationCount = 0;
  const maxIterations = 100;
  const batchSize = Math.min(Math.max(numItems * (includeMembers ? 4 : 6), 200), 500);

  while (iterationCount < maxIterations) {
    iterationCount++;

    const {
      page: galaxyBatch,
      continueCursor,
      isDone,
    }: { page: any[]; continueCursor: string | null; isDone: boolean } = await q.paginate({
      numItems: batchSize,
      cursor: rawCursor,
    });

    if (galaxyBatch.length === 0) break;

    for (const galaxy of galaxyBatch) {
      const isMember = lookup.has(galaxy.id);
      if (includeMembers ? !isMember : isMember) continue;

      if (matchedBeforePage < initialOffset) {
        matchedBeforePage++;
        continue;
      }

      if (collected.length >= numItems) {
        hasMore = true;
        break;
      }

      const metadata = lookup.getMeta ? lookup.getMeta(galaxy.id) : undefined;
      collected.push(augmentGalaxy ? augmentGalaxy(galaxy, metadata) : galaxy);
    }

    if (hasMore || isDone) break;
    rawCursor = continueCursor;
  }

  const nextOffset = initialOffset + collected.length;

  return {
    galaxies: collected,
    total: hasMore ? collected.length : nextOffset,
    hasNext: hasMore,
    hasPrevious: initialOffset > 0,
    totalPages: 0,
    aggregatesPopulated: false,
    cursor: hasMore ? serializeCursor(nextOffset) : null,
    isDone: !hasMore,
    currentBounds: computeBounds(collected),
  };
};

const handleClassifiedGalaxies = async (options: HandleClassifiedOptions) => {
  const {
    ctx,
    userId,
    cursor,
    numItems,
    sortOrder,
    requestedSort,
    filterType,
    searchId,
    searchRaMin,
    searchRaMax,
    searchDecMin,
    searchDecMax,
    searchReffMin,
    searchReffMax,
    searchQMin,
    searchQMax,
    searchPaMin,
    searchPaMax,
    searchMagMin,
    searchMagMax,
    searchMeanMueMin,
    searchMeanMueMax,
    searchNucleus,
    searchTotalClassificationsMin,
    searchTotalClassificationsMax,
    searchNumVisibleNucleusMin,
    searchNumVisibleNucleusMax,
    searchNumAwesomeFlagMin,
    searchNumAwesomeFlagMax,
    searchNumFailedFittingMin,
    searchNumFailedFittingMax,
    searchTotalAssignedMin,
    searchTotalAssignedMax,
  } = options;

  const parsedCursor = parseClassifiedCursor(cursor);

  const classifiedRecords = await ctx.db
    .query("userGalaxyClassifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (filterType === "classified" && classifiedRecords.length === 0) {
    return {
      galaxies: [],
      total: 0,
      hasNext: false,
      hasPrevious: parsedCursor.offset > 0,
      totalPages: 0,
      aggregatesPopulated: false,
      cursor: null,
      isDone: true,
      currentBounds: computeBounds([]),
    };
  }

  const classifiedByGalaxyId = new Map<string, any>(
    classifiedRecords.map((record: any) => [record.galaxyExternalId, record])
  );

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters: {
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    },
    initialOffset: parsedCursor.offset,
    lookup: {
      has: (galaxyId) => classifiedByGalaxyId.has(galaxyId),
      getMeta: (galaxyId) => classifiedByGalaxyId.get(galaxyId),
    },
    includeMembers: filterType === "classified",
    serializeCursor: (offset) => serializeClassifiedCursor(offset),
    augmentGalaxy: (galaxy, trackingRecord) => trackingRecord
      ? {
          ...galaxy,
          classificationId: trackingRecord.classificationId,
          classifiedAt: trackingRecord.classifiedAt,
        }
      : galaxy,
  });
};

const handleSkippedGalaxies = async (options: HandleSkippedOptions) => {
  const {
    ctx,
    userId,
    cursor,
    numItems,
    sortOrder,
    requestedSort,
    searchId,
    searchRaMin,
    searchRaMax,
    searchDecMin,
    searchDecMax,
    searchReffMin,
    searchReffMax,
    searchQMin,
    searchQMax,
    searchPaMin,
    searchPaMax,
    searchMagMin,
    searchMagMax,
    searchMeanMueMin,
    searchMeanMueMax,
    searchNucleus,
    searchTotalClassificationsMin,
    searchTotalClassificationsMax,
    searchNumVisibleNucleusMin,
    searchNumVisibleNucleusMax,
    searchNumAwesomeFlagMin,
    searchNumAwesomeFlagMax,
    searchNumFailedFittingMin,
    searchNumFailedFittingMax,
    searchTotalAssignedMin,
    searchTotalAssignedMax,
  } = options;

  const initialOffset = parseSkippedCursor(cursor);

  const skippedRecords = await ctx.db
    .query("skippedGalaxies")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (skippedRecords.length === 0) {
    return {
      galaxies: [],
      total: 0,
      hasNext: false,
      hasPrevious: initialOffset > 0,
      totalPages: 0,
      aggregatesPopulated: false,
      cursor: null,
      isDone: true,
      currentBounds: computeBounds([]),
    };
  }

  const skippedByGalaxyId = new Map<string, any>(
    skippedRecords.map((record: any) => [
      record.galaxyExternalId,
      {
        skippedRecordId: record._id,
        skippedAt: record._creationTime,
        skippedComments: record.comments ?? null,
      },
    ])
  );

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters: {
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    },
    initialOffset,
    lookup: {
      has: (galaxyId) => skippedByGalaxyId.has(galaxyId),
      getMeta: (galaxyId) => skippedByGalaxyId.get(galaxyId),
    },
    includeMembers: true,
    serializeCursor: serializeSkippedCursor,
    augmentGalaxy: (galaxy, skippedMeta) => ({
      ...galaxy,
      ...skippedMeta,
    }),
  });
};

const SEQUENCE_CURSOR_PREFIX = "SEQUENCE:";

const parseSequenceCursor = (cursor: string | null) => {
  if (!cursor || !cursor.startsWith(SEQUENCE_CURSOR_PREFIX)) {
    return 0;
  }
  const rawOffset = Number.parseInt(cursor.slice(SEQUENCE_CURSOR_PREFIX.length), 10);
  return Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
};

const serializeSequenceCursor = (offset: number) => `${SEQUENCE_CURSOR_PREFIX}${offset}`;

const handleMySequenceGalaxies = async (options: HandleSkippedOptions) => {
  const {
    ctx,
    userId,
    cursor,
    numItems,
    sortOrder,
    requestedSort,
    searchId,
    searchRaMin,
    searchRaMax,
    searchDecMin,
    searchDecMax,
    searchReffMin,
    searchReffMax,
    searchQMin,
    searchQMax,
    searchPaMin,
    searchPaMax,
    searchMagMin,
    searchMagMax,
    searchMeanMueMin,
    searchMeanMueMax,
    searchNucleus,
    searchTotalClassificationsMin,
    searchTotalClassificationsMax,
    searchNumVisibleNucleusMin,
    searchNumVisibleNucleusMax,
    searchNumAwesomeFlagMin,
    searchNumAwesomeFlagMax,
    searchNumFailedFittingMin,
    searchNumFailedFittingMax,
    searchTotalAssignedMin,
    searchTotalAssignedMax,
  } = options;

  const initialOffset = parseSequenceCursor(cursor);

  // Get user's sequence
  const userSequence = await ctx.db
    .query("galaxySequences")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  if (!userSequence || !userSequence.galaxyExternalIds || userSequence.galaxyExternalIds.length === 0) {
    return {
      galaxies: [],
      total: 0,
      hasNext: false,
      hasPrevious: initialOffset > 0,
      totalPages: 0,
      aggregatesPopulated: false,
      cursor: null,
      isDone: true,
      currentBounds: computeBounds([]),
    };
  }

  const sequenceExternalIds = userSequence.galaxyExternalIds;

  const sequenceGalaxyIds = new Set<string>(sequenceExternalIds);

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters: {
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    },
    initialOffset,
    lookup: {
      has: (galaxyId) => sequenceGalaxyIds.has(galaxyId),
    },
    includeMembers: true,
    serializeCursor: serializeSequenceCursor,
  });
};

// Get min/max values for search field prefill
export const getGalaxySearchBounds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return {
        ra: { min: null, max: null },
        dec: { min: null, max: null },
        reff: { min: null, max: null },
        q: { min: null, max: null },
        pa: { min: null, max: null },
        mag: { min: null, max: null },
        mean_mue: { min: null, max: null },
        nucleus: { hasNucleus: false, totalCount: 0 },
        totalClassifications: { min: null, max: null },
        numVisibleNucleus: { min: null, max: null },
        numAwesomeFlag: { min: null, max: null },
        totalAssigned: { min: null, max: null },
      };
    }

    // Use aggregates for all fields that have them
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
      galaxiesByRa.min(ctx).then(item => item?.key),
      galaxiesByRa.max(ctx).then(item => item?.key),
      galaxiesByDec.min(ctx).then(item => item?.key),
      galaxiesByDec.max(ctx).then(item => item?.key),
      galaxiesByReff.min(ctx).then(item => item?.key),
      galaxiesByReff.max(ctx).then(item => item?.key),
      galaxiesByQ.min(ctx).then(item => item?.key),
      galaxiesByQ.max(ctx).then(item => item?.key),
      galaxiesByPa.min(ctx).then(item => item?.key),
      galaxiesByPa.max(ctx).then(item => item?.key),
      galaxiesByMag.min(ctx).then(item => item?.key),
      galaxiesByMag.max(ctx).then(item => item?.key),
      galaxiesByMeanMue.min(ctx).then(item => item?.key),
      galaxiesByMeanMue.max(ctx).then(item => item?.key),
      galaxiesByNucleus.count(ctx, {
        bounds: { lower: { key: true, inclusive: true }, upper: { key: true, inclusive: true } }
      }),
      galaxiesByNucleus.count(ctx),
      galaxiesByTotalClassifications.min(ctx).then(item => item?.key),
      galaxiesByTotalClassifications.max(ctx).then(item => item?.key),
      galaxiesByNumVisibleNucleus.min(ctx).then(item => item?.key),
      galaxiesByNumVisibleNucleus.max(ctx).then(item => item?.key),
      galaxiesByNumAwesomeFlag.min(ctx).then(item => item?.key),
      galaxiesByNumAwesomeFlag.max(ctx).then(item => item?.key),
      galaxiesByTotalAssigned.min(ctx).then(item => item?.key),
      galaxiesByTotalAssigned.max(ctx).then(item => item?.key),
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
  },
});// Get unique classification values for search dropdowns
export const getClassificationSearchOptions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return {
        lsbClasses: [],
        morphologies: [],
      };
    }

    // Get all classifications for this user
    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Extract unique values
    const lsbClasses = [...new Set(classifications.map(c => c.lsb_class).filter(Boolean))].sort();
    const morphologies = [...new Set(classifications.map(c => c.morphology).filter(Boolean))].sort();

    return {
      lsbClasses,
      morphologies,
    };
  },
});
