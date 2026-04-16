import {
  DEFAULT_AVAILABLE_PAPERS,
  DEFAULT_ALLOW_ANONYMOUS,
  DEFAULT_EMAIL_FROM,
  DEFAULT_APP_NAME,
  DEFAULT_HELP_EXAMPLES_GALAXY_EXTERNAL_ID,
  DEFAULT_DEBUG_ADMIN_MODE,
  DEFAULT_APP_VERSION,
  DEFAULT_FAILED_FITTING_MODE,
  DEFAULT_FAILED_FITTING_FALLBACK_LSB_CLASS,
  DEFAULT_SHOW_AWESOME_FLAG,
  DEFAULT_SHOW_VALID_REDSHIFT,
  DEFAULT_SHOW_VISIBLE_NUCLEUS,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_GALAXY_BROWSER_IMAGE_QUALITY,
  DEFAULT_ALLOW_PUBLIC_OVERVIEW,
  DEFAULT_ALLOW_PUBLIC_DATA_ANALYSIS,
  DEFAULT_CLOUDFLARE_CACHE_PURGE_ENABLED,
  DEFAULT_CLOUDFLARE_ZONE_ID,
  DEFAULT_CLOUDFLARE_API_TOKEN,
  DEFAULT_USER_EXPORT_LIMIT,
  DEFAULT_OVERVIEW_DEFAULT_PAPER,
} from "../../../lib/defaults";
import { cloneRolePermissions, DEFAULT_ROLE_PERMISSIONS } from "../../../lib/permissions";
import type { SettingsFormState } from "./types";

export function createSettingsFormState(systemSettings: any): SettingsFormState {
  return {
    allowAnonymous: systemSettings.allowAnonymous ?? DEFAULT_ALLOW_ANONYMOUS,
    emailFrom: systemSettings.emailFrom ?? DEFAULT_EMAIL_FROM,
    appName: systemSettings.appName ?? DEFAULT_APP_NAME,
    helpExamplesGalaxyExternalId:
      systemSettings.helpExamplesGalaxyExternalId ??
      DEFAULT_HELP_EXAMPLES_GALAXY_EXTERNAL_ID,
    debugAdminMode: systemSettings.debugAdminMode ?? DEFAULT_DEBUG_ADMIN_MODE,
    allowPublicOverview:
      systemSettings.allowPublicOverview ?? DEFAULT_ALLOW_PUBLIC_OVERVIEW,
    allowPublicDataAnalysis:
      systemSettings.allowPublicDataAnalysis ??
      DEFAULT_ALLOW_PUBLIC_DATA_ANALYSIS,
    appVersion: systemSettings.appVersion ?? DEFAULT_APP_VERSION,
    failedFittingMode:
      systemSettings.failedFittingMode ?? DEFAULT_FAILED_FITTING_MODE,
    failedFittingFallbackLsbClass:
      systemSettings.failedFittingFallbackLsbClass ??
      DEFAULT_FAILED_FITTING_FALLBACK_LSB_CLASS,
    showAwesomeFlag: systemSettings.showAwesomeFlag ?? DEFAULT_SHOW_AWESOME_FLAG,
    showValidRedshift:
      systemSettings.showValidRedshift ?? DEFAULT_SHOW_VALID_REDSHIFT,
    showVisibleNucleus:
      systemSettings.showVisibleNucleus ?? DEFAULT_SHOW_VISIBLE_NUCLEUS,
    defaultImageQuality:
      systemSettings.defaultImageQuality ?? DEFAULT_IMAGE_QUALITY,
    galaxyBrowserImageQuality:
      systemSettings.galaxyBrowserImageQuality ??
      DEFAULT_GALAXY_BROWSER_IMAGE_QUALITY,
    availablePapers: systemSettings.availablePapers ?? DEFAULT_AVAILABLE_PAPERS,
    userExportLimit: systemSettings.userExportLimit ?? DEFAULT_USER_EXPORT_LIMIT,
    overviewDefaultPaper:
      systemSettings.overviewDefaultPaper ?? DEFAULT_OVERVIEW_DEFAULT_PAPER,
    cloudflareCachePurgeEnabled:
      systemSettings.cloudflareCachePurgeEnabled ??
      DEFAULT_CLOUDFLARE_CACHE_PURGE_ENABLED,
    cloudflareZoneId: systemSettings.cloudflareZoneId ?? DEFAULT_CLOUDFLARE_ZONE_ID,
    cloudflareApiToken:
      systemSettings.cloudflareApiToken ?? DEFAULT_CLOUDFLARE_API_TOKEN,
    rolePermissions: cloneRolePermissions(
      systemSettings.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS
    ),
  };
}

export function hasSettingsChanges(
  localSettings: SettingsFormState,
  systemSettings: any,
): boolean {
  const originalSettings = createSettingsFormState(systemSettings);

  return (
    localSettings.allowAnonymous !== originalSettings.allowAnonymous ||
    localSettings.emailFrom !== originalSettings.emailFrom ||
    localSettings.appName !== originalSettings.appName ||
    localSettings.helpExamplesGalaxyExternalId !==
      originalSettings.helpExamplesGalaxyExternalId ||
    localSettings.debugAdminMode !== originalSettings.debugAdminMode ||
    localSettings.allowPublicOverview !== originalSettings.allowPublicOverview ||
    localSettings.allowPublicDataAnalysis !==
      originalSettings.allowPublicDataAnalysis ||
    localSettings.appVersion !== originalSettings.appVersion ||
    localSettings.failedFittingMode !== originalSettings.failedFittingMode ||
    localSettings.failedFittingFallbackLsbClass !==
      originalSettings.failedFittingFallbackLsbClass ||
    localSettings.showAwesomeFlag !== originalSettings.showAwesomeFlag ||
    localSettings.showValidRedshift !== originalSettings.showValidRedshift ||
    localSettings.showVisibleNucleus !== originalSettings.showVisibleNucleus ||
    localSettings.defaultImageQuality !== originalSettings.defaultImageQuality ||
    localSettings.galaxyBrowserImageQuality !==
      originalSettings.galaxyBrowserImageQuality ||
    localSettings.userExportLimit !== originalSettings.userExportLimit ||
    localSettings.overviewDefaultPaper !== originalSettings.overviewDefaultPaper ||
    localSettings.cloudflareCachePurgeEnabled !==
      originalSettings.cloudflareCachePurgeEnabled ||
    localSettings.cloudflareZoneId !== originalSettings.cloudflareZoneId ||
    localSettings.cloudflareApiToken !== originalSettings.cloudflareApiToken ||
    JSON.stringify(localSettings.rolePermissions) !==
      JSON.stringify(originalSettings.rolePermissions) ||
    JSON.stringify(localSettings.availablePapers) !==
      JSON.stringify(originalSettings.availablePapers)
  );
}