import {
  generatedImageDisplaySettingsPresets,
  ImageDisplaySettingsPreset,
  ImageDisplaySettingsPresetMap,
} from "./contrastGroupPresets";
import {
  ensureSixItemContrastGroups,
  rectangle256x256in1024x1024,
} from "./contrastGroupPresets/shared";
import { ImageDisplaySettings } from "./types";

export const originalDefaultImageDisplaySettings: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: ensureSixItemContrastGroups([
      [
        { key: "g_zscale_masked", label: "Masked g-Band\n(zscale)", showEllipse: true },
        { key: "residual_zscale", label: "Residual\n(zscale)" },
        { key: "model_100_0", label: "Galfit Model\n(100%)" },
        { key: "aplpy_linear_based_on_109534177__1_995_unmasked_irg", label: "APLpy linear\n(109534177-based, irg)", showEllipse: true }, // i,r,g bands
        { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" },
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low", rectangle: rectangle256x256in1024x1024, allowEllipse: false },
      ],
      [
        { key: "g_99_0_masked", label: "Masked g-Band\n(99.0%)", showEllipse: true },
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based)", showEllipse: true }, // !
        { key: "lupton__q_8__stretch_20", label: "Lupton\n(q=8, stretch=20, unmasked)" }, // ?
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low", rectangle: rectangle256x256in1024x1024, allowEllipse: false },
      ],
      [
        { key: "g_99_0_masked", label: "Masked g-Band\n(99.0%)", showEllipse: true },
        { key: "residual_99_7", label: "Residual\n(99.7%)" },
        { key: "model_99_7", label: "Galfit Model\n(99.7%)" },
        { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based)", showEllipse: true }, // !
        { key: "aplpy_defaults_unmasked", label: "APLpy Defaults\n(unmasked)" }, // ?
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low", rectangle: rectangle256x256in1024x1024, allowEllipse: false },
      ],
      
      [
        { key: "g_99_9_masked", label: "Masked g-Band\n(99.9%)", showEllipse: true },
        { key: "residual_100_0", label: "Residual\n(100%)" },
        { key: "model_99_9", label: "Galfit Model\n(99.9%)" },
        { key: "aplpy_linear_based_on_365515297_unmasked", label: "APLpy Linear\n(365515297-based)", showEllipse: true }, // !
        { key: "aplpy_arcsinh_p001_100_vmid02_masked_irg", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, mask, irg)" }, // i,r,g bands
        { key: "aplpy_linear_p1_995_wide_unmasked", label: "APLpy Linear\n(p1_995 wide)", forcedQuality: "low", rectangle: rectangle256x256in1024x1024, allowEllipse: false },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};

export const IMAGE_DISPLAY_SETTINGS_PRESET: ImageDisplaySettingsPreset = "allNewImages";

export { rectangle256x256in1024x1024 };

const imageDisplaySettingsPresets: ImageDisplaySettingsPresetMap = {
  original: originalDefaultImageDisplaySettings,
  ...generatedImageDisplaySettingsPresets,
};

export const defaultImageDisplaySettings: ImageDisplaySettings = imageDisplaySettingsPresets[IMAGE_DISPLAY_SETTINGS_PRESET];

