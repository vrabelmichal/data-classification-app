import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Link } from "react-router";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { PasswordReset } from "./PasswordReset";
import { Navigation } from "./components/Navigation";
import { ClassificationInterface } from "./components/ClassificationInterface";
import { GalaxyBrowser } from "./components/GalaxyBrowser";
import { SkippedGalaxies } from "./components/SkippedGalaxies";
import { Statistics } from "./components/Statistics";
import { UserSettings } from "./components/UserSettings";
import { Help } from "./components/Help";
import { AdminPanel } from "./components/AdminPanel";
import { Toaster } from "sonner";

function App() {
  // Navigation items defined here and passed into Navigation
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
      <BrowserRouter>
        <Unauthenticated>
          <div className="flex items-center justify-center min-h-screen">
            <div className="max-w-md w-full mx-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Galaxy Classifier
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
          <div className="flex flex-col custom-lg:flex-row h-screen">
            <Navigation navigationItems={navigationItems} />
            <div className="custom-lg:flex custom-lg:flex-1 custom-lg:flex-col custom-lg:ml-64">
              <div className="flex-1 overflow-auto">
                <Routes>
                  <Route index element={<ClassificationInterface />} />
                  <Route path="/reset" element={<PasswordReset />} />
                  <Route path="/classify/:galaxyId" element={<ClassificationInterface />} />
                  {navigationItems.map((item) => (
                    <Route key={item.id} path={item.path} element={item.element} />
                  ))}
                </Routes>
              </div>
            </div>
          </div>
        </Authenticated>
        <Toaster position="top-right" />
      </BrowserRouter>
    </main>
  );
}

export default App;
