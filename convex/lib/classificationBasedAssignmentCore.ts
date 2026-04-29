export type ClassificationCandidateDoc = {
  galaxyExternalId: string;
  numericId: bigint;
  totalClassifications: bigint;
};

export type RankedClassificationCandidate = ClassificationCandidateDoc & {
  seniorClassificationCount: number;
};

export function compareNumericIds(a: bigint, b: bigint): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareRankedCandidates(
  a: RankedClassificationCandidate,
  b: RankedClassificationCandidate
): number {
  if (a.seniorClassificationCount !== b.seniorClassificationCount) {
    return a.seniorClassificationCount - b.seniorClassificationCount;
  }
  return compareNumericIds(a.numericId, b.numericId);
}

export function mergeTopRankedCandidates(
  current: RankedClassificationCandidate[],
  incoming: RankedClassificationCandidate[],
  limit: number
): RankedClassificationCandidate[] {
  if (limit <= 0) {
    return [];
  }

  const merged = [...current, ...incoming];
  merged.sort(compareRankedCandidates);
  if (merged.length > limit) {
    merged.length = limit;
  }
  return merged;
}

export function normalizeGalaxyIdList(ids: string[] | null | undefined): string[] {
  if (!ids || ids.length === 0) {
    return [];
  }

  const normalized = ids
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

export function dedupeValues<T>(values: T[] | null | undefined): T[] {
  if (!values || values.length === 0) {
    return [];
  }
  return Array.from(new Set(values));
}

export function buildExtensionCandidateExclusions(
  existingSequenceIds: string[] | null | undefined,
  newlySelectedIds: string[] | null | undefined = []
): {
  underTargetExcludedIds: string[];
  fallbackExcludedIds: string[];
} {
  const underTargetExcludedIds = dedupeValues(existingSequenceIds);

  return {
    underTargetExcludedIds,
    fallbackExcludedIds: mergeGalaxyIdSources(underTargetExcludedIds, newlySelectedIds),
  };
}

export function serializeGalaxyIdList(ids: string[] | null | undefined): string {
  return normalizeGalaxyIdList(ids).join("\n");
}

export function deserializeGalaxyIdList(serializedIds: string | null | undefined): string[] {
  if (!serializedIds) {
    return [];
  }

  return normalizeGalaxyIdList(serializedIds.split("\n"));
}

export function mergeGalaxyIdSources(
  ...sources: Array<readonly string[] | null | undefined>
): string[] {
  const merged = new Set<string>();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const value of source) {
      if (value.trim().length > 0) {
        merged.add(value);
      }
    }
  }
  return Array.from(merged);
}