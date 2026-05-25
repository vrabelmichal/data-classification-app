// Shared default values for the Convex backend
// These are used as fallbacks when system settings are not yet loaded or not configured

import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";

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
 * Default state for exposing the data analysis page to regular users
 */
export const DEFAULT_ALLOW_PUBLIC_DATA_ANALYSIS = false;

/**
 * Default state for automatically refreshing cached paper-assignment coverage snapshots.
 */
export const DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_ENABLED = true;

/**
 * Default refresh interval, in minutes, for cached paper-assignment coverage snapshots.
 */
export const DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_INTERVAL_MINUTES = 60;

/**
 * Default state for automatically refreshing cached overview snapshots.
 */
export const DEFAULT_OVERVIEW_AUTO_REFRESH_ENABLED = true;

/**
 * Default refresh interval, in minutes, for cached overview snapshots.
 */
export const DEFAULT_OVERVIEW_AUTO_REFRESH_INTERVAL_MINUTES = 60;

/**
 * Default system settings values
 */
/**
 * Default maximum number of entries a regular (non-admin) user can export at once
 */
export const DEFAULT_USER_EXPORT_LIMIT = 1000;

/**
 * Default batch size for rebuilding sequence blacklist stats.
 */
export const DEFAULT_SEQUENCE_BLACKLIST_STATS_BATCH_SIZE = 5;

/**
 * Dedicated maximum batch size for rebuilding sequence blacklist stats.
 */
export const SEQUENCE_BLACKLIST_STATS_MAX_BATCH_SIZE = 10;

/**
 * Default paper pre-selected in the Paper Assignment Coverage tab (null = no default, show all papers)
 */
export const DEFAULT_PAPER_ASSIGNMENT_COVERAGE_DEFAULT_PAPER = null as string | null;

export const DEFAULT_SYSTEM_SETTINGS = {
  allowAnonymous: false,
  emailFrom: "noreply@galaxies.michalvrabel.sk",
  appName: "Galaxy Classification App",
  helpExamplesGalaxyExternalId: "",
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
  overviewDefaultPaper: null as string | null,
  paperAssignmentCoverageDefaultPaper:
    DEFAULT_PAPER_ASSIGNMENT_COVERAGE_DEFAULT_PAPER,
  allowPublicOverview: DEFAULT_ALLOW_PUBLIC_OVERVIEW,
  allowPublicDataAnalysis: DEFAULT_ALLOW_PUBLIC_DATA_ANALYSIS,
  overviewAutoRefreshEnabled: DEFAULT_OVERVIEW_AUTO_REFRESH_ENABLED,
  overviewAutoRefreshIntervalMinutes:
    DEFAULT_OVERVIEW_AUTO_REFRESH_INTERVAL_MINUTES,
  paperAssignmentCoverageAutoRefreshEnabled:
    DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_ENABLED,
  paperAssignmentCoverageAutoRefreshIntervalMinutes:
    DEFAULT_PAPER_ASSIGNMENT_COVERAGE_AUTO_REFRESH_INTERVAL_MINUTES,
  userExportLimit: DEFAULT_USER_EXPORT_LIMIT,
  cloudflareCachePurgeEnabled: false,
  cloudflareZoneId: "",
  cloudflareApiToken: "",
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  // Maintenance mode flag
  maintenanceDisableClassifications: false,
};
