import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { buildGalaxyBrowseQuery } from "./queryBuilder";
import { computeBounds, type GalaxySearchFilters, type Sortable } from "./shared";

// Bound each transaction independently of how rare a matching classification is.
// Continuations return only matching galaxies, never the scanned candidates.
export const CLASSIFICATION_SEARCH_BATCH_SIZE = 100;
const MAX_GALAXY_ROWS_READ = 500;
const MAX_GALAXY_BYTES_READ = 512 * 1024;
const CURSOR_PREFIX = "CLASSIFICATION_SEARCH:";

type ClassificationFilters = Pick<GalaxySearchFilters, "searchLsbClass" | "searchMorphology">;

export function hasClassificationFilters(filters: ClassificationFilters) {
  return !!(filters.searchLsbClass?.trim() || filters.searchMorphology?.trim());
}

export async function matchesClassificationFilters(ctx: QueryCtx, galaxyId: string, filters: ClassificationFilters) {
  if (!hasClassificationFilters(filters)) return true;
  const lsbClass = filters.searchLsbClass?.trim() ? Number(filters.searchLsbClass) : undefined;
  const morphology = filters.searchMorphology?.trim() ? Number(filters.searchMorphology) : undefined;
  // The existing galaxy index restricts this lookup to this galaxy's reviewers.
  // Check both fields on one record, and stop at the first matching reviewer.
  for await (const classification of ctx.db.query("classifications")
    .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyId))) {
    if ((lsbClass === undefined || classification.lsb_class === lsbClass) &&
        (morphology === undefined || classification.morphology === morphology)) return true;
  }
  return false;
}

interface Options {
  userId: Id<"users">;
  filters: GalaxySearchFilters;
  filter?: "all" | "classified" | "unclassified" | "my_sequence" | "skipped";
  requestedSort: Sortable;
  sortOrder: "asc" | "desc";
  numItems: number;
  offset?: number;
  cursor?: string | null;
}

type BrowseGalaxy = Doc<"galaxies"> & {
  classificationId?: Id<"classifications">;
  classifiedAt?: number;
  skippedRecordId?: Id<"skippedGalaxies">;
  skippedAt?: number;
  skippedComments?: string | null;
};

function readCursor(cursor: string | null | undefined, offset: number): { galaxyCursor: string | null; skip: number } {
  if (!cursor) return { galaxyCursor: null, skip: Math.max(0, offset) };
  try {
    if (!cursor.startsWith(CURSOR_PREFIX)) throw new Error("Invalid prefix");
    const parsed: unknown = JSON.parse(cursor.slice(CURSOR_PREFIX.length));
    if (parsed && typeof parsed === "object" && "galaxyCursor" in parsed && "skip" in parsed &&
        (parsed.galaxyCursor === null || typeof parsed.galaxyCursor === "string") &&
        typeof parsed.skip === "number" && Number.isSafeInteger(parsed.skip) && parsed.skip >= 0) {
      return { galaxyCursor: parsed.galaxyCursor, skip: parsed.skip };
    }
  } catch { /* Report a recoverable search-position error below. */ }
  throw new ConvexError("This search position is invalid. Return to the first page and try again.");
}

export async function browseClassificationFilteredBatch(ctx: QueryCtx, options: Options) {
  const { userId, filters, filter, requestedSort, sortOrder, numItems, offset = 0, cursor } = options;
  if (!Number.isFinite(numItems) || numItems < 1) throw new ConvexError("Page size must be positive.");
  const position = readCursor(cursor, offset);
  const candidateQuery = buildGalaxyBrowseQuery(ctx, requestedSort, sortOrder, filters);
  const batch: { page: Doc<"galaxies">[]; isDone: boolean; continueCursor: string } = await candidateQuery.paginate({
    cursor: position.galaxyCursor,
    numItems: Math.min(Math.floor(numItems), CLASSIFICATION_SEARCH_BATCH_SIZE),
    maximumRowsRead: MAX_GALAXY_ROWS_READ,
    maximumBytesRead: MAX_GALAXY_BYTES_READ,
  });
  const initialSkip = position.skip;
  let cursorBeforeLastMatch: string | undefined;
  const sequence = filter === "my_sequence"
    ? await ctx.db.query("galaxySequences").withIndex("by_user", (q) => q.eq("userId", userId)).unique()
    : null;
  const sequenceIds = new Set(sequence?.galaxyExternalIds ?? []);
  const galaxies: BrowseGalaxy[] = [];
  for (const galaxy of batch.page) {
    const result: BrowseGalaxy = { ...galaxy };
    if (filter === "my_sequence" && !sequenceIds.has(galaxy.id)) continue;
    if (filter === "classified" || filter === "unclassified") {
      const classification = await ctx.db.query("userGalaxyClassifications")
        .withIndex("by_user_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxy.id)).first();
      if (filter === "classified" ? !classification : classification) continue;
      if (classification) {
        result.classificationId = classification.classificationId;
        result.classifiedAt = classification.classifiedAt;
      }
    }
    if (filter === "skipped") {
      const skipped = await ctx.db.query("skippedGalaxies")
        .withIndex("by_user_and_galaxy", (q) => q.eq("userId", userId).eq("galaxyExternalId", galaxy.id)).first();
      if (!skipped) continue;
      result.skippedRecordId = skipped._id;
      result.skippedAt = skipped._creationTime;
      result.skippedComments = skipped.comments ?? null;
    }
    if (!await matchesClassificationFilters(ctx, galaxy.id, filters)) continue;
    if (position.skip > 0) {
      position.skip--;
      continue;
    }
    cursorBeforeLastMatch = CURSOR_PREFIX + JSON.stringify({ galaxyCursor: position.galaxyCursor, skip: initialSkip + galaxies.length });
    galaxies.push(result);
  }
  return {
    galaxies,
    cursorBeforeLastMatch,
    hasNext: !batch.isDone,
    hasPrevious: offset > 0 || !!cursor,
    aggregatesPopulated: false,
    cursor: batch.isDone ? null : CURSOR_PREFIX + JSON.stringify({ galaxyCursor: batch.continueCursor, skip: position.skip }),
    isDone: batch.isDone,
    scanIncomplete: !batch.isDone && galaxies.length < numItems,
    currentBounds: computeBounds(galaxies),
  };
}
