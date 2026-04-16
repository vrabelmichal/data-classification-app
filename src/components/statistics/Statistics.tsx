import { lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { CachedOverviewTab, LiveOverviewTab } from "./overview/OverviewTab";
import { cn } from "../../lib/utils";
import { StatisticsTab } from "./StatisticsTab";
import { UsersStatisticsTab } from "./UsersStatisticsTab";

const AssignmentStatsTab = lazy(() =>
  import("../admin/galaxies/AssignmentStatsPage").then((module) => ({
    default: module.AssignmentStatsPage,
  }))
);

const DataAnalysisTab = lazy(() =>
  import("./DataAnalysisTab").then((module) => ({
    default: module.DataAnalysisTab,
  }))
);

function StatisticsTabLoading() {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

export function Statistics() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userProfile = useQuery(api.users.getUserProfile);
  const location = useLocation();
  const isLiveOverview = location.pathname.startsWith("/statistics/overview-live");
  const isOverview = location.pathname.startsWith("/statistics/overview");
  const isUsersStatistics = location.pathname.startsWith("/statistics/users");
  const isAssignmentStats = location.pathname.startsWith("/statistics/assignment-stats");
  const isDataAnalysis = location.pathname.startsWith("/statistics/analysis");
  usePageTitle(
    isAssignmentStats
      ? "Assignment Statistics"
      : isDataAnalysis
        ? "Classification Data Analysis"
      : isLiveOverview
        ? "Overview Statistics (Live)"
        : isOverview
        ? "Overview Statistics"
        : isUsersStatistics
          ? "Users Statistics"
          : "My Statistics"
  );

  const isAdmin = userProfile?.role === "admin";
  const allowPublicOverview = systemSettings?.allowPublicOverview ?? false;
  const allowPublicDataAnalysis = systemSettings?.allowPublicDataAnalysis ?? false;
  const permissions = userProfile?.permissions;
  const canAccessOverview = Boolean(permissions?.viewOverviewStatistics || allowPublicOverview);
  const canAccessUsersStatistics = Boolean(permissions?.viewUserStatistics);
  const canAccessAssignmentStats = Boolean(permissions?.viewAssignmentStatistics);
  const canAccessLiveOverview = Boolean(permissions?.viewLiveOverviewStatistics);
  const canAccessDataAnalysis = Boolean(permissions?.viewDataAnalysis || allowPublicDataAnalysis);
  const restrictedTabRedirect = canAccessOverview ? "/statistics/overview" : "/statistics";
  const headerDescription = isAssignmentStats
    ? "Assignment coverage and sequence planning across the full dataset"
    : isDataAnalysis
      ? "Local, interactive analysis of per-galaxy classification outcomes"
    : isLiveOverview
      ? "Live classification progress and performance overview"
    : canAccessOverview
      ? "Cached classification progress and performance overview"
      : "Your classification progress and performance";
  const tabs = [
    { id: "my-statistics", label: "My Statistics", icon: "📊", path: "/statistics" },
    ...(canAccessOverview
      ? [{ id: "overview", label: "Overview", icon: "📈", path: "/statistics/overview" }]
      : []),
    ...(canAccessUsersStatistics
      ? [{ id: "users", label: "Users", icon: "👥", path: "/statistics/users" }]
      : []),
    ...(canAccessDataAnalysis
      ? [{ id: "analysis", label: "Data Analysis", icon: "🧭", path: "/statistics/analysis" }]
      : []),
    ...(canAccessAssignmentStats
      ? [{ id: "assignment-stats", label: "Assignment Stats", icon: "🧮", path: "/statistics/assignment-stats" }]
      : []),
  ];

  const isTabActive = (path: string) =>
    path === "/statistics" ? location.pathname === path : location.pathname.startsWith(path);

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
        <p className="mt-2 text-gray-600 dark:text-gray-300">{headerDescription}</p>
      </div>

      {tabs.length > 1 && (
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                className={cn(
                  "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
                  isTabActive(tab.path)
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
      )}

      <Routes>
        <Route index element={<StatisticsTab />} />
        <Route
          path="overview"
          element={canAccessOverview ? <CachedOverviewTab systemSettings={systemSettings} isAdmin={isAdmin} /> : <Navigate to="/statistics" replace />}
        />
        <Route
          path="overview-live"
          element={
            canAccessLiveOverview ? (
              <LiveOverviewTab systemSettings={systemSettings} isAdmin={isAdmin} />
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route
          path="users"
          element={
            canAccessUsersStatistics ? (
              <UsersStatisticsTab />
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route
          path="analysis"
          element={
            canAccessDataAnalysis ? (
              <Suspense fallback={<StatisticsTabLoading />}>
                <DataAnalysisTab systemSettings={systemSettings} />
              </Suspense>
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route
          path="assignment-stats"
          element={
            canAccessAssignmentStats ? (
              <Suspense fallback={<StatisticsTabLoading />}>
                <AssignmentStatsTab />
              </Suspense>
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/statistics" replace />} />
      </Routes>
    </div>
  );
}
