import React from "react";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { getImageUrl } from "../../images";
import type { SortField } from "./GalaxyBrowser";

interface GalaxyBrowserSimpleTableViewProps {
  galaxyData: any;
  userPrefs: any;
  effectiveImageQuality: "high" | "medium" | "low";
  previewImageName: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: SortField) => void;
}

export function GalaxyBrowserSimpleTableView({
  galaxyData,
  userPrefs,
  effectiveImageQuality,
  previewImageName,
  sortBy,
  sortOrder,
  handleSort,
}: GalaxyBrowserSimpleTableViewProps) {
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
      <div>
        <div>Updating results...</div>
      </div>
    );
  }

  const { galaxies } = galaxyData;

  return (
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th onClick={() => handleSort("numericId")}>
            # {getSortIcon("numericId")}
          </th>
          <th onClick={() => handleSort("id")}>
            Galaxy ID {getSortIcon("id")}
          </th>
          <th onClick={() => handleSort("ra")}>
            RA {getSortIcon("ra")}
          </th>
          <th onClick={() => handleSort("dec")}>
            Dec {getSortIcon("dec")}
          </th>
          <th onClick={() => handleSort("reff")}>
            Reff {getSortIcon("reff")}
          </th>
          <th onClick={() => handleSort("q")}>
            q {getSortIcon("q")}
          </th>
          <th onClick={() => handleSort("nucleus")}>
            Nucleus {getSortIcon("nucleus")}
          </th>
          <th onClick={() => handleSort("mag")}>
            Mag {getSortIcon("mag")}
          </th>
          <th onClick={() => handleSort("mean_mue")}>
            μ₀ {getSortIcon("mean_mue")}
          </th>
          <th>Classifications</th>
          <th>Visible Nuclei</th>
          <th>Awesome Flags</th>
          <th>Total Assigned</th>
          <th>Paper</th>
          <th>Thur CLS N</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {galaxies.map((galaxy: any) => (
          <tr key={galaxy._id}>
            <td>
              <ImageViewer
                imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: effectiveImageQuality })}
                alt={`Galaxy ${galaxy.id}`}
                preferences={userPrefs}
              />
            </td>
            <td>{galaxy.numericId?.toString() || "—"}</td>
            <td>{galaxy.id}</td>
            <td>{galaxy.ra.toFixed(4)}°</td>
            <td>{galaxy.dec.toFixed(4)}°</td>
            <td>{galaxy.reff.toFixed(2)}</td>
            <td>{galaxy.q.toFixed(3)}</td>
            <td>{galaxy.nucleus ? "Yes" : "No"}</td>
            <td>{galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}</td>
            <td>{galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}</td>
            <td>{galaxy.totalClassifications || 0}</td>
            <td>{galaxy.numVisibleNucleus || 0}</td>
            <td>{galaxy.numAwesomeFlag || 0}</td>
            <td>{galaxy.totalAssigned || 0}</td>
            <td>{galaxy.misc?.paper || "—"}</td>
            <td>{galaxy.misc?.thur_cls_n || "—"}</td>
            <td>
              <Link to={`/classify/${galaxy.id}`}>Classify</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}