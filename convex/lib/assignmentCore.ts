// convex/lib/assignmentCore.ts
// Shared, pure selection logic that works with async iterables.
// Reuse this in Convex and locally with mocks.

export type UserId = string;

export interface AssignmentStats {
  // Minimal fields needed by the selector
  _id?: string; // optional (used on Convex docs)
  galaxyExternalId: string; // Id<"galaxyIds"> serialized as string for portability
  numericId: string | number | bigint; // used for stable tie ordering
  totalAssigned: number;
  perUser?: Record<UserId, number>;
}

export interface SelectionParams {
  targetUserId: UserId;
  minAssignmentsK: number;
  perUserCapM: number;
  allowOverAssign: boolean;
  sequenceSize: number;
}

export interface SelectionResult {
  selectedIds: string[];
  selectedDocs: AssignmentStats[];
  overAssignedCount: number;
  // True if we exhausted the under-K stream (we saw "end").
  exhaustedUnderK: boolean;
  // True if we exhausted both under-K and over-K streams.
  exhaustedAll: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export function validateParams(opts: {
  expectedUsers: number; // N
  minAssignmentsK: number; // K
  perUserCapM: number; // M
  sequenceSize: number; // S
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const N = Math.max(1, Math.floor(opts.expectedUsers));
  const K = Math.max(1, Math.floor(opts.minAssignmentsK));
  const M = Math.max(1, Math.floor(opts.perUserCapM));
  const S = Math.max(1, Math.floor(opts.sequenceSize));

  if (K > N * M) {
    warnings.push({
      code: "infeasible_K",
      message: `Requested K=${K} exceeds N*M=${N * M}. Expect over-assignments ` +
        `or truncated sequences.`,
    });
  }
  if (S <= 0) {
    warnings.push({
      code: "invalid_S",
      message: "Requested sequenceSize must be >= 1; will coerce to 1.",
    });
  }
  if (M <= 0) {
    warnings.push({
      code: "invalid_M",
      message:
        "Per-user cap M must be >= 1; will coerce to 1 to avoid deadlock.",
    });
  }
  return warnings;
}

// Helper to safely read per-user count.
function perUserCount(doc: AssignmentStats, userId: UserId): number {
  return (doc.perUser ?? {})[userId] ?? 0;
}

// Core selection over two ordered streams:
// - underKStream: totalAssigned < K in ascending (totalAssigned, numericId)
// - overKStream: totalAssigned >= K in ascending (totalAssigned, numericId)
// Both should be de-duplicated by the caller at the source; we still guard
// against duplicates with a Set.
export async function selectFromOrderedStreams(
  params: SelectionParams,
  underKStream: AsyncIterable<AssignmentStats>,
  overKStream?: AsyncIterable<AssignmentStats>
): Promise<SelectionResult> {
  const {
    targetUserId,
    perUserCapM: M,
    allowOverAssign,
    sequenceSize: S,
  } = params;

  const selectedIds: string[] = [];
  const selectedDocs: AssignmentStats[] = [];
  const seen = new Set<string>();
  let overAssignedCount = 0;

  // Pull from under-K first
  let exhaustedUnderK = true;
  for await (const doc of underKStream) {
    if (selectedIds.length >= S) {
      exhaustedUnderK = false; // we didn't actually exhaust, we just filled
      break;
    }
    const id = doc.galaxyExternalId;
    if (seen.has(id)) continue;
    if (perUserCount(doc, targetUserId) >= M) continue;

    selectedIds.push(id);
    selectedDocs.push(doc);
    seen.add(id);
  }

  // If still short and over-assign allowed, continue with over-K
  let exhaustedAll = exhaustedUnderK;
  if (
    selectedIds.length < S &&
    allowOverAssign &&
    overKStream !== undefined
  ) {
    exhaustedAll = true;
    for await (const doc of overKStream) {
      if (selectedIds.length >= S) {
        exhaustedAll = false; // we filled before exhausting the stream
        break;
      }
      const id = doc.galaxyExternalId;
      if (seen.has(id)) continue;
      if (perUserCount(doc, targetUserId) >= M) continue;

      selectedIds.push(id);
      selectedDocs.push(doc);
      seen.add(id);
      overAssignedCount += 1;
    }
  }

  return {
    selectedIds,
    selectedDocs,
    overAssignedCount,
    exhaustedUnderK,
    exhaustedAll,
  };
}

/*
Utilities for local testing with arrays
These build ordered async iterables from arrays, respecting the same
ordering as the Convex index: (totalAssigned ASC, numericId ASC)
*/

export function arrayToUnderKStream(
  array: AssignmentStats[],
  K: number
): AsyncIterable<AssignmentStats> {
  const filtered = array
    .filter((d) => d.totalAssigned < K)
    .sort(byTotalThenNumeric);
  return iterableFromArray(filtered);
}

export function arrayToOverKStream(
  array: AssignmentStats[],
  K: number
): AsyncIterable<AssignmentStats> {
  const filtered = array
    .filter((d) => d.totalAssigned >= K)
    .sort(byTotalThenNumeric);
  return iterableFromArray(filtered);
}

function byTotalThenNumeric(a: AssignmentStats, b: AssignmentStats): number {
  const dt = a.totalAssigned - b.totalAssigned;
  if (dt !== 0) return dt;
  // Compare numericId lexicographically if strings, numerically if numbers or bigint.
  if (typeof a.numericId === "number" && typeof b.numericId === "number") {
    return a.numericId - b.numericId;
  }
  if (typeof a.numericId === "bigint" && typeof b.numericId === "bigint") {
    return a.numericId < b.numericId ? -1 : a.numericId > b.numericId ? 1 : 0;
  }
  const sa = String(a.numericId);
  const sb = String(b.numericId);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function iterableFromArray<T>(arr: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i >= arr.length) return { value: undefined, done: true };
          return { value: arr[i++], done: false };
        },
      };
    },
  };
}

// Local-only helper to apply the selection result to stats (simulate patches)
export function applySelectionInMemory(
  docs: AssignmentStats[],
  targetUserId: UserId,
  perUserCapM: number
): AssignmentStats[] {
  const now = Date.now();
  // 'now' unused here but mirrors server updates if you add timestamps.
  for (const d of docs) {
    const perUser = { ...(d.perUser ?? {}) };
    const prev = perUser[targetUserId] ?? 0;
    if (prev < perUserCapM) {
      perUser[targetUserId] = prev + 1;
      d.perUser = perUser;
      d.totalAssigned = d.totalAssigned + 1;
    }
  }
  return docs;
}