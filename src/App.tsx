import { useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route } from "react-router";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
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
                <SignInForm />
              </div>
            </div>
          </div>
        </Unauthenticated>
        
        <Authenticated>
          <BrowserRouter>
            {/* <div className="flex h-screen"> */}
            <div className="flex flex-col lg:flex-row h-screen">
              <Navigation navigationItems={navigationItems} />
               <div className="lg:flex lg:flex-1 lg:flex-col lg:ml-64">
                 <div className="flex items-center justify-end px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                   <SignOutButton />
                 </div>
                 
                 <div className="flex-1 overflow-auto">
                   {/* {renderPage()} */}
                   <Routes>
                    {/* keep index hardcoded */}
                    <Route index element={<ClassificationInterface />} />
                    {/* dynamic galaxy route */}
                    <Route path="/classify/:galaxyId" element={<ClassificationInterface />} />
                    {/* generate routes from navigationItems -- element components are already React nodes */}
                    {navigationItems.map((item) => (
                      <Route key={item.id} path={item.path} element={item.element} />
                    ))}
                   </Routes>
                 </div>
               </div>
             </div>
           </BrowserRouter>
         </Authenticated>
        
        <Toaster position="top-right" />
      </main>
  );
}

export default App;
