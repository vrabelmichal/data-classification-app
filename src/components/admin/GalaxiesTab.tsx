import { Routes, Route, Link, Navigate, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { GenerateSequencesPage } from "./galaxies/GenerateSequencesPage";
import { ManageSequencesPage } from "./galaxies/ManageSequencesPage";
import { BlacklistPage } from "./galaxies/BlacklistPage";

interface GalaxiesTabProps {
  users: any[];
  systemSettings: any;
}

export function GalaxiesTab({ users, systemSettings }: GalaxiesTabProps) {
  const location = useLocation();

  const subTabs = [
    { id: "generate", label: "Generate Sequences", icon: "➕", path: "/admin/galaxies/generate" },
    { id: "manage", label: "Manage Sequences", icon: "✏️", path: "/admin/galaxies/manage" },
    { id: "blacklist", label: "Blacklist", icon: "🚫", path: "/admin/galaxies/blacklist" },
  ];

  return (
    <div>
      {/* Sub-navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {subTabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.path}
              className={cn(
                "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
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

      {/* Sub-routes */}
      <Routes>
        <Route index element={<Navigate to="generate" replace />} />
        <Route path="generate" element={<GenerateSequencesPage users={users} systemSettings={systemSettings} />} />
        <Route path="manage" element={<ManageSequencesPage users={users} systemSettings={systemSettings} />} />
        <Route path="blacklist" element={<BlacklistPage />} />
      </Routes>
    </div>
  );
}