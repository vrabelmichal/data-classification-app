import { describe, expect, it } from "vitest";
import { summarizeClassificationRows } from "../convex/statistics/labelingOverview/totalsAndPapers";

describe("overview totals and papers", () => {
  it("excludes blacklisted galaxies from per-page classification summaries", () => {
    const summary = summarizeClassificationRows(
      [
        { id: "gal-1", totalClassifications: 0 },
        { id: "gal-2", totalClassifications: 3 },
        { id: "gal-3", totalClassifications: 1 },
      ],
      ["gal-2"]
    );

    expect(summary).toEqual({
      classifiedGalaxies: 1,
      totalClassifications: 1,
      processedGalaxies: 2,
      classificationHistogram: {
        0: 1,
        1: 1,
      },
    });
  });

  it("treats bigint classification totals the same as number totals", () => {
    const summary = summarizeClassificationRows([
      { id: "gal-1", totalClassifications: BigInt(2) },
      { id: "gal-2", totalClassifications: BigInt(0) },
    ]);

    expect(summary.classifiedGalaxies).toBe(1);
    expect(summary.totalClassifications).toBe(2);
    expect(summary.processedGalaxies).toBe(2);
    expect(summary.classificationHistogram).toEqual({
      0: 1,
      2: 1,
    });
  });
});