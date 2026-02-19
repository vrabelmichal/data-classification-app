import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useGalaxyBrowser } from "./useGalaxyBrowser";
import { GalaxyBrowserSearchForm } from "./GalaxyBrowserSearchForm";
import { GalaxyBrowserControls } from "./GalaxyBrowserControls";
import { GalaxyBrowserLightTableView } from "./GalaxyBrowserLightTableView";
import { GalaxyBrowserMobileCards } from "./GalaxyBrowserMobileCards";
import { GalaxyExport } from "./GalaxyExport";
import { GalaxyQuickReview, type GalaxyQuickReviewFilters } from "./GalaxyQuickReview";
// Cursor-based pagination handled in controls; standalone pagination removed

export type SortField =
  | "id"
  | "ra"
  | "dec"
  | "reff"
  | "q"
  | "pa"
  | "mag"
  | "mean_mue"
  | "nucleus"
  | "numericId"
  | "totalClassifications"
  | "numVisibleNucleus"
  | "numAwesomeFlag"
  | "numFailedFitting"
  | "totalAssigned";
export type SortOrder = "asc" | "desc";
export type FilterType = "all" | "my_sequence" | "classified" | "unclassified" | "skipped";

export function GalaxyBrowser() {
  usePageTitle("Browse Galaxies");

  // Load system settings to determine which fields to show
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const showAwesomeFlag = systemSettings?.showAwesomeFlag !== false;
  const showValidRedshift = systemSettings?.showValidRedshift !== false;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus !== false;

  // Get user profile to check admin status for export
  const userProfile = useQuery(api.users.getUserProfile);
  const isAdmin = userProfile?.role === "admin";

  const {
    // State
    page,
    hasPrevious,
    hasNext,

    // Queries
    galaxyData,
    userPrefs,
    effectiveImageQuality,

    // Computed values
    previewImageName,

    // Handlers
    handleSort,
    goPrev,
    goNext,
    goFirst,

    // Search form props
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
    getBoundsForField,
    getInputClass,

    // Controls props
    filter,
    setFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    pageSize,
    setPageSize,
    isSearchFormCollapsed,
    setIsSearchFormCollapsed,
    // cursor-based navigation handled in controls
  } = useGalaxyBrowser();

  const hasResults = (galaxyData?.galaxies?.length ?? 0) > 0;
  const startIndex = hasResults ? ((page - 1) * pageSize) + 1 : 0;
  const endIndex = hasResults && galaxyData?.galaxies
    ? ((page - 1) * pageSize) + galaxyData.galaxies.length
    : 0;
  const statusText = galaxyData
    ? (hasResults
      ? `Showing ${startIndex} to ${endIndex}`
      : "No galaxies match your filters.")
    : "Loading results...";

  // Quick review mode
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [lastViewedGalaxyId, setLastViewedGalaxyId] = useState<string | null>(null);
  const [lastReviewIndex, setLastReviewIndex] = useState(0);

  // Sequential page navigator used after closing quick review.
  // pendingNavRef > 0  → need to advance (goNext)
  // pendingNavRef < 0  → need to go back (goPrev)
  // Each step is gated on a fresh galaxyData response to avoid stale cursors.
  const pendingNavRef = useRef(0);
  const lastProcessedGalaxyDataRef = useRef<unknown>(null);

  useEffect(() => {
    if (pendingNavRef.current === 0) return;
    if (!galaxyData) return; // still loading — wait for the real response, don't reset
    if (galaxyData === lastProcessedGalaxyDataRef.current) return;
    lastProcessedGalaxyDataRef.current = galaxyData;
    if (pendingNavRef.current > 0) {
      if (galaxyData.hasNext) {
        pendingNavRef.current--;
        goNext();
      } else {
        pendingNavRef.current = 0; // reached end of data
      }
    } else {
      if (hasPrevious) {
        pendingNavRef.current++;
        goPrev();
      } else {
        pendingNavRef.current = 0; // reached beginning
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxyData]);

  const handleOpenReview = () => {
    pendingNavRef.current = 0; // cancel any in-flight navigation
    setIsReviewMode(true);
  };

  // Resume at the last-viewed index (0 on first open)
  const reviewInitialIndex = lastReviewIndex;

  const handleReviewGalaxyChange = (id: string, index: number) => {
    setLastViewedGalaxyId(id);
    setLastReviewIndex(index);
  };

  // On close: navigate the browser to the page that matches the QR position.
  // QR always loads from cursor=undefined (result index 0), so the target
  // browser page is Math.floor(lastReviewIndex / pageSize) + 1 (1-based).
  // We compute the delta from the CURRENT browser page so we never need goFirst().
  // The first step is fired immediately here; the useEffect above handles the rest.
  const handleCloseReview = () => {
    setIsReviewMode(false);
    const targetPage = Math.floor(lastReviewIndex / pageSize) + 1; // 1-based
    const delta = targetPage - page; // page = current browser page (from useGalaxyBrowser)
    if (delta === 0) return;
    lastProcessedGalaxyDataRef.current = null; // allow current galaxyData to trigger effect
    if (delta > 0) {
      pendingNavRef.current = delta - 1; // remaining steps after the one below
      goNext();
    } else {
      pendingNavRef.current = delta + 1; // remaining steps (negative) after the one below
      goPrev();
    }
  };

  // Computed total state
  const [computedTotal, setComputedTotal] = useState<number | null>(null);
  const [isComputingTotal, setIsComputingTotal] = useState(false);
  const [countCursor, setCountCursor] = useState<string | null>(null);
  const [accumulatedCount, setAccumulatedCount] = useState<number>(0);

  // Query for counting - only runs when counting is active
  const countBatchResult = useQuery(
    api.galaxies.count.countFilteredGalaxiesBatch,
    isComputingTotal ? {
      cursor: countCursor || undefined,
      batchSize: 5000,
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
    } : "skip"
  );

  // Process count batch results
  useEffect(() => {
    if (!isComputingTotal || !countBatchResult) return;
    
    const newCount = accumulatedCount + countBatchResult.count;
    setAccumulatedCount(newCount);
    
    if (countBatchResult.isDone) {
      setComputedTotal(newCount);
      setIsComputingTotal(false);
      setCountCursor(null);
      setAccumulatedCount(0);
    } else if (countBatchResult.cursor) {
      setCountCursor(countBatchResult.cursor);
    }
  }, [countBatchResult, isComputingTotal, accumulatedCount]);

  const handleComputeTotal = () => {
    setIsComputingTotal(true);
    setComputedTotal(null);
    setCountCursor(null);
    setAccumulatedCount(0);
  };

  // Reset computed total when filters/search change
  useEffect(() => {
    setComputedTotal(null);
  }, [filter, sortBy, sortOrder, isSearchActive, searchId, searchRaMin, searchRaMax, searchDecMin, searchDecMax, 
      searchReffMin, searchReffMax, searchQMin, searchQMax, searchPaMin, searchPaMax, searchMagMin, searchMagMax, 
      searchMeanMueMin, searchMeanMueMax, searchNucleus, searchTotalClassificationsMin, searchTotalClassificationsMax,
      searchNumVisibleNucleusMin, searchNumVisibleNucleusMax, searchNumAwesomeFlagMin, searchNumAwesomeFlagMax,
      searchNumFailedFittingMin, searchNumFailedFittingMax,
      searchTotalAssignedMin, searchTotalAssignedMax, searchAwesome, searchValidRedshift, searchVisibleNucleus]);

  if (!galaxyData) {
    if (hasPrevious) {
      // We have previous data but current query is loading - show loading state in table area
      return (
        <div className="w-full mx-auto px-2 sm:px-6 lg:px-12 py-6 pb-20 md:pb-6" style={{ maxWidth: "1920px" }}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galaxy Browser</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Browse and explore all galaxies in the database
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <GalaxyBrowserSearchForm
              searchId={searchId}
              setSearchId={setSearchId}
              searchRaMin={searchRaMin}
              setSearchRaMin={setSearchRaMin}
              searchRaMax={searchRaMax}
              setSearchRaMax={setSearchRaMax}
              searchDecMin={searchDecMin}
              setSearchDecMin={setSearchDecMin}
              searchDecMax={searchDecMax}
              setSearchDecMax={setSearchDecMax}
              searchReffMin={searchReffMin}
              setSearchReffMin={setSearchReffMin}
              searchReffMax={searchReffMax}
              setSearchReffMax={setSearchReffMax}
              searchQMin={searchQMin}
              setSearchQMin={setSearchQMin}
              searchQMax={searchQMax}
              setSearchQMax={setSearchQMax}
              searchPaMin={searchPaMin}
              setSearchPaMin={setSearchPaMin}
              searchPaMax={searchPaMax}
              setSearchPaMax={setSearchPaMax}
              searchMagMin={searchMagMin}
              setSearchMagMin={setSearchMagMin}
              searchMagMax={searchMagMax}
              setSearchMagMax={setSearchMagMax}
              searchMeanMueMin={searchMeanMueMin}
              setSearchMeanMueMin={setSearchMeanMueMin}
              searchMeanMueMax={searchMeanMueMax}
              setSearchMeanMueMax={setSearchMeanMueMax}
              searchNucleus={searchNucleus}
              setSearchNucleus={setSearchNucleus}
              searchTotalClassificationsMin={searchTotalClassificationsMin}
              setSearchTotalClassificationsMin={setSearchTotalClassificationsMin}
              searchTotalClassificationsMax={searchTotalClassificationsMax}
              setSearchTotalClassificationsMax={setSearchTotalClassificationsMax}
              searchNumVisibleNucleusMin={searchNumVisibleNucleusMin}
              setSearchNumVisibleNucleusMin={setSearchNumVisibleNucleusMin}
              searchNumVisibleNucleusMax={searchNumVisibleNucleusMax}
              setSearchNumVisibleNucleusMax={setSearchNumVisibleNucleusMax}
              searchNumAwesomeFlagMin={searchNumAwesomeFlagMin}
              setSearchNumAwesomeFlagMin={setSearchNumAwesomeFlagMin}
              searchNumAwesomeFlagMax={searchNumAwesomeFlagMax}
              setSearchNumAwesomeFlagMax={setSearchNumAwesomeFlagMax}
              searchNumFailedFittingMin={searchNumFailedFittingMin}
              setSearchNumFailedFittingMin={setSearchNumFailedFittingMin}
              searchNumFailedFittingMax={searchNumFailedFittingMax}
              setSearchNumFailedFittingMax={setSearchNumFailedFittingMax}
              searchTotalAssignedMin={searchTotalAssignedMin}
              setSearchTotalAssignedMin={setSearchTotalAssignedMin}
              searchTotalAssignedMax={searchTotalAssignedMax}
              setSearchTotalAssignedMax={setSearchTotalAssignedMax}
              searchAwesome={searchAwesome}
              setSearchAwesome={setSearchAwesome}
              searchValidRedshift={searchValidRedshift}
              setSearchValidRedshift={setSearchValidRedshift}
              searchVisibleNucleus={searchVisibleNucleus}
              setSearchVisibleNucleus={setSearchVisibleNucleus}
              isSearchActive={isSearchActive}
              hasPendingChanges={hasPendingChanges}
              hasAnySearchValues={hasAnySearchValues}
              applySearch={applySearch}
              clearSearch={clearSearch}
              getPlaceholderText={getPlaceholderText}
              getBounds={getBoundsForField}
              getInputClass={getInputClass}
              isCollapsed={isSearchFormCollapsed}
              onToggleCollapsed={() => setIsSearchFormCollapsed((prev) => !prev)}
            />

            <GalaxyBrowserControls
              filter={filter}
              setFilter={setFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              pageSize={pageSize}
              setPageSize={setPageSize}
              page={page}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              goPrev={goPrev}
              goNext={goNext}
              goFirst={goFirst}
              galaxyData={galaxyData}
              statusText={statusText}
              onComputeTotal={handleComputeTotal}
              isComputingTotal={isComputingTotal}
              computedTotal={computedTotal}
                accumulatedCount={accumulatedCount}
          onEnterReviewMode={handleOpenReview}
            />
          </div>

          {/* Loading state for table area when we have previous data */}
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Updating results...</p>
            </div>
          </div>
        </div>
      );
    } else {
      // First load - show full loading state
      return (
        <div className="w-full mx-auto px-2 sm:px-6 lg:px-12 py-6 pb-20 md:pb-6" style={{ maxWidth: "1920px" }}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galaxy Browser</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Browse and explore all galaxies in the database
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <GalaxyBrowserSearchForm
              showAwesomeFlag={showAwesomeFlag}
              showValidRedshift={showValidRedshift}
              showVisibleNucleus={showVisibleNucleus}
              searchId={searchId}
              setSearchId={setSearchId}
              searchRaMin={searchRaMin}
              setSearchRaMin={setSearchRaMin}
              searchRaMax={searchRaMax}
              setSearchRaMax={setSearchRaMax}
              searchDecMin={searchDecMin}
              setSearchDecMin={setSearchDecMin}
              searchDecMax={searchDecMax}
              setSearchDecMax={setSearchDecMax}
              searchReffMin={searchReffMin}
              setSearchReffMin={setSearchReffMin}
              searchReffMax={searchReffMax}
              setSearchReffMax={setSearchReffMax}
              searchQMin={searchQMin}
              setSearchQMin={setSearchQMin}
              searchQMax={searchQMax}
              setSearchQMax={setSearchQMax}
              searchPaMin={searchPaMin}
              setSearchPaMin={setSearchPaMin}
              searchPaMax={searchPaMax}
              setSearchPaMax={setSearchPaMax}
              searchMagMin={searchMagMin}
              setSearchMagMin={setSearchMagMin}
              searchMagMax={searchMagMax}
              setSearchMagMax={setSearchMagMax}
              searchMeanMueMin={searchMeanMueMin}
              setSearchMeanMueMin={setSearchMeanMueMin}
              searchMeanMueMax={searchMeanMueMax}
              setSearchMeanMueMax={setSearchMeanMueMax}
              searchNucleus={searchNucleus}
              setSearchNucleus={setSearchNucleus}
              searchTotalClassificationsMin={searchTotalClassificationsMin}
              setSearchTotalClassificationsMin={setSearchTotalClassificationsMin}
              searchTotalClassificationsMax={searchTotalClassificationsMax}
              setSearchTotalClassificationsMax={setSearchTotalClassificationsMax}
              searchNumVisibleNucleusMin={searchNumVisibleNucleusMin}
              setSearchNumVisibleNucleusMin={setSearchNumVisibleNucleusMin}
              searchNumVisibleNucleusMax={searchNumVisibleNucleusMax}
              setSearchNumVisibleNucleusMax={setSearchNumVisibleNucleusMax}
              searchNumAwesomeFlagMin={searchNumAwesomeFlagMin}
              setSearchNumAwesomeFlagMin={setSearchNumAwesomeFlagMin}
              searchNumAwesomeFlagMax={searchNumAwesomeFlagMax}
              setSearchNumAwesomeFlagMax={setSearchNumAwesomeFlagMax}
              searchNumFailedFittingMin={searchNumFailedFittingMin}
              setSearchNumFailedFittingMin={setSearchNumFailedFittingMin}
              searchNumFailedFittingMax={searchNumFailedFittingMax}
              setSearchNumFailedFittingMax={setSearchNumFailedFittingMax}
              searchTotalAssignedMin={searchTotalAssignedMin}
              setSearchTotalAssignedMin={setSearchTotalAssignedMin}
              searchTotalAssignedMax={searchTotalAssignedMax}
              setSearchTotalAssignedMax={setSearchTotalAssignedMax}
              searchAwesome={searchAwesome}
              setSearchAwesome={setSearchAwesome}
              searchValidRedshift={searchValidRedshift}
              setSearchValidRedshift={setSearchValidRedshift}
              searchVisibleNucleus={searchVisibleNucleus}
              setSearchVisibleNucleus={setSearchVisibleNucleus}
              isSearchActive={isSearchActive}
              hasPendingChanges={hasPendingChanges}
              hasAnySearchValues={hasAnySearchValues}
              applySearch={applySearch}
              clearSearch={clearSearch}
              getPlaceholderText={getPlaceholderText}
              getBounds={getBoundsForField}
              getInputClass={getInputClass}
              isCollapsed={isSearchFormCollapsed}
              onToggleCollapsed={() => setIsSearchFormCollapsed((prev) => !prev)}
            />

            <GalaxyBrowserControls
              filter={filter}
              setFilter={setFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              pageSize={pageSize}
              setPageSize={setPageSize}
              page={page}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              goPrev={goPrev}
              goNext={goNext}
              goFirst={goFirst}
              galaxyData={galaxyData}
              statusText={statusText}
              onComputeTotal={handleComputeTotal}
              isComputingTotal={isComputingTotal}
              computedTotal={computedTotal}
                accumulatedCount={accumulatedCount}
              onEnterReviewMode={handleOpenReview}
            />
          </div>

          {/* Loading state for table area */}
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading galaxies...</p>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="w-full min-w-0 mx-auto px-2 sm:px-6 lg:px-12 py-6 pb-20 md:pb-6" style={{ maxWidth: "1920px" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galaxy Browser</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Browse and explore all galaxies in the database
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <GalaxyBrowserSearchForm
          showAwesomeFlag={showAwesomeFlag}
          showValidRedshift={showValidRedshift}
          showVisibleNucleus={showVisibleNucleus}
          searchId={searchId}
          setSearchId={setSearchId}
          searchRaMin={searchRaMin}
          setSearchRaMin={setSearchRaMin}
          searchRaMax={searchRaMax}
          setSearchRaMax={setSearchRaMax}
          searchDecMin={searchDecMin}
          setSearchDecMin={setSearchDecMin}
          searchDecMax={searchDecMax}
          setSearchDecMax={setSearchDecMax}
          searchReffMin={searchReffMin}
          setSearchReffMin={setSearchReffMin}
          searchReffMax={searchReffMax}
          setSearchReffMax={setSearchReffMax}
          searchQMin={searchQMin}
          setSearchQMin={setSearchQMin}
          searchQMax={searchQMax}
          setSearchQMax={setSearchQMax}
          searchPaMin={searchPaMin}
          setSearchPaMin={setSearchPaMin}
          searchPaMax={searchPaMax}
          setSearchPaMax={setSearchPaMax}
          searchMagMin={searchMagMin}
          setSearchMagMin={setSearchMagMin}
          searchMagMax={searchMagMax}
          setSearchMagMax={setSearchMagMax}
          searchMeanMueMin={searchMeanMueMin}
          setSearchMeanMueMin={setSearchMeanMueMin}
          searchMeanMueMax={searchMeanMueMax}
          setSearchMeanMueMax={setSearchMeanMueMax}
          searchNucleus={searchNucleus}
          setSearchNucleus={setSearchNucleus}
          searchTotalClassificationsMin={searchTotalClassificationsMin}
          setSearchTotalClassificationsMin={setSearchTotalClassificationsMin}
          searchTotalClassificationsMax={searchTotalClassificationsMax}
          setSearchTotalClassificationsMax={setSearchTotalClassificationsMax}
          searchNumVisibleNucleusMin={searchNumVisibleNucleusMin}
          setSearchNumVisibleNucleusMin={setSearchNumVisibleNucleusMin}
          searchNumVisibleNucleusMax={searchNumVisibleNucleusMax}
          setSearchNumVisibleNucleusMax={setSearchNumVisibleNucleusMax}
          searchNumAwesomeFlagMin={searchNumAwesomeFlagMin}
          setSearchNumAwesomeFlagMin={setSearchNumAwesomeFlagMin}
          searchNumAwesomeFlagMax={searchNumAwesomeFlagMax}
          setSearchNumAwesomeFlagMax={setSearchNumAwesomeFlagMax}
          searchNumFailedFittingMin={searchNumFailedFittingMin}
          setSearchNumFailedFittingMin={setSearchNumFailedFittingMin}
          searchNumFailedFittingMax={searchNumFailedFittingMax}
          setSearchNumFailedFittingMax={setSearchNumFailedFittingMax}
          searchTotalAssignedMin={searchTotalAssignedMin}
          setSearchTotalAssignedMin={setSearchTotalAssignedMin}
          searchTotalAssignedMax={searchTotalAssignedMax}
          setSearchTotalAssignedMax={setSearchTotalAssignedMax}
          searchAwesome={searchAwesome}
          setSearchAwesome={setSearchAwesome}
          searchValidRedshift={searchValidRedshift}
          setSearchValidRedshift={setSearchValidRedshift}
          searchVisibleNucleus={searchVisibleNucleus}
          setSearchVisibleNucleus={setSearchVisibleNucleus}
          isSearchActive={isSearchActive}
          hasPendingChanges={hasPendingChanges}
          hasAnySearchValues={hasAnySearchValues}
          applySearch={applySearch}
          clearSearch={clearSearch}
          getPlaceholderText={getPlaceholderText}
          getBounds={getBoundsForField}
          getInputClass={getInputClass}
          isCollapsed={isSearchFormCollapsed}
          onToggleCollapsed={() => setIsSearchFormCollapsed((prev) => !prev)}
        />

        <GalaxyBrowserControls
          filter={filter}
          setFilter={setFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          pageSize={pageSize}
          setPageSize={setPageSize}
          page={page}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          goPrev={goPrev}
          goNext={goNext}
          goFirst={goFirst}
          galaxyData={galaxyData}
          statusText={statusText}
          onComputeTotal={handleComputeTotal}
          isComputingTotal={isComputingTotal}
          computedTotal={computedTotal}
            accumulatedCount={accumulatedCount}
          onEnterReviewMode={handleOpenReview}
        />
      </div>

      {/* Quick Review Mode */}
      {isReviewMode && (
        <GalaxyQuickReview
          filters={{
            sortBy,
            sortOrder,
            filter,
            isSearchActive,
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
          } satisfies GalaxyQuickReviewFilters}
          effectiveImageQuality={effectiveImageQuality}
          userPrefs={userPrefs}
          initialIndex={reviewInitialIndex}
          onGalaxyChange={handleReviewGalaxyChange}
          onClose={handleCloseReview}
        />
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block w-full min-w-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden">
        <GalaxyBrowserLightTableView
          galaxyData={galaxyData}
          userPrefs={userPrefs}
          effectiveImageQuality={effectiveImageQuality}
          previewImageName={previewImageName}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          lastViewedGalaxyId={lastViewedGalaxyId ?? undefined}
        />
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden">
        <GalaxyBrowserMobileCards
          galaxyData={galaxyData}
          userPrefs={userPrefs}
          effectiveImageQuality={effectiveImageQuality}
          previewImageName={previewImageName}
          lastViewedGalaxyId={lastViewedGalaxyId ?? undefined}
        />
      </div>

      {/* Export Section */}
      <GalaxyExport
        filter={filter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isSearchActive={isSearchActive}
        searchId={searchId}
        searchRaMin={searchRaMin}
        searchRaMax={searchRaMax}
        searchDecMin={searchDecMin}
        searchDecMax={searchDecMax}
        searchReffMin={searchReffMin}
        searchReffMax={searchReffMax}
        searchQMin={searchQMin}
        searchQMax={searchQMax}
        searchPaMin={searchPaMin}
        searchPaMax={searchPaMax}
        searchMagMin={searchMagMin}
        searchMagMax={searchMagMax}
        searchMeanMueMin={searchMeanMueMin}
        searchMeanMueMax={searchMeanMueMax}
        searchNucleus={searchNucleus}
        searchTotalClassificationsMin={searchTotalClassificationsMin}
        searchTotalClassificationsMax={searchTotalClassificationsMax}
        searchNumVisibleNucleusMin={searchNumVisibleNucleusMin}
        searchNumVisibleNucleusMax={searchNumVisibleNucleusMax}
        searchNumAwesomeFlagMin={searchNumAwesomeFlagMin}
        searchNumAwesomeFlagMax={searchNumAwesomeFlagMax}
        searchNumFailedFittingMin={searchNumFailedFittingMin}
        searchNumFailedFittingMax={searchNumFailedFittingMax}
        searchTotalAssignedMin={searchTotalAssignedMin}
        searchTotalAssignedMax={searchTotalAssignedMax}
        searchAwesome={searchAwesome}
        searchValidRedshift={searchValidRedshift}
        searchVisibleNucleus={searchVisibleNucleus}
        currentPageGalaxies={galaxyData?.galaxies}
        pageSize={pageSize}
        page={page}
        isAdmin={isAdmin}
      />

      {/* Cursor-based pagination is managed in controls */}
    </div>
  );
}
