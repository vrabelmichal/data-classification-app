import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";
import { createSettingsFormState, hasSettingsChanges } from "./settings/helpers";
import { GeneralSettingsPage } from "./settings/GeneralSettingsPage";
import { PapersOverviewSettingsPage } from "./settings/PapersOverviewSettingsPage";
import { ClassificationSettingsPage } from "./settings/ClassificationSettingsPage";
import { OperationsSettingsPage } from "./settings/OperationsSettingsPage";
import { CloudflareSettingsPage } from "./settings/CloudflareSettingsPage";
import type { HandleSettingChange, SettingsTabProps } from "./settings/types";

const settingsSubTabs = [
  {
    id: "general",
    label: "General",
    icon: "⚙️",
    path: "/admin/settings/general",
  },
  {
    id: "papers",
    label: "Papers & Overview",
    icon: "🗂️",
    path: "/admin/settings/papers",
  },
  {
    id: "classification",
    label: "Classification",
    icon: "🧪",
    path: "/admin/settings/classification",
  },
  {
    id: "operations",
    label: "Exports",
    icon: "📤",
    path: "/admin/settings/operations",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    icon: "☁️",
    path: "/admin/settings/cloudflare",
  },
] as const;

export function SettingsTab({ systemSettings }: SettingsTabProps) {
  const location = useLocation();
  const updateSystemSettings = useMutation(api.system_settings.updateSystemSettings);
  const cloudflareCachePurgeStatus = useQuery(
    api.cloudflareCache.getAdminPurgeStatus,
    {},
  );

  const [localSettings, setLocalSettings] = useState(() =>
    createSettingsFormState(systemSettings),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newPaperInput, setNewPaperInput] = useState("");

  useEffect(() => {
    setLocalSettings(createSettingsFormState(systemSettings));
    setHasChanges(false);
  }, [systemSettings]);

  useEffect(() => {
    setHasChanges(hasSettingsChanges(localSettings, systemSettings));
  }, [localSettings, systemSettings]);

  const handleSettingChange: HandleSettingChange = (key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSystemSettings({
        allowAnonymous: localSettings.allowAnonymous,
        emailFrom: localSettings.emailFrom,
        appName: localSettings.appName,
        debugAdminMode: localSettings.debugAdminMode,
        allowPublicOverview: localSettings.allowPublicOverview,
        appVersion: localSettings.appVersion,
        failedFittingMode: localSettings.failedFittingMode,
        failedFittingFallbackLsbClass:
          localSettings.failedFittingFallbackLsbClass,
        showAwesomeFlag: localSettings.showAwesomeFlag,
        showValidRedshift: localSettings.showValidRedshift,
        showVisibleNucleus: localSettings.showVisibleNucleus,
        defaultImageQuality: localSettings.defaultImageQuality,
        galaxyBrowserImageQuality: localSettings.galaxyBrowserImageQuality,
        availablePapers: localSettings.availablePapers,
        userExportLimit: localSettings.userExportLimit,
        overviewDefaultPaper: localSettings.overviewDefaultPaper,
        cloudflareCachePurgeEnabled: localSettings.cloudflareCachePurgeEnabled,
        cloudflareZoneId: localSettings.cloudflareZoneId,
        cloudflareApiToken: localSettings.cloudflareApiToken,
      });
      toast.success("Settings updated successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              "rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
              hasChanges && !isSaving
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
            )}
          >
            {isSaving
              ? "Saving..."
              : hasChanges
                ? "Save Changes *"
                : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-end justify-between gap-6">
          <nav className="-mb-px flex flex-1 space-x-6 overflow-x-auto">
            {settingsSubTabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                className={cn(
                  "flex items-center space-x-2 whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors",
                  location.pathname === tab.path
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300",
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mb-2 hidden items-center gap-3 md:flex">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={cn(
                "rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                hasChanges && !isSaving
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
              )}
            >
              {isSaving
                ? "Saving..."
                : hasChanges
                  ? "Save Changes *"
                  : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          You changed one or more settings. Press Save Changes to apply them.
        </div>
      )}

      <Routes>
        <Route index element={<Navigate to="general" replace />} />
        <Route
          path="general"
          element={
            <GeneralSettingsPage
              localSettings={localSettings}
              handleSettingChange={handleSettingChange}
            />
          }
        />
        <Route
          path="papers"
          element={
            <PapersOverviewSettingsPage
              localSettings={localSettings}
              handleSettingChange={handleSettingChange}
              setLocalSettings={setLocalSettings}
              newPaperInput={newPaperInput}
              setNewPaperInput={setNewPaperInput}
            />
          }
        />
        <Route
          path="classification"
          element={
            <ClassificationSettingsPage
              localSettings={localSettings}
              handleSettingChange={handleSettingChange}
            />
          }
        />
        <Route
          path="operations"
          element={
            <OperationsSettingsPage
              localSettings={localSettings}
              handleSettingChange={handleSettingChange}
            />
          }
        />
        <Route
          path="cloudflare"
          element={
            <CloudflareSettingsPage
              localSettings={localSettings}
              handleSettingChange={handleSettingChange}
              cloudflareCachePurgeStatus={cloudflareCachePurgeStatus}
            />
          }
        />
      </Routes>
    </div>
  );
}