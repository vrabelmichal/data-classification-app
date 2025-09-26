import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { cn } from "../../lib/utils";
import { getImageUrl } from "../../images";
import type { SortField } from "./GalaxyBrowser";

interface GalaxyBrowserTableViewProps {
  galaxyData: any;
  userPrefs: any;
  previewImageName: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: SortField) => void;
}

export function GalaxyBrowserTableView({
  galaxyData,
  userPrefs,
  previewImageName,
  sortBy,
  sortOrder,
  handleSort,
}: GalaxyBrowserTableViewProps) {
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortOrder === "asc" ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (!galaxyData) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Updating results...</p>
        </div>
      </div>
    );
  }

  const { galaxies } = galaxyData;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Image
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("numericId")}
            >
              <div className="flex items-center space-x-1">
                <span>#</span>
                {getSortIcon("numericId")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("id")}
            >
              <div className="flex items-center space-x-1">
                <span>Galaxy ID</span>
                {getSortIcon("id")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("ra")}
            >
              <div className="flex items-center space-x-1">
                <span>RA</span>
                {getSortIcon("ra")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("dec")}
            >
              <div className="flex items-center space-x-1">
                <span>Dec</span>
                {getSortIcon("dec")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("reff")}
            >
              <div className="flex items-center space-x-1">
                <span>Reff</span>
                {getSortIcon("reff")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("q")}
            >
              <div className="flex items-center space-x-1">
                <span>q</span>
                {getSortIcon("q")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("nucleus")}
            >
              <div className="flex items-center space-x-1">
                <span>Nucleus</span>
                {getSortIcon("nucleus")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("mag")}
            >
              <div className="flex items-center space-x-1">
                <span>Mag</span>
                {getSortIcon("mag")}
              </div>
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => handleSort("mean_mue")}
            >
              <div className="flex items-center space-x-1">
                <span>μ₀</span>
                {getSortIcon("mean_mue")}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Classifications
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Visible Nuclei
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Awesome Flags
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Total Assigned
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Paper
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Thur CLS N
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {galaxies.map((galaxy: any) => (
            <tr key={galaxy._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="w-16 h-16">
                  <ImageViewer
                    imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                    alt={`Galaxy ${galaxy.id}`}
                    preferences={userPrefs}
                  />
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {galaxy.numericId?.toString() || "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {galaxy.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.ra.toFixed(4)}°
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.dec.toFixed(4)}°
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.reff.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.q.toFixed(3)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={cn(
                  "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                  galaxy.nucleus
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                )}>
                  {galaxy.nucleus ? "Yes" : "No"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.totalClassifications || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.numVisibleNucleus || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.numAwesomeFlag || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.totalAssigned || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.misc?.paper || "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {galaxy.misc?.thur_cls_n || "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link
                  to={`/classify/${galaxy.id}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  Classify
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}