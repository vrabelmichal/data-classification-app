import { usePageTitle } from "../../hooks/usePageTitle";
import { useGalaxyBrowser } from "./useGalaxyBrowser";
import { GalaxyBrowserSearchForm } from "./GalaxyBrowserSearchForm";
import { GalaxyBrowserControls } from "./GalaxyBrowserControls";
import { GalaxyBrowserLightTableView } from "./GalaxyBrowserLightTableView";
import { GalaxyBrowserMobileCards } from "./GalaxyBrowserMobileCards";
// Cursor-based pagination handled in controls; standalone pagination removed

export type SortField = "id" | "ra" | "dec" | "reff" | "q" | "pa" | "mag" | "mean_mue" | "nucleus" | "numericId";
export type SortOrder = "asc" | "desc";
export type FilterType = "all" | "my_sequence" | "classified" | "unclassified" | "skipped";

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
    effectiveImageQuality,

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

  const total = galaxyData?.total;
  const hasResults = (galaxyData?.galaxies?.length ?? 0) > 0;
  const startIndex = hasResults ? ((page - 1) * pageSize) + 1 : 0;
  const endIndex = hasResults && galaxyData?.galaxies
    ? ((page - 1) * pageSize) + galaxyData.galaxies.length
    : 0;
  const canShowTotal = typeof total === "number" && total > 0 && total >= endIndex && total >= startIndex;
  const statusText = galaxyData
    ? (hasResults
      ? (canShowTotal
        ? `Showing ${startIndex} to ${endIndex} of ${total}`
        : `Showing ${startIndex} to ${endIndex}`)
      : "No galaxies match your filters.")
    : "Loading results...";

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
              statusText={statusText}
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
              statusText={statusText}
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
          statusText={statusText}
        />
      </div>

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
        />
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden">
        <GalaxyBrowserMobileCards
          galaxyData={galaxyData}
          userPrefs={userPrefs}
          effectiveImageQuality={effectiveImageQuality}
          previewImageName={previewImageName}
        />
      </div>

      {/* Cursor-based pagination is managed in controls */}
    </div>
  );
}
