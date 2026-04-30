import { describe, expect, it } from "vitest";
import {
  buildExtensionCandidateExclusions,
  compareRankedCandidates,
  deserializeGalaxyIdList,
  dedupeValues,
  mergeGalaxyIdSources,
  mergeTopRankedCandidates,
  normalizeGalaxyIdList,
  serializeGalaxyIdList,
  type RankedClassificationCandidate,
} from "../convex/lib/classificationBasedAssignmentCore";

describe("classificationBasedAssignmentCore", () => {
  it("normalizes and deduplicates uploaded blacklist ids", () => {
    expect(normalizeGalaxyIdList([" galaxy-1 ", "", "galaxy-2", "galaxy-1", "   "])).toEqual([
      "galaxy-1",
      "galaxy-2",
    ]);
  });

  it("deduplicates generic values without reordering first occurrences", () => {
    expect(dedupeValues(["user-a", "user-b", "user-a", "user-c"]))
      .toEqual(["user-a", "user-b", "user-c"]);
  });

  it("sorts and truncates ranked candidates by senior count then numeric id", () => {
    const current: RankedClassificationCandidate[] = [
      {
        galaxyExternalId: "galaxy-20",
        numericId: BigInt(20),
        totalClassifications: BigInt(1),
        seniorClassificationCount: 2,
      },
    ];

    const incoming: RankedClassificationCandidate[] = [
      {
        galaxyExternalId: "galaxy-10",
        numericId: BigInt(10),
        totalClassifications: BigInt(1),
        seniorClassificationCount: 1,
      },
      {
        galaxyExternalId: "galaxy-11",
        numericId: BigInt(11),
        totalClassifications: BigInt(1),
        seniorClassificationCount: 1,
      },
      {
        galaxyExternalId: "galaxy-09",
        numericId: BigInt(9),
        totalClassifications: BigInt(1),
        seniorClassificationCount: 0,
      },
    ];

    const merged = mergeTopRankedCandidates(current, incoming, 3);

    expect(merged.map((candidate) => candidate.galaxyExternalId)).toEqual([
      "galaxy-09",
      "galaxy-10",
      "galaxy-11",
    ]);
    expect(compareRankedCandidates(merged[1], merged[2])).toBeLessThan(0);
  });

  it("deduplicates ranked candidates by galaxy id when merging current and incoming lists", () => {
    const merged = mergeTopRankedCandidates(
      [
        {
          galaxyExternalId: "galaxy-10",
          numericId: BigInt(10),
          totalClassifications: BigInt(1),
          seniorClassificationCount: 3,
        },
      ],
      [
        {
          galaxyExternalId: "galaxy-10",
          numericId: BigInt(10),
          totalClassifications: BigInt(1),
          seniorClassificationCount: 1,
        },
        {
          galaxyExternalId: "galaxy-11",
          numericId: BigInt(11),
          totalClassifications: BigInt(1),
          seniorClassificationCount: 2,
        },
      ],
      3
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((candidate) => candidate.galaxyExternalId)).toEqual(["galaxy-10", "galaxy-11"]);
    expect(merged[0]?.seniorClassificationCount).toBe(1);
  });

  it("merges system, uploaded, and carry-forward galaxy ids into a unique set", () => {
    expect(
      mergeGalaxyIdSources(["sys-1", "sys-2"], ["upload-1", "sys-2"], ["carry-1", "upload-1"]) 
    ).toEqual(["sys-1", "sys-2", "upload-1", "carry-1"]);
  });

  it("keeps galaxies already in the user's sequence excluded during extension", () => {
    expect(
      buildExtensionCandidateExclusions(["assigned-1", "assigned-2", "assigned-1"], ["assigned-2", "new-1"])
    ).toEqual({
      underTargetExcludedIds: ["assigned-1", "assigned-2"],
      fallbackExcludedIds: ["assigned-1", "assigned-2", "new-1"],
    });
  });

  it("serializes and restores large galaxy-id lists without changing membership", () => {
    expect(
      deserializeGalaxyIdList(serializeGalaxyIdList(["gal-1", "gal-2", "gal-1", "", "gal-3"]))
    ).toEqual(["gal-1", "gal-2", "gal-3"]);
  });
});