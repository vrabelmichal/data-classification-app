import React from "react";
import { cn } from "../../lib/utils";

type BoundsField = 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'totalAssigned';

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
  searchNumVisibleNucleusMin: string;
  setSearchNumVisibleNucleusMin: (value: string) => void;
  searchNumVisibleNucleusMax: string;
  setSearchNumVisibleNucleusMax: (value: string) => void;
  searchNumAwesomeFlagMin: string;
  setSearchNumAwesomeFlagMin: (value: string) => void;
  searchNumAwesomeFlagMax: string;
  setSearchNumAwesomeFlagMax: (value: string) => void;
  searchTotalAssignedMin: string;
  setSearchTotalAssignedMin: (value: string) => void;
  searchTotalAssignedMax: string;
  setSearchTotalAssignedMax: (value: string) => void;
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
  getPlaceholderText: (field: BoundsField, type: 'min' | 'max') => string;
  getBounds: (field: BoundsField) => { min?: number; max?: number } | undefined;
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
  searchNumVisibleNucleusMin,
  setSearchNumVisibleNucleusMin,
  searchNumVisibleNucleusMax,
  setSearchNumVisibleNucleusMax,
  searchNumAwesomeFlagMin,
  setSearchNumAwesomeFlagMin,
  searchNumAwesomeFlagMax,
  setSearchNumAwesomeFlagMax,
  searchTotalAssignedMin,
  setSearchTotalAssignedMin,
  searchTotalAssignedMax,
  setSearchTotalAssignedMax,
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
  getBounds,
  getInputClass,
}: GalaxyBrowserSearchFormProps) {
  const bounds = {
    ra: getBounds('ra'),
    dec: getBounds('dec'),
    reff: getBounds('reff'),
    q: getBounds('q'),
    pa: getBounds('pa'),
    mag: getBounds('mag'),
    mean_mue: getBounds('mean_mue'),
    totalClassifications: getBounds('totalClassifications'),
    numVisibleNucleus: getBounds('numVisibleNucleus'),
    numAwesomeFlag: getBounds('numAwesomeFlag'),
    totalAssigned: getBounds('totalAssigned'),
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Search Galaxies</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 mb-4 max-w-5xl">
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
              min={bounds.ra?.min}
              max={bounds.ra?.max}
              value={searchRaMin}
              onChange={(e) => setSearchRaMin(e.target.value)}
              placeholder={getPlaceholderText('ra', 'min')}
              className={getInputClass('searchRaMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.0001"
              min={bounds.ra?.min}
              max={bounds.ra?.max}
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
              min={bounds.dec?.min}
              max={bounds.dec?.max}
              value={searchDecMin}
              onChange={(e) => setSearchDecMin(e.target.value)}
              placeholder={getPlaceholderText('dec', 'min')}
              className={getInputClass('searchDecMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.0001"
              min={bounds.dec?.min}
              max={bounds.dec?.max}
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
              min={bounds.reff?.min}
              max={bounds.reff?.max}
              value={searchReffMin}
              onChange={(e) => setSearchReffMin(e.target.value)}
              placeholder={getPlaceholderText('reff', 'min')}
              className={getInputClass('searchReffMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              min={bounds.reff?.min}
              max={bounds.reff?.max}
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
              min={bounds.q?.min}
              max={bounds.q?.max}
              value={searchQMin}
              onChange={(e) => setSearchQMin(e.target.value)}
              placeholder={getPlaceholderText('q', 'min')}
              className={getInputClass('searchQMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.001"
              min={bounds.q?.min}
              max={bounds.q?.max}
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
              min={bounds.pa?.min}
              max={bounds.pa?.max}
              value={searchPaMin}
              onChange={(e) => setSearchPaMin(e.target.value)}
              placeholder={getPlaceholderText('pa', 'min')}
              className={getInputClass('searchPaMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.1"
              min={bounds.pa?.min}
              max={bounds.pa?.max}
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
              min={bounds.mag?.min}
              max={bounds.mag?.max}
              value={searchMagMin}
              onChange={(e) => setSearchMagMin(e.target.value)}
              placeholder={getPlaceholderText('mag', 'min')}
              className={getInputClass('searchMagMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              min={bounds.mag?.min}
              max={bounds.mag?.max}
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
              min={bounds.mean_mue?.min}
              max={bounds.mean_mue?.max}
              value={searchMeanMueMin}
              onChange={(e) => setSearchMeanMueMin(e.target.value)}
              placeholder={getPlaceholderText('mean_mue', 'min')}
              className={getInputClass('searchMeanMueMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
            />
            <input
              type="number"
              step="0.01"
              min={bounds.mean_mue?.min}
              max={bounds.mean_mue?.max}
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
        {/* Group these related numeric filters into a single responsive row on larger screens */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 2xl:col-span-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total Classifications
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="1"
                  min={bounds.totalClassifications?.min ?? 0}
                  max={bounds.totalClassifications?.max}
                  value={searchTotalClassificationsMin}
                  onChange={(e) => setSearchTotalClassificationsMin(e.target.value)}
                  placeholder={getPlaceholderText('totalClassifications', 'min')}
                  className={getInputClass('searchTotalClassificationsMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
                <input
                  type="number"
                  step="1"
                  min={bounds.totalClassifications?.min ?? 0}
                  max={bounds.totalClassifications?.max}
                  value={searchTotalClassificationsMax}
                  onChange={(e) => setSearchTotalClassificationsMax(e.target.value)}
                  placeholder={getPlaceholderText('totalClassifications', 'max')}
                  className={getInputClass('searchTotalClassificationsMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visible Nucleus Count
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="1"
                  min={bounds.numVisibleNucleus?.min ?? 0}
                  max={bounds.numVisibleNucleus?.max}
                  value={searchNumVisibleNucleusMin}
                  onChange={(e) => setSearchNumVisibleNucleusMin(e.target.value)}
                  placeholder={getPlaceholderText('numVisibleNucleus', 'min')}
                  className={getInputClass('searchNumVisibleNucleusMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
                <input
                  type="number"
                  step="1"
                  min={bounds.numVisibleNucleus?.min ?? 0}
                  max={bounds.numVisibleNucleus?.max}
                  value={searchNumVisibleNucleusMax}
                  onChange={(e) => setSearchNumVisibleNucleusMax(e.target.value)}
                  placeholder={getPlaceholderText('numVisibleNucleus', 'max')}
                  className={getInputClass('searchNumVisibleNucleusMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Awesome Flag Count
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="1"
                  min={bounds.numAwesomeFlag?.min ?? 0}
                  max={bounds.numAwesomeFlag?.max}
                  value={searchNumAwesomeFlagMin}
                  onChange={(e) => setSearchNumAwesomeFlagMin(e.target.value)}
                  placeholder={getPlaceholderText('numAwesomeFlag', 'min')}
                  className={getInputClass('searchNumAwesomeFlagMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
                <input
                  type="number"
                  step="1"
                  min={bounds.numAwesomeFlag?.min ?? 0}
                  max={bounds.numAwesomeFlag?.max}
                  value={searchNumAwesomeFlagMax}
                  onChange={(e) => setSearchNumAwesomeFlagMax(e.target.value)}
                  placeholder={getPlaceholderText('numAwesomeFlag', 'max')}
                  className={getInputClass('searchNumAwesomeFlagMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total Assigned
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="1"
                  min={bounds.totalAssigned?.min ?? 0}
                  max={bounds.totalAssigned?.max}
                  value={searchTotalAssignedMin}
                  onChange={(e) => setSearchTotalAssignedMin(e.target.value)}
                  placeholder={getPlaceholderText('totalAssigned', 'min')}
                  className={getInputClass('searchTotalAssignedMin', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
                <input
                  type="number"
                  step="1"
                  min={bounds.totalAssigned?.min ?? 0}
                  max={bounds.totalAssigned?.max}
                  value={searchTotalAssignedMax}
                  onChange={(e) => setSearchTotalAssignedMax(e.target.value)}
                  placeholder={getPlaceholderText('totalAssigned', 'max')}
                  className={getInputClass('searchTotalAssignedMax', "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                />
              </div>
            </div>
          </div>
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