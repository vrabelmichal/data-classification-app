import { useState } from "react";
import { useQuery } from "convex/react";
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
import { FailedFittingMode, HelpFeatureFlags, HelpTab } from "./types";

export function Help() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const appName = (systemSettings?.appName ?? DEFAULT_APP_NAME) as string;
  const failedFittingMode = (systemSettings?.failedFittingMode as FailedFittingMode) ?? DEFAULT_FAILED_FITTING_MODE;
  const showAwesomeFlag = Boolean(systemSettings?.showAwesomeFlag) ?? DEFAULT_SHOW_AWESOME_FLAG;
  const showValidRedshift = Boolean(systemSettings?.showValidRedshift) ?? DEFAULT_SHOW_VALID_REDSHIFT;
  const showVisibleNucleus = Boolean(systemSettings?.showVisibleNucleus) ?? DEFAULT_SHOW_VISIBLE_NUCLEUS;

  const [activeTab, setActiveTab] = useState<HelpTab>("getting-started");

  const featureFlags: HelpFeatureFlags = {
    failedFittingMode,
    showAwesomeFlag,
    showValidRedshift,
    showVisibleNucleus,
  };

  usePageTitle("Help");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Help & Guide</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Learn how to classify galaxies and contribute to scientific research
        </p>
      </div>

      <div className="space-y-8">
        <HelpTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "getting-started" && <GettingStartedSection appName={appName} />}
        {activeTab === "classification" && <ClassificationSection settings={featureFlags} />}
        {activeTab === "shortcuts" && <KeyboardShortcutsSection settings={featureFlags} />}
        {activeTab === "image-docs" && <ImageDocumentationSection />}
      </div>
    </div>
  );
}
