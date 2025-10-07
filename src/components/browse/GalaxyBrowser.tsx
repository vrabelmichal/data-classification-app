import { usePageTitle } from "../../hooks/usePageTitle";
import { useGalaxyBrowser } from "./useGalaxyBrowser";
import { GalaxyBrowserSearchForm } from "./GalaxyBrowserSearchForm";
import { GalaxyBrowserControls } from "./GalaxyBrowserControls";
import { GalaxyBrowserLightTableView } from "./GalaxyBrowserLightTableView";
import { GalaxyBrowserMobileCards } from "./GalaxyBrowserMobileCards";
// Cursor-based pagination handled in controls; standalone pagination removed

export type SortField = "id" | "ra" | "dec" | "reff" | "q" | "pa" | "mag" | "mean_mue" | "nucleus" | "numericId";
export type SortOrder = "asc" | "desc";
export type FilterType = "all" | "my_sequence" | "classified" | "unclassified";

export function GalaxyBrowser() {
  usePageTitle("Browse Galaxies");

  const {
    // State
    page,
    hasPrevious,
    hasNext,

    // Queries
    galaxyData,
    userPrefs,

    // Computed values
    previewImageName,

    // Handlers
    handleSort,
    goPrev,
    goNext,

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
    // cursor-based navigation handled in controls
  } = useGalaxyBrowser();

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
              getInputClass={getInputClass}
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
              galaxyData={galaxyData}
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
              getInputClass={getInputClass}
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
              galaxyData={galaxyData}
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

  const { galaxies, total, aggregatesPopulated } = galaxyData;

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
          getInputClass={getInputClass}
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
          galaxyData={galaxyData}
        />
      </div>

      {/* Results Status */}
      <div className="mb-6 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} galaxies
        </p>
        {/* {!aggregatesPopulated && total > 0 && (
          <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Performance Warning
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <p>
                    Galaxy aggregates are not populated. Pagination may be slow for large datasets.
                    Go to the Admin panel → Debugging tab to rebuild aggregates for better performance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )} */}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block w-full min-w-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden">
        <GalaxyBrowserLightTableView
          galaxyData={galaxyData}
          userPrefs={userPrefs}
          previewImageName={previewImageName}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
        />
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden">
        <GalaxyBrowserMobileCards
          galaxyData={galaxyData}
          userPrefs={userPrefs}
          previewImageName={previewImageName}
        />
      </div>

      {/* Cursor-based pagination is managed in controls */}
    </div>
  );
}
