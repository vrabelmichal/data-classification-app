import { usePageTitle } from "../../../hooks/usePageTitle";
import type { CloudflareSettingsPageProps } from "./types";

export function CloudflareSettingsPage({
  localSettings,
  handleSettingChange,
  cloudflareCachePurgeStatus,
}: CloudflareSettingsPageProps) {
  usePageTitle("Admin – Settings – Cloudflare");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Cloudflare
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Cache invalidation controls and credentials for admin purge actions.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cache Invalidation
        </h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Show admin-only buttons that invalidate Cloudflare cache for the
          current image in Quick Review and for the current contrast group in
          Classification.
        </p>

        <label className="mt-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Enable admin cache invalidation buttons
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              When disabled, the purge buttons stay hidden even if credentials
              are configured.
            </p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.cloudflareCachePurgeEnabled}
            onChange={(e) =>
              handleSettingChange(
                "cloudflareCachePurgeEnabled",
                e.target.checked,
              )
            }
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
          />
        </label>

        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Cloudflare Zone ID
            </span>
            <input
              type="text"
              value={localSettings.cloudflareZoneId}
              onChange={(e) =>
                handleSettingChange("cloudflareZoneId", e.target.value)
              }
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. 0123456789abcdef0123456789abcdef"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Cloudflare API Token
            </span>
            <input
              type="password"
              value={localSettings.cloudflareApiToken}
              onChange={(e) =>
                handleSettingChange("cloudflareApiToken", e.target.value)
              }
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Paste a token limited to cache purge for this zone"
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Stored credential status
            </span>
            {cloudflareCachePurgeStatus === undefined ? (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Checking...
              </span>
            ) : cloudflareCachePurgeStatus.hasCredentials ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Credentials configured
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                Credentials missing
              </span>
            )}
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            Warning: this token is stored in the application database for admin
            use. Create a token limited to cache purge on the specific zone
            only.
          </div>

          {cloudflareCachePurgeStatus &&
            !cloudflareCachePurgeStatus.hasCredentials && (
              <p className="text-sm text-rose-700 dark:text-rose-300">
                Missing: {cloudflareCachePurgeStatus.missingCredentials.join(", ")}
              </p>
            )}

          {cloudflareCachePurgeStatus?.available && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Admin purge buttons are currently available in Quick Review and
              Classification.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}