import { useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { SortField, SortOrder, FilterType } from "./GalaxyBrowser";
import { DEFAULT_USER_EXPORT_LIMIT } from "../../lib/defaults";

// Inline SVG Icons
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface GalaxyExportProps {
  // Current filters and search params
  filter: FilterType;
  sortBy: SortField;
  sortOrder: SortOrder;
  isSearchActive: boolean;
  searchId?: string;
  searchRaMin?: string;
  searchRaMax?: string;
  searchDecMin?: string;
  searchDecMax?: string;
  searchReffMin?: string;
  searchReffMax?: string;
  searchQMin?: string;
  searchQMax?: string;
  searchPaMin?: string;
  searchPaMax?: string;
  searchMagMin?: string;
  searchMagMax?: string;
  searchMeanMueMin?: string;
  searchMeanMueMax?: string;
  searchNucleus?: boolean;
  searchTotalClassificationsMin?: string;
  searchTotalClassificationsMax?: string;
  searchNumVisibleNucleusMin?: string;
  searchNumVisibleNucleusMax?: string;
  searchNumAwesomeFlagMin?: string;
  searchNumAwesomeFlagMax?: string;
  searchNumFailedFittingMin?: string;
  searchNumFailedFittingMax?: string;
  searchTotalAssignedMin?: string;
  searchTotalAssignedMax?: string;
  searchAwesome?: boolean;
  searchValidRedshift?: boolean;
  searchVisibleNucleus?: boolean;
  // Current page info
  currentPageGalaxies?: any[];
  pageSize: number;
  page: number;
  isAdmin: boolean;
}

type ExportMode = "current_page" | "all" | "custom";

interface ExportState {
  isExporting: boolean;
  exportMode: ExportMode;
  customLimit: number;
  customOffset: number;
  progress: number;
  totalFetched: number;
  galaxiesCollected: any[];
  cursor: string | null;
  error: string | null;
}

const CSV_HEADERS = [
  "id",
  "numericId", 
  "ra",
  "dec",
  "reff",
  "q",
  "pa",
  "mag",
  "mean_mue",
  "nucleus",
  "totalClassifications",
  "numVisibleNucleus",
  "numAwesomeFlag",
  "numFailedFitting",
  "totalAssigned",
];

function convertToCSV(galaxies: any[]): string {
  const header = CSV_HEADERS.join(",");
  const rows = galaxies.map((g) =>
    CSV_HEADERS.map((h) => {
      const value = g[h];
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function GalaxyExport({
  filter,
  sortBy,
  sortOrder,
  isSearchActive,
  searchId,
  searchRaMin,
  searchRaMax,
  searchDecMin,
  searchDecMax,
  searchReffMin,
  searchReffMax,
  searchQMin,
  searchQMax,
  searchPaMin,
  searchPaMax,
  searchMagMin,
  searchMagMax,
  searchMeanMueMin,
  searchMeanMueMax,
  searchNucleus,
  searchTotalClassificationsMin,
  searchTotalClassificationsMax,
  searchNumVisibleNucleusMin,
  searchNumVisibleNucleusMax,
  searchNumAwesomeFlagMin,
  searchNumAwesomeFlagMax,
  searchNumFailedFittingMin,
  searchNumFailedFittingMax,
  searchTotalAssignedMin,
  searchTotalAssignedMax,
  searchAwesome,
  searchValidRedshift,
  searchVisibleNucleus,
  currentPageGalaxies,
  pageSize,
  page,
  isAdmin,
}: GalaxyExportProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    exportMode: "current_page",
    customLimit: 100,
    customOffset: 0,
    progress: 0,
    totalFetched: 0,
    galaxiesCollected: [],
    cursor: null,
    error: null,
  });

  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const userExportLimitRaw = systemSettings?.userExportLimit;
  const userExportLimit = typeof userExportLimitRaw === "number" ? userExportLimitRaw : DEFAULT_USER_EXPORT_LIMIT;

  // Don't show export UI if limit is 0 for non-admins
  if (!isAdmin && userExportLimit === 0) {
    return null;
  }

  const effectiveLimit = isAdmin ? undefined : userExportLimit;

  // Query for batch export - only active when exporting and not current page mode
  const exportBatchResult = useQuery(
    api.galaxies.export.exportGalaxiesBatch,
    exportState.isExporting && exportState.exportMode !== "current_page"
      ? {
          cursor: exportState.cursor ?? undefined,
          batchSize: 500,
          sortBy,
          sortOrder,
          filter,
          searchId: isSearchActive ? searchId : undefined,
          searchRaMin: isSearchActive ? searchRaMin : undefined,
          searchRaMax: isSearchActive ? searchRaMax : undefined,
          searchDecMin: isSearchActive ? searchDecMin : undefined,
          searchDecMax: isSearchActive ? searchDecMax : undefined,
          searchReffMin: isSearchActive ? searchReffMin : undefined,
          searchReffMax: isSearchActive ? searchReffMax : undefined,
          searchQMin: isSearchActive ? searchQMin : undefined,
          searchQMax: isSearchActive ? searchQMax : undefined,
          searchPaMin: isSearchActive ? searchPaMin : undefined,
          searchPaMax: isSearchActive ? searchPaMax : undefined,
          searchMagMin: isSearchActive ? searchMagMin : undefined,
          searchMagMax: isSearchActive ? searchMagMax : undefined,
          searchMeanMueMin: isSearchActive ? searchMeanMueMin : undefined,
          searchMeanMueMax: isSearchActive ? searchMeanMueMax : undefined,
          searchNucleus: isSearchActive ? searchNucleus : undefined,
          searchTotalClassificationsMin: isSearchActive ? searchTotalClassificationsMin : undefined,
          searchTotalClassificationsMax: isSearchActive ? searchTotalClassificationsMax : undefined,
          searchNumVisibleNucleusMin: isSearchActive ? searchNumVisibleNucleusMin : undefined,
          searchNumVisibleNucleusMax: isSearchActive ? searchNumVisibleNucleusMax : undefined,
          searchNumAwesomeFlagMin: isSearchActive ? searchNumAwesomeFlagMin : undefined,
          searchNumAwesomeFlagMax: isSearchActive ? searchNumAwesomeFlagMax : undefined,
          searchNumFailedFittingMin: isSearchActive ? searchNumFailedFittingMin : undefined,
          searchNumFailedFittingMax: isSearchActive ? searchNumFailedFittingMax : undefined,
          searchTotalAssignedMin: isSearchActive ? searchTotalAssignedMin : undefined,
          searchTotalAssignedMax: isSearchActive ? searchTotalAssignedMax : undefined,
          searchAwesome: isSearchActive ? searchAwesome : undefined,
          searchValidRedshift: isSearchActive ? searchValidRedshift : undefined,
          searchVisibleNucleus: isSearchActive ? searchVisibleNucleus : undefined,
          offset: exportState.exportMode === "custom" ? exportState.customOffset : undefined,
          totalExportedSoFar: exportState.totalFetched,
          maxExportLimit: exportState.exportMode === "custom" ? exportState.customLimit : effectiveLimit,
        }
      : "skip"
  );

  // Process batch results
  useEffect(() => {
    if (!exportState.isExporting || exportState.exportMode === "current_page") return;
    if (!exportBatchResult) return;

    if (exportBatchResult.error) {
      setExportState((prev) => ({
        ...prev,
        isExporting: false,
        error: exportBatchResult.error ?? "Unknown error",
      }));
      return;
    }

    // Backend already handles offset, just accumulate results
    const newGalaxies = [...exportState.galaxiesCollected, ...exportBatchResult.galaxies];
    const newTotalFetched = exportState.totalFetched + exportBatchResult.galaxies.length;

    // Calculate progress
    const maxToFetch = exportState.exportMode === "custom" ? exportState.customLimit : effectiveLimit;
    const cappedTotalFetched = maxToFetch ? Math.min(newTotalFetched, maxToFetch) : newTotalFetched;
    const cappedGalaxies = maxToFetch ? newGalaxies.slice(0, maxToFetch) : newGalaxies;
    const progress = maxToFetch ? Math.min(100, (cappedTotalFetched / maxToFetch) * 100) : 0;

    if (exportBatchResult.isDone || exportBatchResult.limitReached || (maxToFetch !== undefined && cappedTotalFetched >= maxToFetch)) {
      // Export complete - generate CSV and download
      const csv = convertToCSV(cappedGalaxies);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadCSV(csv, `galaxies_export_${timestamp}.csv`);
      
      setExportState((prev) => ({
        ...prev,
        isExporting: false,
        progress: 100,
        totalFetched: cappedTotalFetched,
        galaxiesCollected: [],
        cursor: null,
      }));
    } else {
      // Continue fetching
      setExportState((prev) => ({
        ...prev,
        galaxiesCollected: cappedGalaxies,
        totalFetched: cappedTotalFetched,
        cursor: exportBatchResult.cursor,
        progress,
      }));
    }
  }, [exportBatchResult, exportState.isExporting, exportState.exportMode, exportState.galaxiesCollected, exportState.totalFetched, effectiveLimit, exportState.customLimit]);

  const handleExportCurrentPage = useCallback(() => {
    if (!currentPageGalaxies || currentPageGalaxies.length === 0) return;
    
    const csv = convertToCSV(currentPageGalaxies);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadCSV(csv, `galaxies_page_${page}_${timestamp}.csv`);
  }, [currentPageGalaxies, page]);

  const handleStartExport = useCallback(() => {
    if (exportState.exportMode === "current_page") {
      handleExportCurrentPage();
      return;
    }

    // Validate custom limit for non-admins
    if (!isAdmin && exportState.exportMode === "custom" && exportState.customLimit > userExportLimit) {
      setExportState((prev) => ({
        ...prev,
        error: `Maximum export limit is ${userExportLimit} entries`,
      }));
      return;
    }

    setExportState((prev) => ({
      ...prev,
      isExporting: true,
      progress: 0,
      totalFetched: 0,
      galaxiesCollected: [],
      cursor: null,
      error: null,
    }));
  }, [exportState.exportMode, exportState.customLimit, handleExportCurrentPage, isAdmin, userExportLimit]);

  const handleCancelExport = useCallback(() => {
    setExportState((prev) => ({
      ...prev,
      isExporting: false,
      progress: 0,
      totalFetched: 0,
      galaxiesCollected: [],
      cursor: null,
    }));
  }, []);

  return (
    <div className="mt-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <DownloadIcon className="w-4 h-4" />
          <span>Export Data</span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4" />
        ) : (
          <ChevronDownIcon className="w-4 h-4" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Export mode selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Export Options
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="exportMode"
                  value="current_page"
                  checked={exportState.exportMode === "current_page"}
                  onChange={() =>
                    setExportState((prev) => ({ ...prev, exportMode: "current_page", error: null }))
                  }
                  disabled={exportState.isExporting}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Current page ({currentPageGalaxies?.length ?? 0} entries)
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="exportMode"
                  value="all"
                  checked={exportState.exportMode === "all"}
                  onChange={() =>
                    setExportState((prev) => ({ ...prev, exportMode: "all", error: null }))
                  }
                  disabled={exportState.isExporting}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  All matching data
                  {!isAdmin && effectiveLimit && (
                    <span className="text-gray-500"> (max {effectiveLimit.toLocaleString()})</span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="exportMode"
                  value="custom"
                  checked={exportState.exportMode === "custom"}
                  onChange={() =>
                    setExportState((prev) => ({ ...prev, exportMode: "custom", error: null }))
                  }
                  disabled={exportState.isExporting}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Custom range</span>
              </label>
            </div>
          </div>

          {/* Custom range inputs */}
          {exportState.exportMode === "custom" && (
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Offset (skip first N entries)
                </label>
                <input
                  type="number"
                  min="0"
                  value={exportState.customOffset}
                  onChange={(e) =>
                    setExportState((prev) => ({
                      ...prev,
                      customOffset: Math.max(0, parseInt(e.target.value) || 0),
                      error: null,
                    }))
                  }
                  disabled={exportState.isExporting}
                  className="w-32 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Limit (max entries)
                </label>
                <input
                  type="number"
                  min="1"
                  max={isAdmin ? undefined : userExportLimit}
                  value={exportState.customLimit}
                  onChange={(e) =>
                    setExportState((prev) => ({
                      ...prev,
                      customLimit: Math.max(1, parseInt(e.target.value) || 1),
                      error: null,
                    }))
                  }
                  disabled={exportState.isExporting}
                  className="w-32 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {!isAdmin && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maximum allowed: {userExportLimit.toLocaleString()} entries
                </p>
              )}
            </div>
          )}

          {/* Limit info for non-admins */}
          {!isAdmin && exportState.exportMode !== "current_page" && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md">
              ⚠️ Regular users can export up to {userExportLimit.toLocaleString()} entries at once.
              Contact an administrator if you need to export more data.
            </div>
          )}

          {/* Error message */}
          {exportState.error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
              {exportState.error}
            </div>
          )}

          {/* Progress bar */}
          {exportState.isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Preparing export... {exportState.totalFetched.toLocaleString()} entries fetched
                </span>
                <button
                  onClick={handleCancelExport}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
              {exportState.exportMode === "all" && !effectiveLimit && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Progress may not be accurate when exporting all data without a limit.
                </p>
              )}
            </div>
          )}

          {/* Export button */}
          {!exportState.isExporting && (
            <button
              onClick={handleStartExport}
              disabled={exportState.exportMode === "current_page" && (!currentPageGalaxies || currentPageGalaxies.length === 0)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              Export to CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}
