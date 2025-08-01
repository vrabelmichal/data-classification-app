import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export function UserSettings() {
  const userPrefs = useQuery(api.users.getUserPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);

  const [imageQuality, setImageQuality] = useState<"high" | "medium" | "low">("medium");
  const [showKeyboardHints, setShowKeyboardHints] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");

  useEffect(() => {
    if (userPrefs) {
      setImageQuality(userPrefs.imageQuality);
      setShowKeyboardHints(userPrefs.showKeyboardHints);
      setTheme(userPrefs.theme);
    }
  }, [userPrefs]);

  const handleSave = async () => {
    try {
      await updatePreferences({
        imageQuality,
        showKeyboardHints,
        theme,
      });
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    }
  };

  if (userPrefs === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Customize your classification experience
        </p>
      </div>

      <div className="space-y-6">
        {/* Image Quality */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Image Quality
          </h2>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="imageQuality"
                value="high"
                checked={imageQuality === "high"}
                onChange={(e) => setImageQuality(e.target.value as "high" | "medium" | "low")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  High Quality (PNG)
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Better image quality, larger file sizes
                </p>
              </div>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="imageQuality"
                value="medium"
                checked={imageQuality === "medium"}
                onChange={(e) => setImageQuality(e.target.value as "high" | "medium" | "low")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Medium Quality (WebP)
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Balanced quality and file size
                </p>
              </div>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="imageQuality"
                value="low"
                checked={imageQuality === "low"}
                onChange={(e) => setImageQuality(e.target.value as "high" | "medium" | "low")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Low Quality (AVIF)
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Faster loading, smaller file sizes
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Interface Options */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Interface Options
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Keyboard Hints
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Display keyboard shortcuts on classification buttons
                </p>
              </div>
              <input
                type="checkbox"
                checked={showKeyboardHints}
                onChange={(e) => setShowKeyboardHints(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Theme
          </h2>
          <div className="space-y-3">
            {[
              { value: "light", label: "Light", description: "Always use light theme" },
              { value: "dark", label: "Dark", description: "Always use dark theme" },
              { value: "auto", label: "Auto", description: "Follow system preference" },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={(e) => setTheme(e.target.value as "light" | "dark" | "auto")}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
