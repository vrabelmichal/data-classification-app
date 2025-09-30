import React from "react";
import type { SortField } from "./GalaxyBrowser";

interface GalaxyBrowserDummyTableViewProps {
  galaxyData: any;
  userPrefs: any;
  previewImageName: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: SortField) => void;
}

export function GalaxyBrowserDummyTableView({ galaxyData }: GalaxyBrowserDummyTableViewProps) {
  if (!galaxyData) {
    return (
      <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">
        Updating results...
      </div>
    );
  }

  const dummyWidth = 3000;
  const dummyHeight = 3000;
  const imageUrl = "https://placehold.co/400";

  return (
    <div
      className="relative"
      style={{ width: `${dummyWidth}px`, height: `${dummyHeight}px` }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Dummy large image"
          className="block w-full h-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xl text-gray-500">
          No image available
        </div>
      )}
    </div>
  );
}
