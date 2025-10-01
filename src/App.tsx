import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { PasswordReset } from "./PasswordReset";
import { AccountPendingConfirmation } from "./components/AccountPendingConfirmation";
import { Toaster } from "sonner";
import { Navigation } from "./components/layout/Navigation";
import { ClassificationInterface } from "./components/classification/ClassificationInterface";
import { GalaxyBrowser } from "./components/browse/GalaxyBrowser";
import { SkippedGalaxies } from "./components/browse/SkippedGalaxies";
import { Statistics } from "./components/statistics/Statistics";
import { UserSettings } from "./components/settings/UserSettings";
import { Help } from "./components/help/Help";
import { AdminPanel } from "./components/admin/AdminPanel";
import { useState, useEffect } from "react";

function App() {
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userProfile = useQuery(api.users.getUserProfile);
  const appName = systemSettings?.appName || "Galaxy Classification App";
  
  // Version checking state
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showVersionUpdate, setShowVersionUpdate] = useState(false);
  
  // Check for version updates
  useEffect(() => {
    if (systemSettings?.appVersion !== undefined && systemSettings?.appVersion !== null) {
      const serverVersion = systemSettings.appVersion;
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
    setCurrentVersion(systemSettings?.appVersion || null);
  };

  const navigationItems = [
    { id: "classify", label: "Classify", icon: "🔬", path: "/classify", element: <ClassificationInterface /> },
    { id: "browse", label: "Browse Galaxies", icon: "🌌", path: "/browse", element: <GalaxyBrowser /> },
    { id: "skipped", label: "Skipped", icon: "⏭️", path: "/skipped", element: <SkippedGalaxies /> },
    { id: "statistics", label: "Statistics", icon: "📊", path: "/statistics", element: <Statistics /> },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", element: <UserSettings /> },
    { id: "help", label: "Help", icon: "❓", path: "/help", element: <Help /> },
    { id: "admin", label: "Admin", icon: "👑", path: "/admin", element: <AdminPanel /> },
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
                  <Route path="/reset" element={<PasswordReset />} />
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
            <div className={`flex flex-col custom-lg:flex-row min-h-screen overflow-x-hidden ${showVersionUpdate ? 'pt-10' : ''}`}>
              <Navigation navigationItems={navigationItems} appName={appName} />
              <div className="custom-lg:flex custom-lg:flex-1 custom-lg:flex-col custom-lg:ml-64 min-w-0">
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
                  <Routes>
                    <Route index element={<ClassificationInterface />} />
                    <Route path="/reset" element={<Navigate to="/settings" replace />} />
                    <Route path="/classify/:galaxyId" element={<ClassificationInterface />} />
                    {navigationItems.map((item) => (
                      <Route
                        key={item.id}
                        path={item.id === "admin" ? `${item.path}/*` : item.path}
                        element={item.element}
                      />
                    ))}
                  </Routes>
                </div>
              </div>
            </div>
          )}
        </Authenticated>
        <Toaster position="top-right" />
      </BrowserRouter>
    </main>
  );
}

export default App;
