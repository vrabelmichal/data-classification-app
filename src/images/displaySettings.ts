import { ImageQuality } from "./provider";

export interface ContrastGroupEntry {
  key: string;
  label: string;
  forcedQuality?: ImageQuality;
  showEllipse?: boolean;
}

export type ContrastGroup = ContrastGroupEntry[];

export interface ClassificationImageSettings {
  contrastGroups: ContrastGroup[];
  defaultGroupIndex: number;
  defaultMobileOrder?: number[];
}

export interface ImageDisplaySettings {
  previewImageName: string;
  classification: ClassificationImageSettings;
}

const defaultImageDisplaySettings: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: [
      [
        { key: "g_zscale_masked", label: "Masked g-Band\n(zscale)", showEllipse: true},
        { key: "residual_zscale", label: "Residual\n(zscale)" },
        { key: "model_100_0", label: "Galfit Model\n(100%)" },
        { key: "aplpy_linear_based_on_109534177__1_995_unmasked_irg", label: "APLpy linear\n(109534177-based, irg)", showEllipse: true},   // i,r,g bands
        { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" },
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low",},
      ],
      [
        { key: "g_99_0_masked", label: "Masked g-Band\n(99.0%)", showEllipse: true},
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based)", showEllipse: true},   // !
        { key: "aplpy_defaults_unmasked", label: "APLpy Defaults\n(unmasked)" },  // ?
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low",},
      ],
      [
        { key: "g_99_7_masked", label: "Masked g-Band\n(99.7%)", showEllipse: true},
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_arcsinh_p001_100_vmid02_based_on_100426834_unmasked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, 100426834)", showEllipse: true},   // !
        { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1, mask)" },
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low",},
      ],
      [
        { key: "g_99_9_masked", label: "Masked g-Band\n(99.9%)", showEllipse: true},
        { key: "residual_100_0", label: "Residual\n(100%)" },
        { key: "model_99_9", label: "Galfit Model\n(99.9%)" },
        { key: "aplpy_linear_based_on_365515297_unmasked", label: "APLpy Linear\n(365515297-based)", showEllipse: true},   // !
        { key: "aplpy_arcsinh_p001_100_vmid02_masked_irg", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, mask, irg)" },  // i,r,g bands
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low",},
      ],
    ],
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};

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
