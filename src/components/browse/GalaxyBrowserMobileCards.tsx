import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { cn } from "../../lib/utils";
import { getImageUrl } from "../../images";
import {SMALL_IMAGE_DEFAULT_ZOOM} from "../classification/GalaxyImages";

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
    <div className="space-y-4">
      {galaxies.map((galaxy: any) => (
        <div
          key={galaxy._id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4 space-y-4 sm:space-y-0">
            <div className="flex-shrink-0 w-full sm:w-1/3 max-w-64 max-h-64 aspect-square mx-auto sm:mx-0">
              <ImageViewer
                imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                alt={`Galaxy ${galaxy.id}`}
                preferences={userPrefs}
                defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {galaxy.id}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                <div><span className="font-medium text-gray-800 dark:text-gray-100">#:</span> {galaxy.numericId?.toString() || "—"}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">RA:</span> {galaxy.ra.toFixed(4)}°</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Dec:</span> {galaxy.dec.toFixed(4)}°</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Reff:</span> {galaxy.reff.toFixed(2)}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">q:</span> {galaxy.q.toFixed(3)}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Nucleus:</span> {galaxy.nucleus ? "Yes" : "No"}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Mag:</span> {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">μ₀:</span> {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Classifications:</span> {galaxy.totalClassifications || 0}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Visible Nuclei:</span> {galaxy.numVisibleNucleus || 0}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Awesome Flags:</span> {galaxy.numAwesomeFlag || 0}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Total Assigned:</span> {galaxy.totalAssigned || 0}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Paper:</span> {galaxy.misc?.paper || "—"}</div>
                <div><span className="font-medium text-gray-800 dark:text-gray-100">Thur CLS N:</span> {galaxy.misc?.thur_cls_n || "—"}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              to={`/classify/${galaxy.id}`}
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            >
              Classify
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}