import { useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, useNavigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";
import { SignOutButton } from "../../SignOutButton";
import { DebugAdminButton } from "../admin/DebugAdminButton";
import { DarkModeToggle } from "../navigation/DarkModeToggle";
import { ReportIssueModal } from "../ReportIssueModal";
import { useTheme } from "../../hooks/useTheme";

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
}

interface NavigationProps {
  navigationItems: NavigationItem[];
  appName: string;
}

// Notification badge component
function NotificationBadge({ count, className }: { count?: number; className?: string }) {
  if (!count || count <= 0 || !Number.isFinite(count)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Navigation({ navigationItems, appName }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const userProfile = useQuery(api.users.getUserProfile);
  const progress = useQuery(api.classification.getProgress);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const unreadNotificationCount = useQuery(api.notifications.getUnreadNotificationCount);
  const navigate = useNavigate();
  const userDisplayName = userProfile?.user?.name ?? userProfile?.user?.email;
  const { theme, effectiveTheme, toggleTheme } = useTheme();

  // Filter items based on permissions (e.g., admin only)
  const visibleItems = navigationItems.filter((it) => !it.adminOnly || userProfile?.role === "admin");

  return (
    <>
      <ReportIssueModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
      {/* Mobile Navigation */}
      <div className="custom-lg:hidden">
        {/* Mobile Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {appName}
              </h1>
              {/* Mobile notification badge - shown next to app title */}
              {unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
                <button
                  onClick={() => navigate("/notifications")}
                  className="relative"
                  title="You have unread notifications"
                >
                  <NotificationBadge count={unreadNotificationCount} />
                </button>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-50 custom-lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />
            <div className="fixed top-0 right-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 min-h-0 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                            isActive
                              ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          )
                        }
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className="font-medium flex-1">{item.label}</span>
                        {item.id === "notifications" && unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
                          <NotificationBadge count={unreadNotificationCount} />
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="w-full space-y-3">
                  <button
                    onClick={() => {
                      // Open report modal but keep the mobile menu visible underneath
                      setIsReportModalOpen(true);
                    }}
                    title="Report Issue"
                    className="w-full rounded-lg px-3 py-2 text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 3h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2" />
                        <path d="M15 3v5h5" />
                        <path d="M9 10h6" />
                        <path d="M9 13h6" />
                        <path d="M9 16h6" />
                      </svg>
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Report Issue</span>
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => toggleTheme()}
                    title={theme === "light" ? "Switch to dark" : theme === "dark" ? "Switch to auto" : "Switch to light"}
                    className="w-full rounded-lg px-3 py-2 flex items-center justify-between text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {effectiveTheme === "dark" ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Theme</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
                  </button>

                  {userProfile && userDisplayName && (
                    // <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500 dark:text-gray-400">

                    <div className="flex items-center gap-3 px-3 pt-1 pb-3 text-xs text-gray-500 dark:text-gray-400">
                      {userProfile.role === "admin" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                          <path d="M9.5 12.5l2 2 3.5-4" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="8" r="3.5" />
                          <path d="M5 19c1.5-3.5 12.5-3.5 14 0" />
                        </svg>
                      )}
                      {/* <span>{userProfile.role === "admin" ? "Administrator" : "User"}</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span> */}
                      <span className="truncate">{userDisplayName}</span>
                    </div>
                  )}

                  <div className="[&>button]:w-full [&>button]:justify-center [&>button]:text-center">
                    <SignOutButton />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden custom-lg:flex custom-lg:w-64 custom-lg:flex-col custom-lg:fixed custom-lg:inset-y-0">
        <div className="flex min-h-0 flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {appName}
            </h1>
          </div>

          {/* Progress */}
          {progress && (
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Progress: {progress.completed}/{progress.total} ({progress.percentage}%)
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )
                    }
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium flex-1">{item.label}</span>
                    {item.id === "notifications" && unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
                      <NotificationBadge count={unreadNotificationCount} />
                    )}
                  </NavLink>
                </li>
              ))}
              {systemSettings?.debugAdminMode && userProfile && userProfile.role !== "admin" && (
                <li><DebugAdminButton /></li>
              )}
            </ul>
          </nav>

          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="w-full space-y-1">
              <button
                onClick={() => setIsReportModalOpen(true)}
                title="Report Issue"
                className="w-full rounded-lg px-3 py-2 text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 3h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2" />
                    <path d="M15 3v5h5" />
                    <path d="M9 10h6" />
                    <path d="M9 13h6" />
                    <path d="M9 16h6" />
                  </svg>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Report Issue</span>
                  </span>
                </div>
              </button>

              <button
                onClick={() => toggleTheme()}
                title={theme === "light" ? "Switch to dark" : theme === "dark" ? "Switch to auto" : "Switch to light"}
                className="w-full rounded-lg px-3 py-2 flex items-center justify-between text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {effectiveTheme === "dark" ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Theme</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
              </button>

              {userProfile && userDisplayName && (
                <div className="flex items-center gap-3 px-3 pt-1 pb-3 text-xs text-gray-500 dark:text-gray-400">
                  {userProfile.role === "admin" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                      <path d="M9.5 12.5l2 2 3.5-4" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 19c1.5-3.5 12.5-3.5 14 0" />
                    </svg>
                  )}
                  {/* <span>{userProfile.role === "admin" ? "Administrator" : "User"}</span> */}
                  {/* <span className="text-gray-300 dark:text-gray-600">•</span> */}
                  <span className="truncate">{userDisplayName}</span>
                </div>
              )}

              <div className="[&>button]:w-full [&>button]:justify-center [&>button]:text-center">
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
