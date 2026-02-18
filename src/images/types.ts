import { ImageQuality } from "./provider";

export interface ImageRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ContrastGroupEntry {
  key: string;
  label?: string;
  key_masked?: string;
  label_masked?: string;
  forcedQuality?: ImageQuality;
  showEllipse?: boolean;
  allowEllipse?: boolean;
  rectangle?: ImageRectangle;
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

