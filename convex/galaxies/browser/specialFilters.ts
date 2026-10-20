import { buildGalaxyBrowseQuery } from "./queryBuilder";
import {
  computeBounds,
  createEmptyBrowseResult,
  type GalaxySearchFilters,
  type Sortable,
} from "./shared";

const SKIPPED_CURSOR_PREFIX = "SKIPPED:";
const CLASSIFIED_CURSOR_PREFIX = "CLASSIFIED:";
const SEQUENCE_CURSOR_PREFIX = "SEQUENCE:";

const parseSkippedCursor = (cursor: string | null) => {
  if (!cursor || !cursor.startsWith(SKIPPED_CURSOR_PREFIX)) {
    return 0;
  }
  const rawOffset = Number.parseInt(cursor.slice(SKIPPED_CURSOR_PREFIX.length), 10);
  return Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
};

const serializeSkippedCursor = (offset: number) => `${SKIPPED_CURSOR_PREFIX}${offset}`;

const parseClassifiedCursor = (cursor: string | null) => {
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
    const rawOffset = Number.parseInt(payload, 10);
    return {
      offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
      galaxyCursor: null,
    };
  }
};

const serializeClassifiedCursor = (offset: number) =>
  `${CLASSIFIED_CURSOR_PREFIX}${JSON.stringify({ offset, galaxyCursor: null })}`;

const parseSequenceCursor = (cursor: string | null) => {
  if (!cursor || !cursor.startsWith(SEQUENCE_CURSOR_PREFIX)) {
    return 0;
  }
  const rawOffset = Number.parseInt(cursor.slice(SEQUENCE_CURSOR_PREFIX.length), 10);
  return Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
};

const serializeSequenceCursor = (offset: number) => `${SEQUENCE_CURSOR_PREFIX}${offset}`;

type MembershipLookup = {
  has: (galaxyId: string) => boolean | Promise<boolean>;
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

interface SpecialFilterOptions {
  ctx: any;
  userId: string;
  cursor: string | null;
  offset?: number;
  numItems: number;
  sortOrder: "asc" | "desc";
  requestedSort: Sortable;
  filters: GalaxySearchFilters;
}

interface ClassifiedFilterOptions extends SpecialFilterOptions {
  filterType: "classified" | "unclassified";
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
  let hasMore = false;
  for await (const galaxy of q) {
    const isMember = await lookup.has(galaxy.id);
    if (includeMembers ? !isMember : isMember) continue;

    if (matchedBeforePage < initialOffset) {
      matchedBeforePage++;
      continue;
    }

    if (collected.length >= numItems) {
      hasMore = true;
      break;
    }

    const metadata = lookup.getMeta ? await lookup.getMeta(galaxy.id) : undefined;
    collected.push(augmentGalaxy ? augmentGalaxy(galaxy, metadata) : galaxy);
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

export const handleClassifiedGalaxies = async (options: ClassifiedFilterOptions) => {
  const { ctx, userId, cursor, offset = 0, numItems, sortOrder, requestedSort, filterType, filters } = options;
  const parsedCursor = cursor ? parseClassifiedCursor(cursor) : { offset: Math.max(offset, 0), galaxyCursor: null };

  // Start with the user's indexed classifications for numeric ordering. Scanning
  // all galaxies is particularly expensive when the user has only a few matches.
  if (filterType === "classified" && requestedSort === "numericId") {
    const records = ctx.db
      .query("userGalaxyClassifications")
      .withIndex("by_user_numericId", (q: any) => q.eq("userId", userId))
      .order(sortOrder);
    const galaxies: any[] = [];
    let matched = 0;
    let hasNext = false;
    for await (const record of records) {
      if (filters.searchId && filters.searchId.trim() !== record.galaxyExternalId) continue;
      // Exact ID lookup bounds the galaxy read; all remaining predicates run on
      // the server using the same filter semantics as the other browse paths.
      const galaxy = await buildGalaxyBrowseQuery(ctx, "id", sortOrder, {
        ...filters,
        searchId: record.galaxyExternalId,
      }).first();
      if (!galaxy) continue;
      if (matched++ < parsedCursor.offset) continue;
      if (galaxies.length >= numItems) {
        hasNext = true;
        break;
      }
      galaxies.push({ ...galaxy, classificationId: record.classificationId, classifiedAt: record.classifiedAt });
    }
    const nextOffset = parsedCursor.offset + galaxies.length;
    return {
      galaxies,
      hasNext,
      hasPrevious: parsedCursor.offset > 0,
      aggregatesPopulated: false,
      cursor: hasNext ? serializeClassifiedCursor(nextOffset) : null,
      isDone: !hasNext,
      currentBounds: computeBounds(galaxies),
    };
  }

  if (filterType === "classified") {
    const firstClassification = await ctx.db
      .query("userGalaxyClassifications")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (!firstClassification) {
      return createEmptyBrowseResult({ hasPrevious: parsedCursor.offset > 0 });
    }
  }

  // Other sort orders and the complement use indexed membership checks rather
  // than loading the user's entire classification history into this transaction.
  const findRecord = (galaxyId: string) => ctx.db
    .query("userGalaxyClassifications")
    .withIndex("by_user_galaxy", (q: any) => q.eq("userId", userId).eq("galaxyExternalId", galaxyId))
    .first();

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters,
    initialOffset: parsedCursor.offset,
    lookup: {
      has: async (galaxyId) => Boolean(await findRecord(galaxyId)),
      getMeta: findRecord,
    },
    includeMembers: filterType === "classified",
    serializeCursor: serializeClassifiedCursor,
    augmentGalaxy: (galaxy, trackingRecord) => trackingRecord
      ? {
          ...galaxy,
          classificationId: trackingRecord.classificationId,
          classifiedAt: trackingRecord.classifiedAt,
        }
      : galaxy,
  });
};

export const handleSkippedGalaxies = async (options: SpecialFilterOptions) => {
  const { ctx, userId, cursor, offset = 0, numItems, sortOrder, requestedSort, filters } = options;
  const initialOffset = cursor ? parseSkippedCursor(cursor) : Math.max(offset, 0);

  const skippedRecords = await ctx.db
    .query("skippedGalaxies")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (skippedRecords.length === 0) {
    return createEmptyBrowseResult({ hasPrevious: initialOffset > 0 });
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
    filters,
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

export const handleMySequenceGalaxies = async (options: SpecialFilterOptions) => {
  const { ctx, userId, cursor, offset = 0, numItems, sortOrder, requestedSort, filters } = options;
  const initialOffset = cursor ? parseSequenceCursor(cursor) : Math.max(offset, 0);

  const userSequence = await ctx.db
    .query("galaxySequences")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  if (!userSequence || !userSequence.galaxyExternalIds || userSequence.galaxyExternalIds.length === 0) {
    return createEmptyBrowseResult({ hasPrevious: initialOffset > 0 });
  }

  const sequenceGalaxyIds = new Set<string>(userSequence.galaxyExternalIds);

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters,
    initialOffset,
    lookup: {
      has: (galaxyId) => sequenceGalaxyIds.has(galaxyId),
    },
    includeMembers: true,
    serializeCursor: serializeSequenceCursor,
  });
};
