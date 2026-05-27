import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { CachedOverviewTab, LiveOverviewTab } from "./overview/OverviewTab";
import { cn } from "../../lib/utils";
import { StatisticsTab } from "./StatisticsTab";
import { UsersStatisticsTab } from "./UsersStatisticsTab";
import type { ClassificationCoverageTabProps } from "./paperAssignmentCoverage/ClassificationCoverageTab";

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

const ClassificationCoverageTab = lazy(() =>
  import("./paperAssignmentCoverage/ClassificationCoverageTab").then((module) => ({
    default: module.CachedClassificationCoverageTab,
  }))
);

const LiveClassificationCoverageTab = lazy(() =>
  import("./paperAssignmentCoverage/ClassificationCoverageTab").then((module) => ({
    default: module.LiveClassificationCoverageTab,
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
  const navBarRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState({ isPinned: false, left: 0, top: 0, width: 0 });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isLiveOverview = location.pathname.startsWith("/statistics/overview-live");
  const isOverview = location.pathname.startsWith("/statistics/overview");
  const isUsersStatistics = location.pathname.startsWith("/statistics/users");
  const isAssignmentStats = location.pathname.startsWith("/statistics/assignment-stats");
  const isLiveClassificationCoverage = location.pathname.startsWith("/statistics/classification-coverage-live");
  const isClassificationCoverage = location.pathname.startsWith("/statistics/classification-coverage");
  const isDataAnalysis = location.pathname.startsWith("/statistics/analysis");
  usePageTitle(
    isLiveClassificationCoverage
      ? "Classification Coverage (Live)"
      : isClassificationCoverage
        ? "Classification Coverage"
      : isAssignmentStats
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
  const canAccessClassificationCoverage = Boolean(permissions?.viewAssignmentCoverage);
  const canAccessLiveClassificationCoverage = Boolean(
    permissions?.viewAssignmentCoverage && permissions?.viewLiveAssignmentCoverage,
  );
  const canAccessLiveOverview = Boolean(permissions?.viewLiveOverviewStatistics);
  const canAccessDataAnalysis = Boolean(permissions?.viewDataAnalysis || allowPublicDataAnalysis);
  const restrictedTabRedirect = canAccessOverview ? "/statistics/overview" : "/statistics";
  const classificationCoverageRedirect = canAccessClassificationCoverage
    ? "/statistics/classification-coverage"
    : restrictedTabRedirect;
  const headerDescription = isAssignmentStats
    ? "Assignment stats and sequence planning across the full dataset"
    : isLiveClassificationCoverage
      ? "Live classification coverage across under-target galaxies"
    : isClassificationCoverage
      ? "Cached classification coverage across under-target galaxies"
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
    ...(canAccessClassificationCoverage
      ? [
          { id: "classification-coverage", label: "Classification Coverage", icon: "🕸️", path: "/statistics/classification-coverage" },
        ]
      : []),
    ...(canAccessAssignmentStats
      ? [
          { id: "assignment-stats", label: "Assignment Stats", icon: "🧮", path: "/statistics/assignment-stats" },
        ]
      : []),
    ...(canAccessDataAnalysis
      ? [{ id: "analysis", label: "Data Analysis", icon: "🧭", path: "/statistics/analysis" }]
      : []),
  ];

  const isTabActive = (path: string) =>
    path === "/statistics" ? location.pathname === path : location.pathname.startsWith(path);

  useEffect(() => {
    const navBarElement = navBarRef.current;
    if (!navBarElement || typeof window === "undefined") return;

    const getNearestScrollContainer = (element: HTMLElement | null): HTMLElement | null => {
      if (!element) return null;
      let current: HTMLElement | null = element.parentElement;
      while (current) {
        const { overflowY } = window.getComputedStyle(current);
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return current;
        current = current.parentElement;
      }
      return null;
    };

    const scrollContainer = getNearestScrollContainer(navBarElement);
    scrollContainerRef.current = scrollContainer;

    const update = () => {
      const el = navBarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const containerRect = scrollContainerRef.current?.getBoundingClientRect() ?? null;
      const topAnchor = Math.max(containerRect?.top ?? 0, 0);
      const next = { isPinned: rect.top <= topAnchor, left: rect.left, top: topAnchor, width: rect.width };
      setMetrics((cur) =>
        cur.isPinned === next.isPinned && cur.left === next.left && cur.top === next.top && cur.width === next.width
          ? cur
          : next
      );
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(navBarElement);
    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", update, { passive: true });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      resizeObserver.disconnect();
      scrollContainer?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [location.pathname]);

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
        <>
          <div ref={navBarRef} className="mb-8">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <nav className="hidden -mb-px space-x-8 overflow-x-auto sm:flex" aria-label="Statistics sections">
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

              <div className="sm:hidden">
                <div className="flex items-center gap-3 px-1 py-3">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen((open) => !open)}
                    aria-expanded={mobileNavOpen}
                    aria-label={mobileNavOpen ? "Collapse navigation" : "Expand navigation"}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-sm transition-colors hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                  >
                    <svg
                      className={cn("h-4 w-4 transition-transform", mobileNavOpen && "rotate-180")}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="min-w-0 flex-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {tabs.find((tab) => isTabActive(tab.path))?.label ?? "Statistics"}
                  </span>
                </div>
                {mobileNavOpen && (
                  <nav className="border-t border-gray-200 dark:border-gray-700" aria-label="Statistics sections">
                    {tabs.map((tab) => (
                      <Link
                        key={tab.id}
                        to={tab.path}
                        className={cn(
                          "flex items-center border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                          isTabActive(tab.path)
                            ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                        )}
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            </div>
          </div>

          {metrics.isPinned && metrics.width > 0 && (
            <div
              className="fixed z-40"
              style={{ left: metrics.left, top: metrics.top, width: metrics.width }}
            >
              <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <nav className="hidden -mb-px space-x-8 overflow-x-auto sm:flex" aria-label="Statistics sections">
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

                <div className="sm:hidden">
                  <div className="flex items-center gap-3 px-1 py-3">
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen((open) => !open)}
                      aria-expanded={mobileNavOpen}
                      aria-label={mobileNavOpen ? "Collapse navigation" : "Expand navigation"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-sm transition-colors hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                    >
                      <svg
                        className={cn("h-4 w-4 transition-transform", mobileNavOpen && "rotate-180")}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <span className="min-w-0 flex-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {tabs.find((tab) => isTabActive(tab.path))?.label ?? "Statistics"}
                    </span>
                  </div>
                  {mobileNavOpen && (
                    <nav className="border-t border-gray-200 dark:border-gray-700" aria-label="Statistics sections">
                      {tabs.map((tab) => (
                        <Link
                          key={tab.id}
                          to={tab.path}
                          className={cn(
                            "flex items-center border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                            isTabActive(tab.path)
                              ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                              : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          )}
                        >
                          {tab.label}
                        </Link>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
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
              <Navigate to={classificationCoverageRedirect} replace />
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
        <Route
          path="classification-coverage"
          element={
            canAccessClassificationCoverage ? (
              <Suspense fallback={<StatisticsTabLoading />}>
                <ClassificationCoverageTab
                  systemSettings={systemSettings}
                  canAccessLiveVariant={canAccessLiveClassificationCoverage}
                />
              </Suspense>
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route
          path="classification-coverage-live"
          element={
            canAccessLiveClassificationCoverage ? (
              <Suspense fallback={<StatisticsTabLoading />}>
                <LiveClassificationCoverageTab
                  systemSettings={systemSettings}
                  canAccessLiveVariant={canAccessLiveClassificationCoverage}
                />
              </Suspense>
            ) : (
              <Navigate to={restrictedTabRedirect} replace />
            )
          }
        />
        <Route
          path="paper-assignment-coverage"
          element={<Navigate to="/statistics/classification-coverage" replace />}
        />
        <Route
          path="paper-assignment-coverage-live"
          element={<Navigate to="/statistics/classification-coverage-live" replace />}
        />
        <Route path="*" element={<Navigate to="/statistics" replace />} />
      </Routes>
    </div>
  );
}
