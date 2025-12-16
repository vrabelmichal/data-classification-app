import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useTheme } from "../../hooks/useTheme";
import { DEFAULT_IMAGE_QUALITY } from "../../lib/defaults";

export function UserSettings() {
  usePageTitle("Settings");
  const userPrefs = useQuery(api.users.getUserPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const updateUserName = useMutation(api.users.updateUserName);
  const DEBUG_USER_SETTINGS = (import.meta as any).env?.VITE_DEBUG_USER_SETTINGS === "1";
  const dlog = (...args: any[]) => {
    if (DEBUG_USER_SETTINGS) console.log("[UserSettings]", ...args);
  };
  
  // Get public system settings for default image quality
  const publicSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const defaultImageQuality = (publicSettings?.defaultImageQuality as "high" | "low") ?? DEFAULT_IMAGE_QUALITY;

  // Query for combined user + profile returned by server as `getUserProfile`
  // The returned shape is: { user, ...profileFields }
  const userWithProfile = useQuery(api.users.getUserProfile);
  const authUser = userWithProfile?.user ?? null;
  // Keep the full profile object so we can display all columns
  const profile = userWithProfile ?? null;
  // {
  //   userId: userWithProfile.userId,
  //   role: userWithProfile.role,
  //   isActive: userWithProfile.isActive,
  //   isConfirmed: userWithProfile.isConfirmed,
  //   classificationsCount: userWithProfile.classificationsCount,
  //   joinedAt: userWithProfile.joinedAt,
  //   lastActiveAt: userWithProfile.lastActiveAt,
  // }

  // Use the theme hook for immediate theme changes
  const { theme: liveTheme, setTheme: setLiveTheme } = useTheme();

  // Determine the effective image quality: user preference > system default > hardcoded default
  // userPrefs already includes the server-side default when user has no preference
  const effectiveImageQuality = userPrefs?.imageQuality ?? defaultImageQuality;
  dlog("Derived values", {
    publicSettings,
    defaultImageQuality,
    userPrefs,
    effectiveImageQuality,
  });
  const effectiveTheme = userPrefs?.theme ?? "auto";

  // Initialize with undefined to detect when we haven't set from loaded data yet
  const [imageQuality, setImageQuality] = useState<"high" | "medium" | "low" | undefined>(undefined);
  const [userName, setUserName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");

  // Update state when data loads or changes
  useEffect(() => {
    // Only set imageQuality once userPrefs has loaded (not undefined)
    if (userPrefs !== undefined) {
      setImageQuality(effectiveImageQuality);
      setTheme(effectiveTheme);
    }
    if (authUser?.name) {
      setUserName(authUser.name);
    }
    dlog("Effect update", {
      userPrefs,
      publicSettings,
      defaultImageQuality,
      effectiveImageQuality,
      imageQuality,
      effectiveTheme,
      theme,
      authUser,
    });
  }, [userPrefs, effectiveImageQuality, effectiveTheme, authUser]);

  // Compute the displayed/checked value - use state if set, otherwise fall back to effective
  const displayedImageQuality = imageQuality ?? effectiveImageQuality;
  dlog("Display state", { imageQuality, displayedImageQuality, effectiveImageQuality });

  // Check if there are unsaved changes
  const hasUnsavedChanges = 
    imageQuality !== undefined && imageQuality !== effectiveImageQuality ||
    theme !== effectiveTheme ||
    userName !== (authUser?.name ?? "");

  const handleSave = async () => {
    try {
      dlog("Saving preferences", {
        payload: { imageQuality: displayedImageQuality, theme },
        nameChange: userName !== (authUser?.name ?? ""),
      });
      await updatePreferences({
        imageQuality: displayedImageQuality,
        theme,
      });
      if (userName !== (authUser?.name ?? "")) {
        await updateUserName({ name: userName });
      }
      // Apply theme changes to live theme after save
      setLiveTheme(theme);
      dlog("Save complete");
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    }
  };

  // If preferences are still loading show spinner. We also gracefully handle cases where profile/user might be loading.
  if (userPrefs === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Extract displayable fields (guarded with optional chaining)
  const displayName = authUser?.name ?? "";
  const displayEmail = authUser?.email ?? "";
  const displayRole = profile?.role ?? "user";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      {/* Top: main user info */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Customize your classification experience</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Avatar (if available) */}
            {authUser?.image ? (
              <img src={authUser.image} alt={displayName || "user avatar"} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">{(displayName || displayEmail || "?").charAt(0).toUpperCase()}</div>
            )}
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{displayName || "-"}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{displayEmail}</div>
              <div className="text-sm mt-1 inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded">Role: {displayRole}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* User Name */}
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

        {/* Image Quality */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Image Quality</h2>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="imageQuality"
                value="high"
                checked={displayedImageQuality === "high"}
                onChange={(e) => {
                  const val = e.target.value as "high" | "medium" | "low";
                  dlog("Radio change: imageQuality", { from: imageQuality, to: val });
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
                  dlog("Radio change: imageQuality", { from: imageQuality, to: val });
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

        {/* Interface Options */}
        {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Interface Options</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Show Keyboard Hints</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Display keyboard shortcuts on classification buttons</p>
              </div>
              <input
                type="checkbox"
                checked={showKeyboardHints}
                onChange={(e) => setShowKeyboardHints(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>
        </div> */}

        {/* Theme - Appearance */}
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
                )
              },
              { 
                value: "dark", 
                label: "Dark", 
                description: "Use a dark background with light text. Reduces eye strain in low-light conditions.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )
              },
              { 
                value: "auto", 
                label: "System", 
                description: "Automatically match your operating system's theme preference.",
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )
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


        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={cn(
              "font-medium py-2 px-6 rounded-lg transition-all",
              hasUnsavedChanges
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {hasUnsavedChanges ? "Save Changes *" : "Save Settings"}
          </button>
        </div>

        {/* Details section with additional user/profile fields */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Details</h2>

          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Name</div>
              <div className="font-medium">{displayName || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
              <div className="font-medium">{displayEmail || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Role</div>
              <div className="font-medium">{displayRole}</div>
            </div>

            {/* Other profile fields (all columns) */}
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Profile ID</div>
              <div className="font-medium">{profile?._id ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">User ID (ref)</div>
              <div className="font-medium">{profile?.userId ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
              <div className="font-medium">{profile?.isActive ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Confirmed</div>
              <div className="font-medium">{profile?.isConfirmed ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Classifications</div>
              <div className="font-medium">{profile?.classificationsCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Joined</div>
              <div className="font-medium">{profile?.joinedAt ? new Date(profile.joinedAt).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Last Active</div>
              <div className="font-medium">{profile?.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Sequence Generated</div>
              <div className="font-medium">{profile?.sequenceGenerated ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Profile Created</div>
              <div className="font-medium">{profile?._creationTime ? new Date(profile._creationTime).toLocaleString() : "-"}</div>
            </div>

            {/* Auth users table fields */}
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Email Verified</div>
              <div className="font-medium">{authUser?.emailVerificationTime ? new Date(authUser.emailVerificationTime).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">User doc ID</div>
              <div className="font-medium">{authUser?._id ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">User Created</div>
              <div className="font-medium">{authUser?._creationTime ? new Date(authUser._creationTime).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Phone</div>
              <div className="font-medium">{authUser?.phone ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Phone Verified</div>
              <div className="font-medium">{authUser?.phoneVerificationTime ? new Date(authUser.phoneVerificationTime).toLocaleString() : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Anonymous</div>
              <div className="font-medium">{authUser?.isAnonymous ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Image URL</div>
              <div className="font-medium">{authUser?.image ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
