import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

/**
 * Maintenance mode control panel shown at the top of the Maintenance tab.
 * Each toggle immediately persists via updateSystemSettings.
 */
export function MaintenanceModeSection() {
  const systemSettings = useQuery(api.system_settings.getSystemSettings);
  const updateSystemSettings = useMutation(api.system_settings.updateSystemSettings);

  const disableClassifications = systemSettings?.maintenanceDisableClassifications ?? false;

  const handleToggle = async (key: "maintenanceDisableClassifications", current: boolean) => {
    const nextValue = !current;
    try {
      await updateSystemSettings({ [key]: nextValue });
      toast.success(
        nextValue
          ? "Maintenance restriction enabled."
          : "Maintenance restriction lifted.",
      );
    } catch (e) {
      toast.error("Failed to update maintenance setting.");
      console.error(e);
    }
  };

  const isLoading = systemSettings === undefined;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">
        Maintenance Mode
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Use these toggles to temporarily restrict specific user-facing operations while performing
        maintenance. Changes take effect immediately for all users. <strong>Toggles do not
        activate automatically</strong> — you must enable and disable them manually.
      </p>

      <div className="flex flex-col gap-4">
        {/* Disable all classifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
          {/* Toggle */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleToggle("maintenanceDisableClassifications", disableClassifications)}
            className={[
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2",
              "focus:ring-amber-500 dark:focus:ring-offset-gray-900",
              isLoading ? "opacity-50 cursor-not-allowed" : "",
              disableClassifications
                ? "bg-amber-500"
                : "bg-gray-200 dark:bg-gray-600",
            ].join(" ")}
            aria-pressed={disableClassifications}
          >
            <span
              className={[
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0",
                "transition duration-200 ease-in-out",
                disableClassifications ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>

          {/* Label + description */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Disable all classifications
              </span>
              {disableClassifications && (
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Prevents users from submitting or editing any galaxy classifications. Users can still
              browse galaxies and view images. Enable this before running operations that could
              interfere with the classification procedure (e.g. aggregate rebuilds, sequence resets).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
