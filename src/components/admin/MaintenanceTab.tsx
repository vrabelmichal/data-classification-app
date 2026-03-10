import { Routes, Route, Link, Navigate, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { MaintenanceModeAndRegularPage } from "./maintenance/MaintenanceModeAndRegularPage";
import { DataRepairPage } from "./maintenance/DataRepairPage";
import { AggregateManagementPage } from "./maintenance/AggregateManagementPage";
import { DevelopmentTestingPage } from "./maintenance/DevelopmentTestingPage";

export function MaintenanceTab() {
  const location = useLocation();

  const subTabs = [
    { id: "mode", label: "Maintenance Mode & Regular", icon: "🔧", path: "/admin/maintenance/mode" },
    { id: "repair", label: "Data Repair", icon: "🔨", path: "/admin/maintenance/repair" },
    { id: "aggregates", label: "Aggregates", icon: "📊", path: "/admin/maintenance/aggregates" },
    { id: "development", label: "Development & Testing", icon: "🧪", path: "/admin/maintenance/development" },
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
        <Route index element={<Navigate to="mode" replace />} />
        <Route path="mode" element={<MaintenanceModeAndRegularPage />} />
        <Route path="repair" element={<DataRepairPage />} />
        <Route path="aggregates" element={<AggregateManagementPage />} />
        <Route path="development" element={<DevelopmentTestingPage />} />
      </Routes>
    </div>
  );
}