import { ImageDisplaySettings } from "../types";
import { buildContrastGroups } from "./shared";

export const maskthreshContrastGroupPreset: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: buildContrastGroups([
      [
        {
          key: "unified_100_band_maskthresh_band",
          label: "Unified Band\n(100%, mask-thresh)",
          key_masked: "unified_100_band_masked_band",
          label_masked: "Unified Band\n(100%, masked)",
          showEllipse: true,
        },
        { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        {
          key: "unified_100_log_band_maskthresh_band",
          label: "Unified Band\n(log, 100%, mask-thresh)",
          key_masked: "unified_100_log_band_masked_band",
          label_masked: "Unified Band\n(log, 100%, masked)",
          showEllipse: true,
        },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        {
          key: "unified_zscale_band_maskthresh_band",
          label: "Unified Band\n(zscale, mask-thresh)",
          key_masked: "unified_zscale_band_masked_band",
          label_masked: "Unified Band\n(zscale, masked)",
          showEllipse: true,
        },
        { key: "unified_zscale_band_masked_residual", label: "Unified Residual\n(zscale, masked)" },
        { key: "unified_zscale_band_masked_model", label: "Unified Model\n(zscale, masked)" },
      ],
      [
        {
          key: "unified_100_band_maskthresh_band",
          label: "Unified Band\n(100%, mask-thresh)",
          key_masked: "unified_100_band_masked_band",
          label_masked: "Unified Band\n(100%, masked)",
          showEllipse: true,
        },
        { key: "unified_100_band_masked_residual", label: "Unified Residual\n(100%, masked)" },
        { key: "unified_100_band_masked_model", label: "Unified Model\n(100%, masked)" },
      ],
      [
        {
          key: "unified_100_log_band_maskthresh_band",
          label: "Unified Band\n(log, 100%, mask-thresh)",
          key_masked: "unified_100_log_band_masked_band",
          label_masked: "Unified Band\n(log, 100%, masked)",
          showEllipse: true,
        },
        { key: "unified_100_log_band_masked_residual", label: "Unified Residual\n(log, 100%, masked)" },
        { key: "unified_100_log_band_masked_model", label: "Unified Model\n(log, 100%, masked)" },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};
