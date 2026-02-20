export type DecodedLabel =
  | {
      kind: "invalid";
      message: string;
    }
  | {
      kind: "unknown";
      objectId: string;
      details: string;
    }
  | {
      kind: "standard";
      objectId: string;
      imageType: "g" | "r" | "i" | "mdl" | "res";
      scale: "lin" | "log" | "sym" | "asi" | "apt";
      quantile: string;
    }
  | {
      kind: "unified";
      objectId: string;
      imageType: "g" | "r" | "i" | "mdl" | "res";
      thresholdRef: "b" | "m" | "r";
      scale: "lin" | "log" | "sym" | "asi" | "apt";
      quantile: string;
    };

export const imageTypeMap: Record<"g" | "r" | "i" | "mdl" | "res", string> = {
  g: "g-band (observed)",
  r: "r-band (observed)",
  i: "i-band (observed)",
  mdl: "GALFIT model",
  res: "Residual (observed - model)",
};

export const thresholdRefMap: Record<"b" | "m" | "r", string> = {
  b: "band image",
  m: "model image",
  r: "residual image",
};

export const scaleMap: Record<"lin" | "log" | "sym" | "asi" | "apt", string> = {
  lin: "linear",
  log: "logarithmic",
  sym: "symlog",
  asi: "asinh",
  apt: "APLpy stretch",
};

export function decodeQuantile(q: string): string {
  if (q === "zs") {
    return "ZScale automatic normalization";
  }

  if (q.includes("-")) {
    const [low, high] = q.split("-");
    return `${low}th to ${high}th percentile range`;
  }

  return `${q}th percentile`;
}

export function parseImageLabel(rawLabel: string): DecodedLabel {
  const label = rawLabel.trim();
  if (!label) {
    return { kind: "invalid", message: "Enter a label to decode it." };
  }

  const outerMatch = label.match(/^(\d+)\s*\(([^)]+)\)$/);
  if (!outerMatch) {
    return {
      kind: "invalid",
      message: "Invalid format. Expected: ObjectID (details), e.g. 123456789 (g ≡b lin Q99.9).",
    };
  }

  const objectId = outerMatch[1];
  const details = outerMatch[2].trim();
  const unifiedMatch = details.match(/^(g|r|i|mdl|res)\s+≡([bmr])\s+(lin|log|sym|asi|apt)\s+Q(.+)$/);
  if (unifiedMatch) {
    return {
      kind: "unified",
      objectId,
      imageType: unifiedMatch[1] as "g" | "r" | "i" | "mdl" | "res",
      thresholdRef: unifiedMatch[2] as "b" | "m" | "r",
      scale: unifiedMatch[3] as "lin" | "log" | "sym" | "asi" | "apt",
      quantile: unifiedMatch[4],
    };
  }

  const standardMatch = details.match(/^(g|r|i|mdl|res)\s+(lin|log|sym|asi|apt)\s+Q(.+)$/);
  if (standardMatch) {
    return {
      kind: "standard",
      objectId,
      imageType: standardMatch[1] as "g" | "r" | "i" | "mdl" | "res",
      scale: standardMatch[2] as "lin" | "log" | "sym" | "asi" | "apt",
      quantile: standardMatch[3],
    };
  }

  return {
    kind: "unknown",
    objectId,
    details,
  };
}
