import { ImageDisplaySettings } from "../types";
import { buildContrastGroups } from "./shared";

export const unifiedContrastGroupPreset: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: buildContrastGroups([
      [
        { key: "unified_zscale_band_masked_band", label: "Unified Band\n(zscale, masked)", showEllipse: true },
        { key: "unified_zscale_band_masked_residual", label: "Unified Residual\n(zscale, masked)" },
        { key: "unified_zscale_band_masked_model", label: "Unified Model\n(zscale, masked)" },
      ],
      [
        { key: "unified_100_band_masked_band", label: "Unified Band\n(100%, masked)", showEllipse: true },
        { key: "unified_100_band_masked_residual", label: "Unified Residual\n(100%, masked)" },
        { key: "unified_100_band_masked_model", label: "Unified Model\n(100%, masked)" },
      ],
      [
        { key: "unified_100_log_band_masked_band", label: "Unified Band\n(log, 100%, masked)", showEllipse: true },
        { key: "unified_100_log_band_masked_residual", label: "Unified Residual\n(log, 100%, masked)" },
        { key: "unified_100_log_band_masked_model", label: "Unified Model\n(log, 100%, masked)" },
      ],
      [
        { key: "unified_zscale_band_unmasked_band", label: "Unified Band\n(zscale, unmasked)", showEllipse: true },
        { key: "unified_zscale_band_unmasked_residual", label: "Unified Residual\n(zscale, unmasked)" },
        { key: "unified_zscale_band_unmasked_model", label: "Unified Model\n(zscale, unmasked)" },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};
