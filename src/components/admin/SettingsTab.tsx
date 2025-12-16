import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { DEFAULT_AVAILABLE_PAPERS } from "../../lib/defaults";

interface SettingsTabProps {
  systemSettings: any;
}

export function SettingsTab({ systemSettings }: SettingsTabProps) {
  const updateSystemSettings = useMutation(api.system_settings.updateSystemSettings);
  
  const [localSettings, setLocalSettings] = useState<{
    allowAnonymous: boolean;
    emailFrom: string;
    appName: string;
    debugAdminMode: boolean;
    appVersion: string;
    failedFittingMode: string;
    failedFittingFallbackLsbClass: number;
    showAwesomeFlag: boolean;
    showValidRedshift: boolean;
    showVisibleNucleus: boolean;
    defaultImageQuality: string;
    galaxyBrowserImageQuality: string;
    availablePapers: string[];
  }>({
    allowAnonymous: systemSettings.allowAnonymous || false,
    emailFrom: systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk",
    appName: systemSettings.appName || "Galaxy Classification App",
    debugAdminMode: systemSettings.debugAdminMode || false,
    appVersion: systemSettings.appVersion || "",
    failedFittingMode: systemSettings.failedFittingMode || "checkbox",
    failedFittingFallbackLsbClass: systemSettings.failedFittingFallbackLsbClass ?? 0,
    showAwesomeFlag: systemSettings.showAwesomeFlag ?? true,
    showValidRedshift: systemSettings.showValidRedshift ?? true,
    showVisibleNucleus: systemSettings.showVisibleNucleus ?? true,
    defaultImageQuality: systemSettings.defaultImageQuality || "high",
    galaxyBrowserImageQuality: systemSettings.galaxyBrowserImageQuality || "low",
    availablePapers: systemSettings.availablePapers || DEFAULT_AVAILABLE_PAPERS,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newPaperInput, setNewPaperInput] = useState("");

  // Update local settings when systemSettings prop changes
  useEffect(() => {
    setLocalSettings({
      allowAnonymous: systemSettings.allowAnonymous || false,
      emailFrom: systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk",
      appName: systemSettings.appName || "Galaxy Classification App",
      debugAdminMode: systemSettings.debugAdminMode || false,
      appVersion: systemSettings.appVersion || "",
      failedFittingMode: systemSettings.failedFittingMode || "checkbox",
      failedFittingFallbackLsbClass: systemSettings.failedFittingFallbackLsbClass ?? 0,
      showAwesomeFlag: systemSettings.showAwesomeFlag ?? true,
      showValidRedshift: systemSettings.showValidRedshift ?? true,
      showVisibleNucleus: systemSettings.showVisibleNucleus ?? true,
      defaultImageQuality: systemSettings.defaultImageQuality || "high",
      galaxyBrowserImageQuality: systemSettings.galaxyBrowserImageQuality || "low",
      availablePapers: systemSettings.availablePapers || DEFAULT_AVAILABLE_PAPERS,
    });
    setHasChanges(false);
  }, [systemSettings]);

  // Check for changes
  useEffect(() => {
    const originalAllowAnonymous = systemSettings.allowAnonymous || false;
    const originalEmailFrom = systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk";
    const originalAppName = systemSettings.appName || "Galaxy Classification App";
    const originalDebugAdminMode = systemSettings.debugAdminMode || false;
    const originalAppVersion = systemSettings.appVersion || "";
    const originalFailedFittingMode = systemSettings.failedFittingMode || "checkbox";
    const originalFailedFittingFallbackLsbClass = systemSettings.failedFittingFallbackLsbClass ?? 0;
    const originalShowAwesomeFlag = systemSettings.showAwesomeFlag ?? true;
    const originalShowValidRedshift = systemSettings.showValidRedshift ?? true;
    const originalShowVisibleNucleus = systemSettings.showVisibleNucleus ?? true;
    const originalDefaultImageQuality = systemSettings.defaultImageQuality || "high";
    const originalGalaxyBrowserImageQuality = systemSettings.galaxyBrowserImageQuality || "low";
    const originalAvailablePapers = systemSettings.availablePapers || DEFAULT_AVAILABLE_PAPERS;
    const papersChanged = JSON.stringify(localSettings.availablePapers) !== JSON.stringify(originalAvailablePapers);
    setHasChanges(
      localSettings.allowAnonymous !== originalAllowAnonymous ||
      localSettings.emailFrom !== originalEmailFrom ||
      localSettings.appName !== originalAppName ||
      localSettings.debugAdminMode !== originalDebugAdminMode ||
      localSettings.appVersion !== originalAppVersion ||
      localSettings.failedFittingMode !== originalFailedFittingMode ||
      localSettings.failedFittingFallbackLsbClass !== originalFailedFittingFallbackLsbClass ||
      localSettings.showAwesomeFlag !== originalShowAwesomeFlag ||
      localSettings.showValidRedshift !== originalShowValidRedshift ||
      localSettings.showVisibleNucleus !== originalShowVisibleNucleus ||
      localSettings.defaultImageQuality !== originalDefaultImageQuality ||
      localSettings.galaxyBrowserImageQuality !== originalGalaxyBrowserImageQuality ||
      papersChanged
    );
  }, [localSettings, systemSettings]);

  const handleSettingChange = (key: string, value: boolean | string | number) => {
    setLocalSettings(prev => ({
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
        appVersion: localSettings.appVersion,
        failedFittingMode: localSettings.failedFittingMode as "checkbox" | "legacy",
        failedFittingFallbackLsbClass: localSettings.failedFittingFallbackLsbClass,
        showAwesomeFlag: localSettings.showAwesomeFlag,
        showValidRedshift: localSettings.showValidRedshift,
        showVisibleNucleus: localSettings.showVisibleNucleus,
        defaultImageQuality: localSettings.defaultImageQuality as "high" | "low",
        galaxyBrowserImageQuality: localSettings.galaxyBrowserImageQuality as "high" | "low",
        availablePapers: localSettings.availablePapers,
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          System Settings
        </h2>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            hasChanges && !isSaving
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
      
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            App Name
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            The name of the application displayed in emails and UI
          </p>
          <input
            type="text"
            value={localSettings.appName}
            onChange={(e) => handleSettingChange("appName", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Galaxy Classification App"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Allow Anonymous Users
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Allow users to classify galaxies without admin confirmation
            </p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.allowAnonymous}
            onChange={(e) => handleSettingChange("allowAnonymous", e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Allow anybody to become admin (Debugging Admin Mode) 
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Allow users to become admins via a button in the navigation (development only)
            </p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.debugAdminMode}
            onChange={(e) => handleSettingChange("debugAdminMode", e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Email From Address
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            The email address used as the sender for password reset emails
          </p>
          <input
            type="email"
            value={localSettings.emailFrom}
            onChange={(e) => handleSettingChange("emailFrom", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="noreply@galaxies.michalvrabel.sk"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Application Version
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Current version of the application. Leave empty for no version checking.
          </p>
          <input
            type="text"
            value={localSettings.appVersion}
            onChange={(e) => handleSettingChange("appVersion", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="e.g. 1.0.0"
          />
        </label>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
            Failed Fitting Configuration
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Configure how users report galaxies with failed fitting analysis.
          </p>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Failed Fitting Mode
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Choose how users indicate failed fitting: separate checkbox (recommended) or legacy "-" option
            </p>
            <select
              value={localSettings.failedFittingMode}
              onChange={(e) => handleSettingChange("failedFittingMode", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="checkbox">Checkbox Mode (Separate checkbox for failed fitting)</option>
              <option value="legacy">Legacy Mode (Use "-" option in LSB classification)</option>
            </select>
          </label>

          {localSettings.failedFittingMode === "legacy" && (
            <label className="block">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Failed Fitting Fallback LSB Classification
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                In legacy mode, when user selects "-" (failed fitting), this LSB classification will be stored
              </p>
              <select
                value={localSettings.failedFittingFallbackLsbClass}
                onChange={(e) => handleSettingChange("failedFittingFallbackLsbClass", parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value={-1}>Failed Fitting (-1)</option>
                <option value={0}>Non-LSB (0)</option>
                <option value={1}>LSB (1)</option>
              </select>
            </label>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
            Classification Checkbox Visibility
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Control which checkboxes are visible in the classification interface.
          </p>

          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show "Awesome" Checkbox
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to flag galaxies as awesome
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.showAwesomeFlag}
                onChange={(e) => handleSettingChange("showAwesomeFlag", e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show "Valid Redshift" Checkbox
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to mark if the galaxy has a valid redshift
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.showValidRedshift}
                onChange={(e) => handleSettingChange("showValidRedshift", e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show "Visible Nucleus" Checkbox
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to mark if a visible nucleus is present
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.showVisibleNucleus}
                onChange={(e) => handleSettingChange("showVisibleNucleus", e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
            Image Quality Settings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Configure the default image quality for classification. Users can override this in their personal settings.
          </p>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Default Image Quality
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              The default image quality used when users haven't set their preference
            </p>
            <select
              value={localSettings.defaultImageQuality}
              onChange={(e) => handleSettingChange("defaultImageQuality", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="high">High Quality (Better image quality, larger file sizes)</option>
              <option value="low">Low Quality (Faster loading, smaller file sizes)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Galaxy Browser Image Quality
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Image quality specifically for the Galaxy Browser. This setting is <strong>independent</strong> from the default image quality and user preferences. Currently set to: <strong className="text-blue-600 dark:text-blue-400">{localSettings.galaxyBrowserImageQuality === "high" ? "High Quality" : "Low Quality (AVIF)"}</strong>
            </p>
            <select
              value={localSettings.galaxyBrowserImageQuality}
              onChange={(e) => handleSettingChange("galaxyBrowserImageQuality", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="high">High Quality (Better image quality, larger file sizes)</option>
              <option value="low">Low Quality / AVIF (Faster loading, smaller file sizes - Recommended)</option>
            </select>
          </label>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
            Available Papers (misc.paper values)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Configure the list of paper values that can be used when generating balanced sequences.
            These correspond to the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">misc.paper</code> field in the galaxy data.
          </p>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {localSettings.availablePapers.map((paper, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  <span>{paper === "" ? '(empty string)' : paper}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSettings(prev => ({
                        ...prev,
                        availablePapers: prev.availablePapers.filter((_, i) => i !== index),
                      }));
                    }}
                    className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newPaperInput}
                onChange={(e) => setNewPaperInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newPaperInput.trim();
                    if (!localSettings.availablePapers.includes(trimmed)) {
                      setLocalSettings(prev => ({
                        ...prev,
                        availablePapers: [...prev.availablePapers, trimmed],
                      }));
                      setNewPaperInput("");
                    }
                  }
                }}
                placeholder="Add new paper value..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newPaperInput.trim();
                  if (!localSettings.availablePapers.includes(trimmed)) {
                    setLocalSettings(prev => ({
                      ...prev,
                      availablePapers: [...prev.availablePapers, trimmed],
                    }));
                    setNewPaperInput("");
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!localSettings.availablePapers.includes("")) {
                    setLocalSettings(prev => ({
                      ...prev,
                      availablePapers: [...prev.availablePapers, ""],
                    }));
                  }
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium"
                title="Add empty string value"
              >
                Add Empty
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press Enter to add. Use "Add Empty" to add an empty string value for galaxies without a paper assigned.
            </p>
          </div>
        </div>
      </div>
      
      {hasChanges && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes. Click Save to apply them.
          </p>
        </div>
      )}
    </div>
  );
}