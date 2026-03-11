import { Routes, Route, Navigate } from "react-router";
import { ClassificationsExportPage } from "./ClassificationsExportPage";

export function DataPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Admin-only data tools and export workflows</p>
      </div>

      <Routes>
        <Route index element={<ClassificationsExportPage />} />
        <Route path="classifications" element={<Navigate to="/data" replace />} />
        <Route path="*" element={<Navigate to="/data" replace />} />
      </Routes>
    </div>
  );
}