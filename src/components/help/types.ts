export type HelpTab = "getting-started" | "classification" | "shortcuts" | "image-docs" | "app-guide";

export type FailedFittingMode = "legacy" | "checkbox";

export type HelpFeatureFlags = {
  failedFittingMode: FailedFittingMode;
  showAwesomeFlag: boolean;
  showValidRedshift: boolean;
  showVisibleNucleus: boolean;
};
