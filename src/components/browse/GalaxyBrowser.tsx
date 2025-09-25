import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ImageViewer } from "../classification/ImageViewer";
import { cn } from "../../lib/utils";
import { Link } from "react-router";
import { usePageTitle } from "../../hooks/usePageTitle";
import { getImageUrl } from "../../images";

type SortField = "id" | "ra" | "dec" | "reff" | "q" | "pa" | "mag" | "mean_mue" | "nucleus" | "_creationTime";
type SortOrder = "asc" | "desc";
type FilterType = "all" | "my_sequence" | "classified" | "unclassified" | "skipped";

const STORAGE_KEY = "galaxyBrowserSettings";

export function GalaxyBrowser() {
  usePageTitle("Browse Galaxies");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filter, setFilter] = useState<FilterType>("all");

  const [jumpToPage, setJumpToPage] = useState("");
  
  // New search fields - now support ranges
  const [searchId, setSearchId] = useState("");
  const [searchRaMin, setSearchRaMin] = useState("");
  const [searchRaMax, setSearchRaMax] = useState("");
  const [searchDecMin, setSearchDecMin] = useState("");
  const [searchDecMax, setSearchDecMax] = useState("");
  const [searchReffMin, setSearchReffMin] = useState("");
  const [searchReffMax, setSearchReffMax] = useState("");
  const [searchQMin, setSearchQMin] = useState("");
  const [searchQMax, setSearchQMax] = useState("");
  const [searchPaMin, setSearchPaMin] = useState("");
  const [searchPaMax, setSearchPaMax] = useState("");
  const [searchMagMin, setSearchMagMin] = useState("");
  const [searchMagMax, setSearchMagMax] = useState("");
  const [searchMeanMueMin, setSearchMeanMueMin] = useState("");
  const [searchMeanMueMax, setSearchMeanMueMax] = useState("");
  const [searchNucleus, setSearchNucleus] = useState<boolean | undefined>(undefined);
  const [searchClassificationStatus, setSearchClassificationStatus] = useState<"classified" | "unclassified" | "skipped" | undefined>(undefined);
  const [searchLsbClass, setSearchLsbClass] = useState<string>("");
  const [searchMorphology, setSearchMorphology] = useState<string>("");
  const [searchAwesome, setSearchAwesome] = useState<boolean | undefined>(undefined);
  const [searchValidRedshift, setSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [searchVisibleNucleus, setSearchVisibleNucleus] = useState<boolean | undefined>(undefined);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const didHydrateFromStorage = useRef(false);
  const [hasPreviousData, setHasPreviousData] = useState(false);

  // Applied search values (what's actually being used for queries)
  const [appliedSearchId, setAppliedSearchId] = useState("");
  const [appliedSearchRaMin, setAppliedSearchRaMin] = useState("");
  const [appliedSearchRaMax, setAppliedSearchRaMax] = useState("");
  const [appliedSearchDecMin, setAppliedSearchDecMin] = useState("");
  const [appliedSearchDecMax, setAppliedSearchDecMax] = useState("");
  const [appliedSearchReffMin, setAppliedSearchReffMin] = useState("");
  const [appliedSearchReffMax, setAppliedSearchReffMax] = useState("");
  const [appliedSearchQMin, setAppliedSearchQMin] = useState("");
  const [appliedSearchQMax, setAppliedSearchQMax] = useState("");
  const [appliedSearchPaMin, setAppliedSearchPaMin] = useState("");
  const [appliedSearchPaMax, setAppliedSearchPaMax] = useState("");
  const [appliedSearchMagMin, setAppliedSearchMagMin] = useState("");
  const [appliedSearchMagMax, setAppliedSearchMagMax] = useState("");
  const [appliedSearchMeanMueMin, setAppliedSearchMeanMueMin] = useState("");
  const [appliedSearchMeanMueMax, setAppliedSearchMeanMueMax] = useState("");
  const [appliedSearchNucleus, setAppliedSearchNucleus] = useState<boolean | undefined>(undefined);
  const [appliedSearchClassificationStatus, setAppliedSearchClassificationStatus] = useState<"classified" | "unclassified" | "skipped" | undefined>(undefined);
  const [appliedSearchLsbClass, setAppliedSearchLsbClass] = useState<string>("");
  const [appliedSearchMorphology, setAppliedSearchMorphology] = useState<string>("");
  const [appliedSearchAwesome, setAppliedSearchAwesome] = useState<boolean | undefined>(undefined);
  const [appliedSearchValidRedshift, setAppliedSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [appliedSearchVisibleNucleus, setAppliedSearchVisibleNucleus] = useState<boolean | undefined>(undefined);

  const previewImageName = "aplpy_defaults_unmasked";

  const galaxyData = useQuery(api.galaxies_browse.browseGalaxies, {
    offset: (page - 1) * pageSize,
    numItems: pageSize,
    sortBy,
    sortOrder,
    filter,
    searchId: isSearchActive ? appliedSearchId : undefined,
    searchRaMin: isSearchActive ? (appliedSearchRaMin || undefined) : undefined,
    searchRaMax: isSearchActive ? (appliedSearchRaMax || undefined) : undefined,
    searchDecMin: isSearchActive ? (appliedSearchDecMin || undefined) : undefined,
    searchDecMax: isSearchActive ? (appliedSearchDecMax || undefined) : undefined,
    searchReffMin: isSearchActive ? (appliedSearchReffMin || undefined) : undefined,
    searchReffMax: isSearchActive ? (appliedSearchReffMax || undefined) : undefined,
    searchQMin: isSearchActive ? (appliedSearchQMin || undefined) : undefined,
    searchQMax: isSearchActive ? (appliedSearchQMax || undefined) : undefined,
    searchPaMin: isSearchActive ? (appliedSearchPaMin || undefined) : undefined,
    searchPaMax: isSearchActive ? (appliedSearchPaMax || undefined) : undefined,
    searchMagMin: isSearchActive ? (appliedSearchMagMin || undefined) : undefined,
    searchMagMax: isSearchActive ? (appliedSearchMagMax || undefined) : undefined,
    searchMeanMueMin: isSearchActive ? (appliedSearchMeanMueMin || undefined) : undefined,
    searchMeanMueMax: isSearchActive ? (appliedSearchMeanMueMax || undefined) : undefined,
    searchNucleus: isSearchActive ? appliedSearchNucleus : undefined,
    searchClassificationStatus: isSearchActive ? appliedSearchClassificationStatus : undefined,
    searchLsbClass: isSearchActive ? appliedSearchLsbClass : undefined,
    searchMorphology: isSearchActive ? appliedSearchMorphology : undefined,
    searchAwesome: isSearchActive ? appliedSearchAwesome : undefined,
    searchValidRedshift: isSearchActive ? appliedSearchValidRedshift : undefined,
    searchVisibleNucleus: isSearchActive ? appliedSearchVisibleNucleus : undefined,
  });

  // Check if there are pending changes (current values differ from applied values)
  const hasPendingChanges = isSearchActive && (
    searchId !== appliedSearchId ||
    searchRaMin !== appliedSearchRaMin ||
    searchRaMax !== appliedSearchRaMax ||
    searchDecMin !== appliedSearchDecMin ||
    searchDecMax !== appliedSearchDecMax ||
    searchReffMin !== appliedSearchReffMin ||
    searchReffMax !== appliedSearchReffMax ||
    searchQMin !== appliedSearchQMin ||
    searchQMax !== appliedSearchQMax ||
    searchPaMin !== appliedSearchPaMin ||
    searchPaMax !== appliedSearchPaMax ||
    searchNucleus !== appliedSearchNucleus ||
    searchClassificationStatus !== appliedSearchClassificationStatus ||
    searchLsbClass !== appliedSearchLsbClass ||
    searchMorphology !== appliedSearchMorphology ||
    searchAwesome !== appliedSearchAwesome ||
    searchValidRedshift !== appliedSearchValidRedshift ||
    searchVisibleNucleus !== appliedSearchVisibleNucleus
  );

  // Get search bounds for prefill
  const searchBounds = useQuery(api.galaxies_browse.getGalaxySearchBounds);
  
  // Get classification options for dropdowns
  const classificationOptions = useQuery(api.galaxies_browse.getClassificationSearchOptions);

  // Extract current bounds from galaxy data (when search is active, these are filtered bounds)
  const currentBounds = galaxyData?.currentBounds;

  // Hydrate settings from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // legacy keys page/pageSize retained for backwards compatibility
          if (parsed.pageSize && Number.isFinite(parsed.pageSize)) setPageSize(parsed.pageSize);
          if (parsed.page && Number.isFinite(parsed.page)) setPage(parsed.page);
          if (parsed.sortBy) setSortBy(parsed.sortBy);
          if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
          if (parsed.filter) setFilter(parsed.filter);
          // New search fields
          if (typeof parsed.searchId === "string") {
            setSearchId(parsed.searchId);
            setAppliedSearchId(parsed.searchId);
          }
          if (typeof parsed.searchRaMin === "string") {
            setSearchRaMin(parsed.searchRaMin);
            setAppliedSearchRaMin(parsed.searchRaMin);
          }
          if (typeof parsed.searchRaMax === "string") {
            setSearchRaMax(parsed.searchRaMax);
            setAppliedSearchRaMax(parsed.searchRaMax);
          }
          if (typeof parsed.searchDecMin === "string") {
            setSearchDecMin(parsed.searchDecMin);
            setAppliedSearchDecMin(parsed.searchDecMin);
          }
          if (typeof parsed.searchDecMax === "string") {
            setSearchDecMax(parsed.searchDecMax);
            setAppliedSearchDecMax(parsed.searchDecMax);
          }
          if (typeof parsed.searchReffMin === "string") {
            setSearchReffMin(parsed.searchReffMin);
            setAppliedSearchReffMin(parsed.searchReffMin);
          }
          if (typeof parsed.searchReffMax === "string") {
            setSearchReffMax(parsed.searchReffMax);
            setAppliedSearchReffMax(parsed.searchReffMax);
          }
          if (typeof parsed.searchQMin === "string") {
            setSearchQMin(parsed.searchQMin);
            setAppliedSearchQMin(parsed.searchQMin);
          }
          if (typeof parsed.searchQMax === "string") {
            setSearchQMax(parsed.searchQMax);
            setAppliedSearchQMax(parsed.searchQMax);
          }
          if (typeof parsed.searchPaMin === "string") {
            setSearchPaMin(parsed.searchPaMin);
            setAppliedSearchPaMin(parsed.searchPaMin);
          }
          if (typeof parsed.searchPaMax === "string") {
            setSearchPaMax(parsed.searchPaMax);
            setAppliedSearchPaMax(parsed.searchPaMax);
          }
          if (typeof parsed.searchNucleus === "boolean") {
            setSearchNucleus(parsed.searchNucleus);
            setAppliedSearchNucleus(parsed.searchNucleus);
          }
          if (parsed.searchClassificationStatus) {
            setSearchClassificationStatus(parsed.searchClassificationStatus);
            setAppliedSearchClassificationStatus(parsed.searchClassificationStatus);
          }
          if (typeof parsed.searchLsbClass === "string") {
            setSearchLsbClass(parsed.searchLsbClass);
            setAppliedSearchLsbClass(parsed.searchLsbClass);
          }
          if (typeof parsed.searchMorphology === "string") {
            setSearchMorphology(parsed.searchMorphology);
            setAppliedSearchMorphology(parsed.searchMorphology);
          }
          if (typeof parsed.searchAwesome === "boolean") {
            setSearchAwesome(parsed.searchAwesome);
            setAppliedSearchAwesome(parsed.searchAwesome);
          }
          if (typeof parsed.searchValidRedshift === "boolean") {
            setSearchValidRedshift(parsed.searchValidRedshift);
            setAppliedSearchValidRedshift(parsed.searchValidRedshift);
          }
          if (typeof parsed.searchVisibleNucleus === "boolean") {
            setSearchVisibleNucleus(parsed.searchVisibleNucleus);
            setAppliedSearchVisibleNucleus(parsed.searchVisibleNucleus);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load galaxy browser settings", e);
    } finally {
      didHydrateFromStorage.current = true;
    }
  }, []);

  // Set default search bounds when data is available and we haven't loaded from localStorage
  useEffect(() => {
    if (!searchBounds || didHydrateFromStorage.current) return;

    // Only set defaults if we haven't loaded from localStorage and the fields are still empty
    const shouldSetDefaults = 
      searchRaMin === "" && searchRaMax === "" &&
      searchDecMin === "" && searchDecMax === "" &&
      searchReffMin === "" && searchReffMax === "" &&
      searchQMin === "" && searchQMax === "" &&
      searchPaMin === "" && searchPaMax === "" &&
      searchNucleus === undefined;

    if (shouldSetDefaults) {
      // Don't prefill inputs anymore - keep them empty
      // The placeholders will show the bounds instead
    }
  }, [searchBounds, searchRaMin, searchRaMax, searchDecMin, searchDecMax, searchReffMin, searchReffMax, searchQMin, searchQMax, searchPaMin, searchPaMax, searchNucleus, didHydrateFromStorage.current]);

  // Helper function to get placeholder text for bounds
  const getPlaceholderText = (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue', type: 'min' | 'max') => {
    const bounds = isSearchActive && currentBounds ? currentBounds : searchBounds;
    if (!bounds) return type === 'min' ? 'Min' : 'Max';
    
    const fieldBounds = (bounds as any)[field];
    if (!fieldBounds) return type === 'min' ? 'Min' : 'Max';
    
    const value = fieldBounds[type];
    if (value === null) return type === 'min' ? 'Min' : 'Max';
    
    // Format based on field type
    switch (field) {
      case 'ra':
      case 'dec':
        return `${type === 'min' ? 'Min' : 'Max'}: ${value.toFixed(4)}`;
      case 'reff':
      case 'mag':
      case 'mean_mue':
        return `${type === 'min' ? 'Min' : 'Max'}: ${value.toFixed(2)}`;
      case 'q':
        return `${type === 'min' ? 'Min' : 'Max'}: ${value.toFixed(3)}`;
      case 'pa':
        return `${type === 'min' ? 'Min' : 'Max'}: ${value.toFixed(1)}`;
      default:
        return type === 'min' ? 'Min' : 'Max';
    }
  };

  // Persist settings whenever they change
  useEffect(() => {
    if (!didHydrateFromStorage.current) return; // avoid overwriting while hydrating
    const data = {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      searchId: appliedSearchId,
      searchRaMin: appliedSearchRaMin,
      searchRaMax: appliedSearchRaMax,
      searchDecMin: appliedSearchDecMin,
      searchDecMax: appliedSearchDecMax,
      searchReffMin: appliedSearchReffMin,
      searchReffMax: appliedSearchReffMax,
      searchQMin: appliedSearchQMin,
      searchQMax: appliedSearchQMax,
      searchPaMin: appliedSearchPaMin,
      searchPaMax: appliedSearchPaMax,
      searchNucleus: appliedSearchNucleus,
      searchClassificationStatus: appliedSearchClassificationStatus,
      searchLsbClass: appliedSearchLsbClass,
      searchMorphology: appliedSearchMorphology,
      searchAwesome: appliedSearchAwesome,
      searchValidRedshift: appliedSearchValidRedshift,
      searchVisibleNucleus: appliedSearchVisibleNucleus,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save galaxy browser settings", e);
    }
  }, [page, pageSize, sortBy, sortOrder, filter, appliedSearchId, appliedSearchRaMin, appliedSearchRaMax, appliedSearchDecMin, appliedSearchDecMax, appliedSearchReffMin, appliedSearchReffMax, appliedSearchQMin, appliedSearchQMax, appliedSearchPaMin, appliedSearchPaMax, appliedSearchNucleus]);

  // Helper functions to check if individual fields have changes or values
  const hasFieldChanged = (field: string) => {
    if (!isSearchActive) {
      // When search is not active, highlight fields that have values
      switch (field) {
        case 'searchId': return searchId !== "";
        case 'searchRaMin': return searchRaMin !== "";
        case 'searchRaMax': return searchRaMax !== "";
        case 'searchDecMin': return searchDecMin !== "";
        case 'searchDecMax': return searchDecMax !== "";
        case 'searchReffMin': return searchReffMin !== "";
        case 'searchReffMax': return searchReffMax !== "";
        case 'searchQMin': return searchQMin !== "";
        case 'searchQMax': return searchQMax !== "";
        case 'searchPaMin': return searchPaMin !== "";
        case 'searchPaMax': return searchPaMax !== "";
        case 'searchNucleus': return searchNucleus !== undefined;
        case 'searchClassificationStatus': return searchClassificationStatus !== undefined;
        case 'searchLsbClass': return searchLsbClass !== "";
        case 'searchMorphology': return searchMorphology !== "";
        case 'searchAwesome': return searchAwesome !== undefined;
        case 'searchValidRedshift': return searchValidRedshift !== undefined;
        case 'searchVisibleNucleus': return searchVisibleNucleus !== undefined;
        default: return false;
      }
    }
    // When search is active, check for pending changes
    switch (field) {
      case 'searchId': return searchId !== appliedSearchId;
      case 'searchRaMin': return searchRaMin !== appliedSearchRaMin;
      case 'searchRaMax': return searchRaMax !== appliedSearchRaMax;
      case 'searchDecMin': return searchDecMin !== appliedSearchDecMin;
      case 'searchDecMax': return searchDecMax !== appliedSearchDecMax;
      case 'searchReffMin': return searchReffMin !== appliedSearchReffMin;
      case 'searchReffMax': return searchReffMax !== appliedSearchReffMax;
      case 'searchQMin': return searchQMin !== appliedSearchQMin;
      case 'searchQMax': return searchQMax !== appliedSearchQMax;
      case 'searchPaMin': return searchPaMin !== appliedSearchPaMin;
      case 'searchPaMax': return searchPaMax !== appliedSearchPaMax;
      case 'searchNucleus': return searchNucleus !== appliedSearchNucleus;
      case 'searchClassificationStatus': return searchClassificationStatus !== appliedSearchClassificationStatus;
      case 'searchLsbClass': return searchLsbClass !== appliedSearchLsbClass;
      case 'searchMorphology': return searchMorphology !== appliedSearchMorphology;
      case 'searchAwesome': return searchAwesome !== appliedSearchAwesome;
      case 'searchValidRedshift': return searchValidRedshift !== appliedSearchValidRedshift;
      case 'searchVisibleNucleus': return searchVisibleNucleus !== appliedSearchVisibleNucleus;
      default: return false;
    }
  };

  // Check if there are any search values (for when search is not active)
  const hasAnySearchValues = 
    searchId !== "" ||
    searchRaMin !== "" ||
    searchRaMax !== "" ||
    searchDecMin !== "" ||
    searchDecMax !== "" ||
    searchReffMin !== "" ||
    searchReffMax !== "" ||
    searchQMin !== "" ||
    searchQMax !== "" ||
    searchPaMin !== "" ||
    searchPaMax !== "" ||
    searchNucleus !== undefined ||
    searchClassificationStatus !== undefined ||
    searchLsbClass !== "" ||
    searchMorphology !== "" ||
    searchAwesome !== undefined ||
    searchValidRedshift !== undefined ||
    searchVisibleNucleus !== undefined;

  // Get input class with visual indicator for changed fields
  const getInputClass = (field: string, baseClass: string) => {
    return hasFieldChanged(field) 
      ? `${baseClass} ring-2 ring-orange-400 border-orange-400` 
      : baseClass;
  };

  const userPrefs = useQuery(api.users.getUserPreferences);

  // Reset to page 1 when filters change (except during initial hydration)
  useEffect(() => {
    if (!didHydrateFromStorage.current) return;
    setPage(1);
  }, [filter, sortBy, sortOrder, pageSize, isSearchActive]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      // Invalid page number, clear the input
      setJumpToPage("");
      return;
    }
    setPage(pageNum);
    setJumpToPage("");
  };

  const handleJumpKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJumpToPage();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "classified":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            Classified
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
            Unclassified
          </span>
        );
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortOrder === "asc" ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Track when we have data to avoid showing full loading state on subsequent queries
  useEffect(() => {
    if (galaxyData && !hasPreviousData) {
      setHasPreviousData(true);
    }
  }, [galaxyData, hasPreviousData]);

  if (!galaxyData) {
    if (hasPreviousData) {
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
            {/* Search Section */}
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
                    Classification Status
                  </label>
                  <select
                    value={searchClassificationStatus || ""}
                    onChange={(e) => setSearchClassificationStatus(e.target.value ? e.target.value as "classified" | "unclassified" | "skipped" : undefined)}
                    className={getInputClass('searchClassificationStatus', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any Status</option>
                    <option value="classified">Classified</option>
                    <option value="unclassified">Unclassified</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    LSB Class
                  </label>
                  <select
                    value={searchLsbClass}
                    onChange={(e) => setSearchLsbClass(e.target.value)}
                    className={getInputClass('searchLsbClass', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any LSB Class</option>
                    {classificationOptions?.lsbClasses.map(lsbClass => (
                      <option key={lsbClass} value={lsbClass}>{lsbClass}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Morphology
                  </label>
                  <select
                    value={searchMorphology}
                    onChange={(e) => setSearchMorphology(e.target.value)}
                    className={getInputClass('searchMorphology', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any Morphology</option>
                    {classificationOptions?.morphologies.map(morphology => (
                      <option key={morphology} value={morphology}>{morphology}</option>
                    ))}
                  </select>
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
                  onClick={() => {
                    // Apply pending changes
                    setAppliedSearchId(searchId);
                    setAppliedSearchRaMin(searchRaMin);
                    setAppliedSearchRaMax(searchRaMax);
                    setAppliedSearchDecMin(searchDecMin);
                    setAppliedSearchDecMax(searchDecMax);
                    setAppliedSearchReffMin(searchReffMin);
                    setAppliedSearchReffMax(searchReffMax);
                    setAppliedSearchQMin(searchQMin);
                    setAppliedSearchQMax(searchQMax);
                    setAppliedSearchPaMin(searchPaMin);
                    setAppliedSearchPaMax(searchPaMax);
                    setAppliedSearchNucleus(searchNucleus);
                    setAppliedSearchClassificationStatus(searchClassificationStatus);
                    setAppliedSearchLsbClass(searchLsbClass);
                    setAppliedSearchMorphology(searchMorphology);
                    setAppliedSearchAwesome(searchAwesome);
                    setAppliedSearchValidRedshift(searchValidRedshift);
                    setAppliedSearchVisibleNucleus(searchVisibleNucleus);
                    setIsSearchActive(true);
                    setPage(1);
                  }}
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
                  onClick={() => {
                    setSearchId("");
                    setSearchRaMin("");
                    setSearchRaMax("");
                    setSearchDecMin("");
                    setSearchDecMax("");
                    setSearchReffMin("");
                    setSearchReffMax("");
                    setSearchQMin("");
                    setSearchQMax("");
                    setSearchPaMin("");
                    setSearchPaMax("");
                    setSearchNucleus(undefined);
                    setSearchClassificationStatus(undefined);
                    setSearchLsbClass("");
                    setSearchMorphology("");
                    setSearchAwesome(undefined);
                    setSearchValidRedshift(undefined);
                    setSearchVisibleNucleus(undefined);
                    setAppliedSearchId("");
                    setAppliedSearchRaMin("");
                    setAppliedSearchRaMax("");
                    setAppliedSearchDecMin("");
                    setAppliedSearchDecMax("");
                    setAppliedSearchReffMin("");
                    setAppliedSearchReffMax("");
                    setAppliedSearchQMin("");
                    setAppliedSearchQMax("");
                    setAppliedSearchPaMin("");
                    setAppliedSearchPaMax("");
                    setAppliedSearchNucleus(undefined);
                    setAppliedSearchClassificationStatus(undefined);
                    setAppliedSearchLsbClass("");
                    setAppliedSearchMorphology("");
                    setAppliedSearchAwesome(undefined);
                    setAppliedSearchValidRedshift(undefined);
                    setAppliedSearchVisibleNucleus(undefined);
                    setIsSearchActive(false);
                    setPage(1);
                  }}
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
                    <option value="id">Galaxy ID</option>
                    <option value="ra">Right Ascension</option>
                    <option value="dec">Declination</option>
                    <option value="reff">Effective Radius</option>
                    <option value="q">Axis Ratio</option>
                    <option value="pa">Position Angle</option>
                    <option value="nucleus">Nucleus</option>
                    <option value="_creationTime">Creation Time</option>
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
            </div>
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
            {/* Search Section */}
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
                    Classification Status
                  </label>
                  <select
                    value={searchClassificationStatus || ""}
                    onChange={(e) => setSearchClassificationStatus(e.target.value ? e.target.value as "classified" | "unclassified" | "skipped" : undefined)}
                    className={getInputClass('searchClassificationStatus', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any Status</option>
                    <option value="classified">Classified</option>
                    <option value="unclassified">Unclassified</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    LSB Class
                  </label>
                  <select
                    value={searchLsbClass}
                    onChange={(e) => setSearchLsbClass(e.target.value)}
                    className={getInputClass('searchLsbClass', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any LSB Class</option>
                    {classificationOptions?.lsbClasses.map(lsbClass => (
                      <option key={lsbClass} value={lsbClass}>{lsbClass}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Morphology
                  </label>
                  <select
                    value={searchMorphology}
                    onChange={(e) => setSearchMorphology(e.target.value)}
                    className={getInputClass('searchMorphology', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
                  >
                    <option value="">Any Morphology</option>
                    {classificationOptions?.morphologies.map(morphology => (
                      <option key={morphology} value={morphology}>{morphology}</option>
                    ))}
                  </select>
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
                  onClick={() => {
                    // Apply pending changes
                    setAppliedSearchId(searchId);
                    setAppliedSearchRaMin(searchRaMin);
                    setAppliedSearchRaMax(searchRaMax);
                    setAppliedSearchDecMin(searchDecMin);
                    setAppliedSearchDecMax(searchDecMax);
                    setAppliedSearchReffMin(searchReffMin);
                    setAppliedSearchReffMax(searchReffMax);
                    setAppliedSearchQMin(searchQMin);
                    setAppliedSearchQMax(searchQMax);
                    setAppliedSearchPaMin(searchPaMin);
                    setAppliedSearchPaMax(searchPaMax);
                    setAppliedSearchNucleus(searchNucleus);
                    setAppliedSearchClassificationStatus(searchClassificationStatus);
                    setAppliedSearchLsbClass(searchLsbClass);
                    setAppliedSearchMorphology(searchMorphology);
                    setAppliedSearchAwesome(searchAwesome);
                    setAppliedSearchValidRedshift(searchValidRedshift);
                    setAppliedSearchVisibleNucleus(searchVisibleNucleus);
                    setIsSearchActive(true);
                    setPage(1);
                  }}
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
                  onClick={() => {
                    setSearchId("");
                    setSearchRaMin("");
                    setSearchRaMax("");
                    setSearchDecMin("");
                    setSearchDecMax("");
                    setSearchReffMin("");
                    setSearchReffMax("");
                    setSearchQMin("");
                    setSearchQMax("");
                    setSearchPaMin("");
                    setSearchPaMax("");
                    setSearchNucleus(undefined);
                    setSearchClassificationStatus(undefined);
                    setSearchLsbClass("");
                    setSearchMorphology("");
                    setSearchAwesome(undefined);
                    setSearchValidRedshift(undefined);
                    setSearchVisibleNucleus(undefined);
                    setAppliedSearchId("");
                    setAppliedSearchRaMin("");
                    setAppliedSearchRaMax("");
                    setAppliedSearchDecMin("");
                    setAppliedSearchDecMax("");
                    setAppliedSearchReffMin("");
                    setAppliedSearchReffMax("");
                    setAppliedSearchQMin("");
                    setAppliedSearchQMax("");
                    setAppliedSearchPaMin("");
                    setAppliedSearchPaMax("");
                    setAppliedSearchNucleus(undefined);
                    setAppliedSearchClassificationStatus(undefined);
                    setAppliedSearchLsbClass("");
                    setAppliedSearchMorphology("");
                    setAppliedSearchAwesome(undefined);
                    setAppliedSearchValidRedshift(undefined);
                    setAppliedSearchVisibleNucleus(undefined);
                    setIsSearchActive(false);
                    setPage(1);
                  }}
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
                    <option value="id">Galaxy ID</option>
                    <option value="ra">Right Ascension</option>
                    <option value="dec">Declination</option>
                    <option value="reff">Effective Radius</option>
                    <option value="q">Axis Ratio</option>
                    <option value="pa">Position Angle</option>
                    <option value="nucleus">Nucleus</option>
                    <option value="_creationTime">Creation Time</option>
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
            </div>
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

  const { galaxies, total, hasNext, hasPrevious, totalPages } = galaxyData;

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
        {/* Search Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Search Galaxies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1367px]:grid-cols-3 min-[1747px]:grid-cols-4 gap-3 mb-4">
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
                Classification Status
              </label>
              <select
                value={searchClassificationStatus || ""}
                onChange={(e) => setSearchClassificationStatus(e.target.value ? e.target.value as "classified" | "unclassified" | "skipped" : undefined)}
                className={getInputClass('searchClassificationStatus', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
              >
                <option value="">Any Status</option>
                <option value="classified">Classified</option>
                <option value="unclassified">Unclassified</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LSB Class
              </label>
              <select
                value={searchLsbClass}
                onChange={(e) => setSearchLsbClass(e.target.value)}
                className={getInputClass('searchLsbClass', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
              >
                <option value="">Any LSB Class</option>
                {classificationOptions?.lsbClasses.map(lsbClass => (
                  <option key={lsbClass} value={lsbClass}>{lsbClass}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Morphology
              </label>
              <select
                value={searchMorphology}
                onChange={(e) => setSearchMorphology(e.target.value)}
                className={getInputClass('searchMorphology', "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white")}
              >
                <option value="">Any Morphology</option>
                {classificationOptions?.morphologies.map(morphology => (
                  <option key={morphology} value={morphology}>{morphology}</option>
                ))}
              </select>
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
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Valid Redshift
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchValidRedshift === true}
                  onChange={(e) => setSearchValidRedshift(e.target.checked ? true : undefined)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">Only show galaxies with valid redshift</span>
              </label>
            </div> */}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                // Apply pending changes
                setAppliedSearchId(searchId);
                setAppliedSearchRaMin(searchRaMin);
                setAppliedSearchRaMax(searchRaMax);
                setAppliedSearchDecMin(searchDecMin);
                setAppliedSearchDecMax(searchDecMax);
                setAppliedSearchReffMin(searchReffMin);
                setAppliedSearchReffMax(searchReffMax);
                setAppliedSearchQMin(searchQMin);
                setAppliedSearchQMax(searchQMax);
                setAppliedSearchPaMin(searchPaMin);
                setAppliedSearchPaMax(searchPaMax);
                setAppliedSearchMagMin(searchMagMin);
                setAppliedSearchMagMax(searchMagMax);
                setAppliedSearchMeanMueMin(searchMeanMueMin);
                setAppliedSearchMeanMueMax(searchMeanMueMax);
                setAppliedSearchNucleus(searchNucleus);
                setAppliedSearchClassificationStatus(searchClassificationStatus);
                setAppliedSearchLsbClass(searchLsbClass);
                setAppliedSearchMorphology(searchMorphology);
                setAppliedSearchAwesome(searchAwesome);
                setAppliedSearchValidRedshift(searchValidRedshift);
                setAppliedSearchVisibleNucleus(searchVisibleNucleus);
                setIsSearchActive(true);
                setPage(1);
              }}
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
              onClick={() => {
                setSearchId("");
                setSearchRaMin("");
                setSearchRaMax("");
                setSearchDecMin("");
                setSearchDecMax("");
                setSearchReffMin("");
                setSearchReffMax("");
                setSearchQMin("");
                setSearchQMax("");
                setSearchPaMin("");
                setSearchPaMax("");
                setSearchMagMin("");
                setSearchMagMax("");
                setSearchMeanMueMin("");
                setSearchMeanMueMax("");
                setSearchNucleus(undefined);
                setSearchClassificationStatus(undefined);
                setSearchLsbClass("");
                setSearchMorphology("");
                setSearchAwesome(undefined);
                setSearchValidRedshift(undefined);
                setSearchVisibleNucleus(undefined);
                setAppliedSearchId("");
                setAppliedSearchRaMin("");
                setAppliedSearchRaMax("");
                setAppliedSearchDecMin("");
                setAppliedSearchDecMax("");
                setAppliedSearchReffMin("");
                setAppliedSearchReffMax("");
                setAppliedSearchQMin("");
                setAppliedSearchQMax("");
                setAppliedSearchPaMin("");
                setAppliedSearchPaMax("");
                setAppliedSearchMagMin("");
                setAppliedSearchMagMax("");
                setAppliedSearchMeanMueMin("");
                setAppliedSearchMeanMueMax("");
                setAppliedSearchNucleus(undefined);
                setAppliedSearchClassificationStatus(undefined);
                setAppliedSearchLsbClass("");
                setAppliedSearchMorphology("");
                setAppliedSearchAwesome(undefined);
                setAppliedSearchValidRedshift(undefined);
                setAppliedSearchVisibleNucleus(undefined);
                setIsSearchActive(false);
                setPage(1);
              }}
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
              <option value="id">Galaxy ID</option>
              <option value="ra">Right Ascension</option>
              <option value="dec">Declination</option>
              <option value="reff">Effective Radius</option>
              <option value="q">Axis Ratio</option>
              <option value="pa">Position Angle</option>
              <option value="mag">Magnitude</option>
              <option value="mean_mue">Mean Surface Brightness</option>
              <option value="nucleus">Nucleus</option>
              <option value="_creationTime">Creation Time</option>
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
      </div>

      {/* Results Status */}
      <div className="mb-6 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} galaxies
        </p>
        {!galaxyData?.aggregatesPopulated && total > 0 && (
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
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!galaxyData ? (
          /* Loading state for table area when we have previous data */
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Updating results...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Image
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Galaxy ID</span>
                      {getSortIcon("id")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("ra")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>RA</span>
                      {getSortIcon("ra")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("dec")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Dec</span>
                      {getSortIcon("dec")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("reff")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Reff</span>
                      {getSortIcon("reff")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("q")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>q</span>
                      {getSortIcon("q")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("nucleus")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nucleus</span>
                      {getSortIcon("nucleus")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("mag")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Mag</span>
                      {getSortIcon("mag")}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort("mean_mue")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>μ₀</span>
                      {getSortIcon("mean_mue")}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {galaxies.map((galaxy: any) => (
                  <tr key={galaxy._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-16 h-16">
                        <ImageViewer
                          imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                          alt={`Galaxy ${galaxy.id}`}
                          preferences={userPrefs}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {/* <Link to={`/classify/${galaxy.id}`} className="text-blue-600 dark:text-blue-400 hover:underline"> */}
                        {galaxy.id}
                      {/* </Link> */}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.ra.toFixed(4)}°
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.dec.toFixed(4)}°
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.reff.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.q.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        galaxy.nucleus
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                      )}>
                        {galaxy.nucleus ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(galaxy.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {galaxy.classification ? (
                        <div className="space-y-1">
                          <div>LSB: {galaxy.classification.lsb_class}</div>
                          <div>Morph: {galaxy.classification.morphology}</div>
                          <div className="flex space-x-1">
                            {galaxy.classification.awesome_flag && (
                              <span className="text-yellow-600 dark:text-yellow-400" title="Awesome">⭐</span>
                            )}
                            {galaxy.classification.valid_redshift && (
                              <span className="text-blue-600 dark:text-blue-400" title="Valid redshift">🔴</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        to={`/classify/${galaxy.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                      >
                        Classify
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {!galaxyData ? (
          /* Loading state for mobile cards when we have previous data */
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Updating results...</p>
            </div>
          </div>
        ) : (
          galaxies.map((galaxy: any) => (
            <div
              key={galaxy._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start space-x-4">
                <div className="w-20 h-20 flex-shrink-0">
                  <ImageViewer
                    imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: userPrefs?.imageQuality || "medium" })}
                    alt={`Galaxy ${galaxy.id}`}
                    preferences={userPrefs}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {galaxy.id}
                    </h3>
                    {getStatusBadge(galaxy.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                    <div>RA: {galaxy.ra.toFixed(4)}°</div>
                    <div>Dec: {galaxy.dec.toFixed(4)}°</div>
                    <div>Reff: {galaxy.reff.toFixed(2)}</div>
                    <div>q: {galaxy.q.toFixed(3)}</div>
                    <div>PA: {galaxy.pa.toFixed(1)}°</div>
                    <div>Nucleus: {galaxy.nucleus ? "Yes" : "No"}</div>
                    <div>Mag: {galaxy.mag !== undefined ? galaxy.mag.toFixed(2) : "—"}</div>
                    <div>μ₀: {galaxy.mean_mue !== undefined ? galaxy.mean_mue.toFixed(2) : "—"}</div>
                  </div>
                  
                  {galaxy.classification && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center space-x-4">
                        <span>LSB: {galaxy.classification.lsb_class}</span>
                        <span>Morph: {galaxy.classification.morphology}</span>
                        {galaxy.classification.awesome_flag && (
                          <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                        )}
                        {galaxy.classification.valid_redshift && (
                          <span className="text-blue-600 dark:text-blue-400">🔴</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to={`/classify/${galaxy.id}`}
                  className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  Classify
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={!hasPrevious}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                hasPrevious
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={!hasNext}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                hasNext
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
            >
              Next
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Jump to:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                onKeyPress={handleJumpKeyPress}
                placeholder="Page"
                className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleJumpToPage}
                className="px-3 py-1 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Go
              </button>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Page {page} of {totalPages}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
