import { defaultImageDisplaySettings } from "./defaultImageDisplaySettings";
import { ContrastGroup, ImageDisplaySettings } from "./types";

// External JSON config loading (/config/images.json) is intentionally disabled.
// All settings are sourced directly from defaultImageDisplaySettings.

/**
 * Returns the image display settings (always the compiled-in defaults).
 */
export function loadImageDisplaySettings(): ImageDisplaySettings {
  return defaultImageDisplaySettings;
}

export function getPreviewImageName(): string {
  return loadImageDisplaySettings().previewImageName;
}

export function getClassificationContrastGroups(): ContrastGroup[] {
  return loadImageDisplaySettings().classification.contrastGroups;
}

export function getDefaultClassificationContrastGroupIndex(): number {
  return loadImageDisplaySettings().classification.defaultGroupIndex;
}

export function getDefaultMobileOrder(): number[] | undefined {
  return loadImageDisplaySettings().classification.defaultMobileOrder;
}
