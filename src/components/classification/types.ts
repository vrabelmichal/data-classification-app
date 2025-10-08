export interface ClassificationFormState {
  lsbClass: number | null;
  morphology: number | null;
  awesomeFlag: boolean;
  validRedshift: boolean;
  visibleNucleus: boolean;
  comments: string;
  quickInput: string;
}

export interface ClassificationOption {
  value: number;
  label: string;
  color: string;
}

export interface ImageType {
  key: string;
  name: string;
  displayName: React.ReactNode;
  url: string | null;
}

export interface GalaxyData {
  _id: string;
  id: string;
  ra: number;
  dec: number;
  reff: number;
  reff_pixels: number;
  q: number;
  pa: number;
  nucleus: boolean;
  x?: number;
  y?: number;
}

export interface NavigationState {
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalGalaxies: number;
}

export type NavigationStateOrNull = NavigationState | null | undefined;

export interface UserPreferences {
  imageQuality?: "high" | "medium" | "low";
  contrast?: number;
}
