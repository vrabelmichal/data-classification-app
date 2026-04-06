import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react";
import { BrowserRouter } from "react-router";
import { api } from "../convex/_generated/api";
import { AccountPendingConfirmation } from "./components/AccountPendingConfirmation";
import { Toaster } from "sonner";
import { ChunkLoadBoundary } from "./components/ChunkLoadBoundary";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { RuntimeRecoveryBanner, VersionUpdateBanner } from "./components/app/AppBanners";
import { AuthenticatedAppView, UnauthenticatedAppView } from "./components/app/AppShellViews";
import { RecoverableLoadingScreen } from "./components/app/AppStatus";
import { adminPanelRoute, getAppNavigationItems, notFoundRoute, passwordResetRoute } from "./components/app/appRoutes";
import { useAppRuntimeRecovery } from "./hooks/app/useAppRuntimeRecovery";

function App() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userProfile = useQuery(api.users.getUserProfile);
  const { isAuthenticated, isLoading: authIsLoading } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const isOnline = useOnlineStatus();
  const appName = String(systemSettings?.appName ?? "Galaxy Classification App");
  const isAdmin = userProfile?.role === "admin";
  const navigationItems = getAppNavigationItems(isAdmin);
  const {
    dismissRuntimeIssue,
    dismissVersionUpdate,
    runtimeIssue,
    showLoadingRecovery,
    showVersionUpdate,
  } = useAppRuntimeRecovery({
    appVersion: systemSettings?.appVersion,
    authIsLoading,
    connectionState,
    isAuthenticated,
    isUserProfileLoading: userProfile === undefined,
  });

  const handleRefresh = () => {
    window.location.reload();
  };

  const activeBannerCount = Number(runtimeIssue !== null) + Number(showVersionUpdate);
  const bannerOffsetClass = activeBannerCount === 0 ? "" : activeBannerCount === 1 ? "pt-10" : "pt-20";

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
          {showVersionUpdate && <VersionUpdateBanner onDismiss={dismissVersionUpdate} onRefresh={handleRefresh} />}
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
            <UnauthenticatedAppView appName={appName} passwordResetRoute={passwordResetRoute} />
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
            <AuthenticatedAppView
              appName={appName}
              navigationItems={navigationItems}
              adminPanelRoute={adminPanelRoute}
              notFoundRoute={notFoundRoute}
            />
          )}
          <Toaster position="top-center" />
        </BrowserRouter>
      </ChunkLoadBoundary>
    </main>
  );
}

export default App;
