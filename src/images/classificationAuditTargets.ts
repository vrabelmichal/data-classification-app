import { loadImageDisplaySettings } from "./displaySettings";

export type ClassificationAuditTarget = {
  key: string;
  label: string;
  source: "preview" | "contrast";
};

function humanizeImageKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabel(label: string | undefined, key: string) {
  return (label || humanizeImageKey(key)).replace(/\n+/g, " / ").trim();
}

export function getClassificationAuditTargets(): ClassificationAuditTarget[] {
  const settings = loadImageDisplaySettings();
  const byKey = new Map<string, ClassificationAuditTarget>();

  const addTarget = (key: string | undefined, label: string | undefined, source: "preview" | "contrast") => {
    if (!key) {
      return;
    }

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: normalizeLabel(label, key),
        source,
      });
    }
  };

  addTarget(settings.previewImageName, "Preview image", "preview");

  for (const group of settings.classification.contrastGroups) {
    for (const entry of group) {
      addTarget(entry.key, entry.label, "contrast");
      addTarget(entry.key_masked, entry.label_masked ?? entry.label, "contrast");
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "preview" ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  });
}