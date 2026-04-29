import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { validateParams } from "./lib/assignmentCore";
import {
  buildExtensionCandidateExclusions,
  compareRankedCandidates,
  deserializeGalaxyIdList,
  dedupeValues,
  mergeGalaxyIdSources,
  mergeTopRankedCandidates,
  normalizeGalaxyIdList,
  serializeGalaxyIdList,
  type ClassificationCandidateDoc,
  type RankedClassificationCandidate,
} from "./lib/classificationBasedAssignmentCore";

const MAX_SEQUENCE = 8192;
const CLASSIFICATION_PAGE_SIZE = 2000;
const SENIOR_COUNT_BATCH_SIZE = 200;
const APPLY_BATCH_SIZE = 500;

type ClassificationCandidateBatchResult = {
  candidateDocs: ClassificationCandidateDoc[];
  cursor: string | null;
  exhausted: boolean;
  scannedCount: number;
};

type UnderTargetSelectionResult = {
  selectedIds: string[];
  scannedCount: number;
  exhaustedUnderTarget: boolean;
};

type BalancedFallbackResult = {
  selectedIds: string[];
  overAssignedCount: number;
  exhaustedUnderK: boolean;
  exhaustedAll: boolean;
  scannedCount: number;
};

type SelectGalaxiesBatchResult = {
  selectedIds: string[];
  cursor: string | null;
  exhausted: boolean;
  scannedCount: number;
};

type ClassificationAssignmentDiagnostics = {
  effectiveBlacklistCount: number;
  systemBlacklistedCount: number;
  additionalBlacklistedCount: number;
  excludedSequenceGalaxyCount: number;
  excludedSequenceUserCount: number;
  targetExistingSequenceCount: number;
  classificationPrioritySelectedCount: number;
  balancedFallbackSelectedCount: number;
  balancedFallbackUnderAssignedCount: number;
  balancedFallbackOverAssignedCount: number;
};

type EffectiveBlacklistResult = {
  galaxyIds: string[];
  systemBlacklistedCount: number;
  additionalBlacklistedCount: number;
  excludedSequenceGalaxyCount: number;
  excludedSequenceUserCount: number;
};

type ClassificationAssignmentResult = {
  success: boolean;
  requested: number;
  generated: number;
  selectedGalaxyIds?: string[];
  underClassificationTargetCount?: number;
  fallbackAssignedCount?: number;
  previousSize?: number;
  newSequenceSize?: number;
  classificationTarget: number;
  minAssignmentsPerEntry: number;
  perUserCap: number;
  expectedUsers: number;
  allowOverAssign: boolean;
  paperFilter?: string[];
  diagnostics?: ClassificationAssignmentDiagnostics;
  warnings?: string[];
  errors?: string[];
};

type NormalizedGenerateClassificationBasedSequenceArgs = {
  targetUserId: Id<"users">;
  expectedUsers: number;
  classificationTarget: number;
  minAssignmentsPerEntry: number;
  perUserCap: number;
  sequenceSize: number;
  allowOverAssign: boolean;
  paperFilter: string[] | null;
  additionalBlacklistedIds: string[];
  excludedSequenceUserIds: Id<"users">[];
};

type NormalizedExtendClassificationBasedSequenceArgs = {
  targetUserId: Id<"users">;
  expectedUsers: number;
  classificationTarget: number;
  minAssignmentsPerEntry: number;
  perUserCap: number;
  requestedAdditionalSize: number;
  allowOverAssign: boolean;
  paperFilter: string[] | null;
  additionalBlacklistedIds: string[];
  excludedSequenceUserIds: Id<"users">[];
};

type GenerateClassificationBasedSequencePlan = ClassificationAssignmentResult & {
  selectedIds: string[];
};

type ExtendClassificationBasedSequencePlan = ClassificationAssignmentResult & {
  selectedIds: string[];
  existingIds: string[];
};

type AssignmentTraceTargetEntry = {
  userId: Id<"users">;
  name: string | null;
  email: string | null;
  role: string;
  sequenceSize: number;
  numClassified: number;
  hasSequence: boolean;
};

type AssignmentTraceTargetsResult = {
  usersWithSequences: AssignmentTraceTargetEntry[];
  usersWithoutSequences: AssignmentTraceTargetEntry[];
};

type AssignmentTraceGalaxyState = {
  galaxyExternalId: string;
  exists: boolean;
  numericId: string | null;
  totalAssigned: number;
  totalClassifications: number;
  targetUserAssigned: number;
  inTargetSequence: boolean;
};

type AssignmentTraceState = {
  sequenceSize: number;
  sequenceGalaxyIds: string[];
  galaxies: AssignmentTraceGalaxyState[];
};

type TraceClassificationBasedAssignmentResult = {
  mode: "generate" | "extend";
  targetUserId: Id<"users">;
  parameters: {
    expectedUsers: number;
    targetClassificationCount: number;
    minAssignmentsPerEntry: number;
    maxAssignmentsPerUserPerEntry: number;
    sequenceSize?: number;
    additionalSize?: number;
    allowOverAssign: boolean;
    paperFilter: string[];
    additionalBlacklistedIds: string[];
    excludedSequenceUserIds: Id<"users">[];
  };
  plan: ClassificationAssignmentResult;
  before: AssignmentTraceState | null;
  after: AssignmentTraceState | null;
  changedGalaxies: Array<{
    galaxyExternalId: string;
    numericId: string | null;
    totalClassifications: number;
    before: {
      totalAssigned: number;
      targetUserAssigned: number;
      inTargetSequence: boolean;
    };
    after: {
      totalAssigned: number;
      targetUserAssigned: number;
      inTargetSequence: boolean;
    };
    delta: {
      totalAssigned: number;
      targetUserAssigned: number;
    };
  }>;
};

function formatPaperFilter(papers: string[] | null | undefined): string {
  if (!papers) return "all";
  return papers.map((paper) => (paper === "" ? "(empty)" : paper)).join(", ");
}

function buildSelectionPhaseSummary(args: {
  underClassificationTargetCount: number;
  fallbackAssignedCount: number;
  fallbackOverAssignedCount: number;
  classificationTarget: number;
  minAssignmentsPerEntry: number;
  allowOverAssign: boolean;
}): string {
  const fallbackUnderAssignedCount = Math.max(0, args.fallbackAssignedCount - args.fallbackOverAssignedCount);
  const fallbackSummary = args.allowOverAssign
    ? `${fallbackUnderAssignedCount} galaxies with totalAssigned < K=${args.minAssignmentsPerEntry} and ${args.fallbackOverAssignedCount} galaxies with totalAssigned >= K=${args.minAssignmentsPerEntry}`
    : `${fallbackUnderAssignedCount} galaxies with totalAssigned < K=${args.minAssignmentsPerEntry} (over-assign disabled)`;

  return `Selection summary: classification-priority phase selected ${args.underClassificationTargetCount} galaxies with totalClassifications < C=${args.classificationTarget}. Balanced fallback selected ${fallbackSummary}.`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function buildEffectiveBlacklistIds(
  ctx: ActionCtx,
  args: {
    systemBlacklistedIds: string[];
    additionalBlacklistedIds: string[];
    excludedSequenceUserIds: Id<"users">[];
  }
): Promise<EffectiveBlacklistResult> {
  const normalizedSystemBlacklistedIds = normalizeGalaxyIdList(args.systemBlacklistedIds);
  const normalizedAdditionalBlacklistedIds = normalizeGalaxyIdList(args.additionalBlacklistedIds);
  const excludedSequenceGalaxyIdGroups: string[][] = [];

  for (const sequenceUserId of args.excludedSequenceUserIds) {
    const sequence = await ctx.runQuery(internal.classificationBasedAssignment.getUserSequenceInternal, {
      targetUserId: sequenceUserId,
    });
    excludedSequenceGalaxyIdGroups.push(sequence?.galaxyExternalIds ?? []);
  }

  const excludedSequenceGalaxyIds = mergeGalaxyIdSources(...excludedSequenceGalaxyIdGroups);

  return {
    galaxyIds: mergeGalaxyIdSources(
      normalizedSystemBlacklistedIds,
      normalizedAdditionalBlacklistedIds,
      excludedSequenceGalaxyIds
    ),
    systemBlacklistedCount: normalizedSystemBlacklistedIds.length,
    additionalBlacklistedCount: normalizedAdditionalBlacklistedIds.length,
    excludedSequenceGalaxyCount: excludedSequenceGalaxyIds.length,
    excludedSequenceUserCount: args.excludedSequenceUserIds.length,
  };
}

function buildClassificationAssignmentDiagnostics(args: {
  effectiveBlacklistCount: number;
  systemBlacklistedCount: number;
  additionalBlacklistedCount: number;
  excludedSequenceGalaxyCount: number;
  excludedSequenceUserCount: number;
  targetExistingSequenceCount: number;
  underClassificationTargetCount: number;
  fallbackAssignedCount: number;
  fallbackOverAssignedCount: number;
}): ClassificationAssignmentDiagnostics {
  return {
    effectiveBlacklistCount: args.effectiveBlacklistCount,
    systemBlacklistedCount: args.systemBlacklistedCount,
    additionalBlacklistedCount: args.additionalBlacklistedCount,
    excludedSequenceGalaxyCount: args.excludedSequenceGalaxyCount,
    excludedSequenceUserCount: args.excludedSequenceUserCount,
    targetExistingSequenceCount: args.targetExistingSequenceCount,
    classificationPrioritySelectedCount: args.underClassificationTargetCount,
    balancedFallbackSelectedCount: args.fallbackAssignedCount,
    balancedFallbackUnderAssignedCount: Math.max(0, args.fallbackAssignedCount - args.fallbackOverAssignedCount),
    balancedFallbackOverAssignedCount: args.fallbackOverAssignedCount,
  };
}

async function rankCandidatesBySeniorCounts(
  ctx: ActionCtx,
  candidateDocs: ClassificationCandidateDoc[],
  seniorUserIds: Id<"users">[]
): Promise<RankedClassificationCandidate[]> {
  if (candidateDocs.length === 0) {
    return [];
  }

  const seniorCounts = new Map<string, number>();
  for (const batch of chunkArray(candidateDocs, SENIOR_COUNT_BATCH_SIZE)) {
    const counts = await ctx.runQuery(
      internal.classificationBasedAssignment.getSeniorClassificationCountsBatch,
      {
        galaxyExternalIds: batch.map((candidate) => candidate.galaxyExternalId),
        seniorUserIds,
      }
    );
    for (const countEntry of counts) {
      seniorCounts.set(countEntry.galaxyExternalId, countEntry.seniorClassificationCount);
    }
  }

  return candidateDocs.map((candidate) => ({
    ...candidate,
    seniorClassificationCount: seniorCounts.get(candidate.galaxyExternalId) ?? 0,
  }));
}

async function selectUnderClassificationTargetIds(
  ctx: ActionCtx,
  args: {
    targetUserId: Id<"users">;
    classificationTarget: number;
    perUserCapM: number;
    sequenceSize: number;
    paperFilter: string[] | null;
    blacklistedIds: string[];
    excludedIds: string[];
    seniorUserIds: Id<"users">[];
  }
): Promise<UnderTargetSelectionResult> {
  const selectedIds: string[] = [];
  let cursor: string | undefined;
  let exhausted = false;
  let scannedCount = 0;
  const serializedBlacklistedIds = serializeGalaxyIdList(args.blacklistedIds);
  const serializedExcludedIds = serializeGalaxyIdList(args.excludedIds);

  let currentBucketCount: number | null = null;
  let zeroBucketDocs: ClassificationCandidateDoc[] = [];
  let rankedBucketBest: RankedClassificationCandidate[] = [];
  let pendingBucketDocs: ClassificationCandidateDoc[] = [];
  let neededForBucket = args.sequenceSize;

  const flushPendingRankedDocs = async () => {
    if (currentBucketCount === null || currentBucketCount === 0 || pendingBucketDocs.length === 0) {
      return;
    }
    const rankedDocs = await rankCandidatesBySeniorCounts(ctx, pendingBucketDocs, args.seniorUserIds);
    rankedBucketBest = mergeTopRankedCandidates(rankedBucketBest, rankedDocs, neededForBucket);
    pendingBucketDocs = [];
  };

  const finalizeCurrentBucket = async () => {
    if (currentBucketCount === null || selectedIds.length >= args.sequenceSize) {
      currentBucketCount = null;
      zeroBucketDocs = [];
      rankedBucketBest = [];
      pendingBucketDocs = [];
      return;
    }

    neededForBucket = args.sequenceSize - selectedIds.length;
    if (currentBucketCount === 0) {
      selectedIds.push(
        ...zeroBucketDocs.slice(0, neededForBucket).map((candidate) => candidate.galaxyExternalId)
      );
    } else {
      await flushPendingRankedDocs();
      rankedBucketBest.sort(compareRankedCandidates);
      selectedIds.push(
        ...rankedBucketBest.slice(0, neededForBucket).map((candidate) => candidate.galaxyExternalId)
      );
    }

    currentBucketCount = null;
    zeroBucketDocs = [];
    rankedBucketBest = [];
    pendingBucketDocs = [];
  };

  while (selectedIds.length < args.sequenceSize && !exhausted) {
    const batch: ClassificationCandidateBatchResult = await ctx.runQuery(
      internal.classificationBasedAssignment.selectClassificationBasedCandidatesBatch,
      {
        targetUserId: args.targetUserId,
        classificationTarget: args.classificationTarget,
        maxAssignmentsPerUserM: args.perUserCapM,
        paperFilter: args.paperFilter ?? undefined,
        blacklistedIdsSerialized: serializedBlacklistedIds,
        excludedIdsSerialized: serializedExcludedIds,
        cursor,
        limit: CLASSIFICATION_PAGE_SIZE,
      }
    );

    scannedCount += batch.scannedCount;
    cursor = batch.cursor ?? undefined;
    exhausted = batch.exhausted;

    for (const candidate of batch.candidateDocs) {
      const candidateCount = Number(candidate.totalClassifications ?? BigInt(0));

      if (currentBucketCount === null) {
        currentBucketCount = candidateCount;
        neededForBucket = args.sequenceSize - selectedIds.length;
      } else if (candidateCount !== currentBucketCount) {
        await finalizeCurrentBucket();
        if (selectedIds.length >= args.sequenceSize) {
          return {
            selectedIds,
            scannedCount,
            exhaustedUnderTarget: false,
          };
        }
        currentBucketCount = candidateCount;
        neededForBucket = args.sequenceSize - selectedIds.length;
      }

      if (currentBucketCount === 0) {
        zeroBucketDocs.push(candidate);
        if (zeroBucketDocs.length >= neededForBucket) {
          await finalizeCurrentBucket();
          return {
            selectedIds,
            scannedCount,
            exhaustedUnderTarget: false,
          };
        }
        continue;
      }

      pendingBucketDocs.push(candidate);
      if (pendingBucketDocs.length >= SENIOR_COUNT_BATCH_SIZE) {
        await flushPendingRankedDocs();
      }
    }
  }

  if (currentBucketCount !== null && selectedIds.length < args.sequenceSize) {
    await finalizeCurrentBucket();
  }

  return {
    selectedIds,
    scannedCount,
    exhaustedUnderTarget: exhausted,
  };
}

async function selectBalancedFallbackIds(
  ctx: ActionCtx,
  args: {
    targetUserId: Id<"users">;
    minAssignmentsK: number;
    perUserCapM: number;
    allowOverAssign: boolean;
    paperFilter: string[] | null;
    blacklistedIds: string[];
    excludedIds: string[];
    neededCount: number;
  }
): Promise<BalancedFallbackResult> {
  const selectedIds: string[] = [];
  let scannedCount = 0;
  let overAssignedCount = 0;
  let cursor: string | undefined;
  let exhaustedUnderK = false;
  let exhaustedOverK = false;
  const serializedBlacklistedIds = serializeGalaxyIdList(args.blacklistedIds);

  while (selectedIds.length < args.neededCount && !exhaustedUnderK) {
    const batchResult: SelectGalaxiesBatchResult = await ctx.runQuery(
      internal.generateBalancedUserSequence.selectGalaxiesBatch,
      {
        targetUserId: args.targetUserId,
        minAssignmentsK: args.minAssignmentsK,
        maxAssignmentsPerUserM: args.perUserCapM,
        paperFilter: args.paperFilter ?? undefined,
        blacklistedIdsSerialized: serializedBlacklistedIds,
        alreadySelectedIdsSerialized: serializeGalaxyIdList([...args.excludedIds, ...selectedIds]),
        cursor,
        phase: "underK",
        limit: CLASSIFICATION_PAGE_SIZE,
        neededCount: args.neededCount - selectedIds.length,
      }
    );

    selectedIds.push(...batchResult.selectedIds);
    scannedCount += batchResult.scannedCount;
    cursor = batchResult.cursor ?? undefined;
    exhaustedUnderK = batchResult.exhausted;
  }

  if (selectedIds.length < args.neededCount && args.allowOverAssign) {
    cursor = undefined;
    while (selectedIds.length < args.neededCount && !exhaustedOverK) {
      const batchResult: SelectGalaxiesBatchResult = await ctx.runQuery(
        internal.generateBalancedUserSequence.selectGalaxiesBatch,
        {
          targetUserId: args.targetUserId,
          minAssignmentsK: args.minAssignmentsK,
          maxAssignmentsPerUserM: args.perUserCapM,
          paperFilter: args.paperFilter ?? undefined,
          blacklistedIdsSerialized: serializedBlacklistedIds,
          alreadySelectedIdsSerialized: serializeGalaxyIdList([...args.excludedIds, ...selectedIds]),
          cursor,
          phase: "overK",
          limit: CLASSIFICATION_PAGE_SIZE,
          neededCount: args.neededCount - selectedIds.length,
        }
      );

      selectedIds.push(...batchResult.selectedIds);
      overAssignedCount += batchResult.selectedIds.length;
      scannedCount += batchResult.scannedCount;
      cursor = batchResult.cursor ?? undefined;
      exhaustedOverK = batchResult.exhausted;
    }
  }

  return {
    selectedIds,
    overAssignedCount,
    exhaustedUnderK,
    exhaustedAll: exhaustedUnderK && (args.allowOverAssign ? exhaustedOverK : true),
    scannedCount,
  };
}

async function revertAppliedAssignments(
  ctx: ActionCtx,
  targetUserId: Id<"users">,
  appliedIds: string[]
): Promise<string[]> {
  const rollbackWarnings: string[] = [];
  if (appliedIds.length === 0) {
    return rollbackWarnings;
  }

  try {
    for (const batch of chunkArray(appliedIds, APPLY_BATCH_SIZE).reverse()) {
      await ctx.runMutation(internal.classificationBasedAssignment.revertAssignmentStatsBatchInternal, {
        targetUserId,
        galaxyExternalIds: batch,
      });
    }
  } catch (rollbackError) {
    rollbackWarnings.push(
      `Rollback could not revert assignment counters cleanly: ${
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      }`
    );
  }

  return rollbackWarnings;
}

async function applyAssignmentsInBatches(
  ctx: ActionCtx,
  targetUserId: Id<"users">,
  selectedIds: string[],
  perUserCapM: number
): Promise<string[]> {
  const appliedIds: string[] = [];
  for (const batch of chunkArray(selectedIds, APPLY_BATCH_SIZE)) {
    await ctx.runMutation(internal.classificationBasedAssignment.applyAssignmentStatsBatchInternal, {
      targetUserId,
      galaxyExternalIds: batch,
      perUserCapM,
    });
    appliedIds.push(...batch);
  }
  return appliedIds;
}

function normalizeGenerateClassificationBasedSequenceArgs(args: {
  targetUserId: Id<"users">;
  expectedUsers?: number;
  targetClassificationCount?: number;
  minAssignmentsPerEntry?: number;
  maxAssignmentsPerUserPerEntry?: number;
  sequenceSize?: number;
  allowOverAssign?: boolean;
  paperFilter?: string[];
  additionalBlacklistedIds?: string[];
  excludedSequenceUserIds?: Id<"users">[];
}): NormalizedGenerateClassificationBasedSequenceArgs {
  const expectedUsers = Math.max(1, Math.floor(args.expectedUsers ?? 10));
  const classificationTarget = Math.max(1, Math.floor(args.targetClassificationCount ?? 3));
  const minAssignmentsPerEntry = Math.max(1, Math.floor(args.minAssignmentsPerEntry ?? 3));
  const perUserCap = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
  const requestedSize = Math.max(1, Math.floor(args.sequenceSize ?? 50));

  return {
    targetUserId: args.targetUserId,
    expectedUsers,
    classificationTarget,
    minAssignmentsPerEntry,
    perUserCap,
    sequenceSize: Math.min(requestedSize, MAX_SEQUENCE),
    allowOverAssign: !!args.allowOverAssign,
    paperFilter: args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null,
    additionalBlacklistedIds: normalizeGalaxyIdList(args.additionalBlacklistedIds),
    excludedSequenceUserIds: dedupeValues(args.excludedSequenceUserIds),
  };
}

function normalizeExtendClassificationBasedSequenceArgs(args: {
  targetUserId: Id<"users">;
  expectedUsers?: number;
  targetClassificationCount?: number;
  minAssignmentsPerEntry?: number;
  maxAssignmentsPerUserPerEntry?: number;
  additionalSize?: number;
  allowOverAssign?: boolean;
  paperFilter?: string[];
  additionalBlacklistedIds?: string[];
  excludedSequenceUserIds?: Id<"users">[];
}): NormalizedExtendClassificationBasedSequenceArgs {
  const expectedUsers = Math.max(1, Math.floor(args.expectedUsers ?? 10));
  const classificationTarget = Math.max(1, Math.floor(args.targetClassificationCount ?? 3));
  const minAssignmentsPerEntry = Math.max(1, Math.floor(args.minAssignmentsPerEntry ?? 3));
  const perUserCap = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
  const requestedAdditionalSize = Math.max(1, Math.floor(args.additionalSize ?? 50));

  return {
    targetUserId: args.targetUserId,
    expectedUsers,
    classificationTarget,
    minAssignmentsPerEntry,
    perUserCap,
    requestedAdditionalSize,
    allowOverAssign: !!args.allowOverAssign,
    paperFilter: args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null,
    additionalBlacklistedIds: normalizeGalaxyIdList(args.additionalBlacklistedIds),
    excludedSequenceUserIds: dedupeValues(args.excludedSequenceUserIds),
  };
}

async function planGenerateClassificationBasedSequence(
  ctx: ActionCtx,
  args: NormalizedGenerateClassificationBasedSequenceArgs
): Promise<GenerateClassificationBasedSequencePlan> {
  const warnings = validateParams({
    expectedUsers: args.expectedUsers,
    minAssignmentsK: args.minAssignmentsPerEntry,
    perUserCapM: args.perUserCap,
    sequenceSize: args.sequenceSize,
  }).map((warning) => warning.message);
  const errors: string[] = [];

  const preconditions = await ctx.runQuery(
    internal.generateBalancedUserSequence.checkSequenceGenerationPreconditions,
    { targetUserId: args.targetUserId }
  );
  if (!preconditions.canProceed) {
    return {
      success: false,
      requested: args.sequenceSize,
      generated: 0,
      selectedIds: [],
      classificationTarget: args.classificationTarget,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      perUserCap: args.perUserCap,
      expectedUsers: args.expectedUsers,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter ?? undefined,
      errors: preconditions.error ? [preconditions.error] : undefined,
    };
  }

  const systemBlacklistedIds = dedupeValues(
    (preconditions.blacklistedIds ??
      (await ctx.runQuery(internal.classificationBasedAssignment.getSystemBlacklistedGalaxyIdsInternal, {}))) as string[]
  );
  const blacklistResult = await buildEffectiveBlacklistIds(ctx, {
    systemBlacklistedIds,
    additionalBlacklistedIds: args.additionalBlacklistedIds,
    excludedSequenceUserIds: args.excludedSequenceUserIds,
  });
  const blacklistedIds = blacklistResult.galaxyIds;
  const seniorUserIds = await ctx.runQuery(internal.classificationBasedAssignment.getSeniorClassifierIds, {});

  const underTargetSelection = await selectUnderClassificationTargetIds(ctx, {
    targetUserId: args.targetUserId,
    classificationTarget: args.classificationTarget,
    perUserCapM: args.perUserCap,
    sequenceSize: args.sequenceSize,
    paperFilter: args.paperFilter,
    blacklistedIds,
    excludedIds: [],
    seniorUserIds,
  });

  const selectedIds = [...underTargetSelection.selectedIds];
  const underClassificationTargetCount = selectedIds.length;

  let fallbackAssignedCount = 0;
  let fallbackOverAssignedCount = 0;
  let fallbackExhaustedAll = true;
  if (selectedIds.length < args.sequenceSize) {
    const fallbackSelection = await selectBalancedFallbackIds(ctx, {
      targetUserId: args.targetUserId,
      minAssignmentsK: args.minAssignmentsPerEntry,
      perUserCapM: args.perUserCap,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter,
      blacklistedIds,
      excludedIds: selectedIds,
      neededCount: args.sequenceSize - selectedIds.length,
    });

    selectedIds.push(...fallbackSelection.selectedIds);
    fallbackAssignedCount = fallbackSelection.selectedIds.length;
    fallbackOverAssignedCount = fallbackSelection.overAssignedCount;
    fallbackExhaustedAll = fallbackSelection.exhaustedAll;
  }

  const diagnostics = buildClassificationAssignmentDiagnostics({
    effectiveBlacklistCount: blacklistedIds.length,
    systemBlacklistedCount: blacklistResult.systemBlacklistedCount,
    additionalBlacklistedCount: blacklistResult.additionalBlacklistedCount,
    excludedSequenceGalaxyCount: blacklistResult.excludedSequenceGalaxyCount,
    excludedSequenceUserCount: blacklistResult.excludedSequenceUserCount,
    targetExistingSequenceCount: 0,
    underClassificationTargetCount,
    fallbackAssignedCount,
    fallbackOverAssignedCount,
  });

  if (fallbackAssignedCount > 0) {
    warnings.push(
      `${fallbackAssignedCount} galaxies were filled using the regular balanced fallback after the classification-target pool (< ${args.classificationTarget}) was exhausted.`
    );
  }

  if (fallbackOverAssignedCount > 0) {
    warnings.push(
      `${fallbackOverAssignedCount} fallback entries were assigned with totalAssigned >= K=${args.minAssignmentsPerEntry} (allowOverAssign=true).`
    );
  }

  if (selectedIds.length === 0) {
    warnings.push(
      args.paperFilter
        ? `No galaxies with totalClassifications < C=${args.classificationTarget} remained after applying paper filter values: [${formatPaperFilter(args.paperFilter)}], the current exclusions, and M=${args.perUserCap}.`
        : `No galaxies with totalClassifications < C=${args.classificationTarget} remained after applying the current exclusions and M=${args.perUserCap}.`
    );
    errors.push("No galaxies available for classification-based assignment");
  }

  if (selectedIds.length < args.sequenceSize) {
    warnings.push(
      buildSelectionPhaseSummary({
        underClassificationTargetCount,
        fallbackAssignedCount,
        fallbackOverAssignedCount,
        classificationTarget: args.classificationTarget,
        minAssignmentsPerEntry: args.minAssignmentsPerEntry,
        allowOverAssign: args.allowOverAssign,
      })
    );
    warnings.push(
      `Only generated ${selectedIds.length} of ${args.sequenceSize} requested. Classification-target pool exhausted${fallbackAssignedCount > 0 ? "; fallback pool was also exhausted." : args.allowOverAssign ? "; fallback pool exhausted." : "; fallback over-assign disabled."}`
    );
    if (!fallbackExhaustedAll && fallbackAssignedCount === 0) {
      warnings.push("Fallback selection stopped early before exhausting its pool.");
    }
  }

  if (selectedIds.length === 0) {
    return {
      success: false,
      requested: args.sequenceSize,
      generated: 0,
      selectedIds,
      underClassificationTargetCount,
      fallbackAssignedCount,
      classificationTarget: args.classificationTarget,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      perUserCap: args.perUserCap,
      expectedUsers: args.expectedUsers,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter ?? undefined,
      diagnostics,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  return {
    success: true,
    requested: args.sequenceSize,
    generated: selectedIds.length,
    selectedIds,
    selectedGalaxyIds: selectedIds,
    underClassificationTargetCount,
    fallbackAssignedCount,
    classificationTarget: args.classificationTarget,
    minAssignmentsPerEntry: args.minAssignmentsPerEntry,
    perUserCap: args.perUserCap,
    expectedUsers: args.expectedUsers,
    allowOverAssign: args.allowOverAssign,
    paperFilter: args.paperFilter ?? undefined,
    diagnostics,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

async function persistGeneratedClassificationBasedSequence(
  ctx: ActionCtx,
  args: {
    targetUserId: Id<"users">;
    selectedIds: string[];
    perUserCap: number;
  }
): Promise<{
  success: boolean;
  errors?: string[];
  rollbackWarnings?: string[];
}> {
  let sequenceCreated = false;
  let appliedIds: string[] = [];
  const rollbackWarnings: string[] = [];

  try {
    const createResult = await ctx.runMutation(
      internal.generateBalancedUserSequence.createUserSequence,
      {
        targetUserId: args.targetUserId,
        galaxyExternalIds: args.selectedIds,
      }
    );

    if (!createResult.success) {
      return {
        success: false,
        errors: ["Failed to create the user sequence"],
      };
    }

    sequenceCreated = true;
    appliedIds = await applyAssignmentsInBatches(ctx, args.targetUserId, args.selectedIds, args.perUserCap);
    await ctx.runMutation(internal.classificationBasedAssignment.setSequenceGeneratedFlagInternal, {
      targetUserId: args.targetUserId,
      sequenceGenerated: true,
    });

    return { success: true };
  } catch (error) {
    rollbackWarnings.push(...(await revertAppliedAssignments(ctx, args.targetUserId, appliedIds)));

    if (sequenceCreated) {
      try {
        await ctx.runMutation(internal.classificationBasedAssignment.deleteUserSequenceInternal, {
          targetUserId: args.targetUserId,
        });
      } catch (rollbackError) {
        rollbackWarnings.push(
          `Rollback could not delete the partially created sequence cleanly: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`
        );
      }
    }

    return {
      success: false,
      rollbackWarnings,
      errors: [
        `Failed to apply classification-based sequence assignment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

async function planExtendClassificationBasedSequence(
  ctx: ActionCtx,
  args: NormalizedExtendClassificationBasedSequenceArgs
): Promise<ExtendClassificationBasedSequencePlan> {
  const warnings = validateParams({
    expectedUsers: args.expectedUsers,
    minAssignmentsK: args.minAssignmentsPerEntry,
    perUserCapM: args.perUserCap,
    sequenceSize: args.requestedAdditionalSize,
  }).map((warning) => warning.message);
  const sequence = await ctx.runQuery(internal.classificationBasedAssignment.getUserSequenceInternal, {
    targetUserId: args.targetUserId,
  });

  if (!sequence) {
    return {
      success: false,
      requested: args.requestedAdditionalSize,
      generated: 0,
      selectedIds: [],
      existingIds: [],
      classificationTarget: args.classificationTarget,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      perUserCap: args.perUserCap,
      expectedUsers: args.expectedUsers,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter ?? undefined,
      errors: ["User does not have a sequence"],
    };
  }

  const existingIds = sequence.galaxyExternalIds ?? [];
  const extensionExclusions = buildExtensionCandidateExclusions(existingIds);
  const previousSize = existingIds.length;
  const maxAddAllowed = MAX_SEQUENCE - previousSize;
  if (maxAddAllowed <= 0) {
    return {
      success: false,
      requested: args.requestedAdditionalSize,
      generated: 0,
      selectedIds: [],
      existingIds,
      previousSize,
      newSequenceSize: previousSize,
      classificationTarget: args.classificationTarget,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      perUserCap: args.perUserCap,
      expectedUsers: args.expectedUsers,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter ?? undefined,
      warnings: [`Cannot extend: sequence already at maximum size of ${MAX_SEQUENCE}`],
      errors: ["Sequence is already at maximum size"],
    };
  }

  const additionalSize = Math.min(args.requestedAdditionalSize, maxAddAllowed);
  if (additionalSize < args.requestedAdditionalSize) {
    warnings.push(`Requested extension was capped to ${additionalSize} galaxies (maximum sequence size ${MAX_SEQUENCE}).`);
  }

  const systemBlacklistedIds = await ctx.runQuery(
    internal.classificationBasedAssignment.getSystemBlacklistedGalaxyIdsInternal,
    {}
  );
  const blacklistResult = await buildEffectiveBlacklistIds(ctx, {
    systemBlacklistedIds,
    additionalBlacklistedIds: args.additionalBlacklistedIds,
    excludedSequenceUserIds: args.excludedSequenceUserIds,
  });
  const blacklistedIds = blacklistResult.galaxyIds;
  const seniorUserIds = await ctx.runQuery(internal.classificationBasedAssignment.getSeniorClassifierIds, {});

  const underTargetSelection = await selectUnderClassificationTargetIds(ctx, {
    targetUserId: args.targetUserId,
    classificationTarget: args.classificationTarget,
    perUserCapM: args.perUserCap,
    sequenceSize: additionalSize,
    paperFilter: args.paperFilter,
    blacklistedIds,
    excludedIds: extensionExclusions.underTargetExcludedIds,
    seniorUserIds,
  });

  const selectedIds = [...underTargetSelection.selectedIds];
  const underClassificationTargetCount = selectedIds.length;

  let fallbackAssignedCount = 0;
  let fallbackOverAssignedCount = 0;
  let fallbackExhaustedAll = true;
  if (selectedIds.length < additionalSize) {
    const fallbackSelection = await selectBalancedFallbackIds(ctx, {
      targetUserId: args.targetUserId,
      minAssignmentsK: args.minAssignmentsPerEntry,
      perUserCapM: args.perUserCap,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter,
      blacklistedIds,
      excludedIds: buildExtensionCandidateExclusions(existingIds, selectedIds).fallbackExcludedIds,
      neededCount: additionalSize - selectedIds.length,
    });

    selectedIds.push(...fallbackSelection.selectedIds);
    fallbackAssignedCount = fallbackSelection.selectedIds.length;
    fallbackOverAssignedCount = fallbackSelection.overAssignedCount;
    fallbackExhaustedAll = fallbackSelection.exhaustedAll;
  }

  const diagnostics = buildClassificationAssignmentDiagnostics({
    effectiveBlacklistCount: blacklistedIds.length,
    systemBlacklistedCount: blacklistResult.systemBlacklistedCount,
    additionalBlacklistedCount: blacklistResult.additionalBlacklistedCount,
    excludedSequenceGalaxyCount: blacklistResult.excludedSequenceGalaxyCount,
    excludedSequenceUserCount: blacklistResult.excludedSequenceUserCount,
    targetExistingSequenceCount: existingIds.length,
    underClassificationTargetCount,
    fallbackAssignedCount,
    fallbackOverAssignedCount,
  });

  if (fallbackAssignedCount > 0) {
    warnings.push(
      `${fallbackAssignedCount} galaxies were added using the regular balanced fallback after the classification-target pool (< ${args.classificationTarget}) was exhausted.`
    );
  }

  if (fallbackOverAssignedCount > 0) {
    warnings.push(
      `${fallbackOverAssignedCount} fallback entries were added with totalAssigned >= K=${args.minAssignmentsPerEntry} (allowOverAssign=true).`
    );
  }

  if (selectedIds.length === 0) {
    warnings.push(
      buildSelectionPhaseSummary({
        underClassificationTargetCount,
        fallbackAssignedCount,
        fallbackOverAssignedCount,
        classificationTarget: args.classificationTarget,
        minAssignmentsPerEntry: args.minAssignmentsPerEntry,
        allowOverAssign: args.allowOverAssign,
      })
    );
    warnings.push(
      args.paperFilter
        ? `No galaxies with totalClassifications < C=${args.classificationTarget} remained after applying paper filter values: [${formatPaperFilter(args.paperFilter)}], the current exclusions, and M=${args.perUserCap}.`
        : `No galaxies with totalClassifications < C=${args.classificationTarget} remained after applying the current exclusions and M=${args.perUserCap}.`
    );

    return {
      success: false,
      requested: args.requestedAdditionalSize,
      generated: 0,
      selectedIds,
      existingIds,
      previousSize,
      newSequenceSize: previousSize,
      underClassificationTargetCount,
      fallbackAssignedCount,
      classificationTarget: args.classificationTarget,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      perUserCap: args.perUserCap,
      expectedUsers: args.expectedUsers,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter ?? undefined,
      diagnostics,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: ["No galaxies available to add to the sequence"],
    };
  }

  if (selectedIds.length < additionalSize) {
    warnings.push(
      buildSelectionPhaseSummary({
        underClassificationTargetCount,
        fallbackAssignedCount,
        fallbackOverAssignedCount,
        classificationTarget: args.classificationTarget,
        minAssignmentsPerEntry: args.minAssignmentsPerEntry,
        allowOverAssign: args.allowOverAssign,
      })
    );
    warnings.push(
      `Only found ${selectedIds.length} of ${additionalSize} requested. Classification-target pool exhausted${fallbackAssignedCount > 0 ? "; fallback pool was also exhausted." : args.allowOverAssign ? "; fallback pool exhausted." : "; fallback over-assign disabled."}`
    );
    if (!fallbackExhaustedAll && fallbackAssignedCount === 0) {
      warnings.push("Fallback selection stopped early before exhausting its pool.");
    }
  }

  return {
    success: true,
    requested: args.requestedAdditionalSize,
    generated: selectedIds.length,
    selectedIds,
    existingIds,
    selectedGalaxyIds: selectedIds,
    previousSize,
    newSequenceSize: existingIds.length + selectedIds.length,
    underClassificationTargetCount,
    fallbackAssignedCount,
    classificationTarget: args.classificationTarget,
    minAssignmentsPerEntry: args.minAssignmentsPerEntry,
    perUserCap: args.perUserCap,
    expectedUsers: args.expectedUsers,
    allowOverAssign: args.allowOverAssign,
    paperFilter: args.paperFilter ?? undefined,
    diagnostics,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

async function persistExtendedClassificationBasedSequence(
  ctx: ActionCtx,
  args: {
    targetUserId: Id<"users">;
    existingIds: string[];
    selectedIds: string[];
    perUserCap: number;
  }
): Promise<{
  success: boolean;
  errors?: string[];
  rollbackWarnings?: string[];
}> {
  const nextGalaxyIds = [...args.existingIds, ...args.selectedIds];
  let appliedIds: string[] = [];
  const rollbackWarnings: string[] = [];

  try {
    await ctx.runMutation(internal.classificationBasedAssignment.replaceUserSequenceGalaxyIdsInternal, {
      targetUserId: args.targetUserId,
      galaxyExternalIds: nextGalaxyIds,
    });
    appliedIds = await applyAssignmentsInBatches(ctx, args.targetUserId, args.selectedIds, args.perUserCap);
    return { success: true };
  } catch (error) {
    rollbackWarnings.push(...(await revertAppliedAssignments(ctx, args.targetUserId, appliedIds)));

    try {
      await ctx.runMutation(internal.classificationBasedAssignment.replaceUserSequenceGalaxyIdsInternal, {
        targetUserId: args.targetUserId,
        galaxyExternalIds: args.existingIds,
      });
    } catch (rollbackError) {
      rollbackWarnings.push(
        `Rollback could not restore the original sequence cleanly: ${
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        }`
      );
    }

    return {
      success: false,
      rollbackWarnings,
      errors: [
        `Failed to apply the classification-based sequence extension: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

export const getSeniorClassifierIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userProfiles = await ctx.db.query("userProfiles").collect();
    return userProfiles
      .filter((profile) => profile.experience === "senior")
      .map((profile) => profile.userId);
  },
});

export const getSystemBlacklistedGalaxyIdsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const blacklistedGalaxies = await ctx.db.query("galaxyBlacklist").collect();
    return blacklistedGalaxies.map((entry) => entry.galaxyExternalId);
  },
});

export const selectClassificationBasedCandidatesBatch = internalQuery({
  args: {
    targetUserId: v.id("users"),
    classificationTarget: v.number(),
    maxAssignmentsPerUserM: v.number(),
    paperFilter: v.optional(v.array(v.string())),
    blacklistedIdsSerialized: v.string(),
    excludedIdsSerialized: v.string(),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<ClassificationCandidateBatchResult> => {
    const blacklistedSet = new Set(deserializeGalaxyIdList(args.blacklistedIdsSerialized));
    const excludedSet = new Set(deserializeGalaxyIdList(args.excludedIdsSerialized));
    const effectivePaperFilter = args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null;

    const paginationResult = await ctx.db
      .query("galaxies")
      .withIndex("by_totalClassifications_numericId", (q) =>
        q.lt("totalClassifications", BigInt(args.classificationTarget))
      )
      .paginate({
        numItems: args.limit,
        cursor: args.cursor ?? null,
      });

    const candidateDocs: ClassificationCandidateDoc[] = [];
    for (const doc of paginationResult.page) {
      if (blacklistedSet.has(doc.id) || excludedSet.has(doc.id)) {
        continue;
      }

      if (effectivePaperFilter !== null) {
        const docPaper = doc.misc?.paper ?? "";
        if (!effectivePaperFilter.includes(docPaper)) {
          continue;
        }
      }

      const perUserCount = (doc.perUser ?? {})[args.targetUserId] ?? BigInt(0);
      if (perUserCount >= BigInt(args.maxAssignmentsPerUserM)) {
        continue;
      }

      candidateDocs.push({
        galaxyExternalId: doc.id,
        numericId: doc.numericId ?? BigInt(0),
        totalClassifications: doc.totalClassifications ?? BigInt(0),
      });
    }

    return {
      candidateDocs,
      cursor: paginationResult.isDone ? null : paginationResult.continueCursor,
      exhausted: paginationResult.isDone,
      scannedCount: paginationResult.page.length,
    };
  },
});

export const getSeniorClassificationCountsBatch = internalQuery({
  args: {
    galaxyExternalIds: v.array(v.string()),
    seniorUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const seniorUserIds = new Set(args.seniorUserIds);
    const counts: Array<{ galaxyExternalId: string; seniorClassificationCount: number }> = [];

    for (const galaxyExternalId of args.galaxyExternalIds) {
      const classifications = await ctx.db
        .query("classifications")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .collect();

      let seniorClassificationCount = 0;
      for (const classification of classifications) {
        if (seniorUserIds.has(classification.userId)) {
          seniorClassificationCount += 1;
        }
      }

      counts.push({ galaxyExternalId, seniorClassificationCount });
    }

    return counts;
  },
});

export const getUserSequenceInternal = internalQuery({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();
  },
});

export const replaceUserSequenceGalaxyIdsInternal = internalMutation({
  args: {
    targetUserId: v.id("users"),
    galaxyExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!sequence) {
      throw new Error("User does not have a sequence");
    }

    await ctx.db.patch(sequence._id, {
      galaxyExternalIds: args.galaxyExternalIds,
    });
  },
});

export const deleteUserSequenceInternal = internalMutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!sequence) {
      return;
    }

    await ctx.db.delete(sequence._id);
  },
});

export const applyAssignmentStatsBatchInternal = internalMutation({
  args: {
    targetUserId: v.id("users"),
    galaxyExternalIds: v.array(v.string()),
    perUserCapM: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const galaxyExternalId of args.galaxyExternalIds) {
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) {
        continue;
      }

      const perUser = { ...(galaxy.perUser ?? {}) };
      const previousCount = perUser[args.targetUserId] ?? BigInt(0);
      if (previousCount >= BigInt(args.perUserCapM)) {
        continue;
      }

      perUser[args.targetUserId] = previousCount + BigInt(1);
      await ctx.db.patch(galaxy._id, {
        totalAssigned: (galaxy.totalAssigned ?? BigInt(0)) + BigInt(1),
        perUser,
        lastAssignedAt: now,
      });
    }
  },
});

export const revertAssignmentStatsBatchInternal = internalMutation({
  args: {
    targetUserId: v.id("users"),
    galaxyExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const galaxyExternalId of args.galaxyExternalIds) {
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) {
        continue;
      }

      const perUser = { ...(galaxy.perUser ?? {}) };
      const previousCount = perUser[args.targetUserId] ?? BigInt(0);
      if (previousCount <= BigInt(0)) {
        continue;
      }

      const nextCount = previousCount - BigInt(1);
      if (nextCount <= BigInt(0)) {
        delete perUser[args.targetUserId];
      } else {
        perUser[args.targetUserId] = nextCount;
      }

      const nextTotalAssigned = (() => {
        const currentTotalAssigned = galaxy.totalAssigned ?? BigInt(0);
        return currentTotalAssigned > BigInt(0)
          ? currentTotalAssigned - BigInt(1)
          : BigInt(0);
      })();

      await ctx.db.patch(galaxy._id, {
        totalAssigned: nextTotalAssigned,
        perUser: Object.keys(perUser).length > 0 ? perUser : undefined,
      });
    }
  },
});

export const setSequenceGeneratedFlagInternal = internalMutation({
  args: {
    targetUserId: v.id("users"),
    sequenceGenerated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!userProfile) {
      return;
    }

    await ctx.db.patch(userProfile._id, {
      sequenceGenerated: args.sequenceGenerated,
    });
  },
});

export const listAssignmentTraceTargetsInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<AssignmentTraceTargetsResult> => {
    const sequences = await ctx.db.query("galaxySequences").collect();
    const sequenceByUserId = new Map(sequences.map((sequence) => [sequence.userId, sequence]));
    const userProfiles = await ctx.db.query("userProfiles").collect();

    const users = await Promise.all(
      userProfiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        const sequence = sequenceByUserId.get(profile.userId);

        return {
          userId: profile.userId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          role: profile.role,
          sequenceSize: sequence?.galaxyExternalIds?.length ?? 0,
          numClassified: sequence?.numClassified ?? 0,
          hasSequence: !!sequence,
        };
      })
    );

    const sortKey = (entry: { name: string | null; email: string | null; userId: Id<"users"> }) =>
      `${entry.name ?? ""} ${entry.email ?? ""} ${entry.userId}`.toLowerCase();

    const usersWithSequences = users
      .filter((entry) => entry.hasSequence)
      .sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
    const usersWithoutSequences = users
      .filter((entry) => !entry.hasSequence)
      .sort((left, right) => sortKey(left).localeCompare(sortKey(right)));

    return {
      usersWithSequences,
      usersWithoutSequences,
    };
  },
});

export const getAssignmentTraceStateInternal = internalQuery({
  args: {
    targetUserId: v.id("users"),
    galaxyExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<AssignmentTraceState> => {
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();
    const sequenceGalaxyIds = sequence?.galaxyExternalIds ?? [];
    const sequenceGalaxySet = new Set(sequenceGalaxyIds);

    const galaxies = await Promise.all(
      args.galaxyExternalIds.map(async (galaxyExternalId): Promise<AssignmentTraceGalaxyState> => {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
          .unique();

        return {
          galaxyExternalId,
          exists: !!galaxy,
          numericId: galaxy?.numericId?.toString() ?? null,
          totalAssigned: Number(galaxy?.totalAssigned ?? BigInt(0)),
          totalClassifications: Number(galaxy?.totalClassifications ?? BigInt(0)),
          targetUserAssigned: Number((galaxy?.perUser ?? {})[args.targetUserId] ?? BigInt(0)),
          inTargetSequence: sequenceGalaxySet.has(galaxyExternalId),
        };
      })
    );

    return {
      sequenceSize: sequenceGalaxyIds.length,
      sequenceGalaxyIds,
      galaxies,
    };
  },
});

export const listAssignmentTraceTargetsDev = internalAction({
  args: {},
  handler: async (ctx): Promise<AssignmentTraceTargetsResult> => {
    return await ctx.runQuery(internal.classificationBasedAssignment.listAssignmentTraceTargetsInternal, {});
  },
});

export const traceGenerateClassificationBasedAssignmentDev = internalAction({
  args: {
    targetUserId: v.id("users"),
    expectedUsers: v.optional(v.number()),
    targetClassificationCount: v.optional(v.number()),
    minAssignmentsPerEntry: v.optional(v.number()),
    maxAssignmentsPerUserPerEntry: v.optional(v.number()),
    sequenceSize: v.optional(v.number()),
    allowOverAssign: v.optional(v.boolean()),
    paperFilter: v.optional(v.array(v.string())),
    additionalBlacklistedIds: v.optional(v.array(v.string())),
    excludedSequenceUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<TraceClassificationBasedAssignmentResult> => {
    const normalizedArgs = normalizeGenerateClassificationBasedSequenceArgs(args);
    const plan = await planGenerateClassificationBasedSequence(ctx, normalizedArgs);
    const { selectedIds, ...planResult } = plan;

    if (!plan.success) {
      return {
        mode: "generate",
        targetUserId: normalizedArgs.targetUserId,
        parameters: {
          expectedUsers: normalizedArgs.expectedUsers,
          targetClassificationCount: normalizedArgs.classificationTarget,
          minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
          sequenceSize: normalizedArgs.sequenceSize,
          allowOverAssign: normalizedArgs.allowOverAssign,
          paperFilter: normalizedArgs.paperFilter ?? [],
          additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
          excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
        },
        plan: planResult,
        before: null,
        after: null,
        changedGalaxies: [],
      };
    }

    const before: AssignmentTraceState = await ctx.runQuery(internal.classificationBasedAssignment.getAssignmentTraceStateInternal, {
      targetUserId: normalizedArgs.targetUserId,
      galaxyExternalIds: selectedIds,
    });

    const persistResult = await persistGeneratedClassificationBasedSequence(ctx, {
      targetUserId: normalizedArgs.targetUserId,
      selectedIds,
      perUserCap: normalizedArgs.perUserCap,
    });

    if (!persistResult.success) {
      return {
        mode: "generate",
        targetUserId: normalizedArgs.targetUserId,
        parameters: {
          expectedUsers: normalizedArgs.expectedUsers,
          targetClassificationCount: normalizedArgs.classificationTarget,
          minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
          sequenceSize: normalizedArgs.sequenceSize,
          allowOverAssign: normalizedArgs.allowOverAssign,
          paperFilter: normalizedArgs.paperFilter ?? [],
          additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
          excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
        },
        plan: {
          ...planResult,
          success: false,
          generated: 0,
          warnings:
            planResult.warnings || persistResult.rollbackWarnings
              ? [...(planResult.warnings ?? []), ...(persistResult.rollbackWarnings ?? [])]
              : undefined,
          errors: persistResult.errors,
        },
        before,
        after: null,
        changedGalaxies: [],
      };
    }

    const after: AssignmentTraceState = await ctx.runQuery(internal.classificationBasedAssignment.getAssignmentTraceStateInternal, {
      targetUserId: normalizedArgs.targetUserId,
      galaxyExternalIds: selectedIds,
    });

    const beforeByGalaxyId = new Map<string, AssignmentTraceGalaxyState>(
      before.galaxies.map((galaxy) => [galaxy.galaxyExternalId, galaxy])
    );
    const afterByGalaxyId = new Map<string, AssignmentTraceGalaxyState>(
      after.galaxies.map((galaxy) => [galaxy.galaxyExternalId, galaxy])
    );

    const changedGalaxies = selectedIds.map((galaxyExternalId) => {
      const beforeGalaxy = beforeByGalaxyId.get(galaxyExternalId);
      const afterGalaxy = afterByGalaxyId.get(galaxyExternalId);

      return {
        galaxyExternalId,
        numericId: afterGalaxy?.numericId ?? beforeGalaxy?.numericId ?? null,
        totalClassifications: afterGalaxy?.totalClassifications ?? beforeGalaxy?.totalClassifications ?? 0,
        before: {
          totalAssigned: beforeGalaxy?.totalAssigned ?? 0,
          targetUserAssigned: beforeGalaxy?.targetUserAssigned ?? 0,
          inTargetSequence: beforeGalaxy?.inTargetSequence ?? false,
        },
        after: {
          totalAssigned: afterGalaxy?.totalAssigned ?? 0,
          targetUserAssigned: afterGalaxy?.targetUserAssigned ?? 0,
          inTargetSequence: afterGalaxy?.inTargetSequence ?? false,
        },
        delta: {
          totalAssigned: (afterGalaxy?.totalAssigned ?? 0) - (beforeGalaxy?.totalAssigned ?? 0),
          targetUserAssigned:
            (afterGalaxy?.targetUserAssigned ?? 0) - (beforeGalaxy?.targetUserAssigned ?? 0),
        },
      };
    });

    return {
      mode: "generate",
      targetUserId: normalizedArgs.targetUserId,
      parameters: {
        expectedUsers: normalizedArgs.expectedUsers,
        targetClassificationCount: normalizedArgs.classificationTarget,
        minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
        sequenceSize: normalizedArgs.sequenceSize,
        allowOverAssign: normalizedArgs.allowOverAssign,
        paperFilter: normalizedArgs.paperFilter ?? [],
        additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
        excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
      },
      plan: planResult,
      before,
      after,
      changedGalaxies,
    };
  },
});

export const traceExtendClassificationBasedAssignmentDev = internalAction({
  args: {
    targetUserId: v.id("users"),
    expectedUsers: v.optional(v.number()),
    targetClassificationCount: v.optional(v.number()),
    minAssignmentsPerEntry: v.optional(v.number()),
    maxAssignmentsPerUserPerEntry: v.optional(v.number()),
    additionalSize: v.optional(v.number()),
    allowOverAssign: v.optional(v.boolean()),
    paperFilter: v.optional(v.array(v.string())),
    additionalBlacklistedIds: v.optional(v.array(v.string())),
    excludedSequenceUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<TraceClassificationBasedAssignmentResult> => {
    const normalizedArgs = normalizeExtendClassificationBasedSequenceArgs(args);
    const plan = await planExtendClassificationBasedSequence(ctx, normalizedArgs);
    const { selectedIds, existingIds, ...planResult } = plan;

    if (!plan.success) {
      return {
        mode: "extend",
        targetUserId: normalizedArgs.targetUserId,
        parameters: {
          expectedUsers: normalizedArgs.expectedUsers,
          targetClassificationCount: normalizedArgs.classificationTarget,
          minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
          additionalSize: normalizedArgs.requestedAdditionalSize,
          allowOverAssign: normalizedArgs.allowOverAssign,
          paperFilter: normalizedArgs.paperFilter ?? [],
          additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
          excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
        },
        plan: planResult,
        before: null,
        after: null,
        changedGalaxies: [],
      };
    }

    const before: AssignmentTraceState = await ctx.runQuery(internal.classificationBasedAssignment.getAssignmentTraceStateInternal, {
      targetUserId: normalizedArgs.targetUserId,
      galaxyExternalIds: selectedIds,
    });

    const persistResult = await persistExtendedClassificationBasedSequence(ctx, {
      targetUserId: normalizedArgs.targetUserId,
      existingIds,
      selectedIds,
      perUserCap: normalizedArgs.perUserCap,
    });

    if (!persistResult.success) {
      return {
        mode: "extend",
        targetUserId: normalizedArgs.targetUserId,
        parameters: {
          expectedUsers: normalizedArgs.expectedUsers,
          targetClassificationCount: normalizedArgs.classificationTarget,
          minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
          additionalSize: normalizedArgs.requestedAdditionalSize,
          allowOverAssign: normalizedArgs.allowOverAssign,
          paperFilter: normalizedArgs.paperFilter ?? [],
          additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
          excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
        },
        plan: {
          ...planResult,
          success: false,
          generated: 0,
          warnings:
            planResult.warnings || persistResult.rollbackWarnings
              ? [...(planResult.warnings ?? []), ...(persistResult.rollbackWarnings ?? [])]
              : undefined,
          errors: persistResult.errors,
        },
        before,
        after: null,
        changedGalaxies: [],
      };
    }

    const after: AssignmentTraceState = await ctx.runQuery(internal.classificationBasedAssignment.getAssignmentTraceStateInternal, {
      targetUserId: normalizedArgs.targetUserId,
      galaxyExternalIds: selectedIds,
    });

    const beforeByGalaxyId = new Map<string, AssignmentTraceGalaxyState>(
      before.galaxies.map((galaxy) => [galaxy.galaxyExternalId, galaxy])
    );
    const afterByGalaxyId = new Map<string, AssignmentTraceGalaxyState>(
      after.galaxies.map((galaxy) => [galaxy.galaxyExternalId, galaxy])
    );

    const changedGalaxies = selectedIds.map((galaxyExternalId) => {
      const beforeGalaxy = beforeByGalaxyId.get(galaxyExternalId);
      const afterGalaxy = afterByGalaxyId.get(galaxyExternalId);

      return {
        galaxyExternalId,
        numericId: afterGalaxy?.numericId ?? beforeGalaxy?.numericId ?? null,
        totalClassifications: afterGalaxy?.totalClassifications ?? beforeGalaxy?.totalClassifications ?? 0,
        before: {
          totalAssigned: beforeGalaxy?.totalAssigned ?? 0,
          targetUserAssigned: beforeGalaxy?.targetUserAssigned ?? 0,
          inTargetSequence: beforeGalaxy?.inTargetSequence ?? false,
        },
        after: {
          totalAssigned: afterGalaxy?.totalAssigned ?? 0,
          targetUserAssigned: afterGalaxy?.targetUserAssigned ?? 0,
          inTargetSequence: afterGalaxy?.inTargetSequence ?? false,
        },
        delta: {
          totalAssigned: (afterGalaxy?.totalAssigned ?? 0) - (beforeGalaxy?.totalAssigned ?? 0),
          targetUserAssigned:
            (afterGalaxy?.targetUserAssigned ?? 0) - (beforeGalaxy?.targetUserAssigned ?? 0),
        },
      };
    });

    return {
      mode: "extend",
      targetUserId: normalizedArgs.targetUserId,
      parameters: {
        expectedUsers: normalizedArgs.expectedUsers,
        targetClassificationCount: normalizedArgs.classificationTarget,
        minAssignmentsPerEntry: normalizedArgs.minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry: normalizedArgs.perUserCap,
        additionalSize: normalizedArgs.requestedAdditionalSize,
        allowOverAssign: normalizedArgs.allowOverAssign,
        paperFilter: normalizedArgs.paperFilter ?? [],
        additionalBlacklistedIds: normalizedArgs.additionalBlacklistedIds,
        excludedSequenceUserIds: normalizedArgs.excludedSequenceUserIds,
      },
      plan: planResult,
      before,
      after,
      changedGalaxies,
    };
  },
});

export const generateClassificationBasedUserSequence = action({
  args: {
    targetUserId: v.optional(v.id("users")),
    expectedUsers: v.number(),
    targetClassificationCount: v.number(),
    minAssignmentsPerEntry: v.number(),
    maxAssignmentsPerUserPerEntry: v.optional(v.number()),
    sequenceSize: v.optional(v.number()),
    allowOverAssign: v.optional(v.boolean()),
    paperFilter: v.optional(v.array(v.string())),
    additionalBlacklistedIds: v.optional(v.array(v.string())),
    excludedSequenceUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<ClassificationAssignmentResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile) {
      throw new Error("Authentication required");
    }

    const callerId = callerProfile.userId as Id<"users">;
    const targetUserId = args.targetUserId ?? callerId;

    if (targetUserId !== callerId && !callerProfile.permissions?.manageGalaxyAssignments) {
      throw new Error("Galaxy-assignment access is required to generate a sequence for another user");
    }

    const normalizedArgs = normalizeGenerateClassificationBasedSequenceArgs({
      targetUserId,
      expectedUsers: args.expectedUsers,
      targetClassificationCount: args.targetClassificationCount,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      maxAssignmentsPerUserPerEntry: args.maxAssignmentsPerUserPerEntry,
      sequenceSize: args.sequenceSize,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter,
      additionalBlacklistedIds: args.additionalBlacklistedIds,
      excludedSequenceUserIds: args.excludedSequenceUserIds,
    });

    const plan = await planGenerateClassificationBasedSequence(ctx, normalizedArgs);
    const { selectedIds, ...planResult } = plan;
    if (!plan.success) {
      return planResult;
    }

    const persistResult = await persistGeneratedClassificationBasedSequence(ctx, {
      targetUserId: normalizedArgs.targetUserId,
      selectedIds,
      perUserCap: normalizedArgs.perUserCap,
    });

    if (!persistResult.success) {
      return {
        ...planResult,
        success: false,
        generated: 0,
        warnings:
          planResult.warnings || persistResult.rollbackWarnings
            ? [...(planResult.warnings ?? []), ...(persistResult.rollbackWarnings ?? [])]
            : undefined,
        errors: persistResult.errors,
      };
    }

    return planResult;
  },
});

export const extendSequenceByClassificationTarget = action({
  args: {
    targetUserId: v.id("users"),
    additionalSize: v.number(),
    expectedUsers: v.number(),
    targetClassificationCount: v.number(),
    minAssignmentsPerEntry: v.number(),
    maxAssignmentsPerUserPerEntry: v.optional(v.number()),
    allowOverAssign: v.optional(v.boolean()),
    paperFilter: v.optional(v.array(v.string())),
    additionalBlacklistedIds: v.optional(v.array(v.string())),
    excludedSequenceUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<ClassificationAssignmentResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile) {
      throw new Error("Authentication required");
    }

    const callerId = callerProfile.userId as Id<"users">;
    const targetUserId = args.targetUserId;

    if (targetUserId !== callerId && !callerProfile.permissions?.manageGalaxyAssignments) {
      throw new Error("Galaxy-assignment access is required to extend another user's sequence");
    }

    const normalizedArgs = normalizeExtendClassificationBasedSequenceArgs({
      targetUserId,
      expectedUsers: args.expectedUsers,
      targetClassificationCount: args.targetClassificationCount,
      minAssignmentsPerEntry: args.minAssignmentsPerEntry,
      maxAssignmentsPerUserPerEntry: args.maxAssignmentsPerUserPerEntry,
      additionalSize: args.additionalSize,
      allowOverAssign: args.allowOverAssign,
      paperFilter: args.paperFilter,
      additionalBlacklistedIds: args.additionalBlacklistedIds,
      excludedSequenceUserIds: args.excludedSequenceUserIds,
    });

    const plan = await planExtendClassificationBasedSequence(ctx, normalizedArgs);
    const { selectedIds, existingIds, ...planResult } = plan;
    if (!plan.success) {
      return planResult;
    }

    const persistResult = await persistExtendedClassificationBasedSequence(ctx, {
      targetUserId: normalizedArgs.targetUserId,
      existingIds,
      selectedIds,
      perUserCap: normalizedArgs.perUserCap,
    });

    if (!persistResult.success) {
      return {
        ...planResult,
        success: false,
        generated: 0,
        warnings:
          planResult.warnings || persistResult.rollbackWarnings
            ? [...(planResult.warnings ?? []), ...(persistResult.rollbackWarnings ?? [])]
            : undefined,
        errors: persistResult.errors,
      };
    }

    return planResult;
  },
});