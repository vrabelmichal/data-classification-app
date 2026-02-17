import { buildContrastGroups, rectangle256x256in1024x1024 } from "./contrastGroupPresets/shared";
import { ImageDisplaySettings } from "./types";

export { rectangle256x256in1024x1024 };

export const defaultImageDisplaySettings: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: buildContrastGroups([
      [
        // Practical: Linear scaling for band and model, narrower range for residual
        {
          key: "unified_100_band_maskthresh_band",
          label: "Unified Band\n(100%, mask-thresh)",
          key_masked: "unified_100_band_masked_band",
          label_masked: "Unified Band\n(100%, masked)",
          showEllipse: true,
        },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "unified_100_band_masked_model", label: "Unified Model\n(100%, masked)" },
      ],
      [
        // Unified Log: Log scaling, unified - thresholds based on band image, so residual and model are shown with same range as band
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
      [
        // Unified Linear: Linear scaling, unified - thresholds based on band image, so residual and model are shown with same range as band
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
        // Mixture of potentially useful views: log scale for unmasked band image, full value range (stretch) based on unmasked region of residual, full value range for model 
        {
          key: "band_100_log_unmasked",
          label: "Band\n(log, 100%, unmasked)",
          showEllipse: true,
        },
        { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        // Unified Zscale: Zscale stretches based on unmasked band image, so all three images have same stretch parameters
        {
          key: "unified_zscale_band_unmasked_band",
          label: "Unified Band\n(zscale, unmasked)",
          key_masked: "unified_zscale_band_masked_band",
          label_masked: "Unified Band\n(zscale, masked)",
          showEllipse: true,
        },
        {
          key: "unified_zscale_band_unmasked_residual",
          label: "Unified Residual\n(zscale, unmasked)",
          key_masked: "unified_zscale_band_masked_residual",
          label_masked: "Unified Residual\n(zscale, masked)",
        },
        {
          key: "unified_zscale_band_unmasked_model",
          label: "Unified Model\n(zscale, unmasked)",
          key_masked: "unified_zscale_band_masked_model",
          label_masked: "Unified Model\n(zscale, masked)",
        },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};

