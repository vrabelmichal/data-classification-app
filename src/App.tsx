import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { ReportIssueModalProvider, useReportIssueModal } from "./lib/reportIssueModalContext";
import { ReportIssueModal } from "./components/ReportIssueModal";
import { AccountPendingConfirmation } from "./components/AccountPendingConfirmation";
import { Toaster } from "sonner";
import { Navigation } from "./components/layout/Navigation";
import { ClassificationInterface } from "./components/classification/ClassificationInterface";
import { useState, useEffect, lazy, Suspense, type ReactNode } from "react";
import { DEFAULT_ALLOW_PUBLIC_OVERVIEW } from "./lib/defaults";

const LazyPasswordReset = lazy(() =>
  import("./PasswordReset").then((module) => ({ default: module.PasswordReset }))
);
const LazyGalaxyBrowser = lazy(() =>
  import("./components/browse/GalaxyBrowser").then((module) => ({ default: module.GalaxyBrowser }))
);
const LazySkippedGalaxies = lazy(() =>
  import("./components/browse/SkippedGalaxies").then((module) => ({ default: module.SkippedGalaxies }))
);
const LazyStatistics = lazy(() =>
  import("./components/statistics/Statistics").then((module) => ({ default: module.Statistics }))
);
const LazyUserSettings = lazy(() =>
  import("./components/settings/UserSettings").then((module) => ({ default: module.UserSettings }))
);
const LazyHelp = lazy(() =>
  import("./components/help/Help").then((module) => ({ default: module.Help }))
);
const LazyAdminPanel = lazy(() =>
  import("./components/admin/AdminPanel").then((module) => ({ default: module.AdminPanel }))
);
const LazyIssueReportsPage = lazy(() =>
  import("@/components/admin/IssueReportsPage").then((module) => ({ default: module.IssueReportsPage }))
);
const LazyNotificationsPage = lazy(() =>
  import("./components/notifications/NotificationsPage").then((module) => ({ default: module.NotificationsPage }))
);
const LazyNotFound = lazy(() =>
  import("./components/NotFound").then((module) => ({ default: module.NotFound }))
);

function GlobalReportIssueModal() {
  const { isOpen, close } = useReportIssueModal();
  return <ReportIssueModal isOpen={isOpen} onClose={close} />;
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center px-4">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-lg">
          {message || "You do not have permission to view this page."}
        </p>
      </div>
    </div>
  );
}

function App() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userProfile = useQuery(api.users.getUserProfile);
  const appName = String(systemSettings?.appName ?? "Galaxy Classification App");
  const isAdmin = userProfile?.role === "admin";
  const allowPublicOverview = systemSettings?.allowPublicOverview ?? DEFAULT_ALLOW_PUBLIC_OVERVIEW;
  const canAccessOverview = Boolean(isAdmin || allowPublicOverview);
  
  // Version checking state
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showVersionUpdate, setShowVersionUpdate] = useState(false);
  
  // Check for version updates
  useEffect(() => {
    const appVersionRaw = systemSettings?.appVersion;
    if (appVersionRaw !== undefined && appVersionRaw !== null) {
      const serverVersion: string = String(appVersionRaw);
      if (currentVersion === null) {
        // First load - set current version
        setCurrentVersion(serverVersion);
      } else if (currentVersion !== serverVersion) {
        // Version changed - show update prompt
        setShowVersionUpdate(true);
      }
    }
  }, [systemSettings?.appVersion, currentVersion]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const dismissVersionUpdate = () => {
    setShowVersionUpdate(false);
    const appVersionRaw = systemSettings?.appVersion;
    setCurrentVersion(appVersionRaw !== undefined && appVersionRaw !== null ? String(appVersionRaw) : null);
  };

  const browseRoute = (
    <LazyPage>
      <LazyGalaxyBrowser />
    </LazyPage>
  );

  const skippedRoute = (
    <LazyPage>
      <LazySkippedGalaxies />
    </LazyPage>
  );

  const statisticsRoute = (
    <LazyPage>
      <LazyStatistics />
    </LazyPage>
  );

  const settingsRoute = (
    <LazyPage>
      <LazyUserSettings />
    </LazyPage>
  );

  const notificationsRoute = (
    <LazyPage>
      <LazyNotificationsPage />
    </LazyPage>
  );

  const helpRoute = (
    <LazyPage>
      <LazyHelp />
    </LazyPage>
  );

  const adminPanelRoute = (
    <LazyPage>
      <LazyAdminPanel />
    </LazyPage>
  );

  const issueReportsRoute = (
    <LazyPage>
      <LazyIssueReportsPage />
    </LazyPage>
  );

  const passwordResetRoute = (
    <LazyPage>
      <LazyPasswordReset />
    </LazyPage>
  );

  const notFoundRoute = (
    <LazyPage>
      <LazyNotFound />
    </LazyPage>
  );

  const navigationItems = [
    { id: "classify", label: "Classify", icon: "🔬", path: "/classify", element: <ClassificationInterface /> },
    { id: "browse", label: "Browse Galaxies", icon: "🌌", path: "/browse", element: browseRoute },
    { id: "skipped", label: "Skipped", icon: "⏭️", path: "/skipped", element: skippedRoute },
    { id: "statistics", label: "Statistics", icon: "📊", path: "/statistics", element: statisticsRoute },
    { id: "notifications", label: "Notifications", icon: "🔔", path: "/notifications", element: notificationsRoute },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", element: settingsRoute },
    { id: "help", label: "Help", icon: "❓", path: "/help", element: helpRoute },
    { id: "reports", label: "Issue Reports", icon: "📋", path: "/reports", element: issueReportsRoute, adminOnly: true },
    { id: "admin", label: "Admin", icon: "👑", path: "/admin", element: adminPanelRoute, adminOnly: true },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Version Update Bar */}
      {showVersionUpdate && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              A new version of the app is available. Please refresh to update.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={dismissVersionUpdate}
              className="text-blue-200 hover:text-white text-sm underline"
            >
              Dismiss
            </button>
            <button
              onClick={handleRefresh}
              className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
      
      <BrowserRouter>
        <Unauthenticated>
          <div className="flex items-center justify-center min-h-screen">
            <div className="max-w-md w-full mx-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {appName}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Help classify galaxies for scientific research
                  </p>
                </div>
                <Routes>
                  <Route path="/reset" element={passwordResetRoute} />
                  <Route
                    path="*"
                    element={
                        <>
                            <SignInForm />
                            <div className="mt-6 text-center">
                              <Link
                                to="/reset"
                                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Forgot your password?
                              </Link>
                            </div>
                          </>
                    }
                  />
                </Routes>
              </div>
            </div>
          </div>
        </Unauthenticated>
        <Authenticated>
          {userProfile === undefined ? (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300">Loading...</p>
              </div>
            </div>
          ) : !userProfile?.isConfirmed ? (
            <AccountPendingConfirmation />
          ) : (
            <ReportIssueModalProvider>
              <GlobalReportIssueModal />
            <div className={`flex flex-col custom-lg:flex-row min-h-screen overflow-x-hidden ${showVersionUpdate ? 'pt-10' : ''}`}>
              <Navigation navigationItems={navigationItems} appName={appName} />
              <div className="custom-lg:flex custom-lg:flex-1 custom-lg:flex-col custom-lg:ml-64 min-w-0">
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
                  <Routes>
                    <Route index element={<ClassificationInterface />} />
                    <Route path="/reset" element={<Navigate to="/settings" replace />} />
                    <Route path="/classify/:galaxyId" element={<ClassificationInterface />} />
                    {navigationItems.filter((item) => item.id !== "admin").map((item) => (
                      <Route
                        key={item.id}
                        path={item.id === "statistics" || item.id === "help" ? `${item.path}/*` : item.path}
                        element={item.element}
                      />
                    ))}
                    <Route path="/admin/*" element={adminPanelRoute} />
                    <Route path="*" element={notFoundRoute} />
                  </Routes>
                </div>
              </div>
            </div>
            </ReportIssueModalProvider>
          )}
        </Authenticated>
        <Toaster position="top-center" />
      </BrowserRouter>
    </main>
  );
}

export default App;
