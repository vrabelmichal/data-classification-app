import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

interface SettingsTabProps {
  systemSettings: any;
}

export function SettingsTab({ systemSettings }: SettingsTabProps) {
  const updateSystemSettings = useMutation(api.system_settings.updateSystemSettings);
  
  const [localSettings, setLocalSettings] = useState({
    allowAnonymous: systemSettings.allowAnonymous || false,
    emailFrom: systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk",
    appName: systemSettings.appName || "Galaxy Classification App",
    debugAdminMode: systemSettings.debugAdminMode || false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local settings when systemSettings prop changes
  useEffect(() => {
    setLocalSettings({
      allowAnonymous: systemSettings.allowAnonymous || false,
      emailFrom: systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk",
      appName: systemSettings.appName || "Galaxy Classification App",
      debugAdminMode: systemSettings.debugAdminMode || false,
    });
    setHasChanges(false);
  }, [systemSettings]);

  // Check for changes
  useEffect(() => {
    const originalAllowAnonymous = systemSettings.allowAnonymous || false;
    const originalEmailFrom = systemSettings.emailFrom || "noreply@galaxies.michalvrabel.sk";
    const originalAppName = systemSettings.appName || "Galaxy Classification App";
    const originalDebugAdminMode = systemSettings.debugAdminMode || false;
    setHasChanges(
      localSettings.allowAnonymous !== originalAllowAnonymous ||
      localSettings.emailFrom !== originalEmailFrom ||
      localSettings.appName !== originalAppName ||
      localSettings.debugAdminMode !== originalDebugAdminMode
    );
  }, [localSettings, systemSettings]);

  const handleSettingChange = (key: string, value: boolean | string) => {
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