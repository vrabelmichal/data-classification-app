// Shared default values for the application
// These are used as fallbacks when system settings are not yet loaded or not configured

// ============================================================================
// Individual Default Values
// ============================================================================

/**
 * Default email sender address for password reset emails
 */
export const DEFAULT_EMAIL_FROM = "noreply@galaxies.michalvrabel.sk";

/**
 * Default application name displayed in emails and UI
 */
export const DEFAULT_APP_NAME = "Galaxy Classification App";

/**
 * Default app version (empty string means no version checking)
 */
export const DEFAULT_APP_VERSION = "";

/**
 * Default state for allowing anonymous users to classify without confirmation
 */
export const DEFAULT_ALLOW_ANONYMOUS = false;

/**
 * Default state for debugging admin mode (allow users to become admins via button)
 */
export const DEFAULT_DEBUG_ADMIN_MODE = false;

/**
 * Default failed fitting mode: "checkbox" or "legacy"
 */
export const DEFAULT_FAILED_FITTING_MODE = "checkbox" as const;

/**
 * Default LSB classification value when user selects failed fitting in legacy mode
 */
export const DEFAULT_FAILED_FITTING_FALLBACK_LSB_CLASS = 0;

/**
 * Default state for showing the "Awesome" flag checkbox
 */
export const DEFAULT_SHOW_AWESOME_FLAG = true;

/**
 * Default state for showing the "Valid Redshift" checkbox
 */
export const DEFAULT_SHOW_VALID_REDSHIFT = true;

/**
 * Default state for showing the "Visible Nucleus" checkbox
 */
export const DEFAULT_SHOW_VISIBLE_NUCLEUS = true;

/**
 * Default image quality for classification interface
 */
export const DEFAULT_IMAGE_QUALITY = "high" as const;

/**
 * Default image quality for galaxy browser
 */
export const DEFAULT_GALAXY_BROWSER_IMAGE_QUALITY = "low" as const;

/**
 * Default available paper values for filtering galaxies by misc.paper field.
 * Used in balanced sequence generation.
 */
export const DEFAULT_AVAILABLE_PAPERS = ["", "new", "old"];

// ============================================================================
// Combined Default System Settings
// ============================================================================

/**
 * Default system settings values - combines all defaults for convenience
 */
export const DEFAULT_SYSTEM_SETTINGS = {
  allowAnonymous: DEFAULT_ALLOW_ANONYMOUS,
  emailFrom: DEFAULT_EMAIL_FROM,
  appName: DEFAULT_APP_NAME,
  debugAdminMode: DEFAULT_DEBUG_ADMIN_MODE,
  appVersion: DEFAULT_APP_VERSION,
  failedFittingMode: DEFAULT_FAILED_FITTING_MODE,
  failedFittingFallbackLsbClass: DEFAULT_FAILED_FITTING_FALLBACK_LSB_CLASS,
  showAwesomeFlag: DEFAULT_SHOW_AWESOME_FLAG,
  showValidRedshift: DEFAULT_SHOW_VALID_REDSHIFT,
  showVisibleNucleus: DEFAULT_SHOW_VISIBLE_NUCLEUS,
  defaultImageQuality: DEFAULT_IMAGE_QUALITY,
  galaxyBrowserImageQuality: DEFAULT_GALAXY_BROWSER_IMAGE_QUALITY,
  availablePapers: DEFAULT_AVAILABLE_PAPERS,
};
