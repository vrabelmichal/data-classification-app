import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
  type MutationCtx,
} from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { requirePermission } from "../../lib/auth";
import {
  DEFAULT_AVAILABLE_PAPERS,
  DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_ENABLED,
  DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_INTERVAL_MINUTES,
} from "../../lib/defaults";
import { normalizeUserExperience } from "../../lib/permissions";
import {
  PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT,
  PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY,
  PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY,
  paperAssignmentCoverageCachedResponseValidator,
  paperAssignmentCoverageSharedSnapshotValidator,
  paperAssignmentCoverageSnapshotPayloadValidator,
  paperAssignmentCoverageScopeSnapshotValidator,
  paperAssignmentCoverageUserDirectoryEntryValidator,
} from "./validators";

type Totals = {
  galaxies: number;
  classifiedGalaxies: number;
  unclassifiedGalaxies: number;
  totalClassifications: number;
  progress: number;
  avgClassificationsPerGalaxy: number;
};

type ClassificationStats = {
  flags: {
    awesome: number;
    visibleNucleus: number;
    failedFitting: number;
    validRedshift: number;
  };
  lsbClass: {
    nonLSB: number;
    LSB: number;
  };
  morphology: {
    featureless: number;
    irregular: number;
    spiral: number;
    elliptical: number;
  };
};

type ScopeAccumulator = {
  scopeKey: string;
  paper: string | null;
  totals: {
    galaxies: number;
    classifiedGalaxies: number;
    totalClassifications: number;
  };
  classificationBuckets: number[];
  classificationStats: ClassificationStats;
  activeClassifierIds: Set<string>;
  userCountsByUserId: Map<string, number[]>;
  classifiedByUserId: Map<string, number>;
  processedCountsByUserId: Map<string, number[]>;
  remainingGalaxyIdsByUserId: Map<string, string[][]>;
  assignedBucketCounts: number[];
};

type GalaxyIdBucketChunks = string[][][];

type GalaxyMeta = {
  paper: string;
  bucketIndex: number;
};

type SharedSnapshot = {
  catalog: {
    availablePapers: string[];
    paperCounts: Record<string, { total: number; blacklisted: number; adjusted: number }>;
  };
  userDirectory: Array<{
    userId: string;
    name?: string | null;
    email?: string | null;
    role: string;
    isActive: boolean;
    experience?: "normal" | "senior";
  }>;
  updatedAt: number;
};

type ScopeSnapshot = {
  scopeKey: string;
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
  classificationStats: ClassificationStats;
  activeClassifiers: number;
  userAssignmentCounts: Array<{
    userId: string;
    counts: number[];
    classifiedByUserCount?: number;
    processedByUserCounts?: number[];
    remainingGalaxyIdsByBucket?: GalaxyIdBucketChunks;
  }>;
  unassignedCounts: number[];
  unassignedGalaxyIdsByBucket?: GalaxyIdBucketChunks;
  updatedAt: number;
};

type SequencePageRow = {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: string;
  isActive: boolean;
  experience?: "normal" | "senior";
  galaxyExternalIds: string[];
  sequenceCreatedAt: number;
};

const GALAXY_PAGE_SIZE = 2000;
const CLASSIFICATION_PAGE_SIZE = 5000;
const SKIPPED_PAGE_SIZE = 5000;
const SEQUENCE_PAGE_SIZE = 128;
const MIN_AUTO_REFRESH_INTERVAL_MINUTES = 5;
const MAX_AUTO_REFRESH_INTERVAL_MINUTES = 7 * 24 * 60;
const MAX_GALAXY_ID_CHUNK_SIZE = 4000;

function buildEmptyCounts() {
  return Array.from({ length: PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT }, () => 0);
}

function buildEmptyIdBuckets() {
  return Array.from(
    { length: PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT },
    () => [] as string[]
  );
}

function chunkGalaxyIds(ids: string[]) {
  if (ids.length === 0) {
    return [] as string[][];
  }

  const chunks = [] as string[][];
  for (let startIndex = 0; startIndex < ids.length; startIndex += MAX_GALAXY_ID_CHUNK_SIZE) {
    chunks.push(ids.slice(startIndex, startIndex + MAX_GALAXY_ID_CHUNK_SIZE));
  }

  return chunks;
}

function chunkGalaxyIdBuckets(galaxyIdsByBucket: string[][]) {
  if (!galaxyIdsByBucket.some((bucket) => bucket.length > 0)) {
    return undefined;
  }

  return galaxyIdsByBucket.map((bucket) => chunkGalaxyIds(bucket));
}

function isChunkedGalaxyIdsByBucket(
  value: string[][] | string[][][]
): value is string[][][] {
  return value.some((bucket) => Array.isArray(bucket[0]));
}

function normalizeGalaxyIdBuckets(
  value: string[][] | string[][][] | undefined
): GalaxyIdBucketChunks | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }

  if (isChunkedGalaxyIdsByBucket(value)) {
    return value.map((bucket) => bucket.map((chunk) => [...chunk]));
  }

  return value.map((bucket) => chunkGalaxyIds(bucket));
}

function createEmptyClassificationStats(): ClassificationStats {
  return {
    flags: {
      awesome: 0,
      visibleNucleus: 0,
      failedFitting: 0,
      validRedshift: 0,
    },
    lsbClass: {
      nonLSB: 0,
      LSB: 0,
    },
    morphology: {
      featureless: 0,
      irregular: 0,
      spiral: 0,
      elliptical: 0,
    },
  };
}

function scopeKeyFromPaper(paper: string | null) {
  return paper ?? PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY;
}

function normalizePaper(value: string | null | undefined) {
  return value ?? "";
}

function normalizeBucketIndex(totalClassifications: number) {
  if (!Number.isFinite(totalClassifications) || totalClassifications <= 0) {
    return 0;
  }

  const normalized = Math.floor(totalClassifications);
  if (normalized >= PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT - 1) {
    return PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT - 1;
  }

  return normalized;
}

function createScopeAccumulator(paper: string | null): ScopeAccumulator {
  return {
    scopeKey: scopeKeyFromPaper(paper),
    paper,
    totals: {
      galaxies: 0,
      classifiedGalaxies: 0,
      totalClassifications: 0,
    },
    classificationBuckets: buildEmptyCounts(),
    classificationStats: createEmptyClassificationStats(),
    activeClassifierIds: new Set<string>(),
    userCountsByUserId: new Map<string, number[]>(),
    classifiedByUserId: new Map<string, number>(),
    processedCountsByUserId: new Map<string, number[]>(),
    remainingGalaxyIdsByUserId: new Map<string, string[][]>(),
    assignedBucketCounts: buildEmptyCounts(),
  };
}

function getOrCreateScopeAccumulator(
  scopeAccumulators: Map<string, ScopeAccumulator>,
  paper: string | null
) {
  const scopeKey = scopeKeyFromPaper(paper);
  const existing = scopeAccumulators.get(scopeKey);
  if (existing) {
    return existing;
  }

  const created = createScopeAccumulator(paper);
  scopeAccumulators.set(scopeKey, created);
  return created;
}

function getOrCreateUserCounts(scope: ScopeAccumulator, userId: string) {
  const existing = scope.userCountsByUserId.get(userId);
  if (existing) {
    return existing;
  }

  const created = buildEmptyCounts();
  scope.userCountsByUserId.set(userId, created);
  return created;
}

function getOrCreateProcessedCounts(scope: ScopeAccumulator, userId: string) {
  const existing = scope.processedCountsByUserId.get(userId);
  if (existing) {
    return existing;
  }

  const created = buildEmptyCounts();
  scope.processedCountsByUserId.set(userId, created);
  return created;
}

function getOrCreateRemainingGalaxyIdBuckets(scope: ScopeAccumulator, userId: string) {
  const existing = scope.remainingGalaxyIdsByUserId.get(userId);
  if (existing) {
    return existing;
  }

  const created = buildEmptyIdBuckets();
  scope.remainingGalaxyIdsByUserId.set(userId, created);
  return created;
}

function incrementUserClassifiedCount(scope: ScopeAccumulator, userId: string) {
  scope.classifiedByUserId.set(userId, (scope.classifiedByUserId.get(userId) ?? 0) + 1);
}

function addGalaxyToScope(scope: ScopeAccumulator, totalClassifications: number) {
  const numericTotalClassifications = Number.isFinite(totalClassifications)
    ? Math.max(0, Math.floor(totalClassifications))
    : 0;
  const bucketIndex = normalizeBucketIndex(numericTotalClassifications);

  scope.totals.galaxies += 1;
  scope.totals.totalClassifications += numericTotalClassifications;
  if (numericTotalClassifications > 0) {
    scope.totals.classifiedGalaxies += 1;
  }
  scope.classificationBuckets[bucketIndex] += 1;
}

function addClassificationToStats(
  stats: ClassificationStats,
  row: {
    lsbClass: number;
    morphology: number;
    awesomeFlag: boolean;
    visibleNucleus: boolean;
    failedFitting: boolean;
    validRedshift: boolean;
  }
) {
  if (row.awesomeFlag) {
    stats.flags.awesome += 1;
  }
  if (row.visibleNucleus) {
    stats.flags.visibleNucleus += 1;
  }
  if (row.failedFitting) {
    stats.flags.failedFitting += 1;
  }
  if (row.validRedshift) {
    stats.flags.validRedshift += 1;
  }

  if (row.lsbClass === 1) {
    stats.lsbClass.LSB += 1;
  } else if (row.lsbClass === 0 || row.lsbClass === -1) {
    stats.lsbClass.nonLSB += 1;
  }

  if (row.morphology === -1) {
    stats.morphology.featureless += 1;
  } else if (row.morphology === 0) {
    stats.morphology.irregular += 1;
  } else if (row.morphology === 1) {
    stats.morphology.spiral += 1;
  } else if (row.morphology === 2) {
    stats.morphology.elliptical += 1;
  }
}

function finalizeTotals(totals: ScopeAccumulator["totals"]): Totals {
  const unclassifiedGalaxies = Math.max(totals.galaxies - totals.classifiedGalaxies, 0);
  const progress = totals.galaxies > 0
    ? (totals.classifiedGalaxies / totals.galaxies) * 100
    : 0;
  const avgClassificationsPerGalaxy = totals.galaxies > 0
    ? totals.totalClassifications / totals.galaxies
    : 0;

  return {
    galaxies: totals.galaxies,
    classifiedGalaxies: totals.classifiedGalaxies,
    unclassifiedGalaxies,
    totalClassifications: totals.totalClassifications,
    progress,
    avgClassificationsPerGalaxy,
  };
}

function sortUserDirectory(
  userDirectory: Array<{
    userId: string;
    name?: string | null;
    email?: string | null;
    role: string;
    isActive: boolean;
    experience?: "normal" | "senior";
  }>
) {
  return [...userDirectory].sort((left, right) => {
    const leftLabel = (left.name ?? left.email ?? left.userId).toLowerCase();
    const rightLabel = (right.name ?? right.email ?? right.userId).toLowerCase();
    return leftLabel.localeCompare(rightLabel) || left.userId.localeCompare(right.userId);
  });
}

function finalizeScopeSnapshot(
  scope: ScopeAccumulator,
  updatedAt: number
): ScopeSnapshot {
  const userAssignmentCounts = Array.from(scope.userCountsByUserId.entries())
    .map(([userId, counts]) => {
      const remainingGalaxyIdsByBucket = scope.remainingGalaxyIdsByUserId.get(userId);
      return {
        userId,
        counts: [...counts],
        classifiedByUserCount: scope.classifiedByUserId.get(userId) ?? 0,
        processedByUserCounts: [...(scope.processedCountsByUserId.get(userId) ?? buildEmptyCounts())],
        remainingGalaxyIdsByBucket: chunkGalaxyIdBuckets(
          remainingGalaxyIdsByBucket ?? buildEmptyIdBuckets()
        ),
      };
    })
    .filter((entry) => entry.counts.some((count) => count > 0));
  const unassignedCounts = scope.classificationBuckets.map((count, index) =>
    Math.max(count - scope.assignedBucketCounts[index], 0)
  );
  const unassignedGalaxyIdsByBucket = buildEmptyIdBuckets();

  return {
    scopeKey: scope.scopeKey,
    paper: scope.paper,
    totals: finalizeTotals(scope.totals),
    classificationBuckets: [...scope.classificationBuckets],
    classificationStats: scope.classificationStats,
    activeClassifiers: scope.activeClassifierIds.size,
    userAssignmentCounts,
    unassignedCounts,
    updatedAt,
  };
}

function applyUnassignedGalaxyIdsToScopeSnapshot(
  scopeSnapshot: ScopeSnapshot,
  unassignedGalaxyIdsByBucket: string[][]
) {
  const chunkedGalaxyIdsByBucket = chunkGalaxyIdBuckets(unassignedGalaxyIdsByBucket);

  if (!chunkedGalaxyIdsByBucket) {
    return scopeSnapshot;
  }

  return {
    ...scopeSnapshot,
    unassignedGalaxyIdsByBucket: chunkedGalaxyIdsByBucket,
  };
}

function normalizeConfiguredPapers(value: unknown) {
  const configured = Array.isArray(value)
    ? value.filter((paper): paper is string => typeof paper === "string")
    : DEFAULT_AVAILABLE_PAPERS;
  const deduped = Array.from(new Set(configured));
  return deduped.includes("") ? deduped : ["", ...deduped];
}

function normalizeRefreshIntervalMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_INTERVAL_MINUTES;
  }

  return Math.min(
    MAX_AUTO_REFRESH_INTERVAL_MINUTES,
    Math.max(MIN_AUTO_REFRESH_INTERVAL_MINUTES, Math.floor(parsed))
  );
}

async function computeSnapshotPayload(ctx: ActionCtx) {
  const settings = await ctx.runQuery(
    internal.system_settings.loadMergedSystemSettingsInternal,
    {}
  );
  const configuredPapers = normalizeConfiguredPapers(settings.availablePapers);
  const blacklistedIds = await ctx.runQuery(
    internal.statistics.paperAssignmentCoverage.cache.getBlacklistedIds,
    {}
  );
  const blacklistedIdSet = new Set(blacklistedIds);
  const scopeAccumulators = new Map<string, ScopeAccumulator>([
    [
      PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY,
      createScopeAccumulator(null),
    ],
  ]);
  const discoveredPapers: string[] = [...configuredPapers];
  const paperCounts = new Map<string, { total: number; blacklisted: number }>();
  const galaxyMetaById = new Map<string, GalaxyMeta>();

  for (const paper of configuredPapers) {
    getOrCreateScopeAccumulator(scopeAccumulators, paper);
    paperCounts.set(paper, { total: 0, blacklisted: 0 });
  }

  let galaxyCursor: string | undefined;
  while (true) {
    const page = await ctx.runQuery(
      internal.statistics.paperAssignmentCoverage.cache.getGalaxyPage,
      { cursor: galaxyCursor }
    );

    for (const row of page.rows) {
      const paper = normalizePaper(row.paper);
      const paperCount = paperCounts.get(paper) ?? { total: 0, blacklisted: 0 };
      paperCount.total += 1;
      if (blacklistedIdSet.has(row.externalId)) {
        paperCount.blacklisted += 1;
      }
      paperCounts.set(paper, paperCount);

      if (!discoveredPapers.includes(paper)) {
        discoveredPapers.push(paper);
      }

      if (blacklistedIdSet.has(row.externalId)) {
        continue;
      }

      const totalClassifications = Math.max(0, Math.floor(row.totalClassifications));
      const bucketIndex = normalizeBucketIndex(totalClassifications);
      galaxyMetaById.set(row.externalId, { paper, bucketIndex });

      addGalaxyToScope(
        getOrCreateScopeAccumulator(scopeAccumulators, null),
        totalClassifications
      );
      addGalaxyToScope(
        getOrCreateScopeAccumulator(scopeAccumulators, paper),
        totalClassifications
      );
    }

    if (page.isDone || page.continueCursor === null) {
      break;
    }

    galaxyCursor = page.continueCursor;
  }

  const userDirectoryById = new Map<
    string,
    {
      userId: string;
      name?: string | null;
      email?: string | null;
      role: string;
      isActive: boolean;
      experience: "normal" | "senior";
    }
  >();
  const assignedGalaxyIds = new Set<string>();
  const latestSequenceByUserId = new Map<string, SequencePageRow>();
  const currentSequenceGalaxiesByUserId = new Map<
    string,
    Array<{ externalId: string; paper: string; bucketIndex: number }>
  >();

  let sequenceCursor: string | undefined;
  while (true) {
    const page = await ctx.runQuery(
      internal.statistics.paperAssignmentCoverage.cache.getSequencePage,
      { cursor: sequenceCursor }
    );

    for (const row of page.rows) {
      const existing = latestSequenceByUserId.get(row.userId);
      if (!existing || row.sequenceCreatedAt > existing.sequenceCreatedAt) {
        latestSequenceByUserId.set(row.userId, row);
      }
    }

    if (page.isDone || page.continueCursor === null) {
      break;
    }

    sequenceCursor = page.continueCursor;
  }

  const currentSequenceGalaxyIdsByUserId = new Map<string, Set<string>>();

  for (const row of latestSequenceByUserId.values()) {
    userDirectoryById.set(row.userId, {
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      experience: normalizeUserExperience(row.experience),
    });

    if (row.galaxyExternalIds.length === 0) {
      continue;
    }

    const seenInSequence = new Set<string>();
    for (const externalId of row.galaxyExternalIds) {
      if (seenInSequence.has(externalId)) {
        continue;
      }
      seenInSequence.add(externalId);

      const galaxyMeta = galaxyMetaById.get(externalId);
      if (!galaxyMeta) {
        continue;
      }

      let currentSequenceGalaxyIds = currentSequenceGalaxyIdsByUserId.get(row.userId);
      if (!currentSequenceGalaxyIds) {
        currentSequenceGalaxyIds = new Set<string>();
        currentSequenceGalaxyIdsByUserId.set(row.userId, currentSequenceGalaxyIds);
      }
      currentSequenceGalaxyIds.add(externalId);

      let currentSequenceGalaxies = currentSequenceGalaxiesByUserId.get(row.userId);
      if (!currentSequenceGalaxies) {
        currentSequenceGalaxies = [];
        currentSequenceGalaxiesByUserId.set(row.userId, currentSequenceGalaxies);
      }
      currentSequenceGalaxies.push({
        externalId,
        paper: galaxyMeta.paper,
        bucketIndex: galaxyMeta.bucketIndex,
      });

      const globalScope = getOrCreateScopeAccumulator(scopeAccumulators, null);
      const paperScope = getOrCreateScopeAccumulator(scopeAccumulators, galaxyMeta.paper);
      getOrCreateUserCounts(globalScope, row.userId)[galaxyMeta.bucketIndex] += 1;
      getOrCreateUserCounts(paperScope, row.userId)[galaxyMeta.bucketIndex] += 1;

      if (!assignedGalaxyIds.has(externalId)) {
        assignedGalaxyIds.add(externalId);
        globalScope.assignedBucketCounts[galaxyMeta.bucketIndex] += 1;
        paperScope.assignedBucketCounts[galaxyMeta.bucketIndex] += 1;
      }
    }
  }

  const countedClassificationsByUserAndGalaxy = new Set<string>();
  const countedProcessedByUserAndGalaxy = new Set<string>();

  let classificationCursor: string | undefined;
  while (true) {
    const page = await ctx.runQuery(
      internal.statistics.paperAssignmentCoverage.cache.getClassificationPage,
      { cursor: classificationCursor }
    );

    for (const row of page.rows) {
      const galaxyMeta = galaxyMetaById.get(row.galaxyExternalId);
      if (!galaxyMeta) {
        continue;
      }

      const globalScope = getOrCreateScopeAccumulator(scopeAccumulators, null);
      const paperScope = getOrCreateScopeAccumulator(scopeAccumulators, galaxyMeta.paper);

      addClassificationToStats(globalScope.classificationStats, row);
      addClassificationToStats(paperScope.classificationStats, row);
      globalScope.activeClassifierIds.add(row.userId);
      paperScope.activeClassifierIds.add(row.userId);

      const currentSequence = latestSequenceByUserId.get(row.userId);
      if (!currentSequence || row.createdAt < currentSequence.sequenceCreatedAt) {
        continue;
      }

      const currentSequenceGalaxyIds = currentSequenceGalaxyIdsByUserId.get(row.userId);
      if (!currentSequenceGalaxyIds?.has(row.galaxyExternalId)) {
        continue;
      }

      const classificationKey = `${row.userId}:${row.galaxyExternalId}`;
      if (!countedClassificationsByUserAndGalaxy.has(classificationKey)) {
        countedClassificationsByUserAndGalaxy.add(classificationKey);
        incrementUserClassifiedCount(globalScope, row.userId);
        incrementUserClassifiedCount(paperScope, row.userId);
      }

      if (countedProcessedByUserAndGalaxy.has(classificationKey)) {
        continue;
      }

      countedProcessedByUserAndGalaxy.add(classificationKey);
      getOrCreateProcessedCounts(globalScope, row.userId)[galaxyMeta.bucketIndex] += 1;
      getOrCreateProcessedCounts(paperScope, row.userId)[galaxyMeta.bucketIndex] += 1;
    }

    if (page.isDone || page.continueCursor === null) {
      break;
    }

    classificationCursor = page.continueCursor;
  }

  let skippedCursor: string | undefined;
  while (true) {
    const page = await ctx.runQuery(
      internal.statistics.paperAssignmentCoverage.cache.getSkippedPage,
      { cursor: skippedCursor }
    );

    for (const row of page.rows) {
      const galaxyMeta = galaxyMetaById.get(row.galaxyExternalId);
      if (!galaxyMeta) {
        continue;
      }

      const currentSequence = latestSequenceByUserId.get(row.userId);
      if (!currentSequence || row.createdAt < currentSequence.sequenceCreatedAt) {
        continue;
      }

      const currentSequenceGalaxyIds = currentSequenceGalaxyIdsByUserId.get(row.userId);
      if (!currentSequenceGalaxyIds?.has(row.galaxyExternalId)) {
        continue;
      }

      const processedKey = `${row.userId}:${row.galaxyExternalId}`;
      if (countedProcessedByUserAndGalaxy.has(processedKey)) {
        continue;
      }

      countedProcessedByUserAndGalaxy.add(processedKey);

      const globalScope = getOrCreateScopeAccumulator(scopeAccumulators, null);
      const paperScope = getOrCreateScopeAccumulator(scopeAccumulators, galaxyMeta.paper);
      getOrCreateProcessedCounts(globalScope, row.userId)[galaxyMeta.bucketIndex] += 1;
      getOrCreateProcessedCounts(paperScope, row.userId)[galaxyMeta.bucketIndex] += 1;
    }

    if (page.isDone || page.continueCursor === null) {
      break;
    }

    skippedCursor = page.continueCursor;
  }

  for (const [userId, galaxies] of currentSequenceGalaxiesByUserId.entries()) {
    for (const galaxy of galaxies) {
      const processedKey = `${userId}:${galaxy.externalId}`;
      if (countedProcessedByUserAndGalaxy.has(processedKey)) {
        continue;
      }

      const globalScope = getOrCreateScopeAccumulator(scopeAccumulators, null);
      const paperScope = getOrCreateScopeAccumulator(scopeAccumulators, galaxy.paper);
      getOrCreateRemainingGalaxyIdBuckets(globalScope, userId)[galaxy.bucketIndex].push(
        galaxy.externalId,
      );
      getOrCreateRemainingGalaxyIdBuckets(paperScope, userId)[galaxy.bucketIndex].push(
        galaxy.externalId,
      );
    }
  }

  const availablePapers = Array.from(new Set(discoveredPapers));
  const orderedAvailablePapers = availablePapers.includes("")
    ? availablePapers
    : ["", ...availablePapers];
  const updatedAt = Date.now();
  const catalogCounts: Record<string, { total: number; blacklisted: number; adjusted: number }> = {};

  for (const paper of orderedAvailablePapers) {
    const counts = paperCounts.get(paper) ?? { total: 0, blacklisted: 0 };
    catalogCounts[paper] = {
      total: counts.total,
      blacklisted: counts.blacklisted,
      adjusted: Math.max(counts.total - counts.blacklisted, 0),
    };
    getOrCreateScopeAccumulator(scopeAccumulators, paper);
  }

  const unassignedGalaxyIdsByBucketByScopeKey = new Map<string, string[][]>();

  for (const [externalId, galaxyMeta] of galaxyMetaById.entries()) {
    if (assignedGalaxyIds.has(externalId)) {
      continue;
    }

    const globalBuckets = unassignedGalaxyIdsByBucketByScopeKey.get(
      PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY,
    ) ?? buildEmptyIdBuckets();
    globalBuckets[galaxyMeta.bucketIndex].push(externalId);
    unassignedGalaxyIdsByBucketByScopeKey.set(
      PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY,
      globalBuckets,
    );

    const paperScopeKey = scopeKeyFromPaper(galaxyMeta.paper);
    const paperBuckets = unassignedGalaxyIdsByBucketByScopeKey.get(paperScopeKey) ?? buildEmptyIdBuckets();
    paperBuckets[galaxyMeta.bucketIndex].push(externalId);
    unassignedGalaxyIdsByBucketByScopeKey.set(paperScopeKey, paperBuckets);
  }

  const scopeSnapshots: ScopeSnapshot[] = [
    applyUnassignedGalaxyIdsToScopeSnapshot(
      finalizeScopeSnapshot(
        getOrCreateScopeAccumulator(scopeAccumulators, null),
        updatedAt,
      ),
      unassignedGalaxyIdsByBucketByScopeKey.get(PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY)
        ?? buildEmptyIdBuckets(),
    ),
    ...orderedAvailablePapers.map((paper) =>
      applyUnassignedGalaxyIdsToScopeSnapshot(
        finalizeScopeSnapshot(
          getOrCreateScopeAccumulator(scopeAccumulators, paper),
          updatedAt,
        ),
        unassignedGalaxyIdsByBucketByScopeKey.get(scopeKeyFromPaper(paper))
          ?? buildEmptyIdBuckets(),
      ),
    ),
  ];

  const sharedSnapshot: SharedSnapshot = {
    catalog: {
      availablePapers: orderedAvailablePapers,
      paperCounts: catalogCounts,
    },
    userDirectory: sortUserDirectory(Array.from(userDirectoryById.values())),
    updatedAt,
  };

  return {
    sharedSnapshot,
    scopeSnapshots,
  };
}

export const getBlacklistedIds = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("galaxyBlacklist").collect();
    return Array.from(new Set(rows.map((row) => row.galaxyExternalId)));
  },
});

export const getGalaxyPage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    rows: v.array(v.object({
      externalId: v.string(),
      paper: v.string(),
      totalClassifications: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("galaxies")
      .paginate({ numItems: GALAXY_PAGE_SIZE, cursor: args.cursor ?? null });

    return {
      rows: page.page.map((doc) => ({
        externalId: doc.id,
        paper: normalizePaper(doc.misc?.paper),
        totalClassifications: Number(doc.totalClassifications ?? 0),
      })),
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getClassificationPage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    rows: v.array(v.object({
      userId: v.string(),
      galaxyExternalId: v.string(),
      createdAt: v.number(),
      lsbClass: v.number(),
      morphology: v.number(),
      awesomeFlag: v.boolean(),
      validRedshift: v.boolean(),
      visibleNucleus: v.boolean(),
      failedFitting: v.boolean(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("classifications")
      .paginate({ numItems: CLASSIFICATION_PAGE_SIZE, cursor: args.cursor ?? null });

    return {
      rows: page.page.map((doc) => ({
        userId: String(doc.userId),
        galaxyExternalId: doc.galaxyExternalId,
        createdAt: doc._creationTime,
        lsbClass: doc.lsb_class,
        morphology: doc.morphology,
        awesomeFlag: doc.awesome_flag,
        validRedshift: doc.valid_redshift,
        visibleNucleus: Boolean(doc.visible_nucleus),
        failedFitting: Boolean(doc.failed_fitting),
      })),
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getSequencePage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    rows: v.array(v.object({
      userId: v.string(),
      name: v.optional(v.union(v.string(), v.null())),
      email: v.optional(v.union(v.string(), v.null())),
      role: v.string(),
      isActive: v.boolean(),
      experience: v.optional(v.union(v.literal("normal"), v.literal("senior"))),
      galaxyExternalIds: v.array(v.string()),
      sequenceCreatedAt: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("galaxySequences")
      .paginate({ numItems: SEQUENCE_PAGE_SIZE, cursor: args.cursor ?? null });

    const rows = await Promise.all(
      page.page.map(async (sequence) => {
        const [user, profile] = await Promise.all([
          ctx.db.get(sequence.userId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", sequence.userId))
            .unique(),
        ]);

        return {
          userId: String(sequence.userId),
          name: (user as { name?: string | null } | null)?.name ?? null,
          email: (user as { email?: string | null } | null)?.email ?? null,
          role: profile?.role ?? "user",
          isActive: profile?.isActive ?? false,
          experience: normalizeUserExperience(profile?.experience),
          galaxyExternalIds: sequence.galaxyExternalIds ?? [],
          sequenceCreatedAt: sequence._creationTime,
        };
      })
    );

    return {
      rows,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getSkippedPage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    rows: v.array(v.object({
      userId: v.string(),
      galaxyExternalId: v.string(),
      createdAt: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("skippedGalaxies")
      .paginate({ numItems: SKIPPED_PAGE_SIZE, cursor: args.cursor ?? null });

    return {
      rows: page.page.map((doc) => ({
        userId: String(doc.userId),
        galaxyExternalId: doc.galaxyExternalId,
        createdAt: doc._creationTime,
      })),
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getGalaxyDetailsByIds = query({
  args: {
    galaxyExternalIds: v.array(v.string()),
  },
  returns: v.object({
    galaxies: v.array(v.object({
      id: v.string(),
      numericId: v.union(v.string(), v.null()),
      ra: v.number(),
      dec: v.number(),
      reff: v.number(),
      q: v.number(),
      nucleus: v.boolean(),
      mag: v.union(v.number(), v.null()),
      meanMue: v.union(v.number(), v.null()),
      totalClassifications: v.number(),
      totalAssigned: v.number(),
      paper: v.union(v.string(), v.null()),
      thurClsN: v.union(v.number(), v.null()),
    })),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewAssignmentStatistics", {
      notAuthorizedMessage: "Paper assignment coverage is not available for this account",
    });

    const seenGalaxyIds = new Set<string>();
    const galaxies = [] as Array<{
      id: string;
      numericId: string | null;
      ra: number;
      dec: number;
      reff: number;
      q: number;
      nucleus: boolean;
      mag: number | null;
      meanMue: number | null;
      totalClassifications: number;
      totalAssigned: number;
      paper: string | null;
      thurClsN: number | null;
    }>;

    for (const galaxyExternalId of args.galaxyExternalIds) {
      if (seenGalaxyIds.has(galaxyExternalId)) {
        continue;
      }
      seenGalaxyIds.add(galaxyExternalId);

      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) {
        continue;
      }

      galaxies.push({
        id: galaxy.id,
        numericId: galaxy.numericId !== undefined && galaxy.numericId !== null
          ? galaxy.numericId.toString()
          : null,
        ra: galaxy.ra,
        dec: galaxy.dec,
        reff: galaxy.reff,
        q: galaxy.q,
        nucleus: galaxy.nucleus,
        mag: galaxy.mag ?? null,
        meanMue: galaxy.mean_mue ?? null,
        totalClassifications: Number(galaxy.totalClassifications ?? 0),
        totalAssigned: Number(galaxy.totalAssigned ?? 0),
        paper: galaxy.misc?.paper ?? null,
        thurClsN:
          typeof galaxy.misc?.thur_cls_n === "number"
            ? galaxy.misc.thur_cls_n
            : null,
      });
    }

    return { galaxies };
  },
});

export const getCurrentUserDirectory = action({
  args: {},
  returns: v.array(paperAssignmentCoverageUserDirectoryEntryValidator),
  handler: async (ctx) => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile?.permissions?.viewAssignmentStatistics) {
      throw new Error("Paper assignment coverage is not available for this account");
    }

    const userDirectoryById = new Map<
      string,
      {
        userId: string;
        name?: string | null;
        email?: string | null;
        role: string;
        isActive: boolean;
        experience?: "normal" | "senior";
      }
    >();
    const latestSequenceCreatedAtByUserId = new Map<string, number>();

    let sequenceCursor: string | undefined;
    while (true) {
      const page = await ctx.runQuery(
        internal.statistics.paperAssignmentCoverage.cache.getSequencePage,
        { cursor: sequenceCursor }
      );

      for (const row of page.rows) {
        const existingCreatedAt = latestSequenceCreatedAtByUserId.get(row.userId) ?? -1;
        if (row.sequenceCreatedAt < existingCreatedAt) {
          continue;
        }

        latestSequenceCreatedAtByUserId.set(row.userId, row.sequenceCreatedAt);
        userDirectoryById.set(row.userId, {
          userId: row.userId,
          name: row.name,
          email: row.email,
          role: row.role,
          isActive: row.isActive,
          experience: normalizeUserExperience(row.experience),
        });
      }

      if (page.isDone || page.continueCursor === null) {
        break;
      }

      sequenceCursor = page.continueCursor;
    }

    return sortUserDirectory(Array.from(userDirectoryById.values()));
  },
});

export const getSharedSnapshotUpdatedAtInternal = internalQuery({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const sharedSnapshot = await ctx.db
      .query("paperAssignmentCoverageSharedSnapshots")
      .withIndex("by_key", (q) =>
        q.eq("key", PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY)
      )
      .unique();

    return sharedSnapshot?.updatedAt ?? null;
  },
});

export const saveAllSnapshotsInternal = internalMutation({
  args: paperAssignmentCoverageSnapshotPayloadValidator.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const sharedSnapshot = await ctx.db
      .query("paperAssignmentCoverageSharedSnapshots")
      .withIndex("by_key", (q) =>
        q.eq("key", PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY)
      )
      .unique();

    if (sharedSnapshot) {
      await ctx.db.patch(sharedSnapshot._id, {
        catalog: args.sharedSnapshot.catalog,
        userDirectory: args.sharedSnapshot.userDirectory,
        updatedAt: args.sharedSnapshot.updatedAt,
      });
    } else {
      await ctx.db.insert("paperAssignmentCoverageSharedSnapshots", {
        key: PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY,
        catalog: args.sharedSnapshot.catalog,
        userDirectory: args.sharedSnapshot.userDirectory,
        updatedAt: args.sharedSnapshot.updatedAt,
      });
    }

    const existingScopes = await ctx.db
      .query("paperAssignmentCoverageScopeSnapshots")
      .collect();
    const existingByScopeKey = new Map(
      existingScopes.map((doc) => [doc.scopeKey, doc] as const)
    );
    const nextScopeKeys = new Set(args.scopeSnapshots.map((snapshot) => snapshot.scopeKey));

    for (const snapshot of args.scopeSnapshots) {
      const existing = existingByScopeKey.get(snapshot.scopeKey);
      if (existing) {
        await ctx.db.delete(existing._id);
        await ctx.db.insert("paperAssignmentCoverageScopeSnapshots", snapshot);
      } else {
        await ctx.db.insert("paperAssignmentCoverageScopeSnapshots", snapshot);
      }
    }

    for (const doc of existingScopes) {
      if (!nextScopeKeys.has(doc.scopeKey)) {
        await ctx.db.delete(doc._id);
      }
    }

    return null;
  },
});

export const computeLiveSnapshot = action({
  args: {},
  returns: paperAssignmentCoverageSnapshotPayloadValidator,
  handler: async (ctx) => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile?.permissions?.viewAssignmentStatistics) {
      throw new Error("Not authorized");
    }

    const snapshots = await computeSnapshotPayload(ctx);
    await ctx.runMutation(
      internal.statistics.paperAssignmentCoverage.cache.saveAllSnapshotsInternal,
      snapshots
    );

    return snapshots;
  },
});

export const computeSnapshotInternal = internalAction({
  args: {},
  returns: paperAssignmentCoverageSnapshotPayloadValidator,
  handler: async (ctx) => {
    return await computeSnapshotPayload(ctx);
  },
});

export const refreshSnapshotsIfDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const settings = await ctx.runQuery(
      internal.system_settings.loadMergedSystemSettingsInternal,
      {}
    );
    const autoRefreshEnabled =
      settings.paperAssignmentCoverageAutoRefreshEnabled
      ?? DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_ENABLED;

    if (!autoRefreshEnabled) {
      return null;
    }

    const intervalMinutes = normalizeRefreshIntervalMinutes(
      settings.paperAssignmentCoverageAutoRefreshIntervalMinutes
    );
    const lastUpdatedAt = await ctx.runQuery(
      internal.statistics.paperAssignmentCoverage.cache.getSharedSnapshotUpdatedAtInternal,
      {}
    );

    if (
      lastUpdatedAt !== null
      && Date.now() - lastUpdatedAt < intervalMinutes * 60 * 1000
    ) {
      return null;
    }

    const snapshots = await ctx.runAction(
      internal.statistics.paperAssignmentCoverage.cache.computeSnapshotInternal,
      {}
    );
    await ctx.runMutation(
      internal.statistics.paperAssignmentCoverage.cache.saveAllSnapshotsInternal,
      snapshots
    );

    return null;
  },
});

export const getCachedSnapshot = query({
  args: {},
  returns: paperAssignmentCoverageCachedResponseValidator,
  handler: async (ctx) => {
    await requirePermission(ctx, "viewAssignmentStatistics", {
      notAuthorizedMessage: "Paper assignment coverage is not available for this account",
    });

    const [sharedSnapshot, scopeSnapshots] = await Promise.all([
      ctx.db
        .query("paperAssignmentCoverageSharedSnapshots")
        .withIndex("by_key", (q) =>
          q.eq("key", PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY)
        )
        .unique(),
      ctx.db.query("paperAssignmentCoverageScopeSnapshots").collect(),
    ]);

    const orderedScopeSnapshots = [...scopeSnapshots].sort((left, right) => {
      if (left.scopeKey === PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY) {
        return -1;
      }
      if (right.scopeKey === PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY) {
        return 1;
      }

      return normalizePaper(left.paper).localeCompare(normalizePaper(right.paper));
    });

    return {
      sharedSnapshot: sharedSnapshot
        ? {
            catalog: sharedSnapshot.catalog,
            userDirectory: sharedSnapshot.userDirectory,
            updatedAt: sharedSnapshot.updatedAt,
          }
        : null,
      scopeSnapshots: orderedScopeSnapshots.map((snapshot) => ({
        scopeKey: snapshot.scopeKey,
        paper: snapshot.paper,
        totals: snapshot.totals,
        classificationBuckets: snapshot.classificationBuckets,
        classificationStats: snapshot.classificationStats,
        activeClassifiers: snapshot.activeClassifiers,
        userAssignmentCounts: snapshot.userAssignmentCounts.map((entry) => ({
          ...entry,
          remainingGalaxyIdsByBucket: normalizeGalaxyIdBuckets(
            entry.remainingGalaxyIdsByBucket,
          ),
        })),
        unassignedCounts: snapshot.unassignedCounts,
        unassignedGalaxyIdsByBucket: normalizeGalaxyIdBuckets(
          snapshot.unassignedGalaxyIdsByBucket,
        ),
        updatedAt: snapshot.updatedAt,
      })),
    };
  },
});