import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { getImageUrl } from "../../images";
import type { SortField } from "./GalaxyBrowser";
import {SMALL_IMAGE_DEFAULT_ZOOM} from "../classification/GalaxyImages";

interface GalaxyBrowserLightTableViewProps {
  galaxyData: any;
  userPrefs: any;
  effectiveImageQuality: "high" | "medium" | "low";
  previewImageName: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: SortField) => void;
}

export function GalaxyBrowserLightTableView({
  galaxyData,
  userPrefs,
  effectiveImageQuality,
  previewImageName,
  sortBy,
  sortOrder,
  handleSort,
}: GalaxyBrowserLightTableViewProps) {
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return (
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortOrder === "asc" ? (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (!galaxyData) {
    return (
      <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">
        Updating results...
      </div>
    );
  }

  const { galaxies } = galaxyData;

  return (
    <div className="galaxy-table-container relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
      <div className="galaxy-table-scroll-wrapper galaxy-table-scroll relative max-w-full overflow-x-auto">
        <table className="galaxy-table w-full min-w-[1200px] border-collapse text-sm text-gray-700 dark:text-gray-200">
          <thead className="bg-gray-100 dark:bg-gray-900/40">
            <tr>
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Image
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("numericId")}
              >
                # {getSortIcon("numericId")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("id")}
              >
                Galaxy ID {getSortIcon("id")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("ra")}
              >
                RA {getSortIcon("ra")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("dec")}
              >
                Dec {getSortIcon("dec")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("reff")}
              >
                Reff {getSortIcon("reff")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("q")}
              >
                q {getSortIcon("q")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("nucleus")}
              >
                Nucleus {getSortIcon("nucleus")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("mag")}
              >
                Mag {getSortIcon("mag")}
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSort("mean_mue")}
              >
                μ₀ {getSortIcon("mean_mue")}
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Classifications
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Visible Nuclei
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Awesome Flags
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Failed Fittings
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Total Assigned
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Paper
              </th>
              <th
                className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap"
                title="Number of algorithms by Thuruthipilly classifying object as a galaxy"
              >
                Thur CLS N
              </th>
              <th className="galaxy-sticky-col galaxy-sticky-col-header border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {galaxies.map((galaxy: any, index: number) => {
              const rowBackgroundClass = index % 2 === 0 ? "bg-white dark:bg-gray-900/10" : "bg-gray-50 dark:bg-gray-900/30";
              const stickyCellBackgroundClass = index % 2 === 0 ? "bg-white dark:bg-gray-900/20" : "bg-gray-50 dark:bg-gray-900/40";

              return (
                <tr key={galaxy._id} className={rowBackgroundClass}>
                  <td className="border border-gray-300 px-3 py-2 align-top">
                    <div className="h-16 w-16 overflow-hidden rounded">
                      <ImageViewer
                        imageUrl={getImageUrl(galaxy.id, previewImageName, {
                          quality: effectiveImageQuality,
                        })}
                        alt={`Galaxy ${galaxy.id}`}
                        preferences={userPrefs}
                        defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                      />
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.numericId?.toString() || "—"}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.id}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.ra.toFixed(4)}°</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.dec.toFixed(4)}°</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.reff.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.q.toFixed(3)}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.nucleus ? "Yes" : "No"}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">
                    {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">
                    {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.totalClassifications || 0}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.numVisibleNucleus || 0}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.numAwesomeFlag || 0}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.numFailedFitting || 0}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.totalAssigned || 0}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.misc?.paper || "—"}</td>
                  <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{galaxy.misc?.thur_cls_n || "—"}</td>
                  <td
                    className={`galaxy-sticky-col border border-gray-300 px-3 py-2 whitespace-nowrap ${stickyCellBackgroundClass}`}
                  >
                    <Link
                      to={`/classify/${galaxy.id}`}
                      className="inline-flex items-center rounded bg-blue-500 px-3 py-1 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      Classify
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}