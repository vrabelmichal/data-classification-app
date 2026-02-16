import { ImageDisplaySettings } from "../types";
import { buildContrastGroups } from "./shared";

export const singleBandContrastGroupPreset: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: buildContrastGroups([
      [
        { key: "band_100_masked", label: "Band\n(100%, masked)", showEllipse: true },
        { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        { key: "band_100_log_masked", label: "Band\n(log, 100%, masked)", showEllipse: true },
        { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        { key: "band_100_log_unmasked", label: "Band\n(log, 100%, unmasked)", showEllipse: true },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        { key: "unified_100_band_maskthresh_band", label: "Unified Band\n(100%, mask-thresh)", showEllipse: true },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        { key: "unified_100_log_band_maskthresh_band", label: "Unified Band\n(log, 100%, mask-thresh)", showEllipse: true },
        { key: "residual_0_5_99_5_maskthresh", label: "Residual\n(0.5–99.5, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
      [
        { key: "band_zscale_maskthresh", label: "Band\n(zscale, mask-thresh)", showEllipse: true },
        { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
        { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
      ],
    ]),
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};
