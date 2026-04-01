import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useTheme } from "../../hooks/useTheme";
import { DEFAULT_IMAGE_QUALITY } from "../../lib/defaults";
import { LocalStorageSection } from "./LocalStorageSection";
import { UserSettingsAccountPage } from "./UserSettingsAccountPage";
import { UserSettingsGeneralPage } from "./UserSettingsGeneralPage";

const settingsSubPages = [
  {
    id: "general",
    label: "General",
    path: "/settings/general",
  },
  {
    id: "storage",
    label: "Local storage",
    path: "/settings/storage",
  },
  {
    id: "account",
    label: "Account details",
    path: "/settings/account",
  },
] as const;

export function UserSettings() {
  usePageTitle("Settings");
  const location = useLocation();
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
  // Note: historical values may include "medium" which is no longer supported.
  const effectiveImageQuality = userPrefs?.imageQuality ?? defaultImageQuality;

  // Map legacy/unsupported values to supported ones for display and saving
  const normalizeQuality = (
    q: "high" | "low" | "medium" | undefined,
    fallback: "high" | "low"
  ): "high" | "low" => (q === "medium" ? fallback : (q ?? fallback));
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

  // Compute the displayed/checked value using normalization so a radio is always selected
  const normalizedEffectiveImageQuality = normalizeQuality(effectiveImageQuality, defaultImageQuality);
  const displayedImageQuality = normalizeQuality(imageQuality, defaultImageQuality);
  dlog("Display state", { imageQuality, displayedImageQuality, effectiveImageQuality });

  // Check if there are unsaved changes
  // Compare normalized values so legacy 'medium' correctly reflects pending change intent
  const hasUnsavedChanges = (
    (imageQuality !== undefined && normalizeQuality(imageQuality, defaultImageQuality) !== normalizedEffectiveImageQuality) ||
    theme !== effectiveTheme ||
    userName !== (authUser?.name ?? "")
  );

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
  const activeSubPage = settingsSubPages.find((page) => location.pathname === page.path) ?? settingsSubPages[0];
  const isGeneralSubPage = activeSubPage.id === "general";
  const contentWidthClass = activeSubPage.id === "storage" ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Customize your classification experience.</p>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Sections</div>
          <nav className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {settingsSubPages.map((page) => {
              const isActive = location.pathname === page.path;

              return (
                <Link
                  key={page.id}
                  to={page.path}
                  className={cn(
                    "text-sm transition-colors",
                    isActive
                      ? "text-gray-900 dark:text-white font-medium"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                >
                  {page.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className={cn("mx-auto", contentWidthClass)}>
        {isGeneralSubPage && (
          <div className="sticky top-0 z-30 mb-6 rounded-xl bg-gray-50/95 px-1 py-3 shadow-sm backdrop-blur dark:bg-gray-900/95">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General settings</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Update the preferences that affect your day-to-day classification workflow.
                </p>
                {hasUnsavedChanges && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    You have unsaved changes.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                className={cn(
                  "rounded-lg px-5 py-2.5 text-sm font-medium transition-colors shadow-sm",
                  hasUnsavedChanges
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                )}
              >
                {hasUnsavedChanges ? "Save Changes" : "Saved"}
              </button>
            </div>
          </div>
        )}

        <Routes>
          <Route index element={<Navigate to="general" replace />} />
          <Route
            path="general"
            element={
              <UserSettingsGeneralPage
                userName={userName}
                setUserName={setUserName}
                displayedImageQuality={displayedImageQuality}
                normalizedEffectiveImageQuality={normalizedEffectiveImageQuality}
                userPrefsImageQuality={userPrefs?.imageQuality}
                setImageQuality={setImageQuality}
                theme={theme}
                setTheme={setTheme}
                dlog={dlog}
              />
            }
          />
          <Route path="storage" element={<LocalStorageSection />} />
          <Route
            path="account"
            element={
              <UserSettingsAccountPage
                displayName={displayName}
                displayEmail={displayEmail}
                displayRole={displayRole}
                profile={profile}
                authUser={authUser}
              />
            }
          />
          <Route path="*" element={<Navigate to="general" replace />} />
        </Routes>
      </div>
    </div>
  );
}
