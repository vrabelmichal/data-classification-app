import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface SettingsTabProps {
  systemSettings: any;
}

export function SettingsTab({ systemSettings }: SettingsTabProps) {
  const updateSystemSettings = useMutation(api.users.updateSystemSettings);

  const handleUpdateSettings = async (allowAnonymous: boolean) => {
    try {
      await updateSystemSettings({ allowAnonymous });
      toast.success("Settings updated successfully");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        System Settings
      </h2>
      
      <div className="space-y-4">
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
            checked={systemSettings.allowAnonymous || false}
            onChange={(e) => void (async () => { await handleUpdateSettings(e.target.checked); })()}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </label>
      </div>
    </div>
  );
}