import { usePageTitle } from "../../../hooks/usePageTitle";
import type { SettingsPageProps } from "./types";

export function GeneralSettingsPage({
  localSettings,
  handleSettingChange,
}: SettingsPageProps) {
  usePageTitle("Admin – Settings – General");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          General Settings
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Core application identity, email settings, and access policy.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Application Identity
        </h4>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              App Name
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              The name of the application displayed in emails and UI.
            </p>
            <input
              type="text"
              value={localSettings.appName}
              onChange={(e) => handleSettingChange("appName", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Galaxy Classification App"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Email From Address
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              The sender address used for password reset emails.
            </p>
            <input
              type="email"
              value={localSettings.emailFrom}
              onChange={(e) => handleSettingChange("emailFrom", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="noreply@galaxies.michalvrabel.sk"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Application Version
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Current version of the application. Leave empty for no version
              checking.
            </p>
            <input
              type="text"
              value={localSettings.appVersion}
              onChange={(e) => handleSettingChange("appVersion", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. 1.0.0"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Access Policy
        </h4>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Make cached overview visible to confirmed users
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Confirmed non-admin users can open the cached overview page at
                /statistics/overview. The live overview stays admin-only at
                /statistics/overview-live.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.allowPublicOverview}
              onChange={(e) =>
                handleSettingChange("allowPublicOverview", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Allow Anonymous Users
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to classify galaxies without admin confirmation.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.allowAnonymous}
              onChange={(e) =>
                handleSettingChange("allowAnonymous", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Allow anybody to become admin (Debugging Admin Mode)
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to become admins via a button in the navigation.
                Development only.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.debugAdminMode}
              onChange={(e) =>
                handleSettingChange("debugAdminMode", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>
        </div>
      </div>
    </div>
  );
}