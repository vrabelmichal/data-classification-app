import React from "react";
import { cn } from "../../lib/utils";

type BoundsField = 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'numFailedFitting' | 'totalAssigned';

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
  searchNumFailedFittingMin: string;
  setSearchNumFailedFittingMin: (value: string) => void;
  searchNumFailedFittingMax: string;
  setSearchNumFailedFittingMax: (value: string) => void;
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
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
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
  searchNumFailedFittingMin,
  setSearchNumFailedFittingMin,
  searchNumFailedFittingMax,
  setSearchNumFailedFittingMax,
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
  isCollapsed,
  onToggleCollapsed,
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
    numFailedFitting: getBounds('numFailedFitting'),
    totalAssigned: getBounds('totalAssigned'),
  };

  // User-assigned flags with counts (Yes = 1+, No = 0)
  const userFlagFilters = [
    {
      key: 'searchAwesome',
      label: 'Awesome flagged',
      helper: '',
      // Derive toggle value from count ranges
      get value(): boolean | undefined {
        if (searchNumAwesomeFlagMin === '' && searchNumAwesomeFlagMax === '') return undefined;
        if (searchNumAwesomeFlagMin === '1' && searchNumAwesomeFlagMax === '') return true;
        if (searchNumAwesomeFlagMin === '' && searchNumAwesomeFlagMax === '0') return false;
        return undefined; // custom range
      },
      setter: setSearchAwesome,
      count: {
        minValue: searchNumAwesomeFlagMin,
        maxValue: searchNumAwesomeFlagMax,
        setMin: setSearchNumAwesomeFlagMin,
        setMax: setSearchNumAwesomeFlagMax,
        bounds: bounds.numAwesomeFlag,
        minKey: 'searchNumAwesomeFlagMin',
        maxKey: 'searchNumAwesomeFlagMax',
      },
    },
    {
      key: 'searchVisibleNucleus',
      label: 'Visible nucleus flag',
      helper: '',
      // Derive toggle value from count ranges
      get value(): boolean | undefined {
        if (searchNumVisibleNucleusMin === '' && searchNumVisibleNucleusMax === '') return undefined;
        if (searchNumVisibleNucleusMin === '1' && searchNumVisibleNucleusMax === '') return true;
        if (searchNumVisibleNucleusMin === '' && searchNumVisibleNucleusMax === '0') return false;
        return undefined; // custom range
      },
      setter: setSearchVisibleNucleus,
      count: {
        minValue: searchNumVisibleNucleusMin,
        maxValue: searchNumVisibleNucleusMax,
        setMin: setSearchNumVisibleNucleusMin,
        setMax: setSearchNumVisibleNucleusMax,
        bounds: bounds.numVisibleNucleus,
        minKey: 'searchNumVisibleNucleusMin',
        maxKey: 'searchNumVisibleNucleusMax',
      },
    },
    {
      key: 'searchFailedFitting',
      label: 'Failed fitting',
      helper: '',
      // Derive toggle value from count ranges
      get value(): boolean | undefined {
        if (searchNumFailedFittingMin === '' && searchNumFailedFittingMax === '') return undefined;
        if (searchNumFailedFittingMin === '1' && searchNumFailedFittingMax === '') return true;
        if (searchNumFailedFittingMin === '' && searchNumFailedFittingMax === '0') return false;
        return undefined; // custom range
      },
      setter: (val: boolean | undefined) => {
        if (val === undefined) {
          setSearchNumFailedFittingMin('');
          setSearchNumFailedFittingMax('');
        } else if (val) {
          setSearchNumFailedFittingMin('1');
          setSearchNumFailedFittingMax('');
        } else {
          setSearchNumFailedFittingMin('');
          setSearchNumFailedFittingMax('0');
        }
      },
      count: {
        minValue: searchNumFailedFittingMin,
        maxValue: searchNumFailedFittingMax,
        setMin: setSearchNumFailedFittingMin,
        setMax: setSearchNumFailedFittingMax,
        bounds: bounds.numFailedFitting,
        minKey: 'searchNumFailedFittingMin',
        maxKey: 'searchNumFailedFittingMax',
      },
    },
    {
      key: 'searchValidRedshift',
      label: 'Valid redshift',
      helper: '',
      value: searchValidRedshift,
      setter: setSearchValidRedshift,
    },
  ];

  // System counts (with Any/Yes/No toggles)
  const systemCounts = [
    {
      key: 'totalClassifications' as BoundsField,
      label: 'Total Classifications',
      minValue: searchTotalClassificationsMin,
      maxValue: searchTotalClassificationsMax,
      setMin: setSearchTotalClassificationsMin,
      setMax: setSearchTotalClassificationsMax,
      bounds: bounds.totalClassifications,
      minKey: 'searchTotalClassificationsMin',
      maxKey: 'searchTotalClassificationsMax',
      // Derive toggle state from range values
      get toggleValue(): boolean | undefined {
        if (searchTotalClassificationsMin === '' && searchTotalClassificationsMax === '') return undefined;
        if (searchTotalClassificationsMin === '1' && searchTotalClassificationsMax === '') return true;
        if (searchTotalClassificationsMin === '' && searchTotalClassificationsMax === '0') return false;
        return undefined; // custom range
      },
    },
    {
      key: 'totalAssigned' as BoundsField,
      label: 'Total Assigned',
      minValue: searchTotalAssignedMin,
      maxValue: searchTotalAssignedMax,
      setMin: setSearchTotalAssignedMin,
      setMax: setSearchTotalAssignedMax,
      bounds: bounds.totalAssigned,
      minKey: 'searchTotalAssignedMin',
      maxKey: 'searchTotalAssignedMax',
      // Derive toggle state from range values
      get toggleValue(): boolean | undefined {
        if (searchTotalAssignedMin === '' && searchTotalAssignedMax === '') return undefined;
        if (searchTotalAssignedMin === '1' && searchTotalAssignedMax === '') return true;
        if (searchTotalAssignedMin === '' && searchTotalAssignedMax === '0') return false;
        return undefined; // custom range
      },
    },
  ];

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!isCollapsed}
        className={cn(
          "w-full flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg border transition-colors",
          "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700"
        )}
      >
        <div className="flex items-center gap-2 text-left">
            <span className="flex items-center">
              <svg
              className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
              >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35m1.85-4.65a7 7 0 11-14 0 7 7 0 0114 0z"
              />
              </svg>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Search Galaxies</span>
            </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Click to {isCollapsed ? "show" : "hide"} filters</span>
        </div>
        <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {isCollapsed ? "+" : "−"}
        </span>
      </button>
      {!isCollapsed && (
        <div className="space-y-4 mb-4">
        {/* SECTION 1: Galaxy Properties */}
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800/60 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Galaxy Properties</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Catalog metadata</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {/* Galaxy ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* RA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Dec */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Effective Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Axis Ratio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Position Angle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Magnitude */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Mean Surface Brightness */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
            {/* Has nucleus */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Has Nucleus
              </label>
              <div className="flex gap-2">
                {[{ label: 'Any', value: undefined }, { label: 'Yes', value: true }, { label: 'No', value: false }].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setSearchNucleus(option.value)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
                      searchNucleus === option.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: User-Assigned Flags (with counts) */}
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800/60 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">User-Assigned Flags</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Reviewer checkboxes • Yes = 1+, No = 0</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {userFlagFilters.map((filter) => (
              <div key={filter.key} className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{filter.label}</div>
                  <div className="flex gap-2">
                    {[{ label: 'Any', value: undefined }, { label: 'Yes', value: true }, { label: 'No', value: false }].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          // Yes => min=1, No => max=0, Any => clear
                          if (filter.count) {
                            if (option.value === undefined) {
                              filter.count.setMin('');
                              filter.count.setMax('');
                            } else if (option.value) {
                              filter.count.setMin('1');
                              filter.count.setMax('');
                            } else {
                              filter.count.setMin('');
                              filter.count.setMax('0');
                            }
                          }
                          filter.setter(option.value as boolean | undefined);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
                          filter.value === option.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {filter.count && (
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="1"
                        min={filter.count.bounds?.min ?? 0}
                        max={filter.count.bounds?.max}
                        value={filter.count.minValue}
                        onChange={(e) => filter.count?.setMin(e.target.value)}
                        placeholder="Min"
                        className={getInputClass(filter.count.minKey, "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                      />
                      <input
                        type="number"
                        step="1"
                        min={filter.count.bounds?.min ?? 0}
                        max={filter.count.bounds?.max}
                        value={filter.count.maxValue}
                        onChange={(e) => filter.count?.setMax(e.target.value)}
                        placeholder="Max"
                        className={getInputClass(filter.count.maxKey, "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                      />
                    </div>
                    {filter.helper && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{filter.helper}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: System Counts */}
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-gray-800 dark:to-gray-800/60 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">System Counts</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Activity totals • Yes = 1+, No = 0</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {systemCounts.map((filter) => (
              <div key={filter.key} className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{filter.label}</div>
                  <div className="flex gap-2">
                    {[{ label: 'Any', value: undefined }, { label: 'Yes', value: true }, { label: 'No', value: false }].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          // Yes => min=1, No => max=0, Any => clear
                          if (option.value === undefined) {
                            filter.setMin('');
                            filter.setMax('');
                          } else if (option.value) {
                            filter.setMin('1');
                            filter.setMax('');
                          } else {
                            filter.setMin('');
                            filter.setMax('0');
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
                          filter.toggleValue === option.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      min={filter.bounds?.min ?? 0}
                      max={filter.bounds?.max}
                      value={filter.minValue}
                      onChange={(e) => filter.setMin(e.target.value)}
                      placeholder="Min"
                      className={getInputClass(filter.minKey, "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                    />
                    <input
                      type="number"
                      step="1"
                      min={filter.bounds?.min ?? 0}
                      max={filter.bounds?.max}
                      value={filter.maxValue}
                      onChange={(e) => filter.setMax(e.target.value)}
                      placeholder="Max"
                      className={getInputClass(filter.maxKey, "flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
      {!isCollapsed && (
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
      )}
    </div>
  );
}