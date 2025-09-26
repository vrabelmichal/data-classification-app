import React from "react";
import type { SortField, SortOrder, FilterType } from "./GalaxyBrowser";

interface GalaxyBrowserControlsProps {
  // Filter and sort state
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  sortBy: SortField;
  setSortBy: (field: SortField) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  pageSize: number;
  setPageSize: (size: number) => void;

  // Pagination state
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;

  // Data
  galaxyData: any;
}

export function GalaxyBrowserControls({
  filter,
  setFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  pageSize,
  setPageSize,
  page,
  hasPrevious,
  hasNext,
  goPrev,
  goNext,
  galaxyData,
}: GalaxyBrowserControlsProps) {
  const { total } = galaxyData || {};

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Galaxies</option>
            <option value="my_sequence">My Sequence</option>
            <option value="classified">Classified by Me</option>
            <option value="unclassified">Unclassified by Me</option>
            <option value="skipped">Skipped by Me</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="numericId">#</option>
            <option value="id">Galaxy ID</option>
            <option value="ra">Right Ascension</option>
            <option value="dec">Declination</option>
            <option value="reff">Effective Radius</option>
            <option value="q">Axis Ratio</option>
            <option value="pa">Position Angle</option>
            <option value="mag">Magnitude</option>
            <option value="mean_mue">Mean Surface Brightness</option>
            <option value="nucleus">Nucleus</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Order
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {/* Page Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Per Page
          </label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Cursor Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={goPrev}
            disabled={!hasPrevious}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={!hasNext}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">Page {page}</div>
      </div>
    </div>
  );
}