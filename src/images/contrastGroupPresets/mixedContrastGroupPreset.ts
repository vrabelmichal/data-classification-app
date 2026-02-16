import { ImageDisplaySettings } from "../types";
import { buildContrastGroups } from "./shared";

export const mixedContrastGroupPreset: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: buildContrastGroups([
      [
        { key: "unified_100_band_masked_band", label: "Unified Band\n(100%, masked)", showEllipse: true },
        { key: "unified_100_band_masked_residual", label: "Unified Residual\n(100%, masked)" },
        { key: "unified_100_band_masked_model", label: "Unified Model\n(100%, masked)" },
      ],
      [
        { key: "unified_zscale_band_masked_band", label: "Unified Band\n(zscale, masked)", showEllipse: true },
        { key: "unified_zscale_band_masked_residual", label: "Unified Residual\n(zscale, masked)" },
        { key: "unified_zscale_band_masked_model", label: "Unified Model\n(zscale, masked)" },
      ],
      [
        { key: "unified_zscale_band_unmasked_band", label: "Unified Band\n(zscale, unmasked)", showEllipse: true },
        { key: "unified_zscale_band_unmasked_residual", label: "Unified Residual\n(zscale, unmasked)" },
        { key: "unified_zscale_band_unmasked_model", label: "Unified Model\n(zscale, unmasked)" },
      ],
      [
        {
          key: "band_100_log_unmasked",
          label: "Band\n(log, 100%, unmasked)",
          key_masked: "band_100_log_masked",
          label_masked: "Band\n(log, 100%, masked)",
          showEllipse: true,
        },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};
