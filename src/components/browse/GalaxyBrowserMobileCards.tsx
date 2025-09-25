import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "classified":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            Classified
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
            Unclassified
          </span>
        );
    }
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
    <div className="space-y-4">
      {galaxies.map((galaxy: any) => (
        <div
          key={galaxy._id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 flex-shrink-0">
              <ImageViewer
                imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                alt={`Galaxy ${galaxy.id}`}
                preferences={userPrefs}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {galaxy.id}
                </h3>
                {getStatusBadge(galaxy.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                <div>RA: {galaxy.ra.toFixed(4)}°</div>
                <div>Dec: {galaxy.dec.toFixed(4)}°</div>
                <div>Reff: {galaxy.reff.toFixed(2)}</div>
                <div>q: {galaxy.q.toFixed(3)}</div>
                <div>PA: {galaxy.pa.toFixed(1)}°</div>
                <div>Nucleus: {galaxy.nucleus ? "Yes" : "No"}</div>
                <div>Mag: {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}</div>
                <div>μ₀: {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}</div>
              </div>

              {galaxy.classification && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center space-x-4">
                    <span>LSB: {galaxy.classification.lsb_class}</span>
                    <span>Morph: {galaxy.classification.morphology}</span>
                    {galaxy.classification.awesome_flag && (
                      <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                    )}
                    {galaxy.classification.valid_redshift && (
                      <span className="text-blue-600 dark:text-blue-400">🔴</span>
                    )}
                  </div>
                </div>
              )}
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