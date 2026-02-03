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
  statusText: string;
  
  // Total count computation
  onComputeTotal?: () => void;
  isComputingTotal?: boolean;
  computedTotal?: number | null;
    accumulatedCount?: number;
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
  statusText,
  onComputeTotal,
  isComputingTotal = false,
  computedTotal = null,
    accumulatedCount = 0,
}: GalaxyBrowserControlsProps) {
  const { total } = galaxyData || {};

  return (
    <div className="border-gray-200 dark:border-gray-700">
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
            <option value="totalClassifications">Total Classifications</option>
            <option value="numVisibleNucleus">Visible Nuclei</option>
            <option value="numAwesomeFlag">Awesome Flags</option>
            <option value="numFailedFitting">Failed Fittings</option>
            <option value="totalAssigned">Total Assigned</option>
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
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Cursor Pagination */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          {onComputeTotal && (
            <button
              onClick={onComputeTotal}
              disabled={isComputingTotal}
              className="px-3 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              title="Count all galaxies matching current filters"
            >
              {isComputingTotal ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                    <span>{accumulatedCount > 0 ? `Counted ${accumulatedCount}...` : 'Counting...'}</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Compute Total</span>
                </>
              )}
            </button>
          )}
          {onComputeTotal && (isComputingTotal || computedTotal !== null) && (
            <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {isComputingTotal
                ? accumulatedCount > 0
                  ? `Counted ${accumulatedCount}...`
                  : 'Counting...'
                : `Total ${computedTotal}`}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300 text-left sm:text-right">
          <div>Page {page}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {statusText}
          </div>
        </div>
      </div>
    </div>
  );
}