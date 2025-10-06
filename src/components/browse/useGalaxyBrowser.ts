import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { SortField, SortOrder, FilterType } from "./GalaxyBrowser";
import {
  STORAGE_KEY,
  getPlaceholderText,
  hasFieldChanged,
  getInputClass,
  handleSort as handleSortUtil,
  hasAnySearchValues
} from "./galaxyBrowserUtils";
import { getPreviewImageName } from "../../images/displaySettings";

export interface UseGalaxyBrowserReturn {
  // State
  page: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  sortBy: SortField;
  setSortBy: (field: SortField) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  goNext: () => void;
  goPrev: () => void;

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
  isSearchActive: boolean;
  hasPendingChanges: boolean;
  hasPreviousData: boolean;

  // Queries
  galaxyData: any;
  searchBounds: any;
  userPrefs: any;

  // Computed values
  currentBounds: any;
  hasPrevious: boolean;
  hasNext: boolean;
  previewImageName: string;

  // Utility functions
  getPlaceholderText: (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue', type: 'min' | 'max') => string;
  hasFieldChanged: (field: string) => boolean;
  getInputClass: (field: string, baseClass: string) => string;
  hasAnySearchValues: boolean;

  // Handlers
  handleSort: (field: SortField) => void;
  applySearch: () => void;
  clearSearch: () => void;
}

export function useGalaxyBrowser(): UseGalaxyBrowserReturn {
  // Basic state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>("numericId");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filter, setFilter] = useState<FilterType>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Search fields
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
  const [searchTotalClassificationsMin, setSearchTotalClassificationsMin] = useState("");
  const [searchTotalClassificationsMax, setSearchTotalClassificationsMax] = useState("");
  const [searchNumVisibleNucleusMin, setSearchNumVisibleNucleusMin] = useState("");
  const [searchNumVisibleNucleusMax, setSearchNumVisibleNucleusMax] = useState("");
  const [searchNumAwesomeFlagMin, setSearchNumAwesomeFlagMin] = useState("");
  const [searchNumAwesomeFlagMax, setSearchNumAwesomeFlagMax] = useState("");
  const [searchTotalAssignedMin, setSearchTotalAssignedMin] = useState("");
  const [searchTotalAssignedMax, setSearchTotalAssignedMax] = useState("");
  const [searchAwesome, setSearchAwesome] = useState<boolean | undefined>(undefined);
  const [searchValidRedshift, setSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [searchVisibleNucleus, setSearchVisibleNucleus] = useState<boolean | undefined>(undefined);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const didHydrateFromStorage = useRef(false);
  const [hasPreviousData, setHasPreviousData] = useState(false);

  // Applied search values
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
  const [appliedSearchTotalClassificationsMin, setAppliedSearchTotalClassificationsMin] = useState("");
  const [appliedSearchTotalClassificationsMax, setAppliedSearchTotalClassificationsMax] = useState("");
  const [appliedSearchNumVisibleNucleusMin, setAppliedSearchNumVisibleNucleusMin] = useState("");
  const [appliedSearchNumVisibleNucleusMax, setAppliedSearchNumVisibleNucleusMax] = useState("");
  const [appliedSearchNumAwesomeFlagMin, setAppliedSearchNumAwesomeFlagMin] = useState("");
  const [appliedSearchNumAwesomeFlagMax, setAppliedSearchNumAwesomeFlagMax] = useState("");
  const [appliedSearchTotalAssignedMin, setAppliedSearchTotalAssignedMin] = useState("");
  const [appliedSearchTotalAssignedMax, setAppliedSearchTotalAssignedMax] = useState("");
  const [appliedSearchAwesome, setAppliedSearchAwesome] = useState<boolean | undefined>(undefined);
  const [appliedSearchValidRedshift, setAppliedSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [appliedSearchVisibleNucleus, setAppliedSearchVisibleNucleus] = useState<boolean | undefined>(undefined);

  const previewImageName = getPreviewImageName();

  // Queries
  const galaxyData = useQuery(api.galaxies_browse.browseGalaxies, {
    offset: 0,
    numItems: pageSize,
    cursor: cursor ?? undefined,
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
    searchTotalClassificationsMin: isSearchActive ? (appliedSearchTotalClassificationsMin || undefined) : undefined,
    searchTotalClassificationsMax: isSearchActive ? (appliedSearchTotalClassificationsMax || undefined) : undefined,
    searchNumVisibleNucleusMin: isSearchActive ? (appliedSearchNumVisibleNucleusMin || undefined) : undefined,
    searchNumVisibleNucleusMax: isSearchActive ? (appliedSearchNumVisibleNucleusMax || undefined) : undefined,
    searchNumAwesomeFlagMin: isSearchActive ? (appliedSearchNumAwesomeFlagMin || undefined) : undefined,
    searchNumAwesomeFlagMax: isSearchActive ? (appliedSearchNumAwesomeFlagMax || undefined) : undefined,
    searchTotalAssignedMin: isSearchActive ? (appliedSearchTotalAssignedMin || undefined) : undefined,
    searchTotalAssignedMax: isSearchActive ? (appliedSearchTotalAssignedMax || undefined) : undefined,
    searchAwesome: isSearchActive ? appliedSearchAwesome : undefined,
    searchValidRedshift: isSearchActive ? appliedSearchValidRedshift : undefined,
    searchVisibleNucleus: isSearchActive ? appliedSearchVisibleNucleus : undefined,
  });

  const searchBounds = useQuery(api.galaxies_browse.getGalaxySearchBounds);
  const userPrefs = useQuery(api.users.getUserPreferences);

  // Computed values
  const currentBounds = galaxyData?.currentBounds;
  const hasPrevious = cursorStack.length > 0;
  const hasNext = !!galaxyData?.hasNext;

  // Check if there are pending changes
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
    searchMagMin !== appliedSearchMagMin ||
    searchMagMax !== appliedSearchMagMax ||
    searchMeanMueMin !== appliedSearchMeanMueMin ||
    searchMeanMueMax !== appliedSearchMeanMueMax ||
    searchNucleus !== appliedSearchNucleus ||
    searchTotalClassificationsMin !== appliedSearchTotalClassificationsMin ||
    searchTotalClassificationsMax !== appliedSearchTotalClassificationsMax ||
    searchNumVisibleNucleusMin !== appliedSearchNumVisibleNucleusMin ||
    searchNumVisibleNucleusMax !== appliedSearchNumVisibleNucleusMax ||
    searchNumAwesomeFlagMin !== appliedSearchNumAwesomeFlagMin ||
    searchNumAwesomeFlagMax !== appliedSearchNumAwesomeFlagMax ||
    searchTotalAssignedMin !== appliedSearchTotalAssignedMin ||
    searchTotalAssignedMax !== appliedSearchTotalAssignedMax ||
    searchAwesome !== appliedSearchAwesome ||
    searchValidRedshift !== appliedSearchValidRedshift ||
    searchVisibleNucleus !== appliedSearchVisibleNucleus
  );

  // Check if there are any search values
  const hasAnySearchValuesComputed = hasAnySearchValues({
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
    searchTotalAssignedMin,
    searchTotalAssignedMax,
    searchAwesome,
    searchValidRedshift,
    searchVisibleNucleus,
  });

  // Effects
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.pageSize && Number.isFinite(parsed.pageSize)) setPageSize(parsed.pageSize);
          // page number is derived from cursor history now; don't restore it directly
          if (parsed.sortBy) setSortBy(parsed.sortBy);
          if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
          if (parsed.filter) setFilter(parsed.filter);

          // Search fields
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
          if (typeof parsed.searchMagMin === "string") {
            setSearchMagMin(parsed.searchMagMin);
            setAppliedSearchMagMin(parsed.searchMagMin);
          }
          if (typeof parsed.searchMagMax === "string") {
            setSearchMagMax(parsed.searchMagMax);
            setAppliedSearchMagMax(parsed.searchMagMax);
          }
          if (typeof parsed.searchMeanMueMin === "string") {
            setSearchMeanMueMin(parsed.searchMeanMueMin);
            setAppliedSearchMeanMueMin(parsed.searchMeanMueMin);
          }
          if (typeof parsed.searchMeanMueMax === "string") {
            setSearchMeanMueMax(parsed.searchMeanMueMax);
            setAppliedSearchMeanMueMax(parsed.searchMeanMueMax);
          }
          if (typeof parsed.searchNucleus === "boolean") {
            setSearchNucleus(parsed.searchNucleus);
            setAppliedSearchNucleus(parsed.searchNucleus);
          }
          if (typeof parsed.searchTotalClassificationsMin === "string") {
            setSearchTotalClassificationsMin(parsed.searchTotalClassificationsMin);
            setAppliedSearchTotalClassificationsMin(parsed.searchTotalClassificationsMin);
          }
          if (typeof parsed.searchTotalClassificationsMax === "string") {
            setSearchTotalClassificationsMax(parsed.searchTotalClassificationsMax);
            setAppliedSearchTotalClassificationsMax(parsed.searchTotalClassificationsMax);
          }
          if (typeof parsed.searchNumVisibleNucleusMin === "string") {
            setSearchNumVisibleNucleusMin(parsed.searchNumVisibleNucleusMin);
            setAppliedSearchNumVisibleNucleusMin(parsed.searchNumVisibleNucleusMin);
          }
          if (typeof parsed.searchNumVisibleNucleusMax === "string") {
            setSearchNumVisibleNucleusMax(parsed.searchNumVisibleNucleusMax);
            setAppliedSearchNumVisibleNucleusMax(parsed.searchNumVisibleNucleusMax);
          }
          if (typeof parsed.searchNumAwesomeFlagMin === "string") {
            setSearchNumAwesomeFlagMin(parsed.searchNumAwesomeFlagMin);
            setAppliedSearchNumAwesomeFlagMin(parsed.searchNumAwesomeFlagMin);
          }
          if (typeof parsed.searchNumAwesomeFlagMax === "string") {
            setSearchNumAwesomeFlagMax(parsed.searchNumAwesomeFlagMax);
            setAppliedSearchNumAwesomeFlagMax(parsed.searchNumAwesomeFlagMax);
          }
          if (typeof parsed.searchTotalAssignedMin === "string") {
            setSearchTotalAssignedMin(parsed.searchTotalAssignedMin);
            setAppliedSearchTotalAssignedMin(parsed.searchTotalAssignedMin);
          }
          if (typeof parsed.searchTotalAssignedMax === "string") {
            setSearchTotalAssignedMax(parsed.searchTotalAssignedMax);
            setAppliedSearchTotalAssignedMax(parsed.searchTotalAssignedMax);
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

  useEffect(() => {
    if (!didHydrateFromStorage.current) return;
    const data = {
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
      searchMagMin: appliedSearchMagMin,
      searchMagMax: appliedSearchMagMax,
      searchMeanMueMin: appliedSearchMeanMueMin,
      searchMeanMueMax: appliedSearchMeanMueMax,
      searchNucleus: appliedSearchNucleus,
      searchTotalClassificationsMin: appliedSearchTotalClassificationsMin,
      searchTotalClassificationsMax: appliedSearchTotalClassificationsMax,
      searchNumVisibleNucleusMin: appliedSearchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax: appliedSearchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin: appliedSearchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax: appliedSearchNumAwesomeFlagMax,
      searchTotalAssignedMin: appliedSearchTotalAssignedMin,
      searchTotalAssignedMax: appliedSearchTotalAssignedMax,
      searchAwesome: appliedSearchAwesome,
      searchValidRedshift: appliedSearchValidRedshift,
      searchVisibleNucleus: appliedSearchVisibleNucleus,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save galaxy browser settings", e);
    }
  }, [pageSize, sortBy, sortOrder, filter, appliedSearchId, appliedSearchRaMin, appliedSearchRaMax, appliedSearchDecMin, appliedSearchDecMax, appliedSearchReffMin, appliedSearchReffMax, appliedSearchQMin, appliedSearchQMax, appliedSearchPaMin, appliedSearchPaMax, appliedSearchMagMin, appliedSearchMagMax, appliedSearchMeanMueMin, appliedSearchMeanMueMax, appliedSearchNucleus, appliedSearchTotalClassificationsMin, appliedSearchTotalClassificationsMax, appliedSearchNumVisibleNucleusMin, appliedSearchNumVisibleNucleusMax, appliedSearchNumAwesomeFlagMin, appliedSearchNumAwesomeFlagMax, appliedSearchTotalAssignedMin, appliedSearchTotalAssignedMax]);

  useEffect(() => {
    if (!didHydrateFromStorage.current) return;
    // reset cursor-based pagination
    setPage(1);
    setCursor(null);
    setCursorStack([]);
  }, [filter, sortBy, sortOrder, pageSize, isSearchActive]);

  useEffect(() => {
    if (galaxyData && !hasPreviousData) {
      setHasPreviousData(true);
    }
  }, [galaxyData, hasPreviousData]);

  // Handlers
  const handleSort = (field: SortField) => {
    handleSortUtil(field, sortBy, sortOrder, setSortBy, setSortOrder);
  };

  const goNext = () => {
    if (!galaxyData?.hasNext) return;
    setCursorStack((prev) => [...prev, cursor ?? ""]);
    setCursor(galaxyData?.cursor ?? null);
    setPage((p) => p + 1);
  };

  const goPrev = () => {
    if (cursorStack.length === 0) return;
    setCursorStack((prev) => {
      const copy = [...prev];
      const prevCursor = copy.pop() ?? null;
      setCursor(prevCursor || null);
      return copy;
    });
    setPage((p) => Math.max(1, p - 1));
  };

  const applySearch = () => {
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
    setAppliedSearchTotalClassificationsMin(searchTotalClassificationsMin);
    setAppliedSearchTotalClassificationsMax(searchTotalClassificationsMax);
    setAppliedSearchNumVisibleNucleusMin(searchNumVisibleNucleusMin);
    setAppliedSearchNumVisibleNucleusMax(searchNumVisibleNucleusMax);
    setAppliedSearchNumAwesomeFlagMin(searchNumAwesomeFlagMin);
    setAppliedSearchNumAwesomeFlagMax(searchNumAwesomeFlagMax);
    setAppliedSearchTotalAssignedMin(searchTotalAssignedMin);
    setAppliedSearchTotalAssignedMax(searchTotalAssignedMax);
    setAppliedSearchAwesome(searchAwesome);
    setAppliedSearchValidRedshift(searchValidRedshift);
    setAppliedSearchVisibleNucleus(searchVisibleNucleus);
    setIsSearchActive(true);
    setPage(1);
    setCursor(null);
    setCursorStack([]);
  };

  const clearSearch = () => {
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
    setSearchTotalClassificationsMin("");
    setSearchTotalClassificationsMax("");
    setSearchNumVisibleNucleusMin("");
    setSearchNumVisibleNucleusMax("");
    setSearchNumAwesomeFlagMin("");
    setSearchNumAwesomeFlagMax("");
    setSearchTotalAssignedMin("");
    setSearchTotalAssignedMax("");
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
    setAppliedSearchTotalClassificationsMin("");
    setAppliedSearchTotalClassificationsMax("");
    setAppliedSearchNumVisibleNucleusMin("");
    setAppliedSearchNumVisibleNucleusMax("");
    setAppliedSearchNumAwesomeFlagMin("");
    setAppliedSearchNumAwesomeFlagMax("");
    setAppliedSearchTotalAssignedMin("");
    setAppliedSearchTotalAssignedMax("");
    setAppliedSearchAwesome(undefined);
    setAppliedSearchValidRedshift(undefined);
    setAppliedSearchVisibleNucleus(undefined);
    setIsSearchActive(false);
    setPage(1);
    setCursor(null);
    setCursorStack([]);
  };

  // Utility functions
  const getPlaceholderTextWrapper = (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue', type: 'min' | 'max') => {
    const bounds = isSearchActive && currentBounds ? currentBounds : searchBounds;
    return getPlaceholderText(field, type, bounds);
  };

  const hasFieldChangedWrapper = (field: string) => {
    return hasFieldChanged(field, isSearchActive, {
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
      searchTotalAssignedMin,
      searchTotalAssignedMax,
      searchAwesome,
      searchValidRedshift,
      searchVisibleNucleus,
    }, {
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
      searchMagMin: appliedSearchMagMin,
      searchMagMax: appliedSearchMagMax,
      searchMeanMueMin: appliedSearchMeanMueMin,
      searchMeanMueMax: appliedSearchMeanMueMax,
      searchNucleus: appliedSearchNucleus,
      searchTotalClassificationsMin: appliedSearchTotalClassificationsMin,
      searchTotalClassificationsMax: appliedSearchTotalClassificationsMax,
      searchNumVisibleNucleusMin: appliedSearchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax: appliedSearchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin: appliedSearchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax: appliedSearchNumAwesomeFlagMax,
      searchTotalAssignedMin: appliedSearchTotalAssignedMin,
      searchTotalAssignedMax: appliedSearchTotalAssignedMax,
      searchAwesome: appliedSearchAwesome,
      searchValidRedshift: appliedSearchValidRedshift,
      searchVisibleNucleus: appliedSearchVisibleNucleus,
    });
  };

  const getInputClassWrapper = (field: string, baseClass: string) => {
    return getInputClass(field, baseClass, hasFieldChangedWrapper(field));
  };

  return {
    // State
    page,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filter,
    setFilter,
    goNext,
    goPrev,

    // Search state
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
    hasPreviousData,

    // Queries
    galaxyData,
    searchBounds,
    userPrefs,

    // Computed values
  currentBounds,
    hasPrevious,
    hasNext,
    previewImageName,

    // Utility functions
    getPlaceholderText: getPlaceholderTextWrapper,
    hasFieldChanged: hasFieldChangedWrapper,
    getInputClass: getInputClassWrapper,
    hasAnySearchValues: hasAnySearchValuesComputed,

    // Handlers
    handleSort,
    applySearch,
    clearSearch,
  };
}