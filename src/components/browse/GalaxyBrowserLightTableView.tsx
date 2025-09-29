import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { getImageUrl } from "../../images";
import type { SortField } from "./GalaxyBrowser";

interface GalaxyBrowserLightTableViewProps {
  galaxyData: any;
  userPrefs: any;
  previewImageName: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: SortField) => void;
}

export function GalaxyBrowserLightTableView({
  galaxyData,
  userPrefs,
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
      <div className="p-4 text-center">
        <div>Updating results...</div>
      </div>
    );
  }

  const { galaxies } = galaxyData;

  return (
    <div className="overflow-x-auto pr-32">
      <table className="w-max border-collapse border border-gray-300">
      <thead className="bg-gray-100">
        <tr>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Image</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("numericId")}>
            # {getSortIcon("numericId")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("id")}>
            Galaxy ID {getSortIcon("id")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("ra")}>
            RA {getSortIcon("ra")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("dec")}>
            Dec {getSortIcon("dec")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("reff")}>
            Reff {getSortIcon("reff")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("q")}>
            q {getSortIcon("q")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("nucleus")}>
            Nucleus {getSortIcon("nucleus")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("mag")}>
            Mag {getSortIcon("mag")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold cursor-pointer hover:bg-gray-200" onClick={() => handleSort("mean_mue")}>
            μ₀ {getSortIcon("mean_mue")}
          </th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Classifications</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Visible Nuclei</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Awesome Flags</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Total Assigned</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Paper</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Thur CLS N</th>
          <th className="border border-gray-300 px-2 py-1 text-left font-semibold">Action</th>
        </tr>
      </thead>
      <tbody>
        {galaxies.map((galaxy: any, index: number) => (
          <tr key={galaxy._id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="border border-gray-300 px-2 py-1">
              <div className="w-16 h-16">
                <ImageViewer
                  imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                  alt={`Galaxy ${galaxy.id}`}
                  preferences={userPrefs}
                />
              </div>
            </td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.numericId?.toString() || "—"}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.id}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.ra.toFixed(4)}°</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.dec.toFixed(4)}°</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.reff.toFixed(2)}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.q.toFixed(3)}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.nucleus ? "Yes" : "No"}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.totalClassifications || 0}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.numVisibleNucleus || 0}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.numAwesomeFlag || 0}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.totalAssigned || 0}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.misc?.paper || "—"}</td>
            <td className="border border-gray-300 px-2 py-1">{galaxy.misc?.thur_cls_n || "—"}</td>
            <td className="border border-gray-300 px-2 py-1">
              <Link
                to={`/classify/${galaxy.id}`}
                className="inline-block px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
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