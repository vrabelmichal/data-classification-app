import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react";
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
import { ChunkLoadBoundary } from "./components/ChunkLoadBoundary";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const LOADING_RECOVERY_DELAY_MS = 15000;
const STALLED_REQUEST_DELAY_MS = 30000;

type RuntimeIssueKind = "network" | "stalled-request";

interface RuntimeIssue {
  kind: RuntimeIssueKind;
  title: string;
  message: string;
}

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
const LazyDataPage = lazy(() =>
  import("./components/data/DataPage").then((module) => ({ default: module.DataPage }))
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

function getRuntimeErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? getRuntimeErrorMessage(error.cause) : "";

  return [name, message, cause].filter(Boolean).join(" ");
}

function isRecoverableNetworkError(error: unknown): boolean {
  const message = getRuntimeErrorMessage(error);

  if (!message) {
    return false;
  }

  return [
    /Failed to fetch/i,
    /NetworkError/i,
    /Load failed/i,
    /ERR_QUIC_PROTOCOL_ERROR/i,
    /ERR_ECH_FALLBACK_CERTIFICATE_INVALID/i,
    /fetch.*failed/i,
  ].some((pattern) => pattern.test(message));
}

function RuntimeRecoveryBanner({
  issue,
  onDismiss,
  onRefresh,
}: {
  issue: RuntimeIssue;
  onDismiss: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
      <div className="min-w-0">
        <p className="text-sm font-medium">{issue.title}</p>
        <p className="text-xs text-amber-100">{issue.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-amber-100 hover:text-white text-sm underline"
        >
          Dismiss
        </button>
        <button
          onClick={onRefresh}
          className="bg-white text-amber-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function RecoverableLoadingScreen({
  isOnline,
  message,
  showRecovery,
  onRefresh,
}: {
  isOnline: boolean;
  message: string;
  showRecovery: boolean;
  onRefresh: () => void;
}) {
  if (!showRecovery) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
          {!isOnline && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              The browser is offline. The app will resume once the connection returns.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-xl dark:border-amber-800 dark:bg-gray-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Connection recovery
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
          This session needs to reconnect.
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {isOnline
            ? "This tab has been open for a while and the app is still waiting for the backend. Refresh once to restore a clean connection."
            : "The browser is offline, so the app cannot finish loading yet. Reconnect to the internet, then refresh if the page does not recover on its own."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            Refresh app
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Status: {isOnline ? "browser online" : "browser offline"}. {message}
        </p>
      </div>
    </div>
  );
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
  const { isAuthenticated, isLoading: authIsLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const isOnline = useOnlineStatus();
  const appName = String(systemSettings?.appName ?? "Galaxy Classification App");
  const isAdmin = userProfile?.role === "admin";
  
  // Version checking state
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showVersionUpdate, setShowVersionUpdate] = useState(false);
  const [runtimeIssue, setRuntimeIssue] = useState<RuntimeIssue | null>(null);
  const [showLoadingRecovery, setShowLoadingRecovery] = useState(false);
  
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

  const dismissRuntimeIssue = () => {
    setRuntimeIssue(null);
  };

  const dismissVersionUpdate = () => {
    setShowVersionUpdate(false);
    const appVersionRaw = systemSettings?.appVersion;
    setCurrentVersion(appVersionRaw !== undefined && appVersionRaw !== null ? String(appVersionRaw) : null);
  };

  const reportRuntimeIssue = (issue: RuntimeIssue) => {
    setRuntimeIssue((current) => {
      if (current?.kind === issue.kind && current.message === issue.message) {
        return current;
      }

      return issue;
    });
  };

  const isAuthOrProfileLoading = authIsLoading || (isAuthenticated && userProfile === undefined);

  useEffect(() => {
    if (!isAuthOrProfileLoading) {
      setShowLoadingRecovery(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowLoadingRecovery(true);
    }, LOADING_RECOVERY_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAuthOrProfileLoading]);

  useEffect(() => {
    if (!connectionState.hasInflightRequests || connectionState.timeOfOldestInflightRequest === null) {
      return;
    }

    const requestAgeMs = Date.now() - connectionState.timeOfOldestInflightRequest.getTime();
    const delayMs = Math.max(0, STALLED_REQUEST_DELAY_MS - requestAgeMs);
    const timeout = window.setTimeout(() => {
      reportRuntimeIssue({
        kind: "stalled-request",
        title: "A backend request is taking unusually long",
        message:
          "If this tab was left open for a long time or the network changed, refresh the app to re-establish a clean session.",
      });
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [connectionState.hasInflightRequests, connectionState.timeOfOldestInflightRequest]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isRecoverableNetworkError(event.reason)) {
        return;
      }

      reportRuntimeIssue({
        kind: "network",
        title: "The connection to the backend failed",
        message:
          "A request could not reach Convex. This usually happens after the tab has been open for a long time or the network path changed. Refresh the app to recover.",
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isRecoverableNetworkError(event.error ?? event.message)) {
        return;
      }

      reportRuntimeIssue({
        kind: "network",
        title: "The connection to the backend failed",
        message:
          "A request could not reach Convex. This usually happens after the tab has been open for a long time or the network path changed. Refresh the app to recover.",
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

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

  const dataRoute = isAdmin ? (
    <LazyPage>
      <LazyDataPage />
    </LazyPage>
  ) : (
    <AccessDenied message="You need administrator privileges to access the data section." />
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

  const activeBannerCount = Number(runtimeIssue !== null) + Number(showVersionUpdate);
  const bannerOffsetClass = activeBannerCount === 0 ? "" : activeBannerCount === 1 ? "pt-10" : "pt-20";

  const navigationItems = [
    { id: "classify", label: "Classify", icon: "🔬", path: "/classify", element: <ClassificationInterface /> },
    { id: "browse", label: "Browse Galaxies", icon: "🌌", path: "/browse", element: browseRoute },
    { id: "skipped", label: "Skipped", icon: "⏭️", path: "/skipped", element: skippedRoute },
    { id: "statistics", label: "Statistics", icon: "📊", path: "/statistics", element: statisticsRoute },
    {
      id: "data",
      label: "Data",
      icon: "🗂️",
      path: "/data",
      element: dataRoute,
      adminOnly: true,
      activeWhenPathStartsWith: ["/data"],
    },
    { id: "notifications", label: "Notifications", icon: "🔔", path: "/notifications", element: notificationsRoute },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", element: settingsRoute, activeWhenPathStartsWith: ["/settings"] },
    { id: "help", label: "Help", icon: "❓", path: "/help", element: helpRoute },
    { id: "reports", label: "Issue Reports", icon: "📋", path: "/reports", element: issueReportsRoute, adminOnly: true },
    { id: "admin", label: "Admin", icon: "👑", path: "/admin", element: adminPanelRoute, adminOnly: true },
  ];

  return (
    <main className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${bannerOffsetClass}`}>
      {(runtimeIssue !== null || showVersionUpdate) && (
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col shadow-lg">
          {runtimeIssue !== null && (
            <RuntimeRecoveryBanner
              issue={runtimeIssue}
              onDismiss={dismissRuntimeIssue}
              onRefresh={handleRefresh}
            />
          )}
          {showVersionUpdate && (
            <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-medium">
                  A new version of the app is available. Please refresh to update.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
        </div>
      )}

      <ChunkLoadBoundary>
        <BrowserRouter>
          {authIsLoading ? (
            <RecoverableLoadingScreen
              isOnline={isOnline}
              message="Restoring your session..."
              showRecovery={showLoadingRecovery}
              onRefresh={handleRefresh}
            />
          ) : !isAuthenticated ? (
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
          ) : userProfile === undefined ? (
            <RecoverableLoadingScreen
              isOnline={isOnline}
              message="Loading your account..."
              showRecovery={showLoadingRecovery}
              onRefresh={handleRefresh}
            />
          ) : !userProfile?.isConfirmed ? (
            <AccountPendingConfirmation />
          ) : (
            <ReportIssueModalProvider>
              <GlobalReportIssueModal />
              <div className="flex flex-col custom-lg:flex-row min-h-screen overflow-x-hidden">
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
                          path={item.id === "statistics" || item.id === "help" || item.id === "notifications" || item.id === "data" || item.id === "settings" ? `${item.path}/*` : item.path}
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
          <Toaster position="top-center" />
        </BrowserRouter>
      </ChunkLoadBoundary>
    </main>
  );
}

export default App;
