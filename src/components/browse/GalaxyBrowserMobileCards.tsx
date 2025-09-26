import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { cn } from "../../lib/utils";
import { getImageUrl } from "../../images";

interface GalaxyBrowserMobileCardsProps {
  galaxyData: any;
  userPrefs: any;
  previewImageName: string;
}

export function GalaxyBrowserMobileCards({
  galaxyData,
  userPrefs,
  previewImageName,
}: GalaxyBrowserMobileCardsProps) {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table container with relative positioning for sticky action column */}
      <div className="relative">
        {/* Action column - fixed position, always visible */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-10">
          <div className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">
              Action
            </span>
          </div>
          {galaxies.map((galaxy: any) => (
            <div key={`action-${galaxy._id}`} className="h-20 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center px-2">
              <Link
                to={`/classify/${galaxy.id}`}
                className="inline-flex items-center px-2 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                Classify
              </Link>
            </div>
          ))}
        </div>

        {/* Scrollable table content */}
        <div className="overflow-x-auto pr-24">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-20">
                  Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-16">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider min-w-24">
                  Galaxy ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-20">
                  RA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-20">
                  Dec
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-16">
                  Reff
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-12">
                  q
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-20">
                  Nucleus
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-16">
                  Mag
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-16">
                  μ₀
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-24">
                  Classifications
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-24">
                  Visible Nuclei
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-24">
                  Awesome Flags
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider w-24">
                  Total Assigned
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider min-w-20">
                  Paper
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider min-w-24">
                  Thur CLS N
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {galaxies.map((galaxy: any) => (
                <tr key={galaxy._id} className="h-20">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="w-12 h-12">
                      <ImageViewer
                        imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                        alt={`Galaxy ${galaxy.id}`}
                        preferences={userPrefs}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {galaxy.numericId?.toString() || "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {galaxy.id}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.ra.toFixed(4)}°
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.dec.toFixed(4)}°
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.reff.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.q.toFixed(3)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                      galaxy.nucleus
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                    )}>
                      {galaxy.nucleus ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.totalClassifications || 0}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.numVisibleNucleus || 0}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.numAwesomeFlag || 0}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.totalAssigned || 0}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.misc?.paper || "—"}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.misc?.thur_cls_n || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}