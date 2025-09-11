import { useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { cn } from "../lib/utils";
import { SignOutButton } from "../SignOutButton";
import { AdminButton } from "./AdminButton";

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

interface NavigationProps {
  navigationItems: NavigationItem[];
}

export function Navigation({ navigationItems }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const userProfile = useQuery(api.users.getUserProfile);
  const progress = useQuery(api.galaxies.getProgress);
  const navigate = useNavigate();

  // Filter items based on permissions (e.g., admin only)
  const visibleItems = navigationItems.filter(
    (it) => it.id !== "admin" || userProfile?.role === "admin"
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Galaxy Classifier
              </h1>
            </div>
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

        {/* Mobile Menu Overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
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
              <nav className="flex-1 p-4">
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
                        <span className="font-medium">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {/* Mobile Sign Out */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {userProfile && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    <div className="font-medium">Classifications: {userProfile.classificationsCount}</div>
                    <div className="text-xs mt-1">
                      Role: {userProfile.role === "admin" ? "Administrator" : "User"}
                    </div>
                  </div>
                )}
                <SignOutButton />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Galaxy Classifier
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
          <nav className="flex-1 px-4 py-4">
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
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
              <li><AdminButton /></li>
            </ul>
          </nav>

          {/* User Info */}
          {userProfile && (
            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <div className="font-medium">Classifications: {userProfile.classificationsCount}</div>
                <div className="text-xs mt-1">
                  Role: {userProfile.role === "admin" ? "Administrator" : "User"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
