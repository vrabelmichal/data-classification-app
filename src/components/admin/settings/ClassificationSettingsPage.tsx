import { usePageTitle } from "../../../hooks/usePageTitle";
import type { SettingsPageProps } from "./types";

export function ClassificationSettingsPage({
  localSettings,
  handleSettingChange,
}: SettingsPageProps) {
  usePageTitle("Admin – Settings – Classification");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Classification Settings
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Behavior of failed-fitting reporting, checkbox visibility, and default
          image quality.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Failed Fitting Configuration
        </h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Configure how users report galaxies with failed fitting analysis.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Failed Fitting Mode
          </span>
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Choose whether failed fitting appears as a separate checkbox or the
            legacy - option in LSB classification.
          </p>
          <select
            value={localSettings.failedFittingMode}
            onChange={(e) =>
              handleSettingChange(
                "failedFittingMode",
                e.target.value as "checkbox" | "legacy",
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="checkbox">
              Checkbox Mode (Separate checkbox for failed fitting)
            </option>
            <option value="legacy">
              Legacy Mode (Use - option in LSB classification)
            </option>
          </select>
        </label>

        {localSettings.failedFittingMode === "legacy" && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Failed Fitting Fallback LSB Classification
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              In legacy mode, when a user selects -, this LSB classification is
              stored.
            </p>
            <select
              value={localSettings.failedFittingFallbackLsbClass}
              onChange={(e) =>
                handleSettingChange(
                  "failedFittingFallbackLsbClass",
                  Number.parseInt(e.target.value, 10),
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={-1}>Failed Fitting (-1)</option>
              <option value={0}>Non-LSB (0)</option>
              <option value={1}>LSB (1)</option>
            </select>
          </label>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Classification Checkbox Visibility
        </h4>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Show Awesome Checkbox
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to flag galaxies as awesome.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.showAwesomeFlag}
              onChange={(e) =>
                handleSettingChange("showAwesomeFlag", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Show Valid Redshift Checkbox
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to mark whether the galaxy has a valid redshift.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.showValidRedshift}
              onChange={(e) =>
                handleSettingChange("showValidRedshift", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Show Visible Nucleus Checkbox
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Allow users to mark whether a visible nucleus is present.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.showVisibleNucleus}
              onChange={(e) =>
                handleSettingChange("showVisibleNucleus", e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Image Quality
        </h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Configure the default image quality for classification. Users can
          override the default in their personal settings.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Default Image Quality
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Used when a user has not set their own preference.
            </p>
            <select
              value={localSettings.defaultImageQuality}
              onChange={(e) =>
                handleSettingChange(
                  "defaultImageQuality",
                  e.target.value as "high" | "low",
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="high">
                High Quality (Better image quality, larger file sizes)
              </option>
              <option value="low">
                Low Quality (Faster loading, smaller file sizes)
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Galaxy Browser Image Quality
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Independent from the classification default and user preferences.
              Currently set to
              <strong className="ml-1 text-blue-600 dark:text-blue-400">
                {localSettings.galaxyBrowserImageQuality === "high"
                  ? "High Quality"
                  : "Low Quality (AVIF)"}
              </strong>
              .
            </p>
            <select
              value={localSettings.galaxyBrowserImageQuality}
              onChange={(e) =>
                handleSettingChange(
                  "galaxyBrowserImageQuality",
                  e.target.value as "high" | "low",
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="high">
                High Quality (Better image quality, larger file sizes)
              </option>
              <option value="low">
                Low Quality / AVIF (Faster loading, smaller file sizes -
                Recommended)
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}