import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { usePageTitle } from "../../hooks/usePageTitle";

export function UserSettings() {
  usePageTitle("Settings");
  const userPrefs = useQuery(api.users.getUserPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const updateUserName = useMutation(api.users.updateUserName);
  
  // Get public system settings for default image quality
  const publicSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const defaultImageQuality = (publicSettings?.defaultImageQuality as "high" | "low") || "high";

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

  const [imageQuality, setImageQuality] = useState<"high" | "medium" | "low">(defaultImageQuality);
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");
  const [userName, setUserName] = useState("");

  // Update state when userPrefs or defaultImageQuality changes
  useEffect(() => {
    if (userPrefs) {
      setImageQuality(userPrefs.imageQuality);
      setTheme(userPrefs.theme);
    } else if (defaultImageQuality) {
      // Use system default when user has no preference set
      setImageQuality(defaultImageQuality);
    }
    if (authUser?.name) {
      setUserName(authUser.name);
    }
  }, [userPrefs, authUser, defaultImageQuality]);

  const handleSave = async () => {
    try {
      await updatePreferences({
        imageQuality,
        theme,
      });
      if (userName !== (authUser?.name ?? "")) {
        await updateUserName({ name: userName });
      }
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
                checked={imageQuality === "high"}
                onChange={(e) => setImageQuality(e.target.value as "high" | "medium" | "low")}
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
                checked={imageQuality === "low"}
                onChange={(e) => setImageQuality(e.target.value as "high" | "medium" | "low")}
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

        {/* Theme */}
        {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme</h2>
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
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div> */}


        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Save Settings
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
