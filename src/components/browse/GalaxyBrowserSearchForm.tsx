import React from "react";
import { cn } from "../../lib/utils";

interface GalaxyBrowserSearchFormProps {
  // Search state
  searchId: string;
  setSearchId: (value: string) => void;
  searchRaMin: string;
  setSearchRaMin: (value: string) => void;
  searchRaMax: string;
  setSearchRaMax: (value: string) => void;
  searchDecMin: string;
  setSearchDecMin: (value: string) => void;
  searchDecMax: string;
  setSearchDecMax: (value: string) => void;
  searchReffMin: string;
  setSearchReffMin: (value: string) => void;
  searchReffMax: string;
  setSearchReffMax: (value: string) => void;
  searchQMin: string;
  setSearchQMin: (value: string) => void;
  searchQMax: string;
  setSearchQMax: (value: string) => void;
  searchPaMin: string;
  setSearchPaMin: (value: string) => void;
  searchPaMax: string;
  setSearchPaMax: (value: string) => void;
  searchMagMin: string;
  setSearchMagMin: (value: string) => void;
  searchMagMax: string;
  setSearchMagMax: (value: string) => void;
  searchMeanMueMin: string;
  setSearchMeanMueMin: (value: string) => void;
  searchMeanMueMax: string;
  setSearchMeanMueMax: (value: string) => void;
  searchNucleus: boolean | undefined;
  setSearchNucleus: (value: boolean | undefined) => void;
  searchTotalClassificationsMin: string;
  setSearchTotalClassificationsMin: (value: string) => void;
  searchTotalClassificationsMax: string;
  setSearchTotalClassificationsMax: (value: string) => void;
  searchAwesome: boolean | undefined;
  setSearchAwesome: (value: boolean | undefined) => void;
  searchValidRedshift: boolean | undefined;
  setSearchValidRedshift: (value: boolean | undefined) => void;
  searchVisibleNucleus: boolean | undefined;
  setSearchVisibleNucleus: (value: boolean | undefined) => void;

  // Search control
  isSearchActive: boolean;
  hasPendingChanges: boolean;
  hasAnySearchValues: boolean;
  applySearch: () => void;
  clearSearch: () => void;

  // Utility functions
  getPlaceholderText: (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue', type: 'min' | 'max') => string;
  getInputClass: (field: string, baseClass: string) => string;
}

export function GalaxyBrowserSearchForm({
  searchId,
  setSearchId,
  searchRaMin,
  setSearchRaMin,
  searchRaMax,
  setSearchRaMax,
  searchDecMin,
  setSearchDecMin,
  searchDecMax,
  setSearchDecMax,
  searchReffMin,
  setSearchReffMin,
  searchReffMax,
  setSearchReffMax,
  searchQMin,
  setSearchQMin,
  searchQMax,
  setSearchQMax,
  searchPaMin,
  setSearchPaMin,
  searchPaMax,
  setSearchPaMax,
  searchMagMin,
  setSearchMagMin,
  searchMagMax,
  setSearchMagMax,
  searchMeanMueMin,
  setSearchMeanMueMin,
  searchMeanMueMax,
  setSearchMeanMueMax,
  searchNucleus,
  setSearchNucleus,
  searchTotalClassificationsMin,
  setSearchTotalClassificationsMin,
  searchTotalClassificationsMax,
  setSearchTotalClassificationsMax,
  searchAwesome,
  setSearchAwesome,
  searchValidRedshift,
  setSearchValidRedshift,
  searchVisibleNucleus,
  setSearchVisibleNucleus,
  isSearchActive,
  hasPendingChanges,
  hasAnySearchValues,
  applySearch,
  clearSearch,
  getPlaceholderText,
  getInputClass,
}: GalaxyBrowserSearchFormProps) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Search Galaxies</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1367px]:grid-cols-3 min-[1747px]:grid-cols-4 gap-3 mb-4 max-w-5xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Galaxy ID
          </label>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Exact ID"
            className={getInputClass('searchId', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            RA (degrees)
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.0001"
              value={searchRaMin}
              onChange={(e) => setSearchRaMin(e.target.value)}
              placeholder={getPlaceholderText('ra', 'min')}
              className={getInputClass('searchRaMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.0001"
              value={searchRaMax}
              onChange={(e) => setSearchRaMax(e.target.value)}
              placeholder={getPlaceholderText('ra', 'max')}
              className={getInputClass('searchRaMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Dec (degrees)
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.0001"
              value={searchDecMin}
              onChange={(e) => setSearchDecMin(e.target.value)}
              placeholder={getPlaceholderText('dec', 'min')}
              className={getInputClass('searchDecMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.0001"
              value={searchDecMax}
              onChange={(e) => setSearchDecMax(e.target.value)}
              placeholder={getPlaceholderText('dec', 'max')}
              className={getInputClass('searchDecMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Effective Radius
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.01"
              value={searchReffMin}
              onChange={(e) => setSearchReffMin(e.target.value)}
              placeholder={getPlaceholderText('reff', 'min')}
              className={getInputClass('searchReffMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              value={searchReffMax}
              onChange={(e) => setSearchReffMax(e.target.value)}
              placeholder={getPlaceholderText('reff', 'max')}
              className={getInputClass('searchReffMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Axis Ratio (q)
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.001"
              value={searchQMin}
              onChange={(e) => setSearchQMin(e.target.value)}
              placeholder={getPlaceholderText('q', 'min')}
              className={getInputClass('searchQMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.001"
              value={searchQMax}
              onChange={(e) => setSearchQMax(e.target.value)}
              placeholder={getPlaceholderText('q', 'max')}
              className={getInputClass('searchQMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Position Angle
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.1"
              value={searchPaMin}
              onChange={(e) => setSearchPaMin(e.target.value)}
              placeholder={getPlaceholderText('pa', 'min')}
              className={getInputClass('searchPaMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.1"
              value={searchPaMax}
              onChange={(e) => setSearchPaMax(e.target.value)}
              placeholder={getPlaceholderText('pa', 'max')}
              className={getInputClass('searchPaMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Magnitude
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.01"
              value={searchMagMin}
              onChange={(e) => setSearchMagMin(e.target.value)}
              placeholder={getPlaceholderText('mag', 'min')}
              className={getInputClass('searchMagMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              value={searchMagMax}
              onChange={(e) => setSearchMagMax(e.target.value)}
              placeholder={getPlaceholderText('mag', 'max')}
              className={getInputClass('searchMagMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mean Surface Brightness
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.01"
              value={searchMeanMueMin}
              onChange={(e) => setSearchMeanMueMin(e.target.value)}
              placeholder={getPlaceholderText('mean_mue', 'min')}
              className={getInputClass('searchMeanMueMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              value={searchMeanMueMax}
              onChange={(e) => setSearchMeanMueMax(e.target.value)}
              placeholder={getPlaceholderText('mean_mue', 'max')}
              className={getInputClass('searchMeanMueMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Has Nucleus
          </label>
          <select
            value={searchNucleus === undefined ? "" : searchNucleus ? "true" : "false"}
            onChange={(e) => {
              const value = e.target.value;
              setSearchNucleus(value === "" ? undefined : value === "true" ? true : false);
            }}
            className={getInputClass('searchNucleus', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
          >
            <option value="">Any</option>
            <option value="true">Has nucleus</option>
            <option value="false">No nucleus</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Classifications
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="1"
              min="0"
              value={searchTotalClassificationsMin}
              onChange={(e) => setSearchTotalClassificationsMin(e.target.value)}
              placeholder="Min"
              className={getInputClass('searchTotalClassificationsMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="1"
              min="0"
              value={searchTotalClassificationsMax}
              onChange={(e) => setSearchTotalClassificationsMax(e.target.value)}
              placeholder="Max"
              className={getInputClass('searchTotalClassificationsMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Visible Nucleus
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={searchVisibleNucleus === true}
              onChange={(e) => setSearchVisibleNucleus(e.target.checked ? true : undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">Only show galaxies with visible nucleus</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Awesome Flag
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={searchAwesome === true}
              onChange={(e) => setSearchAwesome(e.target.checked ? true : undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 mr-2"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">Only show awesome galaxies</span>
          </label>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={applySearch}
          disabled={!hasPendingChanges && isSearchActive && !hasAnySearchValues}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-colors",
            hasPendingChanges || (!isSearchActive && hasAnySearchValues)
              ? "bg-orange-600 hover:bg-orange-700 text-white"
              : isSearchActive
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {hasPendingChanges || (!isSearchActive && hasAnySearchValues) ? "Apply Search" : isSearchActive ? "Search Active" : "Search"}
        </button>
        <button
          onClick={clearSearch}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Clear Search
        </button>
        {isSearchActive && (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Search active
          </span>
        )}
      </div>
    </div>
  );
}