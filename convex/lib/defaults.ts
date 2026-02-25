// Shared default values for the Convex backend
// These are used as fallbacks when system settings are not yet loaded or not configured

/**
 * Default available paper values for filtering galaxies by misc.paper field.
 * Used in balanced sequence generation.
 */
export const DEFAULT_AVAILABLE_PAPERS = ["", "new", "old"];

/**
 * Default state for exposing the overview page to all authenticated users
 */
export const DEFAULT_ALLOW_PUBLIC_OVERVIEW = false;

/**
 * Default system settings values
 */
/**
 * Default maximum number of entries a regular (non-admin) user can export at once
 */
export const DEFAULT_USER_EXPORT_LIMIT = 1000;

export const DEFAULT_SYSTEM_SETTINGS = {
  allowAnonymous: false,
  emailFrom: "noreply@galaxies.michalvrabel.sk",
  appName: "Galaxy Classification App",
  debugAdminMode: false,
  appVersion: "",
  failedFittingMode: "checkbox" as const,
  failedFittingFallbackLsbClass: 0,
  showAwesomeFlag: true,
  showValidRedshift: true,
  showVisibleNucleus: true,
  defaultImageQuality: "high" as const,
  galaxyBrowserImageQuality: "low" as const,
  availablePapers: DEFAULT_AVAILABLE_PAPERS,
  allowPublicOverview: DEFAULT_ALLOW_PUBLIC_OVERVIEW,
  userExportLimit: DEFAULT_USER_EXPORT_LIMIT,
  // Maintenance mode flags
  maintenanceDisableClassifications: false,
};
