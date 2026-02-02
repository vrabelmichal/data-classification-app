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
  galaxiesByTotalAssigned,
} from "./aggregates";
// Aggregates are not used in this implementation; we rely on Convex indexes + paginate


const SKIPPED_CURSOR_PREFIX = "SKIPPED:";

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
  | "nucleus";

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
      v.literal("numericId")
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
      searchTotalAssignedMin,
      searchTotalAssignedMax,
      searchAwesome,
      searchValidRedshift,
      searchVisibleNucleus,
    } = args;

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

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
    };
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
        searchTotalAssignedMin,
        searchTotalAssignedMax,
      });
    }

    // Pick best index starting with the sort key and optionally second fields based on filters
    let indexName = allowedSort[requestedSort].index;
    let indexBuilder: ((qb: any) => any) | undefined = undefined;

    const applyRange = (qb: any, field: string, min?: string, max?: string) => {
      let out = qb;
      if (min) out = out.gte(field, parseFloat(min));
      if (max) out = out.lte(field, parseFloat(max));
      return out;
    };

    switch (requestedSort) {
      case "numericId":
        if (searchNucleus !== undefined) {
          indexName = "by_numericId_nucleus";
          indexBuilder = (qb) => qb.eq("nucleus", !!searchNucleus);
        } else if (searchMagMin || searchMagMax) {
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
    }

    // Start query with index and sort order
    let qBase = ctx.db.query("galaxies");
    let q: any = indexBuilder
      ? qBase.withIndex(indexName as any, indexBuilder as any)
      : qBase.withIndex(indexName as any);
  q = q.order(normalizedSortOrder as any);

    // Apply additional filters via chained .filter calls
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
  if (searchTotalClassificationsMin)
    q = q.filter((f: any) => f.gte(f.field("totalClassifications"), parseInt(searchTotalClassificationsMin, 10)));
  if (searchTotalClassificationsMax)
    q = q.filter((f: any) => f.lte(f.field("totalClassifications"), parseInt(searchTotalClassificationsMax, 10)));
  if (searchNumVisibleNucleusMin)
    q = q.filter((f: any) => f.gte(f.field("numVisibleNucleus"), parseInt(searchNumVisibleNucleusMin, 10)));
  if (searchNumVisibleNucleusMax)
    q = q.filter((f: any) => f.lte(f.field("numVisibleNucleus"), parseInt(searchNumVisibleNucleusMax, 10)));
  if (searchNumAwesomeFlagMin)
    q = q.filter((f: any) => f.gte(f.field("numAwesomeFlag"), parseInt(searchNumAwesomeFlagMin, 10)));
  if (searchNumAwesomeFlagMax)
    q = q.filter((f: any) => f.lte(f.field("numAwesomeFlag"), parseInt(searchNumAwesomeFlagMax, 10)));
  if (searchTotalAssignedMin)
    q = q.filter((f: any) => f.gte(f.field("totalAssigned"), parseInt(searchTotalAssignedMin, 10)));
  if (searchTotalAssignedMax)
    q = q.filter((f: any) => f.lte(f.field("totalAssigned"), parseInt(searchTotalAssignedMax, 10)));

    const { page, isDone, continueCursor } = await q.paginate({ numItems, cursor: cursor || null });
    let galaxies: any[] = page;

    // We rely on server-side filtering above; no additional in-memory filtering/pagination here
    let searchFilteredTotal = 0;
    
    // Note: "classified", "unclassified", and "my_sequence" filters are handled by dedicated handlers above

    // totalClassifications, numVisibleNucleus, numAwesomeFlag, totalAssigned handled server-side above

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

const handleClassifiedGalaxies = async (options: HandleClassifiedOptions) => {
  const {
    ctx,
    userId,
    cursor,
    numItems,
    sortOrder,
    requestedSort,
    sortField,
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
    searchTotalAssignedMin,
    searchTotalAssignedMax,
  } = options;

  const parsedCursor = parseClassifiedCursor(cursor);

  // Helper to apply search filters to galaxies
  const applySearchFilters = (galaxies: any[]) => {
    let filtered = galaxies;

    if (searchId) {
      const trimmed = searchId.trim();
      filtered = filtered.filter((g) => g.id === trimmed);
    }

    const applyNumericFilter = (
      values: any[],
      field: string,
      min?: string,
      max?: string,
    ) => {
      if (!min && !max) return values;
      const minVal = min !== undefined && min !== null && min !== "" ? Number.parseFloat(min) : undefined;
      const maxVal = max !== undefined && max !== null && max !== "" ? Number.parseFloat(max) : undefined;
      return values.filter((g) => {
        const value = g[field];
        if (typeof value !== "number" || Number.isNaN(value)) return false;
        if (minVal !== undefined && value < minVal) return false;
        if (maxVal !== undefined && value > maxVal) return false;
        return true;
      });
    };

    filtered = applyNumericFilter(filtered, "ra", searchRaMin, searchRaMax);
    filtered = applyNumericFilter(filtered, "dec", searchDecMin, searchDecMax);
    filtered = applyNumericFilter(filtered, "reff", searchReffMin, searchReffMax);
    filtered = applyNumericFilter(filtered, "q", searchQMin, searchQMax);
    filtered = applyNumericFilter(filtered, "pa", searchPaMin, searchPaMax);
    filtered = applyNumericFilter(filtered, "mag", searchMagMin, searchMagMax);
    filtered = applyNumericFilter(filtered, "mean_mue", searchMeanMueMin, searchMeanMueMax);

    if (searchNucleus !== undefined) {
      const desired = !!searchNucleus;
      filtered = filtered.filter((g) => !!g.nucleus === desired);
    }

    if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
      const minVal = searchTotalClassificationsMin ? Number.parseInt(searchTotalClassificationsMin, 10) : undefined;
      const maxVal = searchTotalClassificationsMax ? Number.parseInt(searchTotalClassificationsMax, 10) : undefined;
      filtered = filtered.filter((g) => {
        const total = typeof g.totalClassifications === "number" ? g.totalClassifications : Number(g.totalClassifications ?? 0);
        const numericTotal = Number.isFinite(total) ? total : 0;
        if (minVal !== undefined && numericTotal < minVal) return false;
        if (maxVal !== undefined && numericTotal > maxVal) return false;
        return true;
      });
    }

    if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
      const minVal = searchNumVisibleNucleusMin ? Number.parseInt(searchNumVisibleNucleusMin, 10) : undefined;
      const maxVal = searchNumVisibleNucleusMax ? Number.parseInt(searchNumVisibleNucleusMax, 10) : undefined;
      filtered = filtered.filter((g) => {
        const total = typeof g.numVisibleNucleus === "number" ? g.numVisibleNucleus : Number(g.numVisibleNucleus ?? 0);
        const numericTotal = Number.isFinite(total) ? total : 0;
        if (minVal !== undefined && numericTotal < minVal) return false;
        if (maxVal !== undefined && numericTotal > maxVal) return false;
        return true;
      });
    }

    if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
      const minVal = searchNumAwesomeFlagMin ? Number.parseInt(searchNumAwesomeFlagMin, 10) : undefined;
      const maxVal = searchNumAwesomeFlagMax ? Number.parseInt(searchNumAwesomeFlagMax, 10) : undefined;
      filtered = filtered.filter((g) => {
        const total = typeof g.numAwesomeFlag === "number" ? g.numAwesomeFlag : Number(g.numAwesomeFlag ?? 0);
        const numericTotal = Number.isFinite(total) ? total : 0;
        if (minVal !== undefined && numericTotal < minVal) return false;
        if (maxVal !== undefined && numericTotal > maxVal) return false;
        return true;
      });
    }

    if (searchTotalAssignedMin || searchTotalAssignedMax) {
      const minVal = searchTotalAssignedMin ? Number.parseInt(searchTotalAssignedMin, 10) : undefined;
      const maxVal = searchTotalAssignedMax ? Number.parseInt(searchTotalAssignedMax, 10) : undefined;
      filtered = filtered.filter((g) => {
        const total = typeof g.totalAssigned === "number" ? g.totalAssigned : Number(g.totalAssigned ?? 0);
        const numericTotal = Number.isFinite(total) ? total : 0;
        if (minVal !== undefined && numericTotal < minVal) return false;
        if (maxVal !== undefined && numericTotal > maxVal) return false;
        return true;
      });
    }

    return filtered;
  };

  // Helper to sort galaxies
  const sortGalaxies = (galaxies: any[]) => {
    const missingNumericValue = sortOrder === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    return [...galaxies].sort((a, b) => {
      if (requestedSort === "id") {
        const aVal = typeof a[sortField] === "string" ? a[sortField] : "";
        const bVal = typeof b[sortField] === "string" ? b[sortField] : "";
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
        if (cmp !== 0) {
          return sortOrder === "asc" ? cmp : -cmp;
        }
      } else if (requestedSort === "nucleus") {
        const aVal = a[sortField] ? 1 : 0;
        const bVal = b[sortField] ? 1 : 0;
        if (aVal !== bVal) {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
      } else {
        const aVal = typeof a[sortField] === "number" && !Number.isNaN(a[sortField]) ? a[sortField] : missingNumericValue;
        const bVal = typeof b[sortField] === "number" && !Number.isNaN(b[sortField]) ? b[sortField] : missingNumericValue;
        if (aVal !== bVal) {
          return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        }
      }

      const aNumeric = typeof a.numericId === "number" ? a.numericId : Number.POSITIVE_INFINITY;
      const bNumeric = typeof b.numericId === "number" ? b.numericId : Number.POSITIVE_INFINITY;
      if (aNumeric !== bNumeric) {
        return aNumeric - bNumeric;
      }

      const aId = typeof a.id === "string" ? a.id : "";
      const bId = typeof b.id === "string" ? b.id : "";
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  if (filterType === "classified") {
    // EFFICIENT PATH: Query userGalaxyClassifications table with index
    // This avoids loading all classifications into memory
    
    // Use paginated query on the tracking table
    const { page: trackingRecords, continueCursor, isDone } = await ctx.db
      .query("userGalaxyClassifications")
      .withIndex("by_user_numericId", (q: any) => q.eq("userId", userId))
      .order(sortOrder)
      .paginate({ numItems: numItems * 3, cursor: parsedCursor.galaxyCursor }); // Fetch extra to account for filtering

    if (trackingRecords.length === 0) {
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

    // Fetch galaxy data for tracking records
    const galaxiesWithTracking = await Promise.all(
      trackingRecords.map(async (record: any) => {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q: any) => q.eq("id", record.galaxyExternalId))
          .unique();
        if (!galaxy) return null;
        return {
          ...galaxy,
          classificationId: record.classificationId,
          classifiedAt: record.classifiedAt,
        };
      })
    );

    const validGalaxies = galaxiesWithTracking.filter((g): g is any => g !== null);

    // Apply search filters
    let filtered = applySearchFilters(validGalaxies);

    // Sort (mainly needed when not sorting by numericId)
    if (requestedSort !== "numericId") {
      filtered = sortGalaxies(filtered);
    }

    // Take requested number of items
    const paged = filtered.slice(0, numItems);
    const hasMore = filtered.length > numItems || !isDone;

    return {
      galaxies: paged,
      total: paged.length, // Unknown total without scanning all
      hasNext: hasMore,
      hasPrevious: parsedCursor.offset > 0 || parsedCursor.galaxyCursor !== null,
      totalPages: 0,
      aggregatesPopulated: false,
      cursor: hasMore ? serializeClassifiedCursor(parsedCursor.offset + paged.length, continueCursor) : null,
      isDone: !hasMore,
      currentBounds: computeBounds(paged),
    };
  } else {
    // UNCLASSIFIED: Stream through galaxies and check against tracking table
    // This is more efficient than loading all galaxies because we:
    // 1. Use cursor-based pagination on galaxies table
    // 2. Do indexed lookups to check classification status
    
    const collected: any[] = [];
    let galaxyCursor: string | null = parsedCursor.galaxyCursor;
    let iterationCount = 0;
    const maxIterations = 50; // Safety limit to prevent timeout
    let reachedEndOfGalaxies = false;

    while (collected.length < numItems && iterationCount < maxIterations) {
      iterationCount++;

      // Fetch a batch of galaxies
      const batchSize = Math.min(500, (numItems - collected.length) * 5); // Estimate 20% are unclassified
      const { page: galaxyBatch, continueCursor, isDone: galaxiesDone } = await ctx.db
        .query("galaxies")
        .withIndex("by_numeric_id")
        .order(sortOrder)
        .paginate({ numItems: batchSize, cursor: galaxyCursor });

      if (galaxyBatch.length === 0) {
        reachedEndOfGalaxies = true;
        break;
      }

      // Check each galaxy against the tracking table (indexed lookup)
      for (const galaxy of galaxyBatch) {
        if (collected.length >= numItems) break;

        // Efficient indexed lookup to check if classified
        const isClassified = await ctx.db
          .query("userGalaxyClassifications")
          .withIndex("by_user_galaxy", (q: any) => 
            q.eq("userId", userId).eq("galaxyExternalId", galaxy.id)
          )
          .unique();

        if (!isClassified) {
          // Apply search filters inline
          const passesFilters = (() => {
            if (searchId && galaxy.id !== searchId.trim()) return false;
            if (searchRaMin && (typeof galaxy.ra !== "number" || galaxy.ra < parseFloat(searchRaMin))) return false;
            if (searchRaMax && (typeof galaxy.ra !== "number" || galaxy.ra > parseFloat(searchRaMax))) return false;
            if (searchDecMin && (typeof galaxy.dec !== "number" || galaxy.dec < parseFloat(searchDecMin))) return false;
            if (searchDecMax && (typeof galaxy.dec !== "number" || galaxy.dec > parseFloat(searchDecMax))) return false;
            if (searchReffMin && (typeof galaxy.reff !== "number" || galaxy.reff < parseFloat(searchReffMin))) return false;
            if (searchReffMax && (typeof galaxy.reff !== "number" || galaxy.reff > parseFloat(searchReffMax))) return false;
            if (searchQMin && (typeof galaxy.q !== "number" || galaxy.q < parseFloat(searchQMin))) return false;
            if (searchQMax && (typeof galaxy.q !== "number" || galaxy.q > parseFloat(searchQMax))) return false;
            if (searchPaMin && (typeof galaxy.pa !== "number" || galaxy.pa < parseFloat(searchPaMin))) return false;
            if (searchPaMax && (typeof galaxy.pa !== "number" || galaxy.pa > parseFloat(searchPaMax))) return false;
            if (searchMagMin && (typeof galaxy.mag !== "number" || galaxy.mag < parseFloat(searchMagMin))) return false;
            if (searchMagMax && (typeof galaxy.mag !== "number" || galaxy.mag > parseFloat(searchMagMax))) return false;
            if (searchMeanMueMin && (typeof galaxy.mean_mue !== "number" || galaxy.mean_mue < parseFloat(searchMeanMueMin))) return false;
            if (searchMeanMueMax && (typeof galaxy.mean_mue !== "number" || galaxy.mean_mue > parseFloat(searchMeanMueMax))) return false;
            if (searchNucleus !== undefined && !!galaxy.nucleus !== !!searchNucleus) return false;
            return true;
          })();

          if (passesFilters) {
            collected.push(galaxy);
          }
        }
      }

      galaxyCursor = continueCursor;

      if (galaxiesDone) {
        reachedEndOfGalaxies = true;
        break;
      }
    }

    // Sort if needed
    let sortedResults = collected;
    if (requestedSort !== "numericId") {
      sortedResults = sortGalaxies(collected);
    }

    const paged = sortedResults.slice(0, numItems);
    // hasMore is true if:
    // 1. We collected more than needed (had to filter some out), OR
    // 2. We haven't reached the end of the galaxy table yet
    const hasMore = !reachedEndOfGalaxies && galaxyCursor !== null;

    return {
      galaxies: paged,
      total: paged.length,
      hasNext: hasMore,
      hasPrevious: parsedCursor.offset > 0 || parsedCursor.galaxyCursor !== null,
      totalPages: 0,
      aggregatesPopulated: false,
      cursor: hasMore ? serializeClassifiedCursor(parsedCursor.offset + paged.length, galaxyCursor) : null,
      isDone: !hasMore,
      currentBounds: computeBounds(paged),
    };
  }
};

const handleSkippedGalaxies = async (options: HandleSkippedOptions) => {
  const {
    ctx,
    userId,
    cursor,
    numItems,
    sortOrder,
    requestedSort,
    sortField,
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

  const skippedGalaxies = (await Promise.all(
    skippedRecords.map(async (record: any) => {
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q: any) => q.eq("id", record.galaxyExternalId))
        .unique();
      if (!galaxy) return null;
      return {
        ...galaxy,
        skippedRecordId: record._id,
        skippedAt: record._creationTime,
        skippedComments: record.comments ?? null,
      };
    })
  )).filter((item): item is any => item !== null);

  let filtered = skippedGalaxies;

  if (searchId) {
    const trimmed = searchId.trim();
    filtered = filtered.filter((g) => g.id === trimmed);
  }
  const applyNumericFilter = (
    values: any[],
    field: string,
    min?: string,
    max?: string,
  ) => {
    if (!min && !max) return values;
    const minVal = min !== undefined && min !== null && min !== "" ? Number.parseFloat(min) : undefined;
    const maxVal = max !== undefined && max !== null && max !== "" ? Number.parseFloat(max) : undefined;
    return values.filter((g) => {
      const value = g[field];
      if (typeof value !== "number" || Number.isNaN(value)) return false;
      if (minVal !== undefined && value < minVal) return false;
      if (maxVal !== undefined && value > maxVal) return false;
      return true;
    });
  };

  filtered = applyNumericFilter(filtered, "ra", searchRaMin, searchRaMax);
  filtered = applyNumericFilter(filtered, "dec", searchDecMin, searchDecMax);
  filtered = applyNumericFilter(filtered, "reff", searchReffMin, searchReffMax);
  filtered = applyNumericFilter(filtered, "q", searchQMin, searchQMax);
  filtered = applyNumericFilter(filtered, "pa", searchPaMin, searchPaMax);
  filtered = applyNumericFilter(filtered, "mag", searchMagMin, searchMagMax);
  filtered = applyNumericFilter(filtered, "mean_mue", searchMeanMueMin, searchMeanMueMax);

  if (searchNucleus !== undefined) {
    const desired = !!searchNucleus;
    filtered = filtered.filter((g) => !!g.nucleus === desired);
  }

  if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
    const minVal = searchTotalClassificationsMin ? Number.parseInt(searchTotalClassificationsMin, 10) : undefined;
    const maxVal = searchTotalClassificationsMax ? Number.parseInt(searchTotalClassificationsMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.totalClassifications === "number" ? g.totalClassifications : Number(g.totalClassifications ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
    const minVal = searchNumVisibleNucleusMin ? Number.parseInt(searchNumVisibleNucleusMin, 10) : undefined;
    const maxVal = searchNumVisibleNucleusMax ? Number.parseInt(searchNumVisibleNucleusMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.numVisibleNucleus === "number" ? g.numVisibleNucleus : Number(g.numVisibleNucleus ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
    const minVal = searchNumAwesomeFlagMin ? Number.parseInt(searchNumAwesomeFlagMin, 10) : undefined;
    const maxVal = searchNumAwesomeFlagMax ? Number.parseInt(searchNumAwesomeFlagMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.numAwesomeFlag === "number" ? g.numAwesomeFlag : Number(g.numAwesomeFlag ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchTotalAssignedMin || searchTotalAssignedMax) {
    const minVal = searchTotalAssignedMin ? Number.parseInt(searchTotalAssignedMin, 10) : undefined;
    const maxVal = searchTotalAssignedMax ? Number.parseInt(searchTotalAssignedMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.totalAssigned === "number" ? g.totalAssigned : Number(g.totalAssigned ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  const missingNumericValue = sortOrder === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  filtered.sort((a, b) => {
    if (requestedSort === "id") {
      const aVal = typeof a[sortField] === "string" ? a[sortField] : "";
      const bVal = typeof b[sortField] === "string" ? b[sortField] : "";
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) {
        return sortOrder === "asc" ? cmp : -cmp;
      }
    } else if (requestedSort === "nucleus") {
      const aVal = a[sortField] ? 1 : 0;
      const bVal = b[sortField] ? 1 : 0;
      if (aVal !== bVal) {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    } else {
      const aVal = typeof a[sortField] === "number" && !Number.isNaN(a[sortField]) ? a[sortField] : missingNumericValue;
      const bVal = typeof b[sortField] === "number" && !Number.isNaN(b[sortField]) ? b[sortField] : missingNumericValue;
      if (aVal !== bVal) {
        return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
    }

    const aNumeric = typeof a.numericId === "number" ? a.numericId : Number.POSITIVE_INFINITY;
    const bNumeric = typeof b.numericId === "number" ? b.numericId : Number.POSITIVE_INFINITY;
    if (aNumeric !== bNumeric) {
      return aNumeric - bNumeric;
    }

    const aId = typeof a.id === "string" ? a.id : "";
    const bId = typeof b.id === "string" ? b.id : "";
    return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
  });

  const total = filtered.length;
  const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(initialOffset, Math.max(total - numItems, 0)));
  const paged = filtered.slice(safeOffset, safeOffset + numItems);

  const hasNext = safeOffset + paged.length < total;
  const nextCursor = hasNext ? serializeSkippedCursor(safeOffset + paged.length) : null;
  const hasPrevious = safeOffset > 0;
  const totalPages = total > 0 ? Math.ceil(total / numItems) : 0;

  return {
    galaxies: paged,
    total,
    hasNext,
    hasPrevious,
    totalPages,
    aggregatesPopulated: false,
    cursor: nextCursor,
    isDone: !hasNext,
    currentBounds: computeBounds(paged),
  };
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
    sortField,
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

  // Pull only the slice we need for this page (+ a small oversample to survive filters)
  const PAGE_FETCH_MULTIPLIER = 5;
  const fetchWindow = Math.max(numItems * PAGE_FETCH_MULTIPLIER, numItems);
  const sliceStart = Math.max(0, Math.min(initialOffset, sequenceExternalIds.length));
  const sliceIds = sequenceExternalIds.slice(sliceStart, sliceStart + fetchWindow);

  // Fetch galaxies in small batches to stay under Convex read limits
  const BATCH_SIZE = 50;
  const sliceGalaxies: any[] = [];

  for (let i = 0; i < sliceIds.length; i += BATCH_SIZE) {
    const batchIds = sliceIds.slice(i, i + BATCH_SIZE);
    const batchGalaxies = await Promise.all(
      batchIds.map(async (externalId: string) => {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q: any) => q.eq("id", externalId))
          .unique();
        return galaxy;
      })
    );
    sliceGalaxies.push(...batchGalaxies.filter((g): g is any => g !== null));
  }

  let filtered = sliceGalaxies;

  // Apply search filters
  if (searchId) {
    const trimmed = searchId.trim();
    filtered = filtered.filter((g) => g.id === trimmed);
  }
  const applyNumericFilter = (
    values: any[],
    field: string,
    min?: string,
    max?: string,
  ) => {
    if (!min && !max) return values;
    const minVal = min !== undefined && min !== null && min !== "" ? Number.parseFloat(min) : undefined;
    const maxVal = max !== undefined && max !== null && max !== "" ? Number.parseFloat(max) : undefined;
    return values.filter((g) => {
      const value = g[field];
      if (typeof value !== "number" || Number.isNaN(value)) return false;
      if (minVal !== undefined && value < minVal) return false;
      if (maxVal !== undefined && value > maxVal) return false;
      return true;
    });
  };

  filtered = applyNumericFilter(filtered, "ra", searchRaMin, searchRaMax);
  filtered = applyNumericFilter(filtered, "dec", searchDecMin, searchDecMax);
  filtered = applyNumericFilter(filtered, "reff", searchReffMin, searchReffMax);
  filtered = applyNumericFilter(filtered, "q", searchQMin, searchQMax);
  filtered = applyNumericFilter(filtered, "pa", searchPaMin, searchPaMax);
  filtered = applyNumericFilter(filtered, "mag", searchMagMin, searchMagMax);
  filtered = applyNumericFilter(filtered, "mean_mue", searchMeanMueMin, searchMeanMueMax);

  if (searchNucleus !== undefined) {
    const desired = !!searchNucleus;
    filtered = filtered.filter((g) => !!g.nucleus === desired);
  }

  if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
    const minVal = searchTotalClassificationsMin ? Number.parseInt(searchTotalClassificationsMin, 10) : undefined;
    const maxVal = searchTotalClassificationsMax ? Number.parseInt(searchTotalClassificationsMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.totalClassifications === "number" ? g.totalClassifications : Number(g.totalClassifications ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
    const minVal = searchNumVisibleNucleusMin ? Number.parseInt(searchNumVisibleNucleusMin, 10) : undefined;
    const maxVal = searchNumVisibleNucleusMax ? Number.parseInt(searchNumVisibleNucleusMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.numVisibleNucleus === "number" ? g.numVisibleNucleus : Number(g.numVisibleNucleus ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
    const minVal = searchNumAwesomeFlagMin ? Number.parseInt(searchNumAwesomeFlagMin, 10) : undefined;
    const maxVal = searchNumAwesomeFlagMax ? Number.parseInt(searchNumAwesomeFlagMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.numAwesomeFlag === "number" ? g.numAwesomeFlag : Number(g.numAwesomeFlag ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  if (searchTotalAssignedMin || searchTotalAssignedMax) {
    const minVal = searchTotalAssignedMin ? Number.parseInt(searchTotalAssignedMin, 10) : undefined;
    const maxVal = searchTotalAssignedMax ? Number.parseInt(searchTotalAssignedMax, 10) : undefined;
    filtered = filtered.filter((g) => {
      const total = typeof g.totalAssigned === "number" ? g.totalAssigned : Number(g.totalAssigned ?? 0);
      const numericTotal = Number.isFinite(total) ? total : 0;
      if (minVal !== undefined && numericTotal < minVal) return false;
      if (maxVal !== undefined && numericTotal > maxVal) return false;
      return true;
    });
  }

  // Sort the galaxies
  const missingNumericValue = sortOrder === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  filtered.sort((a, b) => {
    if (requestedSort === "id") {
      const aVal = typeof a[sortField] === "string" ? a[sortField] : "";
      const bVal = typeof b[sortField] === "string" ? b[sortField] : "";
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) {
        return sortOrder === "asc" ? cmp : -cmp;
      }
    } else if (requestedSort === "nucleus") {
      const aVal = a[sortField] ? 1 : 0;
      const bVal = b[sortField] ? 1 : 0;
      if (aVal !== bVal) {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    } else {
      const aVal = typeof a[sortField] === "number" && !Number.isNaN(a[sortField]) ? a[sortField] : missingNumericValue;
      const bVal = typeof b[sortField] === "number" && !Number.isNaN(b[sortField]) ? b[sortField] : missingNumericValue;
      if (aVal !== bVal) {
        return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
    }

    const aNumeric = typeof a.numericId === "number" ? a.numericId : Number.POSITIVE_INFINITY;
    const bNumeric = typeof b.numericId === "number" ? b.numericId : Number.POSITIVE_INFINITY;
    if (aNumeric !== bNumeric) {
      return aNumeric - bNumeric;
    }

    const aId = typeof a.id === "string" ? a.id : "";
    const bId = typeof b.id === "string" ? b.id : "";
    return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
  });

  const total = sequenceExternalIds.length; // Total sequence length; filtered total is unknown without full scan
  const paged = filtered.slice(0, numItems);

  // We consider there is a next page if the underlying sequence has more entries beyond the current window
  const hasNext = sliceStart + fetchWindow < sequenceExternalIds.length || filtered.length > numItems;
  const nextCursor = hasNext ? serializeSequenceCursor(initialOffset + numItems) : null;
  const hasPrevious = initialOffset > 0;
  const totalPages = total > 0 ? Math.ceil(total / numItems) : 0;

  return {
    galaxies: paged,
    total,
    hasNext,
    hasPrevious,
    totalPages,
    aggregatesPopulated: false,
    cursor: nextCursor,
    isDone: !hasNext,
    currentBounds: computeBounds(paged),
  };
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
