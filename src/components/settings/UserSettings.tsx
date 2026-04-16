import { type Ref, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { toast } from "sonner";
import { getRoleLabel } from "../../lib/permissions";
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

interface FixedBarMetrics {
  isPinned: boolean;
  left: number;
  top: number;
  width: number;
}

function getNearestScrollContainer(element: HTMLElement | null): HTMLElement | null {
  if (!element || typeof window === "undefined") {
    return null;
  }

  let current: HTMLElement | null = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;

    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

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
  const { setTheme: setLiveTheme } = useTheme();

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
  const navBarRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [fixedBarMetrics, setFixedBarMetrics] = useState<FixedBarMetrics>({
    isPinned: false,
    left: 0,
    top: 0,
    width: 0,
  });

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
    if (!hasUnsavedChanges) {
      return;
    }

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
  const displayRole = getRoleLabel(profile?.role);
  const activeSubPage = settingsSubPages.find((page) => location.pathname === page.path) ?? settingsSubPages[0];
  const isGeneralSubPage = activeSubPage.id === "general";
  const contentWidthClass = activeSubPage.id === "storage" ? "max-w-6xl" : "max-w-4xl";

  useEffect(() => {
    const navBarElement = navBarRef.current;
    if (!navBarElement || typeof window === "undefined") {
      return;
    }

    const scrollContainer = getNearestScrollContainer(navBarElement);
    scrollContainerRef.current = scrollContainer;

    const updateFixedBarMetrics = () => {
      const currentNavBarElement = navBarRef.current;
      if (!currentNavBarElement) {
        return;
      }

      const navBarRect = currentNavBarElement.getBoundingClientRect();
      const scrollContainerElement = scrollContainerRef.current;
      const containerRect = scrollContainerElement?.getBoundingClientRect() ?? null;
      const topAnchor = Math.max(containerRect?.top ?? 0, 0);
      const nextMetrics = {
        isPinned: navBarRect.top <= topAnchor,
        left: navBarRect.left,
        top: topAnchor,
        width: navBarRect.width,
      };

      setFixedBarMetrics((current) => {
        if (
          current.isPinned === nextMetrics.isPinned &&
          current.left === nextMetrics.left &&
          current.top === nextMetrics.top &&
          current.width === nextMetrics.width
        ) {
          return current;
        }

        return nextMetrics;
      });
    };

    updateFixedBarMetrics();

    const scrollContainerElement = scrollContainerRef.current;
    const resizeObserver = new ResizeObserver(updateFixedBarMetrics);

    const handleScrollContainerScroll = () => {
      updateFixedBarMetrics();
    };

    resizeObserver.observe(navBarElement);
    if (scrollContainerElement) {
      resizeObserver.observe(scrollContainerElement);
      scrollContainerElement.addEventListener("scroll", handleScrollContainerScroll, { passive: true });
    }

    const handleWindowScroll = () => updateFixedBarMetrics();
    const handleWindowResize = () => updateFixedBarMetrics();

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      if (scrollContainerElement) {
        scrollContainerElement.removeEventListener("scroll", handleScrollContainerScroll);
      }
      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [location.pathname]);

  const renderSettingsNavigationBar = (barRef?: Ref<HTMLDivElement>, hidden = false, pinned = false) => (
    <div
      ref={barRef}
      className={cn(
        "mx-auto w-full bg-gray-50/95 backdrop-blur dark:bg-gray-900/95",
        hidden && "invisible pointer-events-none"
      )}
      aria-hidden={hidden}
    >
      <div className={cn("mx-auto", contentWidthClass, pinned && "px-1") }>
        <div className="mx-auto max-w-4xl border-b border-gray-200 dark:border-gray-700">
          <div className="flex min-h-[3.75rem] items-end justify-between gap-4">
            <nav className="-mb-px flex flex-1 self-end space-x-8 overflow-x-auto">
              {settingsSubPages.map((page) => {
                const isActive = location.pathname === page.path;

                return (
                  <Link
                    key={page.id}
                    to={page.path}
                    className={cn(
                      "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    )}
                  >
                    {page.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex h-12 w-[7.5rem] shrink-0 items-end justify-end pb-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isGeneralSubPage || !hasUnsavedChanges}
                tabIndex={isGeneralSubPage ? 0 : -1}
                aria-hidden={!isGeneralSubPage}
                className={cn(
                  "rounded-lg px-5 py-2 text-sm font-medium shadow-sm transition-colors",
                  isGeneralSubPage ? "visible" : "invisible pointer-events-none",
                  hasUnsavedChanges
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "cursor-not-allowed bg-gray-200 text-gray-500 shadow-none dark:bg-gray-700 dark:text-gray-400"
                )}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            </div>
          </div>
        </div>

        <div className="mb-5">
          {renderSettingsNavigationBar(navBarRef, fixedBarMetrics.isPinned)}
        </div>

        {fixedBarMetrics.isPinned && fixedBarMetrics.width > 0 && (
          <div
            className="fixed z-40"
            style={{
              left: fixedBarMetrics.left,
              top: fixedBarMetrics.top,
              width: fixedBarMetrics.width,
            }}
          >
            {renderSettingsNavigationBar(undefined, false, true)}
          </div>
        )}

        <div className={cn("mx-auto", contentWidthClass)}>
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
    </div>
  );
}
