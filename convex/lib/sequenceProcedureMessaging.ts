export type SequenceProcedureType = "balanced" | "classificationBased";
export type SequenceProcedureContext = "generate" | "extend";

export function getSequenceProcedureCopy(
  procedureType: SequenceProcedureType | undefined,
  context: SequenceProcedureContext
) {
  const normalizedType = procedureType ?? "balanced";
  const isClassificationBased = normalizedType === "classificationBased";
  const procedureLabel = isClassificationBased
    ? "classification-based assignment procedure"
    : "regular balanced assignment procedure";

  if (context === "generate") {
    return {
      procedureType: normalizedType,
      isClassificationBased,
      procedureLabel,
      procedureExplanation: isClassificationBased
        ? "This run first prioritized galaxies below the target classification count, broke ties using senior-classifier coverage, and only then fell back to the regular balanced assignment rules when needed."
        : "This run used the regular balanced assignment procedure, which prioritizes galaxies with lower assignment counts overall.",
    };
  }

  return {
    procedureType: normalizedType,
    isClassificationBased,
    procedureLabel,
    procedureExplanation: isClassificationBased
      ? "The added galaxies were prioritized by current classification count first, with senior-classifier coverage used as the tie-breaker before the regular balanced fallback rules were applied."
      : "The added galaxies were selected using the regular balanced assignment procedure.",
  };
}