import { buildContrastGroups, rectangle256x256in1024x1024 } from "./contrastGroupPresets/shared";
import { ImageDisplaySettings } from "./types";

export { rectangle256x256in1024x1024 };

const contrastGroupsConfig = buildContrastGroups([
  {
    label: "Practical (linear)",
    description: `A general-purpose view. The band image uses full linear scaling; the residual uses a narrower brightness range (0.5–99.5%) to highlight structure
without being overwhelmed by bright or dark extremes; the model uses the same full linear range as the band. Good starting point for most objects.`,
    entries: [
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
  },
  {
    label: "Unified log",
    description: `All three panels (band, residual, model) use logarithmic scaling with thresholds derived from the band image, so the brightness range is identical across all three.
Log scaling brings out faint extended emission that linear scaling can suppress.`,
    entries: [
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
  },
  {
    label: "Unified linear",
    description: `Same idea as Group 2 but with linear scaling. The band, residual, and model are all displayed on the same brightness scale,
making direct visual comparison between panels straightforward.`,
    entries: [
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
  },
  {
    label: "Mixed",
    description: `A practical combination of different independent scalings: the band is shown in log scale (full range, unmasked);
the residual uses full-range linear scaling based on the unmasked area; the model uses full linear range.`,
    entries: [
      {
        key: "band_100_log_unmasked",
        label: "Band\n(log, 100%, unmasked)",
        showEllipse: true,
      },
      { key: "residual_100_maskthresh", label: "Residual\n(100%, mask-thresh)" },
      { key: "model_100_unmasked", label: "Model\n(100%, unmasked)" },
    ],
  },
  {
    label: "Unified zscale",
    description: `All three panels share the same zscale stretch parameters, calculated from the unmasked band image. Zscale is an automatic algorithm that sets the brightness range
based on the typical pixel values, which often gives a good view without manual adjustment. All panels being on the same scale makes differences between them easier to spot.`,
    entries: [
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
  },
]);

export const defaultImageDisplaySettings: ImageDisplaySettings = {
  previewImageName: "aplpy_linear_based_on_109534177__1_995_unmasked_irg",
  classification: {
    defaultGroupIndex: 0,
    contrastGroups: contrastGroupsConfig.groups,
    groupLabels: contrastGroupsConfig.labels,
    groupDescriptions: contrastGroupsConfig.descriptions,
    defaultMobileOrder: [3, 0, 1, 4, 5, 2],
  },
};

