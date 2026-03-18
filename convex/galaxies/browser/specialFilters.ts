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

interface SpecialFilterOptions {
  ctx: any;
  userId: string;
  cursor: string | null;
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

export const handleClassifiedGalaxies = async (options: ClassifiedFilterOptions) => {
  const { ctx, userId, cursor, numItems, sortOrder, requestedSort, filterType, filters } = options;
  const parsedCursor = parseClassifiedCursor(cursor);

  const classifiedRecords = await ctx.db
    .query("userGalaxyClassifications")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (filterType === "classified" && classifiedRecords.length === 0) {
    return createEmptyBrowseResult({ hasPrevious: parsedCursor.offset > 0 });
  }

  const classifiedByGalaxyId = new Map<string, any>(
    classifiedRecords.map((record: any) => [record.galaxyExternalId, record])
  );

  return scanMembershipFilteredGalaxies({
    ctx,
    numItems,
    sortOrder,
    requestedSort,
    filters,
    initialOffset: parsedCursor.offset,
    lookup: {
      has: (galaxyId) => classifiedByGalaxyId.has(galaxyId),
      getMeta: (galaxyId) => classifiedByGalaxyId.get(galaxyId),
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
  const { ctx, userId, cursor, numItems, sortOrder, requestedSort, filters } = options;
  const initialOffset = parseSkippedCursor(cursor);

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
  const { ctx, userId, cursor, numItems, sortOrder, requestedSort, filters } = options;
  const initialOffset = parseSequenceCursor(cursor);

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
