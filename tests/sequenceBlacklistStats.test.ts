import { describe, expect, it } from "vitest";
import {
  computeSequenceBlacklistStats,
  getEffectiveSequenceIndex,
} from "../convex/lib/sequenceBlacklistStats";

describe("sequence blacklist stats", () => {
  it("excludes blacklisted galaxies from effective totals and completion", () => {
    const stats = computeSequenceBlacklistStats(
      {
        galaxyExternalIds: ["gal-1", "gal-2", "gal-3", "gal-4"],
        numClassified: 2,
        numSkipped: 1,
      },
      {
        blacklistedExternalIds: new Set(["gal-2", "gal-4"]),
        classifiedExternalIds: new Set(["gal-1", "gal-2"]),
        skippedExternalIds: new Set(["gal-4"]),
      }
    );

    expect(stats.rawGalaxyCount).toBe(4);
    expect(stats.effectiveGalaxyCount).toBe(2);
    expect(stats.blacklistedGalaxyCount).toBe(2);
    expect(stats.blacklistedClassifiedCount).toBe(1);
    expect(stats.blacklistedSkippedCount).toBe(1);
    expect(stats.effectiveClassifiedCount).toBe(1);
    expect(stats.effectiveSkippedCount).toBe(0);
    expect(stats.effectiveCompletedCount).toBe(1);
    expect(stats.effectiveRemainingCount).toBe(1);
    expect(stats.effectiveCompletionPercent).toBe(50);
  });

  it("compresses visible sequence positions and hides blacklisted current entries", () => {
    const blacklistedExternalIds = new Set(["gal-2"]);
    const galaxyExternalIds = ["gal-1", "gal-2", "gal-3", "gal-4"];

    expect(getEffectiveSequenceIndex(galaxyExternalIds, 0, blacklistedExternalIds)).toBe(0);
    expect(getEffectiveSequenceIndex(galaxyExternalIds, 2, blacklistedExternalIds)).toBe(1);
    expect(getEffectiveSequenceIndex(galaxyExternalIds, 1, blacklistedExternalIds)).toBe(-1);
  });
});