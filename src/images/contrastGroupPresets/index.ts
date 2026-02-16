import { ImageDisplaySettings } from "../types";
import { allNewImagesContrastGroupPreset } from "./allNewImagesContrastGroupPreset";
import { maskthreshContrastGroupPreset } from "./maskthreshContrastGroupPreset";
import { mixedContrastGroupPreset } from "./mixedContrastGroupPreset";
import { singleBandContrastGroupPreset } from "./singleBandContrastGroupPreset";
import { unifiedContrastGroupPreset } from "./unifiedContrastGroupPreset";

export type ImageDisplaySettingsPreset =
  | "original"
  | "unified"
  | "maskthresh"
  | "mixed"
  | "singleBand"
  | "allNewImages";

export interface ImageDisplaySettingsPresetMap {
  original: ImageDisplaySettings;
  unified: ImageDisplaySettings;
  maskthresh: ImageDisplaySettings;
  mixed: ImageDisplaySettings;
  singleBand: ImageDisplaySettings;
  allNewImages: ImageDisplaySettings;
}

export const generatedImageDisplaySettingsPresets: Omit<ImageDisplaySettingsPresetMap, "original"> = {
  unified: unifiedContrastGroupPreset,
  maskthresh: maskthreshContrastGroupPreset,
  mixed: mixedContrastGroupPreset,
  singleBand: singleBandContrastGroupPreset,
  allNewImages: allNewImagesContrastGroupPreset,
};
