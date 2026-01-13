import { useQuery } from "convex/react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { OverviewTab } from "../admin/OverviewTab";
import { cn } from "../../lib/utils";
import { StatisticsTab } from "./StatisticsTab";

export function Statistics() {
  usePageTitle("Statistics");
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userProfile = useQuery(api.users.getUserProfile);
  const location = useLocation();
  
  const isAdmin = userProfile?.role === "admin";
  const allowPublicOverview = systemSettings?.allowPublicOverview ?? false;
  const canAccessOverview = Boolean(isAdmin || allowPublicOverview);

  if (systemSettings === undefined || userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {canAccessOverview ? "Classification progress and performance overview" : "Your classification progress and performance"}
        </p>
      </div>

      {canAccessOverview && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "my-statistics", label: "My Statistics", icon: "📊", path: "/statistics" },
                { id: "overview", label: "Overview", icon: "📈", path: "/statistics/overview" },
              ].map((tab) => (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={cn(
                    "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                    location.pathname === tab.path
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <Routes>
            <Route index element={<StatisticsTab />} />
            <Route path="overview" element={<OverviewTab />} />
          </Routes>
        </>
      )}

      {!canAccessOverview && <StatisticsTab />}
    </div>
  );
}
