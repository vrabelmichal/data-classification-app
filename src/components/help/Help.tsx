import { useQuery } from "convex/react";
import { Routes, Route, useLocation, Navigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  DEFAULT_APP_NAME,
  DEFAULT_FAILED_FITTING_MODE,
  DEFAULT_SHOW_AWESOME_FLAG,
  DEFAULT_SHOW_VALID_REDSHIFT,
  DEFAULT_SHOW_VISIBLE_NUCLEUS,
} from "../../lib/defaults";
import { HelpTabs } from "./HelpTabs";
import { ClassificationSection } from "./sections/ClassificationSection";
import { GettingStartedSection } from "./sections/GettingStartedSection";
import { ImageDocumentationSection } from "./sections/ImageDocumentationSection";
import { KeyboardShortcutsSection } from "./sections/KeyboardShortcutsSection";
import { FailedFittingMode, HelpFeatureFlags } from "./types";

export function Help() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const appName = (systemSettings?.appName ?? DEFAULT_APP_NAME) as string;
  const failedFittingMode = (systemSettings?.failedFittingMode as FailedFittingMode) ?? DEFAULT_FAILED_FITTING_MODE;
  const showAwesomeFlag = Boolean(systemSettings?.showAwesomeFlag) ?? DEFAULT_SHOW_AWESOME_FLAG;
  const showValidRedshift = Boolean(systemSettings?.showValidRedshift) ?? DEFAULT_SHOW_VALID_REDSHIFT;
  const showVisibleNucleus = Boolean(systemSettings?.showVisibleNucleus) ?? DEFAULT_SHOW_VISIBLE_NUCLEUS;

  const location = useLocation();

  // Determine page title based on current path
  const getPageTitle = () => {
    if (location.pathname.includes("/help/classification")) return "Help - Categories & Flags";
    if (location.pathname.includes("/help/shortcuts")) return "Help - Keyboard Shortcuts";
    if (location.pathname.includes("/help/image-docs")) return "Help - Image Documentation";
    return "Help - Getting Started";
  };

  usePageTitle(getPageTitle());

  const featureFlags: HelpFeatureFlags = {
    failedFittingMode,
    showAwesomeFlag,
    showValidRedshift,
    showVisibleNucleus,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Help & Guide</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Learn how to classify galaxies and contribute to scientific research
        </p>
      </div>

      <div className="space-y-8">
        <HelpTabs />

        <Routes>
          <Route index element={<GettingStartedSection appName={appName} />} />
          <Route path="classification" element={<ClassificationSection settings={featureFlags} />} />
          <Route path="shortcuts" element={<KeyboardShortcutsSection settings={featureFlags} />} />
          <Route path="image-docs" element={<ImageDocumentationSection />} />
          <Route path="*" element={<Navigate to="/help" replace />} />
        </Routes>
      </div>
    </div>
  );
}
