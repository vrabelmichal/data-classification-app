import { usePageTitle } from "../../../hooks/usePageTitle";
import type { OperationsSettingsPageProps } from "./types";

export function OperationsSettingsPage({
  localSettings,
  handleSettingChange,
}: OperationsSettingsPageProps) {
  usePageTitle("Admin – Settings – Exports");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Export Settings
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Configure export guardrails for the Galaxy Browser.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Export Settings
        </h4>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            User Export Limit
          </span>
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Maximum number of rows a regular user can export at once from the
            Galaxy Browser. Set to 0 to disable export for non-admin users.
          </p>
          <input
            type="number"
            min="0"
            value={localSettings.userExportLimit}
            onChange={(e) =>
              handleSettingChange(
                "userExportLimit",
                Math.max(0, Number.parseInt(e.target.value, 10) || 0),
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="1000"
          />
        </label>
      </div>

    </div>
  );
}