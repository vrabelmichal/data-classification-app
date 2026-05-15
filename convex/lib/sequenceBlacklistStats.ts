import type { Doc } from "../_generated/dataModel";

export const SEQUENCE_BLACKLIST_STATS_VERSION_KEY = "sequenceBlacklistStatsVersion";
export const SEQUENCE_BLACKLIST_STATS_BACKFILL_CURSOR_KEY = "sequenceBlacklistStatsBackfillCursor";

type SequenceLike = Pick<
  Doc<"galaxySequences">,
  | "galaxyExternalIds"
  | "numClassified"
  | "numSkipped"
  | "effectiveGalaxyCount"
  | "blacklistedGalaxyCount"
  | "blacklistedClassifiedCount"
  | "blacklistedSkippedCount"
  | "blacklistStatsVersion"
>;

export type SequenceBlacklistStats = {
  rawGalaxyCount: number;
  effectiveGalaxyCount: number;
  blacklistedGalaxyCount: number;
  blacklistedClassifiedCount: number;
  blacklistedSkippedCount: number;
  effectiveClassifiedCount: number;
  effectiveSkippedCount: number;
  effectiveCompletedCount: number;
  effectiveRemainingCount: number;
  effectiveCompletionPercent: number;
};

export type SequenceBlacklistStatsSnapshot = SequenceBlacklistStats & {
  version: number;
  isCurrent: boolean;
};

export function buildSequenceBlacklistStatsPatch(stats: SequenceBlacklistStats, version: number) {
  return {
    effectiveGalaxyCount: stats.effectiveGalaxyCount,
    blacklistedGalaxyCount: stats.blacklistedGalaxyCount,
    blacklistedClassifiedCount: stats.blacklistedClassifiedCount,
    blacklistedSkippedCount: stats.blacklistedSkippedCount,
    blacklistStatsVersion: version,
  };
}

export async function getSequenceBlacklistStatsVersion(ctx: any): Promise<number> {
  const row = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SEQUENCE_BLACKLIST_STATS_VERSION_KEY))
    .unique();

  return typeof row?.value === "number" ? row.value : 0;
}

export async function bumpSequenceBlacklistStatsVersion(ctx: any): Promise<number> {
  const row = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SEQUENCE_BLACKLIST_STATS_VERSION_KEY))
    .unique();

  const nextVersion = (typeof row?.value === "number" ? row.value : 0) + 1;

  if (row) {
    await ctx.db.patch(row._id, { value: nextVersion });
  } else {
    await ctx.db.insert("systemSettings", {
      key: SEQUENCE_BLACKLIST_STATS_VERSION_KEY,
      value: nextVersion,
    });
  }

  return nextVersion;
}

export async function getSequenceBlacklistStatsBackfillCursor(ctx: any): Promise<string | null> {
  const row = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SEQUENCE_BLACKLIST_STATS_BACKFILL_CURSOR_KEY))
    .unique();

  return typeof row?.value === "string" ? row.value : null;
}

export async function setSequenceBlacklistStatsBackfillCursor(
  ctx: any,
  cursor: string | null
): Promise<void> {
  const row = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SEQUENCE_BLACKLIST_STATS_BACKFILL_CURSOR_KEY))
    .unique();

  if (cursor === null) {
    if (row) {
      await ctx.db.delete(row._id);
    }
    return;
  }

  if (row) {
    await ctx.db.patch(row._id, { value: cursor });
    return;
  }

  await ctx.db.insert("systemSettings", {
    key: SEQUENCE_BLACKLIST_STATS_BACKFILL_CURSOR_KEY,
    value: cursor,
  });
}

export async function listBlacklistedGalaxyExternalIds(ctx: any): Promise<string[]> {
  const rows = await ctx.db.query("galaxyBlacklist").collect();
  return rows.map((row: { galaxyExternalId: string }) => row.galaxyExternalId);
}

export function getStoredSequenceBlacklistStats(sequence: SequenceLike): SequenceBlacklistStats | null {
  if (
    typeof sequence.effectiveGalaxyCount !== "number" ||
    typeof sequence.blacklistedGalaxyCount !== "number" ||
    typeof sequence.blacklistedClassifiedCount !== "number" ||
    typeof sequence.blacklistedSkippedCount !== "number"
  ) {
    return null;
  }

  return buildSequenceBlacklistStats(
    sequence,
    sequence.blacklistedGalaxyCount,
    sequence.blacklistedClassifiedCount,
    sequence.blacklistedSkippedCount
  );
}

export function shouldUseStoredSequenceBlacklistStats(
  sequence: SequenceLike,
  currentVersion: number
): boolean {
  return getStoredSequenceBlacklistStats(sequence) !== null && sequence.blacklistStatsVersion === currentVersion;
}

export function computeSequenceBlacklistStats(
  sequence: Pick<SequenceLike, "galaxyExternalIds" | "numClassified" | "numSkipped">,
  options: {
    blacklistedExternalIds: ReadonlySet<string>;
    classifiedExternalIds?: ReadonlySet<string>;
    skippedExternalIds?: ReadonlySet<string>;
  }
): SequenceBlacklistStats {
  const galaxyExternalIds = sequence.galaxyExternalIds ?? [];
  let blacklistedGalaxyCount = 0;

  for (const galaxyExternalId of galaxyExternalIds) {
    if (options.blacklistedExternalIds.has(galaxyExternalId)) {
      blacklistedGalaxyCount += 1;
    }
  }

  let blacklistedClassifiedCount = 0;
  if (options.classifiedExternalIds) {
    for (const galaxyExternalId of galaxyExternalIds) {
      if (
        options.blacklistedExternalIds.has(galaxyExternalId) &&
        options.classifiedExternalIds.has(galaxyExternalId)
      ) {
        blacklistedClassifiedCount += 1;
      }
    }
  }

  let blacklistedSkippedCount = 0;
  if (options.skippedExternalIds) {
    for (const galaxyExternalId of galaxyExternalIds) {
      if (
        options.blacklistedExternalIds.has(galaxyExternalId) &&
        options.skippedExternalIds.has(galaxyExternalId)
      ) {
        blacklistedSkippedCount += 1;
      }
    }
  }

  return buildSequenceBlacklistStats(
    sequence,
    blacklistedGalaxyCount,
    blacklistedClassifiedCount,
    blacklistedSkippedCount
  );
}

export function getSequenceBlacklistStatsSnapshot(
  sequence: SequenceLike,
  currentVersion: number,
  computedStats: SequenceBlacklistStats
): SequenceBlacklistStatsSnapshot {
  if (shouldUseStoredSequenceBlacklistStats(sequence, currentVersion)) {
    return {
      ...(getStoredSequenceBlacklistStats(sequence) as SequenceBlacklistStats),
      version: currentVersion,
      isCurrent: true,
    };
  }

  return {
    ...computedStats,
    version: currentVersion,
    isCurrent: false,
  };
}

export function getEffectiveSequenceIndex(
  galaxyExternalIds: readonly string[] | undefined,
  rawIndex: number,
  blacklistedExternalIds: ReadonlySet<string>
): number {
  if (!galaxyExternalIds || rawIndex < 0 || rawIndex >= galaxyExternalIds.length) {
    return -1;
  }

  if (blacklistedExternalIds.has(galaxyExternalIds[rawIndex])) {
    return -1;
  }

  let effectiveIndex = 0;
  for (let index = 0; index < rawIndex; index += 1) {
    if (!blacklistedExternalIds.has(galaxyExternalIds[index])) {
      effectiveIndex += 1;
    }
  }

  return effectiveIndex;
}

export function getEffectiveRemainingFromSequence(
  sequence: Pick<SequenceLike, "numClassified" | "numSkipped">,
  stats: Pick<SequenceBlacklistStats, "effectiveGalaxyCount" | "blacklistedClassifiedCount" | "blacklistedSkippedCount">
): number {
  const effectiveCompletedCount = Math.max(
    0,
    (sequence.numClassified ?? 0) +
      (sequence.numSkipped ?? 0) -
      stats.blacklistedClassifiedCount -
      stats.blacklistedSkippedCount
  );

  return Math.max(0, stats.effectiveGalaxyCount - effectiveCompletedCount);
}

function buildSequenceBlacklistStats(
  sequence: Pick<SequenceLike, "galaxyExternalIds" | "numClassified" | "numSkipped">,
  blacklistedGalaxyCount: number,
  blacklistedClassifiedCount: number,
  blacklistedSkippedCount: number
): SequenceBlacklistStats {
  const rawGalaxyCount = sequence.galaxyExternalIds?.length ?? 0;
  const effectiveGalaxyCount = Math.max(0, rawGalaxyCount - blacklistedGalaxyCount);
  const effectiveClassifiedCount = Math.max(0, (sequence.numClassified ?? 0) - blacklistedClassifiedCount);
  const effectiveSkippedCount = Math.max(0, (sequence.numSkipped ?? 0) - blacklistedSkippedCount);
  const effectiveCompletedCount = Math.max(0, effectiveClassifiedCount + effectiveSkippedCount);
  const effectiveRemainingCount = Math.max(0, effectiveGalaxyCount - effectiveCompletedCount);

  return {
    rawGalaxyCount,
    effectiveGalaxyCount,
    blacklistedGalaxyCount,
    blacklistedClassifiedCount,
    blacklistedSkippedCount,
    effectiveClassifiedCount,
    effectiveSkippedCount,
    effectiveCompletedCount,
    effectiveRemainingCount,
    effectiveCompletionPercent:
      effectiveGalaxyCount > 0 ? Math.round((effectiveCompletedCount / effectiveGalaxyCount) * 100) : 0,
  };
}