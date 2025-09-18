import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "../lib/utils";
import { usePageTitle } from "../hooks/usePageTitle";
import { UsersTab } from "./UsersTab";
import { GalaxiesTab } from "./GalaxiesTab";
import { SettingsTab } from "./SettingsTab";
import { DebuggingTab } from "./DebuggingTab";

export function AdminPanel() {
  usePageTitle("Admin");
  const [selectedTab, setSelectedTab] = useState<"users" | "galaxies" | "settings" | "debugging">("users");
  
  const userProfile = useQuery(api.users.getUserProfile);
  const isAdmin = userProfile?.role === "admin";
  
  const users = useQuery(api.users.getAllUsers, isAdmin ? {} : "skip");
  const systemSettings = useQuery(api.users.getSystemSettings, isAdmin ? {} : "skip");

  if (userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-300">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (users === undefined || systemSettings === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Manage users and system settings</p>
      </div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "users", label: "Users", icon: "👥" },
            { id: "galaxies", label: "Galaxies", icon: "🌌" },
            { id: "settings", label: "Settings", icon: "⚙️" },
            { id: "debugging", label: "Debugging", icon: "🛠️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                selectedTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {selectedTab === "users" && <UsersTab users={users} />}

      {selectedTab === "galaxies" && <GalaxiesTab users={users} />}

      {selectedTab === "settings" && <SettingsTab systemSettings={systemSettings} />}

      {selectedTab === "debugging" && <DebuggingTab />}
    </div>
  );
}
