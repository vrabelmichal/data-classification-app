import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useGalaxyBrowser } from "./useGalaxyBrowser";
import { GalaxyBrowserSearchForm } from "./GalaxyBrowserSearchForm";
import { GalaxyBrowserControls } from "./GalaxyBrowserControls";
import { GalaxyBrowserLightTableView } from "./GalaxyBrowserLightTableView";
import { GalaxyBrowserMobileCards } from "./GalaxyBrowserMobileCards";
import { GalaxyExport } from "./GalaxyExport";
import { GalaxyQuickReview, type GalaxyQuickReviewFilters } from "./GalaxyQuickReview";
import { parseGalaxyBrowserUrlState, parseGalaxyQuickReviewUrlState } from "./galaxyBrowserUrlState";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const retainedGalaxyDataRef = useRef<any | null>(null);

  // Load system settings to determine which fields to show
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const showAwesomeFlag = systemSettings?.showAwesomeFlag !== false;
  const showValidRedshift = systemSettings?.showValidRedshift !== false;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus !== false;

  // Get user profile to resolve export permissions.
  const userProfile = useQuery(api.users.getUserProfile);
  const canExportAll = Boolean(userProfile?.permissions?.unlimitedGalaxyExport);

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
    jumpToPage,
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
    appliedSearchValues,
    isSearchActive,
    hasPendingChanges,
    hasAnySearchValues,
    isUrlStateReady,
    isViewUnavailable,
    viewStateIssue,
    currentViewKey,
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
  const parsedBrowserUrlState = useMemo(() => parseGalaxyBrowserUrlState(searchParams), [searchParams]);
  const parsedReviewUrlState = useMemo(() => parseGalaxyQuickReviewUrlState(searchParams), [searchParams]);
  const initialReviewIndexFromUrl = useMemo(() => {
    if (parsedReviewUrlState.hasExplicitPosition) {
      return parsedReviewUrlState.reviewIndex;
    }

    if (!parsedReviewUrlState.isOpen) {
      return 0;
    }

    const initialPage = Math.max(1, parsedBrowserUrlState.page);
    const initialPageSize = parsedBrowserUrlState.pageSize ?? pageSize;
    return Math.max(0, (initialPage - 1) * initialPageSize);
  }, [pageSize, parsedBrowserUrlState.page, parsedBrowserUrlState.pageSize, parsedReviewUrlState.hasExplicitPosition, parsedReviewUrlState.isOpen, parsedReviewUrlState.reviewIndex]);
  const derivedReviewIndexFromPage = Math.max(0, (page - 1) * pageSize);

  useEffect(() => {
    if (isViewUnavailable) {
      retainedGalaxyDataRef.current = null;
      return;
    }

    if (galaxyData) {
      retainedGalaxyDataRef.current = galaxyData;
    }
  }, [galaxyData, isViewUnavailable]);

  const displayGalaxyData = galaxyData ?? retainedGalaxyDataRef.current;
  const isRefreshingResults = !galaxyData && !!displayGalaxyData && !isViewUnavailable;
  const hasResults = (displayGalaxyData?.galaxies?.length ?? 0) > 0;
  const startIndex = hasResults ? ((page - 1) * pageSize) + 1 : 0;
  const endIndex = hasResults && displayGalaxyData?.galaxies
    ? ((page - 1) * pageSize) + displayGalaxyData.galaxies.length
    : 0;
  const statusText = viewStateIssue?.kind === "unavailable"
    ? viewStateIssue.message
    : isRefreshingResults
    ? "Updating results..."
    : displayGalaxyData
    ? (hasResults
      ? `Showing ${startIndex} to ${endIndex}`
      : "No galaxies match your filters.")
    : "Loading results...";

  // Quick review mode
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [lastViewedGalaxyId, setLastViewedGalaxyId] = useState<string | null>(parsedReviewUrlState.reviewGalaxyId);
  const [lastReviewIndex, setLastReviewIndex] = useState(initialReviewIndexFromUrl);
  const [reviewSelectedImageKey, setReviewSelectedImageKey] = useState<string | null>(parsedReviewUrlState.imageKey);
  const [reviewShowEllipse, setReviewShowEllipse] = useState(parsedReviewUrlState.showEllipse);
  const [isReviewUrlReady, setIsReviewUrlReady] = useState(false);
  const lastAppliedReviewUrlSignatureRef = useRef<string | null>(null);
  const lastWrittenReviewUrlSignatureRef = useRef<string | null>(null);
  const isClosingReviewRef = useRef(false);

  // Close-time page sync waits until the destination page data has loaded
  // before showing the browser again.
  const pendingNavRef = useRef(0);
  const lastProcessedGalaxyDataRef = useRef<unknown>(null);
  const lastPageRef = useRef(page);
  // True while post-close page sync hasn't finished yet (hides the table).
  const [isSyncingPage, setIsSyncingPage] = useState(false);

  useEffect(() => {
    if (!isUrlStateReady) return;
    if (isClosingReviewRef.current && parsedReviewUrlState.isOpen) {
      console.log("[GalaxyBrowserDebug] ignoring stale open review URL state while closing", {
        parsedReviewUrlState,
        page,
        lastReviewIndex,
      });
      return;
    }
    if (isClosingReviewRef.current && !parsedReviewUrlState.isOpen) {
      console.log("[GalaxyBrowserDebug] review close confirmed by URL state", {
        parsedReviewUrlState,
        page,
        lastReviewIndex,
      });
      isClosingReviewRef.current = false;
    }
    if (isReviewMode && parsedReviewUrlState.isOpen) {
      return;
    }
    if (parsedReviewUrlState.signature === lastWrittenReviewUrlSignatureRef.current) {
      if (!isReviewUrlReady) setIsReviewUrlReady(true);
      return;
    }
    if (lastAppliedReviewUrlSignatureRef.current === parsedReviewUrlState.signature && isReviewUrlReady) {
      return;
    }

    lastAppliedReviewUrlSignatureRef.current = parsedReviewUrlState.signature;
    pendingNavRef.current = 0;
    lastProcessedGalaxyDataRef.current = null;
    setIsSyncingPage(false);
    const nextReviewIndex = parsedReviewUrlState.hasExplicitPosition
      ? parsedReviewUrlState.reviewIndex
      : parsedReviewUrlState.isOpen
        ? derivedReviewIndexFromPage
        : parsedReviewUrlState.reviewIndex;
    console.log("[GalaxyBrowserDebug] applying review URL state", {
      parsedReviewUrlState,
      nextReviewIndex,
      page,
      isReviewMode,
      isViewUnavailable,
    });
    setLastViewedGalaxyId(parsedReviewUrlState.reviewGalaxyId);
    setLastReviewIndex(nextReviewIndex);
    setReviewSelectedImageKey(parsedReviewUrlState.imageKey);
    setReviewShowEllipse(parsedReviewUrlState.showEllipse);
    setIsReviewMode(parsedReviewUrlState.isOpen && !isViewUnavailable);
    setIsReviewUrlReady(true);
  }, [derivedReviewIndexFromPage, isReviewMode, isReviewUrlReady, isUrlStateReady, isViewUnavailable, parsedReviewUrlState]);

  useEffect(() => {
    if (!isUrlStateReady || !isReviewUrlReady) return;
    if (isViewUnavailable) return;
    if (isClosingReviewRef.current && isSyncingPage) {
      console.log("[GalaxyBrowserDebug] delaying review URL write until page sync completes", {
        page,
        pageSize,
        lastReviewIndex,
        lastViewedGalaxyId,
      });
      return;
    }

    const hasPersistedReviewState =
      lastViewedGalaxyId !== null ||
      lastReviewIndex > 0 ||
      reviewSelectedImageKey !== null ||
      reviewShowEllipse;

    const nextSignature = JSON.stringify({
      isOpen: isReviewMode,
      reviewIndex: lastReviewIndex,
      reviewGalaxyId: lastViewedGalaxyId,
      imageKey: reviewSelectedImageKey,
      showEllipse: reviewShowEllipse,
    });
    if (nextSignature === lastWrittenReviewUrlSignatureRef.current) return;

    lastWrittenReviewUrlSignatureRef.current = nextSignature;
    console.log("[GalaxyBrowserDebug] writing review URL state", {
      isReviewMode,
      lastReviewIndex,
      lastViewedGalaxyId,
      reviewSelectedImageKey,
      reviewShowEllipse,
      page,
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (currentViewKey) {
        next.set("view", currentViewKey);
      }
      next.set("page", String(page));
      next.set("pageSize", String(pageSize));
      if (isReviewMode) {
        next.set("review", "1");
      } else {
        next.delete("review");
      }

      if (hasPersistedReviewState) {
        next.set("reviewIndex", String(lastReviewIndex + 1));
        if (lastViewedGalaxyId) {
          next.set("reviewGalaxyId", lastViewedGalaxyId);
        } else {
          next.delete("reviewGalaxyId");
        }
        if (reviewSelectedImageKey) {
          next.set("reviewImage", reviewSelectedImageKey);
        } else {
          next.delete("reviewImage");
        }
        if (reviewShowEllipse) {
          next.set("reviewEllipse", "1");
        } else {
          next.delete("reviewEllipse");
        }
      } else {
        next.delete("reviewIndex");
        next.delete("reviewGalaxyId");
        next.delete("reviewImage");
        next.delete("reviewEllipse");
      }
      return next;
    }, { replace: true, preventScrollReset: true });
  }, [
    isReviewMode,
    isReviewUrlReady,
    isUrlStateReady,
    isViewUnavailable,
    lastReviewIndex,
    lastViewedGalaxyId,
    currentViewKey,
    page,
    pageSize,
    isSyncingPage,
    reviewSelectedImageKey,
    reviewShowEllipse,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!isSyncingPage) return;
    if (!galaxyData) return;

    console.log("[GalaxyBrowserDebug] syncing browser page after review close", {
      page,
      isSyncingPage,
      pendingNav: pendingNavRef.current,
      hasGalaxyData: !!galaxyData,
      firstGalaxyId: galaxyData?.galaxies?.[0]?.id ?? null,
    });

    if (pendingNavRef.current === 0) {
      console.log("[GalaxyBrowserDebug] page sync complete", {
        page,
        firstGalaxyId: galaxyData?.galaxies?.[0]?.id ?? null,
      });
      setIsSyncingPage(false);
      return;
    }
    if (galaxyData === lastProcessedGalaxyDataRef.current) return;
    lastProcessedGalaxyDataRef.current = galaxyData;
    if (pendingNavRef.current > 0) {
      if (galaxyData.hasNext) {
        pendingNavRef.current--;
        goNext();
      } else {
        pendingNavRef.current = 0;
        setIsSyncingPage(false);
      }
    } else {
      if (hasPrevious) {
        pendingNavRef.current++;
        goPrev();
      } else {
        pendingNavRef.current = 0;
        setIsSyncingPage(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxyData, isSyncingPage]);

  // NOTE: We intentionally do NOT change the browser page while QR is open.
  // Instead, we sync the browser page after the overlay closes.

  // Search inputs are stored as strings in useGalaxyBrowser. Blank inputs should
  // become undefined so the backend treats them as "no filter", while a user-
  // entered zero stays as the truthy string "0" and is preserved. Reports about
  // `|| undefined` dropping numeric 0 are therefore incorrect for this code as
  // written; only revisit this normalization if these fields ever become numbers.
  
  const appliedSearchQueryFilters = {
    sortBy,
    sortOrder,
    filter,
    searchId: isSearchActive ? (appliedSearchValues.searchId || undefined) : undefined,
    searchRaMin: isSearchActive ? (appliedSearchValues.searchRaMin || undefined) : undefined,
    searchRaMax: isSearchActive ? (appliedSearchValues.searchRaMax || undefined) : undefined,
    searchDecMin: isSearchActive ? (appliedSearchValues.searchDecMin || undefined) : undefined,
    searchDecMax: isSearchActive ? (appliedSearchValues.searchDecMax || undefined) : undefined,
    searchReffMin: isSearchActive ? (appliedSearchValues.searchReffMin || undefined) : undefined,
    searchReffMax: isSearchActive ? (appliedSearchValues.searchReffMax || undefined) : undefined,
    searchQMin: isSearchActive ? (appliedSearchValues.searchQMin || undefined) : undefined,
    searchQMax: isSearchActive ? (appliedSearchValues.searchQMax || undefined) : undefined,
    searchPaMin: isSearchActive ? (appliedSearchValues.searchPaMin || undefined) : undefined,
    searchPaMax: isSearchActive ? (appliedSearchValues.searchPaMax || undefined) : undefined,
    searchMagMin: isSearchActive ? (appliedSearchValues.searchMagMin || undefined) : undefined,
    searchMagMax: isSearchActive ? (appliedSearchValues.searchMagMax || undefined) : undefined,
    searchMeanMueMin: isSearchActive ? (appliedSearchValues.searchMeanMueMin || undefined) : undefined,
    searchMeanMueMax: isSearchActive ? (appliedSearchValues.searchMeanMueMax || undefined) : undefined,
    searchNucleus: isSearchActive ? appliedSearchValues.searchNucleus : undefined,
    searchTotalClassificationsMin: isSearchActive ? (appliedSearchValues.searchTotalClassificationsMin || undefined) : undefined,
    searchTotalClassificationsMax: isSearchActive ? (appliedSearchValues.searchTotalClassificationsMax || undefined) : undefined,
    searchNumVisibleNucleusMin: isSearchActive ? (appliedSearchValues.searchNumVisibleNucleusMin || undefined) : undefined,
    searchNumVisibleNucleusMax: isSearchActive ? (appliedSearchValues.searchNumVisibleNucleusMax || undefined) : undefined,
    searchNumAwesomeFlagMin: isSearchActive ? (appliedSearchValues.searchNumAwesomeFlagMin || undefined) : undefined,
    searchNumAwesomeFlagMax: isSearchActive ? (appliedSearchValues.searchNumAwesomeFlagMax || undefined) : undefined,
    searchNumFailedFittingMin: isSearchActive ? (appliedSearchValues.searchNumFailedFittingMin || undefined) : undefined,
    searchNumFailedFittingMax: isSearchActive ? (appliedSearchValues.searchNumFailedFittingMax || undefined) : undefined,
    searchTotalAssignedMin: isSearchActive ? (appliedSearchValues.searchTotalAssignedMin || undefined) : undefined,
    searchTotalAssignedMax: isSearchActive ? (appliedSearchValues.searchTotalAssignedMax || undefined) : undefined,
    searchAwesome: isSearchActive ? appliedSearchValues.searchAwesome : undefined,
    searchValidRedshift: isSearchActive ? appliedSearchValues.searchValidRedshift : undefined,
    searchVisibleNucleus: isSearchActive ? appliedSearchValues.searchVisibleNucleus : undefined,
  };
  const quickReviewFilters = {
    ...appliedSearchQueryFilters,
    isSearchActive,
  } satisfies GalaxyQuickReviewFilters;
  const quickReviewResetKey = JSON.stringify(quickReviewFilters);
  const lastQuickReviewResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isUrlStateReady) {
      return;
    }
    if (lastQuickReviewResetKeyRef.current === null) {
      lastQuickReviewResetKeyRef.current = quickReviewResetKey;
      return;
    }
    if (lastQuickReviewResetKeyRef.current === quickReviewResetKey) return;

    lastQuickReviewResetKeyRef.current = quickReviewResetKey;
    pendingNavRef.current = 0;
    lastProcessedGalaxyDataRef.current = null;
    setIsSyncingPage(false);
    setLastViewedGalaxyId(null);
    setLastReviewIndex(0);
  }, [isUrlStateReady, quickReviewResetKey]);

  useEffect(() => {
    if (lastPageRef.current === page) return;

    console.log("[GalaxyBrowserDebug] observed browser page change", {
      previousPage: lastPageRef.current,
      nextPage: page,
      isSyncingPage,
      lastViewedGalaxyId,
      lastReviewIndex,
    });
    lastPageRef.current = page;
  }, [isSyncingPage, lastReviewIndex, lastViewedGalaxyId, page]);

  const handleOpenReview = () => {
    isClosingReviewRef.current = false;
    pendingNavRef.current = 0; // cancel any in-flight navigation
    setIsReviewMode(true);
  };

  const handleOpenReviewAtIndex = (pageIndex: number, galaxyId: string) => {
    isClosingReviewRef.current = false;
    pendingNavRef.current = 0;
    setLastViewedGalaxyId(galaxyId);
    setLastReviewIndex(((page - 1) * pageSize) + pageIndex);
    setIsReviewMode(true);
  };

  // Resume at the last-viewed index (0 on first open)
  const reviewInitialIndex = lastReviewIndex;

  const handleReviewGalaxyChange = (id: string, index: number) => {
    setLastViewedGalaxyId(id);
    setLastReviewIndex(index);
  };

  const handleReviewStateChange = (state: {
    galaxyId: string | null;
    index: number;
    selectedImageKey: string;
    showEllipse: boolean;
  }) => {
    setLastViewedGalaxyId(state.galaxyId);
    setLastReviewIndex(state.index);
    setReviewSelectedImageKey(state.selectedImageKey);
    setReviewShowEllipse(state.showEllipse);
  };

  // On close: compute which browser page matches the last QR position and jump
  // directly to it. isSyncingPage hides the table until the destination page loads.
  const handleCloseReview = (state: {
    galaxyId: string | null;
    index: number;
    selectedImageKey: string;
    showEllipse: boolean;
  }) => {
    isClosingReviewRef.current = true;
    const targetPage = Math.floor(state.index / pageSize) + 1; // 1-based
    console.log("[GalaxyBrowserDebug] closing review", {
      closeState: state,
      currentPage: page,
      targetPage,
      pageSize,
      lastViewedGalaxyId,
      lastReviewIndex,
    });
    setLastViewedGalaxyId(state.galaxyId);
    setLastReviewIndex(state.index);
    setReviewSelectedImageKey(state.selectedImageKey);
    setReviewShowEllipse(state.showEllipse);
    setIsReviewMode(false);
    if (targetPage === page) return; // already on the right page
    pendingNavRef.current = 0;
    setIsSyncingPage(true);
    lastProcessedGalaxyDataRef.current = null; // let current galaxyData trigger effect
    console.log("[GalaxyBrowserDebug] jumping browser page after review close", {
      fromPage: page,
      toPage: targetPage,
      reviewIndex: state.index,
      reviewGalaxyId: state.galaxyId,
    });
    jumpToPage(targetPage);
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
      ...appliedSearchQueryFilters,
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
  }, [quickReviewResetKey]);

  const viewStateBanner = viewStateIssue ? (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        viewStateIssue.kind === "unavailable"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100"
      }`}
      role="alert"
    >
      {viewStateIssue.message}
    </div>
  ) : null;

  // ── QR overlay ──
  // Rendered BEFORE the if (!galaxyData) early returns so it stays mounted
  // during background page transitions (galaxyData temporarily undefined).
  const quickReviewOverlay = isReviewMode && !isViewUnavailable ? (
    <GalaxyQuickReview
      filters={quickReviewFilters}
      effectiveImageQuality={effectiveImageQuality}
      userPrefs={userPrefs}
      initialIndex={reviewInitialIndex}
      initialSelectedImageKey={reviewSelectedImageKey ?? undefined}
      initialShowEllipse={reviewShowEllipse}
      onGalaxyChange={handleReviewGalaxyChange}
      onReviewStateChange={handleReviewStateChange}
      onClose={handleCloseReview}
    />
  ) : null;

  if (!displayGalaxyData) {
    return (
      <div className="w-full mx-auto px-2 sm:px-6 lg:px-12 py-6 pb-20 md:pb-6" style={{ maxWidth: "1920px" }}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galaxy Browser</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Browse and explore all galaxies in the database
          </p>
        </div>

        {viewStateBanner}

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

        {/* QR overlay stays mounted during first load too */}
        {quickReviewOverlay}
      </div>
    );
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

      {viewStateBanner}

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
          galaxyData={displayGalaxyData}
          statusText={statusText}
          onComputeTotal={handleComputeTotal}
          isComputingTotal={isComputingTotal}
          computedTotal={computedTotal}
            accumulatedCount={accumulatedCount}
          onEnterReviewMode={handleOpenReview}
        />
      </div>

      {/* Quick Review Mode — rendered via shared variable so it stays mounted
         across all code paths (including loading early returns above) */}
      {quickReviewOverlay}

      {/* Desktop Table View */}
      {isSyncingPage ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Syncing page…</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden lg:block w-full min-w-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden">
            <GalaxyBrowserLightTableView
              galaxyData={displayGalaxyData}
              userPrefs={userPrefs}
              effectiveImageQuality={effectiveImageQuality}
              previewImageName={previewImageName}
              sortBy={sortBy}
              sortOrder={sortOrder}
              handleSort={handleSort}
              onOpenReviewAtIndex={handleOpenReviewAtIndex}
              lastViewedGalaxyId={lastViewedGalaxyId ?? undefined}
            />
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            <GalaxyBrowserMobileCards
              galaxyData={displayGalaxyData}
              userPrefs={userPrefs}
              effectiveImageQuality={effectiveImageQuality}
              previewImageName={previewImageName}
              onOpenReviewAtIndex={handleOpenReviewAtIndex}
              lastViewedGalaxyId={lastViewedGalaxyId ?? undefined}
            />
          </div>
        </>
      )}

      {/* Export Section */}
      <GalaxyExport
        {...quickReviewFilters}
        currentPageGalaxies={galaxyData?.galaxies}
        pageSize={pageSize}
        page={page}
        canExportAll={canExportAll}
      />

      {/* Cursor-based pagination is managed in controls */}
    </div>
  );
}
