import { describe, expect, it } from "vitest";
import { getSequenceProcedureCopy } from "../convex/lib/sequenceProcedureMessaging";

describe("sequenceProcedureMessaging", () => {
  it("returns balanced generate copy by default", () => {
    const copy = getSequenceProcedureCopy(undefined, "generate");

    expect(copy.procedureLabel).toBe("regular balanced assignment procedure");
    expect(copy.procedureExplanation).toContain("lower assignment counts overall");
    expect(copy.isClassificationBased).toBe(false);
  });

  it("returns classification-based extend copy with fallback explanation", () => {
    const copy = getSequenceProcedureCopy("classificationBased", "extend");

    expect(copy.procedureLabel).toBe("classification-based assignment procedure");
    expect(copy.procedureExplanation).toContain("current classification count first");
    expect(copy.procedureExplanation).toContain("regular balanced fallback rules");
    expect(copy.isClassificationBased).toBe(true);
  });
});