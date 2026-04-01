import { cn } from "../../lib/utils";

interface UserSettingsGeneralPageProps {
  userName: string;
  setUserName: (value: string) => void;
  displayedImageQuality: "high" | "low";
  normalizedEffectiveImageQuality: "high" | "low";
  userPrefsImageQuality: "high" | "medium" | "low" | undefined;
  setImageQuality: (value: "high" | "medium" | "low") => void;
  theme: "light" | "dark" | "auto";
  setTheme: (value: "light" | "dark" | "auto") => void;
  dlog: (...args: any[]) => void;
}

export function UserSettingsGeneralPage({
  userName,
  setUserName,
  displayedImageQuality,
  normalizedEffectiveImageQuality,
  userPrefsImageQuality,
  setImageQuality,
  theme,
  setTheme,
  dlog,
}: UserSettingsGeneralPageProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter your name"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Image Quality</h2>
        {userPrefsImageQuality === "medium" && (
          <div className="mb-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-800 dark:text-amber-200 text-sm">
            Medium quality is no longer supported. We will use
            <span className="font-semibold"> {normalizedEffectiveImageQuality.toUpperCase()} </span>
            for classification by default. Please choose a supported option and save.
          </div>
        )}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="imageQuality"
              value="high"
              checked={displayedImageQuality === "high"}
              onChange={(e) => {
                const val = e.target.value as "high" | "medium" | "low";
                dlog("Radio change: imageQuality", { from: displayedImageQuality, to: val });
                setImageQuality(val);
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white">High Quality</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">Better image quality, larger file sizes</p>
            </div>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="imageQuality"
              value="low"
              checked={displayedImageQuality === "low"}
              onChange={(e) => {
                const val = e.target.value as "high" | "medium" | "low";
                dlog("Radio change: imageQuality", { from: displayedImageQuality, to: val });
                setImageQuality(val);
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="ml-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Low Quality</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">Faster loading, smaller file sizes</p>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose how the application looks. Changes are applied immediately.</p>
        <div className="space-y-3">
          {[
            {
              value: "light",
              label: "Light",
              description: "Use a light background with dark text. Best for well-lit environments.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
            {
              value: "dark",
              label: "Dark",
              description: "Use a dark background with light text. Reduces eye strain in low-light conditions.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ),
            },
            {
              value: "auto",
              label: "System",
              description: "Automatically match your operating system's theme preference.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ),
            },
          ].map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors",
                theme === option.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={(e) => setTheme(e.target.value as "light" | "dark" | "auto")}
                className="sr-only"
              />
              <div className={cn(
                "flex-shrink-0 mr-3 mt-0.5",
                theme === option.value
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              )}>
                {option.icon}
              </div>
              <div className="flex-1">
                <span className={cn(
                  "text-sm font-medium",
                  theme === option.value
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-900 dark:text-white"
                )}>{option.label}</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{option.description}</p>
              </div>
              {theme === option.value && (
                <div className="flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}