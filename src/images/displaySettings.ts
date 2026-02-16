import { defaultImageDisplaySettings } from "./defaultImageDisplaySettings";
import { ContrastGroup, ImageDisplaySettings } from "./types";

let cachedSettings: ImageDisplaySettings | null = null;
let configLoadAttempted = false;

/**
 * Merge loaded config with defaults, handling partial configurations
 * Note: defaultMobileOrder is NOT merged from defaults - if not in config, it remains undefined
 * (which means images are shown in the same order as defined in the contrast group)
 */
function mergeWithDefaults(loaded: Partial<ImageDisplaySettings>): ImageDisplaySettings {
  const classification = {
    contrastGroups: loaded.classification?.contrastGroups ?? defaultImageDisplaySettings.classification.contrastGroups,
    defaultGroupIndex: loaded.classification?.defaultGroupIndex ?? defaultImageDisplaySettings.classification.defaultGroupIndex,
    defaultMobileOrder: loaded.classification?.defaultMobileOrder,  // intentionally not falling back to defaults
  };
  
  return {
    previewImageName: loaded.previewImageName ?? defaultImageDisplaySettings.previewImageName,
    classification,
  };
}

/**
 * Attempt to load config from external JSON file
 */
async function loadConfigFromFile(): Promise<Partial<ImageDisplaySettings> | null> {
  try {
    const response = await fetch('/config/images.json', { cache: 'no-cache' });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data as Partial<ImageDisplaySettings>;
  } catch {
    return null;
  }
}

/**
 * Initialize settings by attempting to load from config file
 */
export async function initializeImageDisplaySettings(): Promise<ImageDisplaySettings> {
  if (cachedSettings && configLoadAttempted) {
    return cachedSettings;
  }
  
  configLoadAttempted = true;
  const loaded = await loadConfigFromFile();
  
  if (loaded) {
    cachedSettings = mergeWithDefaults(loaded);
    console.log('[ImageDisplaySettings] Loaded from config file');
  } else {
    cachedSettings = defaultImageDisplaySettings;
    console.log('[ImageDisplaySettings] Using default settings');
  }
  
  return cachedSettings;
}

/**
 * Force reload settings from config file
 */
export async function reloadImageDisplaySettings(): Promise<ImageDisplaySettings> {
  configLoadAttempted = false;
  cachedSettings = null;
  return initializeImageDisplaySettings();
}

/**
 * Synchronous access to settings - returns cached or defaults
 * For guaranteed loaded settings, use initializeImageDisplaySettings() first
 */
export function loadImageDisplaySettings(): ImageDisplaySettings {
  if (!cachedSettings) {
    cachedSettings = defaultImageDisplaySettings;
  }
  return cachedSettings;
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
