import { ImageQuality } from "./provider";

export interface ContrastGroupEntry {
  key: string;
  label: string;
  forcedQuality?: ImageQuality;
}

export type ContrastGroup = ContrastGroupEntry[];

export interface ClassificationImageSettings {
  contrastGroups: ContrastGroup[];
  defaultGroupIndex: number;
}

export interface ImageDisplaySettings {
  previewImageName: string;
  classification: ClassificationImageSettings;
}

const defaultImageDisplaySettings: ImageDisplaySettings = {
  previewImageName: "aplpy_arcsinh_p001_100_vmid02_based_on_100426834_unmasked",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: [
      [
        { key: "g_zscale_masked", label: "Masked g-Band\n(zscale)" },
        { key: "residual_zscale", label: "Residual\n(zscale)" },
        { key: "model_100_0", label: "Galfit Model\n(100%)" },
        { key: "aplpy_arcsinh_p001_100_vmid02_based_on_100426834_unmasked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, 100426834)" },   // !
        // { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1)" }, // remove from the group?
        { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" },
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide, unmasked)", forcedQuality: "low" },
      ],
      [
        { key: "g_99_9_masked", label: "Masked g-Band\n(99.9%)" },
        { key: "residual_100_0", label: "Residual\n(100%)" },
        { key: "model_99_9", label: "Galfit Model\n(99.9%)" },
        { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1)" },
        { key: "aplpy_linear_based_on_365515297_unmasked", label: "APLpy Linear\n(365515297-based, unmasked)" },   // !
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide, unmasked)", forcedQuality: "low" },
      ],
      [
        { key: "g_99_7_masked", label: "Masked g-Band\n(99.7%)" },
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1)" },
        // { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" }, 
        { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based, unmasked)" },   // !
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide, unmasked)", forcedQuality: "low" },
      ],
      [
        { key: "g_99_0_masked", label: "Masked g-Band\n(99.0%)" },
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1)" },
        // { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" },
        { key: "aplpy_defaults_unmasked", label: "APLpy Defaults\n(unmasked)" },  // ?
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide, unmasked)", forcedQuality: "low" },
      ],
    ],
  },
};

let cachedSettings: ImageDisplaySettings | null = null;

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
