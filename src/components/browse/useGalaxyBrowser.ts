import { useState, useEffect, useLayoutEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
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
import {
  buildGalaxyBrowserViewState,
  parseGalaxyBrowserUrlState,
  type GalaxyBrowserAppliedSearchValues,
  type GalaxyBrowserViewState,
} from "./galaxyBrowserUrlState";

export type AppliedGalaxySearchValues = GalaxyBrowserAppliedSearchValues;

export interface GalaxyBrowserViewStateIssue {
  kind: "warning" | "unavailable";
  message: string;
}

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
  jumpToPage: (page: number) => void;
  goNext: () => void;
  goPrev: () => void;
  goFirst: () => void;
  isSearchFormCollapsed: boolean;
  setIsSearchFormCollapsed: Dispatch<SetStateAction<boolean>>;

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
  appliedSearchValues: AppliedGalaxySearchValues;
  isSearchActive: boolean;
  hasPendingChanges: boolean;
  hasPreviousData: boolean;
  isUrlStateReady: boolean;
  isViewUnavailable: boolean;
  viewStateIssue: GalaxyBrowserViewStateIssue | null;
  currentViewKey: string | null;

  // Queries
  galaxyData: any;
  searchBounds: any;
  userPrefs: any;
  effectiveImageQuality: "high" | "medium" | "low";

  // Computed values
  currentBounds: any;
  hasPrevious: boolean;
  hasNext: boolean;
  previewImageName: string;

  // Utility functions
  getPlaceholderText: (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'numFailedFitting' | 'totalAssigned', type: 'min' | 'max') => string;
  getBoundsForField: (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'numFailedFitting' | 'totalAssigned') => { min?: number; max?: number } | undefined;
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
  const [isSearchFormCollapsed, setIsSearchFormCollapsed] = useState(true);

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
  const [searchNumFailedFittingMin, setSearchNumFailedFittingMin] = useState("");
  const [searchNumFailedFittingMax, setSearchNumFailedFittingMax] = useState("");
  const [searchTotalAssignedMin, setSearchTotalAssignedMin] = useState("");
  const [searchTotalAssignedMax, setSearchTotalAssignedMax] = useState("");
  const [searchAwesome, setSearchAwesome] = useState<boolean | undefined>(undefined);
  const [searchValidRedshift, setSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [searchVisibleNucleus, setSearchVisibleNucleus] = useState<boolean | undefined>(undefined);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hasPreviousData, setHasPreviousData] = useState(false);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [viewStateIssue, setViewStateIssue] = useState<GalaxyBrowserViewStateIssue | null>(null);
  const [isViewUnavailable, setIsViewUnavailable] = useState(false);
  const [currentViewKey, setCurrentViewKey] = useState<string | null>(null);

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
  const [appliedSearchNumFailedFittingMin, setAppliedSearchNumFailedFittingMin] = useState("");
  const [appliedSearchNumFailedFittingMax, setAppliedSearchNumFailedFittingMax] = useState("");
  const [appliedSearchTotalAssignedMin, setAppliedSearchTotalAssignedMin] = useState("");
  const [appliedSearchTotalAssignedMax, setAppliedSearchTotalAssignedMax] = useState("");
  const [appliedSearchAwesome, setAppliedSearchAwesome] = useState<boolean | undefined>(undefined);
  const [appliedSearchValidRedshift, setAppliedSearchValidRedshift] = useState<boolean | undefined>(undefined);
  const [appliedSearchVisibleNucleus, setAppliedSearchVisibleNucleus] = useState<boolean | undefined>(undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const ensureBrowserView = useMutation(api.galaxies.viewState.ensureBrowserView);
  const previewImageName = getPreviewImageName();
  const parsedBrowserUrlState = useMemo(() => parseGalaxyBrowserUrlState(searchParams), [searchParams]);
  const browserSearchParamsSignature = searchParams.toString();
  const resolvedBrowserView = useQuery(
    api.galaxies.viewState.resolveBrowserView,
    parsedBrowserUrlState.viewKey ? { viewKey: parsedBrowserUrlState.viewKey } : "skip",
  );
  const lastAppliedBrowserUrlSignatureRef = useRef<string | null>(null);
  const lastWrittenBrowserUrlSignatureRef = useRef<string | null>(null);
  const pendingBrowserUrlSyncSignatureRef = useRef<string | null>(null);
  const lastEnsuredViewSignatureRef = useRef<string | null>(null);
  const unavailableViewSignatureRef = useRef<string | null>(null);
  const skipNextPaginationResetRef = useRef(false);
  const pendingScrollRestoreTopRef = useRef<number | null>(null);
  const pendingScrollRestoreLeftRef = useRef<number | null>(null);
  const latestBrowserPagingRef = useRef({
    page,
    pageSize,
    currentViewKey,
  });

  latestBrowserPagingRef.current = {
    page,
    pageSize,
    currentViewKey,
  };

  const currentDraftSearchValues = useMemo<AppliedGalaxySearchValues>(() => ({
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
  }), [
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
  ]);

  const currentAppliedSearchValues = useMemo<AppliedGalaxySearchValues>(() => ({
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
    searchNumFailedFittingMin: appliedSearchNumFailedFittingMin,
    searchNumFailedFittingMax: appliedSearchNumFailedFittingMax,
    searchTotalAssignedMin: appliedSearchTotalAssignedMin,
    searchTotalAssignedMax: appliedSearchTotalAssignedMax,
    searchAwesome: appliedSearchAwesome,
    searchValidRedshift: appliedSearchValidRedshift,
    searchVisibleNucleus: appliedSearchVisibleNucleus,
  }), [
    appliedSearchId,
    appliedSearchRaMin,
    appliedSearchRaMax,
    appliedSearchDecMin,
    appliedSearchDecMax,
    appliedSearchReffMin,
    appliedSearchReffMax,
    appliedSearchQMin,
    appliedSearchQMax,
    appliedSearchPaMin,
    appliedSearchPaMax,
    appliedSearchMagMin,
    appliedSearchMagMax,
    appliedSearchMeanMueMin,
    appliedSearchMeanMueMax,
    appliedSearchNucleus,
    appliedSearchTotalClassificationsMin,
    appliedSearchTotalClassificationsMax,
    appliedSearchNumVisibleNucleusMin,
    appliedSearchNumVisibleNucleusMax,
    appliedSearchNumAwesomeFlagMin,
    appliedSearchNumAwesomeFlagMax,
    appliedSearchNumFailedFittingMin,
    appliedSearchNumFailedFittingMax,
    appliedSearchTotalAssignedMin,
    appliedSearchTotalAssignedMax,
    appliedSearchAwesome,
    appliedSearchValidRedshift,
    appliedSearchVisibleNucleus,
  ]);

  const currentViewState = useMemo(
    () => buildGalaxyBrowserViewState({
      filter,
      sortBy,
      sortOrder,
      isSearchActive,
      appliedSearchValues: currentAppliedSearchValues,
    }),
    [filter, sortBy, sortOrder, isSearchActive, currentAppliedSearchValues],
  );
  const currentViewStateSignature = useMemo(() => JSON.stringify(currentViewState), [currentViewState]);

  const readStoredString = (source: Record<string, unknown>, key: keyof AppliedGalaxySearchValues): string =>
    typeof source[key] === "string" ? (source[key] as string) : "";

  const readStoredBoolean = (
    source: Record<string, unknown>,
    key: "searchNucleus" | "searchAwesome" | "searchValidRedshift" | "searchVisibleNucleus",
  ): boolean | undefined => (typeof source[key] === "boolean" ? (source[key] as boolean) : undefined);

  const createAppliedSearchValuesFromUnknown = (source: Record<string, unknown>): AppliedGalaxySearchValues => ({
    searchId: readStoredString(source, "searchId"),
    searchRaMin: readStoredString(source, "searchRaMin"),
    searchRaMax: readStoredString(source, "searchRaMax"),
    searchDecMin: readStoredString(source, "searchDecMin"),
    searchDecMax: readStoredString(source, "searchDecMax"),
    searchReffMin: readStoredString(source, "searchReffMin"),
    searchReffMax: readStoredString(source, "searchReffMax"),
    searchQMin: readStoredString(source, "searchQMin"),
    searchQMax: readStoredString(source, "searchQMax"),
    searchPaMin: readStoredString(source, "searchPaMin"),
    searchPaMax: readStoredString(source, "searchPaMax"),
    searchMagMin: readStoredString(source, "searchMagMin"),
    searchMagMax: readStoredString(source, "searchMagMax"),
    searchMeanMueMin: readStoredString(source, "searchMeanMueMin"),
    searchMeanMueMax: readStoredString(source, "searchMeanMueMax"),
    searchNucleus: readStoredBoolean(source, "searchNucleus"),
    searchTotalClassificationsMin: readStoredString(source, "searchTotalClassificationsMin"),
    searchTotalClassificationsMax: readStoredString(source, "searchTotalClassificationsMax"),
    searchNumVisibleNucleusMin: readStoredString(source, "searchNumVisibleNucleusMin"),
    searchNumVisibleNucleusMax: readStoredString(source, "searchNumVisibleNucleusMax"),
    searchNumAwesomeFlagMin: readStoredString(source, "searchNumAwesomeFlagMin"),
    searchNumAwesomeFlagMax: readStoredString(source, "searchNumAwesomeFlagMax"),
    searchNumFailedFittingMin: readStoredString(source, "searchNumFailedFittingMin"),
    searchNumFailedFittingMax: readStoredString(source, "searchNumFailedFittingMax"),
    searchTotalAssignedMin: readStoredString(source, "searchTotalAssignedMin"),
    searchTotalAssignedMax: readStoredString(source, "searchTotalAssignedMax"),
    searchAwesome: readStoredBoolean(source, "searchAwesome"),
    searchValidRedshift: readStoredBoolean(source, "searchValidRedshift"),
    searchVisibleNucleus: readStoredBoolean(source, "searchVisibleNucleus"),
  });

  const applySearchStateValues = (
    viewState: Partial<GalaxyBrowserViewState>,
    options: { updateDraft: boolean; updateApplied: boolean },
  ) => {
    const nextSearchId = viewState.searchId ?? "";
    const nextSearchRaMin = viewState.searchRaMin ?? "";
    const nextSearchRaMax = viewState.searchRaMax ?? "";
    const nextSearchDecMin = viewState.searchDecMin ?? "";
    const nextSearchDecMax = viewState.searchDecMax ?? "";
    const nextSearchReffMin = viewState.searchReffMin ?? "";
    const nextSearchReffMax = viewState.searchReffMax ?? "";
    const nextSearchQMin = viewState.searchQMin ?? "";
    const nextSearchQMax = viewState.searchQMax ?? "";
    const nextSearchPaMin = viewState.searchPaMin ?? "";
    const nextSearchPaMax = viewState.searchPaMax ?? "";
    const nextSearchMagMin = viewState.searchMagMin ?? "";
    const nextSearchMagMax = viewState.searchMagMax ?? "";
    const nextSearchMeanMueMin = viewState.searchMeanMueMin ?? "";
    const nextSearchMeanMueMax = viewState.searchMeanMueMax ?? "";
    const nextSearchNucleus = typeof viewState.searchNucleus === "boolean" ? viewState.searchNucleus : undefined;
    const nextSearchTotalClassificationsMin = viewState.searchTotalClassificationsMin ?? "";
    const nextSearchTotalClassificationsMax = viewState.searchTotalClassificationsMax ?? "";
    const nextSearchNumVisibleNucleusMin = viewState.searchNumVisibleNucleusMin ?? "";
    const nextSearchNumVisibleNucleusMax = viewState.searchNumVisibleNucleusMax ?? "";
    const nextSearchNumAwesomeFlagMin = viewState.searchNumAwesomeFlagMin ?? "";
    const nextSearchNumAwesomeFlagMax = viewState.searchNumAwesomeFlagMax ?? "";
    const nextSearchNumFailedFittingMin = viewState.searchNumFailedFittingMin ?? "";
    const nextSearchNumFailedFittingMax = viewState.searchNumFailedFittingMax ?? "";
    const nextSearchTotalAssignedMin = viewState.searchTotalAssignedMin ?? "";
    const nextSearchTotalAssignedMax = viewState.searchTotalAssignedMax ?? "";
    const nextSearchAwesome = typeof viewState.searchAwesome === "boolean" ? viewState.searchAwesome : undefined;
    const nextSearchValidRedshift =
      typeof viewState.searchValidRedshift === "boolean" ? viewState.searchValidRedshift : undefined;
    const nextSearchVisibleNucleus =
      typeof viewState.searchVisibleNucleus === "boolean" ? viewState.searchVisibleNucleus : undefined;

    if (options.updateDraft) {
      setSearchId(nextSearchId);
      setSearchRaMin(nextSearchRaMin);
      setSearchRaMax(nextSearchRaMax);
      setSearchDecMin(nextSearchDecMin);
      setSearchDecMax(nextSearchDecMax);
      setSearchReffMin(nextSearchReffMin);
      setSearchReffMax(nextSearchReffMax);
      setSearchQMin(nextSearchQMin);
      setSearchQMax(nextSearchQMax);
      setSearchPaMin(nextSearchPaMin);
      setSearchPaMax(nextSearchPaMax);
      setSearchMagMin(nextSearchMagMin);
      setSearchMagMax(nextSearchMagMax);
      setSearchMeanMueMin(nextSearchMeanMueMin);
      setSearchMeanMueMax(nextSearchMeanMueMax);
      setSearchNucleus(nextSearchNucleus);
      setSearchTotalClassificationsMin(nextSearchTotalClassificationsMin);
      setSearchTotalClassificationsMax(nextSearchTotalClassificationsMax);
      setSearchNumVisibleNucleusMin(nextSearchNumVisibleNucleusMin);
      setSearchNumVisibleNucleusMax(nextSearchNumVisibleNucleusMax);
      setSearchNumAwesomeFlagMin(nextSearchNumAwesomeFlagMin);
      setSearchNumAwesomeFlagMax(nextSearchNumAwesomeFlagMax);
      setSearchNumFailedFittingMin(nextSearchNumFailedFittingMin);
      setSearchNumFailedFittingMax(nextSearchNumFailedFittingMax);
      setSearchTotalAssignedMin(nextSearchTotalAssignedMin);
      setSearchTotalAssignedMax(nextSearchTotalAssignedMax);
      setSearchAwesome(nextSearchAwesome);
      setSearchValidRedshift(nextSearchValidRedshift);
      setSearchVisibleNucleus(nextSearchVisibleNucleus);
    }

    if (options.updateApplied) {
      setAppliedSearchId(nextSearchId);
      setAppliedSearchRaMin(nextSearchRaMin);
      setAppliedSearchRaMax(nextSearchRaMax);
      setAppliedSearchDecMin(nextSearchDecMin);
      setAppliedSearchDecMax(nextSearchDecMax);
      setAppliedSearchReffMin(nextSearchReffMin);
      setAppliedSearchReffMax(nextSearchReffMax);
      setAppliedSearchQMin(nextSearchQMin);
      setAppliedSearchQMax(nextSearchQMax);
      setAppliedSearchPaMin(nextSearchPaMin);
      setAppliedSearchPaMax(nextSearchPaMax);
      setAppliedSearchMagMin(nextSearchMagMin);
      setAppliedSearchMagMax(nextSearchMagMax);
      setAppliedSearchMeanMueMin(nextSearchMeanMueMin);
      setAppliedSearchMeanMueMax(nextSearchMeanMueMax);
      setAppliedSearchNucleus(nextSearchNucleus);
      setAppliedSearchTotalClassificationsMin(nextSearchTotalClassificationsMin);
      setAppliedSearchTotalClassificationsMax(nextSearchTotalClassificationsMax);
      setAppliedSearchNumVisibleNucleusMin(nextSearchNumVisibleNucleusMin);
      setAppliedSearchNumVisibleNucleusMax(nextSearchNumVisibleNucleusMax);
      setAppliedSearchNumAwesomeFlagMin(nextSearchNumAwesomeFlagMin);
      setAppliedSearchNumAwesomeFlagMax(nextSearchNumAwesomeFlagMax);
      setAppliedSearchNumFailedFittingMin(nextSearchNumFailedFittingMin);
      setAppliedSearchNumFailedFittingMax(nextSearchNumFailedFittingMax);
      setAppliedSearchTotalAssignedMin(nextSearchTotalAssignedMin);
      setAppliedSearchTotalAssignedMax(nextSearchTotalAssignedMax);
      setAppliedSearchAwesome(nextSearchAwesome);
      setAppliedSearchValidRedshift(nextSearchValidRedshift);
      setAppliedSearchVisibleNucleus(nextSearchVisibleNucleus);
    }
  };

  const loadStoredSettings = () => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as Record<string, unknown>;
    } catch (error) {
      console.warn("Failed to load galaxy browser settings", error);
      return null;
    }
  };

  const applyHydratedBrowserState = (options: {
    viewState: GalaxyBrowserViewState;
    page: number;
    pageSizeValue: number;
    viewKey: string | null;
    issue: GalaxyBrowserViewStateIssue | null;
    unavailable: boolean;
  }) => {
    skipNextPaginationResetRef.current = true;
    setFilter(options.viewState.filter);
    setSortBy(options.viewState.sortBy);
    setSortOrder(options.viewState.sortOrder);
    setPageSize(options.pageSizeValue);
    applySearchStateValues(options.viewState, { updateDraft: true, updateApplied: true });
    setIsSearchActive(options.viewState.isSearchActive);
    setPage(Math.max(1, options.page));
    setCurrentViewKey(options.viewKey);
    setViewStateIssue(options.issue);
    setIsViewUnavailable(options.unavailable);
    lastEnsuredViewSignatureRef.current = options.viewKey ? JSON.stringify(options.viewState) : null;
    unavailableViewSignatureRef.current = options.unavailable ? JSON.stringify(options.viewState) : null;
  };

  const fallbackStoredSettings = loadStoredSettings();
  const fallbackStoredSearchValues = fallbackStoredSettings
    ? createAppliedSearchValuesFromUnknown(fallbackStoredSettings)
    : createAppliedSearchValuesFromUnknown({});
  const fallbackStoredViewState = buildGalaxyBrowserViewState({
    filter: (fallbackStoredSettings?.filter as FilterType | undefined) ?? "all",
    sortBy: (fallbackStoredSettings?.sortBy as SortField | undefined) ?? "numericId",
    sortOrder: (fallbackStoredSettings?.sortOrder as SortOrder | undefined) ?? "asc",
    isSearchActive: hasAnySearchValues(fallbackStoredSearchValues),
    appliedSearchValues: fallbackStoredSearchValues,
  });
  const fallbackPageSize =
    typeof fallbackStoredSettings?.pageSize === "number" && Number.isFinite(fallbackStoredSettings.pageSize)
      ? fallbackStoredSettings.pageSize
      : 10;
  const fallbackSearchFormCollapsed =
    typeof fallbackStoredSettings?.searchFormCollapsed === "boolean" ? fallbackStoredSettings.searchFormCollapsed : true;

  useEffect(() => {
    if (pendingBrowserUrlSyncSignatureRef.current) {
      if (parsedBrowserUrlState.signature === pendingBrowserUrlSyncSignatureRef.current) {
        console.log("[GalaxyBrowserDebug] browser URL sync confirmed", {
          signature: parsedBrowserUrlState.signature,
          page: parsedBrowserUrlState.page,
          pageSize: parsedBrowserUrlState.pageSize,
        });
        pendingBrowserUrlSyncSignatureRef.current = null;
      } else if (isUrlStateReady) {
        console.log("[GalaxyBrowserDebug] ignoring stale parsed browser URL state during pending sync", {
          parsedSignature: parsedBrowserUrlState.signature,
          pendingSignature: pendingBrowserUrlSyncSignatureRef.current,
          parsedPage: parsedBrowserUrlState.page,
          currentPage: page,
        });
        return;
      }
    }

    if (parsedBrowserUrlState.viewKey && !resolvedBrowserView) return;
    if (lastWrittenBrowserUrlSignatureRef.current === parsedBrowserUrlState.signature) {
      if (!isUrlStateReady) setIsUrlStateReady(true);
      return;
    }
    if (lastAppliedBrowserUrlSignatureRef.current === parsedBrowserUrlState.signature && isUrlStateReady) {
      return;
    }

    setIsSearchFormCollapsed(fallbackSearchFormCollapsed);

    if (parsedBrowserUrlState.viewKey && resolvedBrowserView?.status === "ok" && resolvedBrowserView.state) {
      applyHydratedBrowserState({
        viewState: resolvedBrowserView.state as GalaxyBrowserViewState,
        page: parsedBrowserUrlState.page,
        pageSizeValue: parsedBrowserUrlState.pageSize ?? fallbackPageSize,
        viewKey: resolvedBrowserView.viewKey ?? parsedBrowserUrlState.viewKey,
        issue: null,
        unavailable: false,
      });
    } else if (parsedBrowserUrlState.viewKey && resolvedBrowserView?.status === "owner_only" && resolvedBrowserView.state) {
      applyHydratedBrowserState({
        viewState: resolvedBrowserView.state as GalaxyBrowserViewState,
        page: parsedBrowserUrlState.page,
        pageSizeValue: parsedBrowserUrlState.pageSize ?? fallbackPageSize,
        viewKey: resolvedBrowserView.viewKey ?? parsedBrowserUrlState.viewKey,
        issue: {
          kind: "unavailable",
          message:
            resolvedBrowserView.message ??
            "This saved galaxy browser view depends on personal galaxy state and cannot be shown for another user.",
        },
        unavailable: true,
      });
    } else if (parsedBrowserUrlState.viewKey) {
      applyHydratedBrowserState({
        viewState: fallbackStoredViewState,
        page: 1,
        pageSizeValue: parsedBrowserUrlState.pageSize ?? fallbackPageSize,
        viewKey: null,
        issue: {
          kind: "warning",
          message: resolvedBrowserView?.message ?? "This saved galaxy browser view could not be found.",
        },
        unavailable: false,
      });
    } else {
      applyHydratedBrowserState({
        viewState: fallbackStoredViewState,
        page: parsedBrowserUrlState.page,
        pageSizeValue: parsedBrowserUrlState.pageSize ?? fallbackPageSize,
        viewKey: null,
        issue: null,
        unavailable: false,
      });
    }

    lastAppliedBrowserUrlSignatureRef.current = parsedBrowserUrlState.signature;
    setIsUrlStateReady(true);
  }, [
    fallbackPageSize,
    fallbackSearchFormCollapsed,
    fallbackStoredViewState,
    isUrlStateReady,
    parsedBrowserUrlState.page,
    parsedBrowserUrlState.pageSize,
    parsedBrowserUrlState.signature,
    parsedBrowserUrlState.viewKey,
    resolvedBrowserView,
  ]);

  useEffect(() => {
    if (!isViewUnavailable) return;
    if (currentViewStateSignature === unavailableViewSignatureRef.current) return;
    setIsViewUnavailable(false);
    setViewStateIssue(null);
    setCurrentViewKey(null);
    lastEnsuredViewSignatureRef.current = null;
    unavailableViewSignatureRef.current = null;
  }, [currentViewStateSignature, isViewUnavailable]);

  useEffect(() => {
    if (!isUrlStateReady) return;

    const data = {
      pageSize,
      sortBy,
      sortOrder,
      filter,
      searchId: currentAppliedSearchValues.searchId,
      searchRaMin: currentAppliedSearchValues.searchRaMin,
      searchRaMax: currentAppliedSearchValues.searchRaMax,
      searchDecMin: currentAppliedSearchValues.searchDecMin,
      searchDecMax: currentAppliedSearchValues.searchDecMax,
      searchReffMin: currentAppliedSearchValues.searchReffMin,
      searchReffMax: currentAppliedSearchValues.searchReffMax,
      searchQMin: currentAppliedSearchValues.searchQMin,
      searchQMax: currentAppliedSearchValues.searchQMax,
      searchPaMin: currentAppliedSearchValues.searchPaMin,
      searchPaMax: currentAppliedSearchValues.searchPaMax,
      searchMagMin: currentAppliedSearchValues.searchMagMin,
      searchMagMax: currentAppliedSearchValues.searchMagMax,
      searchMeanMueMin: currentAppliedSearchValues.searchMeanMueMin,
      searchMeanMueMax: currentAppliedSearchValues.searchMeanMueMax,
      searchNucleus: currentAppliedSearchValues.searchNucleus,
      searchTotalClassificationsMin: currentAppliedSearchValues.searchTotalClassificationsMin,
      searchTotalClassificationsMax: currentAppliedSearchValues.searchTotalClassificationsMax,
      searchNumVisibleNucleusMin: currentAppliedSearchValues.searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax: currentAppliedSearchValues.searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin: currentAppliedSearchValues.searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax: currentAppliedSearchValues.searchNumAwesomeFlagMax,
      searchNumFailedFittingMin: currentAppliedSearchValues.searchNumFailedFittingMin,
      searchNumFailedFittingMax: currentAppliedSearchValues.searchNumFailedFittingMax,
      searchTotalAssignedMin: currentAppliedSearchValues.searchTotalAssignedMin,
      searchTotalAssignedMax: currentAppliedSearchValues.searchTotalAssignedMax,
      searchAwesome: currentAppliedSearchValues.searchAwesome,
      searchValidRedshift: currentAppliedSearchValues.searchValidRedshift,
      searchVisibleNucleus: currentAppliedSearchValues.searchVisibleNucleus,
      searchFormCollapsed: isSearchFormCollapsed,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save galaxy browser settings", error);
    }
  }, [
    currentAppliedSearchValues,
    filter,
    isSearchFormCollapsed,
    isUrlStateReady,
    pageSize,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    if (!isUrlStateReady) return;
    if (skipNextPaginationResetRef.current) {
      console.log("[GalaxyBrowserDebug] skipping automatic page reset after URL hydration", {
        page,
        filter,
        sortBy,
        sortOrder,
        pageSize,
        isSearchActive,
      });
      skipNextPaginationResetRef.current = false;
      return;
    }

    console.log("[GalaxyBrowserDebug] automatic page reset to 1", {
      previousPage: page,
      filter,
      sortBy,
      sortOrder,
      pageSize,
      isSearchActive,
    });
    setPage(1);
  }, [filter, sortBy, sortOrder, pageSize, isSearchActive, isUrlStateReady]);

  useEffect(() => {
    if (!isUrlStateReady || isViewUnavailable) return;
    if (currentViewStateSignature === lastEnsuredViewSignatureRef.current && currentViewKey) return;

    let cancelled = false;
    void ensureBrowserView({ state: currentViewState }).then((result) => {
      if (cancelled) return;
      lastEnsuredViewSignatureRef.current = currentViewStateSignature;
      setCurrentViewKey(result.viewKey);
    }).catch((error) => {
      console.warn("Failed to resolve galaxy browser view key", error);
    });

    return () => {
      cancelled = true;
    };
  }, [currentViewKey, currentViewState, currentViewStateSignature, ensureBrowserView, isUrlStateReady, isViewUnavailable]);

  useEffect(() => {
    if (!isUrlStateReady) return;
    if (isViewUnavailable) return;
    if (!currentViewKey) return;

    const latestBrowserPaging = latestBrowserPagingRef.current;
    if (
      latestBrowserPaging.page !== page ||
      latestBrowserPaging.pageSize !== pageSize ||
      latestBrowserPaging.currentViewKey !== currentViewKey
    ) {
      console.log("[GalaxyBrowserDebug] skipping stale browser URL write", {
        effectPage: page,
        latestPage: latestBrowserPaging.page,
        effectPageSize: pageSize,
        latestPageSize: latestBrowserPaging.pageSize,
        effectViewKey: currentViewKey,
        latestViewKey: latestBrowserPaging.currentViewKey,
      });
      return;
    }

    const nextSignature = JSON.stringify({
      viewKey: currentViewKey,
      page,
      pageSize,
    });
    if (nextSignature === lastWrittenBrowserUrlSignatureRef.current) return;

    lastWrittenBrowserUrlSignatureRef.current = nextSignature;
    pendingBrowserUrlSyncSignatureRef.current = nextSignature;
    console.log("[GalaxyBrowserDebug] writing browser URL state", {
      currentViewKey,
      page,
      pageSize,
      filter,
      sortBy,
      sortOrder,
      isSearchActive,
    });
    if (typeof window !== "undefined") {
      pendingScrollRestoreTopRef.current = window.scrollY;
      pendingScrollRestoreLeftRef.current = window.scrollX;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", currentViewKey);
      next.set("page", String(page));
      next.set("pageSize", String(pageSize));
      return next;
    }, { replace: true, preventScrollReset: true });
  }, [currentViewKey, isUrlStateReady, isViewUnavailable, page, pageSize, setSearchParams]);

  useLayoutEffect(() => {
    if (pendingScrollRestoreTopRef.current === null || pendingScrollRestoreLeftRef.current === null) return;
    if (typeof window === "undefined") return;

    const top = pendingScrollRestoreTopRef.current;
    const left = pendingScrollRestoreLeftRef.current;
    pendingScrollRestoreTopRef.current = null;
    pendingScrollRestoreLeftRef.current = null;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top, left, behavior: "auto" });
    });
  }, [browserSearchParamsSignature]);

  const shouldSkipGalaxyQuery = !isUrlStateReady || (parsedBrowserUrlState.viewKey !== null && !resolvedBrowserView) || isViewUnavailable;
  const rawGalaxyData = useQuery(api.galaxies.browse.browseGalaxies, shouldSkipGalaxyQuery ? "skip" : {
    offset: Math.max(0, (page - 1) * pageSize),
    numItems: pageSize,
    cursor: undefined,
    sortBy,
    sortOrder,
    filter,
    searchId: isSearchActive ? (currentAppliedSearchValues.searchId || undefined) : undefined,
    searchRaMin: isSearchActive ? (currentAppliedSearchValues.searchRaMin || undefined) : undefined,
    searchRaMax: isSearchActive ? (currentAppliedSearchValues.searchRaMax || undefined) : undefined,
    searchDecMin: isSearchActive ? (currentAppliedSearchValues.searchDecMin || undefined) : undefined,
    searchDecMax: isSearchActive ? (currentAppliedSearchValues.searchDecMax || undefined) : undefined,
    searchReffMin: isSearchActive ? (currentAppliedSearchValues.searchReffMin || undefined) : undefined,
    searchReffMax: isSearchActive ? (currentAppliedSearchValues.searchReffMax || undefined) : undefined,
    searchQMin: isSearchActive ? (currentAppliedSearchValues.searchQMin || undefined) : undefined,
    searchQMax: isSearchActive ? (currentAppliedSearchValues.searchQMax || undefined) : undefined,
    searchPaMin: isSearchActive ? (currentAppliedSearchValues.searchPaMin || undefined) : undefined,
    searchPaMax: isSearchActive ? (currentAppliedSearchValues.searchPaMax || undefined) : undefined,
    searchMagMin: isSearchActive ? (currentAppliedSearchValues.searchMagMin || undefined) : undefined,
    searchMagMax: isSearchActive ? (currentAppliedSearchValues.searchMagMax || undefined) : undefined,
    searchMeanMueMin: isSearchActive ? (currentAppliedSearchValues.searchMeanMueMin || undefined) : undefined,
    searchMeanMueMax: isSearchActive ? (currentAppliedSearchValues.searchMeanMueMax || undefined) : undefined,
    searchNucleus: isSearchActive ? currentAppliedSearchValues.searchNucleus : undefined,
    searchTotalClassificationsMin: isSearchActive
      ? (currentAppliedSearchValues.searchTotalClassificationsMin || undefined)
      : undefined,
    searchTotalClassificationsMax: isSearchActive
      ? (currentAppliedSearchValues.searchTotalClassificationsMax || undefined)
      : undefined,
    searchNumVisibleNucleusMin: isSearchActive
      ? (currentAppliedSearchValues.searchNumVisibleNucleusMin || undefined)
      : undefined,
    searchNumVisibleNucleusMax: isSearchActive
      ? (currentAppliedSearchValues.searchNumVisibleNucleusMax || undefined)
      : undefined,
    searchNumAwesomeFlagMin: isSearchActive
      ? (currentAppliedSearchValues.searchNumAwesomeFlagMin || undefined)
      : undefined,
    searchNumAwesomeFlagMax: isSearchActive
      ? (currentAppliedSearchValues.searchNumAwesomeFlagMax || undefined)
      : undefined,
    searchNumFailedFittingMin: isSearchActive
      ? (currentAppliedSearchValues.searchNumFailedFittingMin || undefined)
      : undefined,
    searchNumFailedFittingMax: isSearchActive
      ? (currentAppliedSearchValues.searchNumFailedFittingMax || undefined)
      : undefined,
    searchTotalAssignedMin: isSearchActive ? (currentAppliedSearchValues.searchTotalAssignedMin || undefined) : undefined,
    searchTotalAssignedMax: isSearchActive ? (currentAppliedSearchValues.searchTotalAssignedMax || undefined) : undefined,
    searchAwesome: isSearchActive ? currentAppliedSearchValues.searchAwesome : undefined,
    searchValidRedshift: isSearchActive ? currentAppliedSearchValues.searchValidRedshift : undefined,
    searchVisibleNucleus: isSearchActive ? currentAppliedSearchValues.searchVisibleNucleus : undefined,
  });

  useEffect(() => {
    console.log("[GalaxyBrowserDebug] browse query inputs", {
      shouldSkipGalaxyQuery,
      page,
      pageSize,
      offset: Math.max(0, (page - 1) * pageSize),
      filter,
      sortBy,
      sortOrder,
      isSearchActive,
      currentViewKey,
      parsedUrlPage: parsedBrowserUrlState.page,
    });
  }, [
    currentViewKey,
    filter,
    isSearchActive,
    page,
    pageSize,
    parsedBrowserUrlState.page,
    shouldSkipGalaxyQuery,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    if (!rawGalaxyData) return;
    console.log("[GalaxyBrowserDebug] browse query result", {
      page,
      pageSize,
      hasNext: rawGalaxyData.hasNext,
      galaxyCount: rawGalaxyData.galaxies?.length ?? 0,
      firstGalaxyId: rawGalaxyData.galaxies?.[0]?.id ?? null,
      lastGalaxyId: rawGalaxyData.galaxies?.[rawGalaxyData.galaxies.length - 1]?.id ?? null,
    });
  }, [page, pageSize, rawGalaxyData]);

  const galaxyData = isViewUnavailable
    ? {
        galaxies: [],
        total: 0,
        hasNext: false,
        hasPrevious: page > 1,
        totalPages: 0,
        aggregatesPopulated: false,
        currentBounds: undefined,
        cursor: null,
        isDone: true,
      }
    : rawGalaxyData;

  const searchBounds = useQuery(api.galaxies.browse.getGalaxySearchBounds);
  const userPrefs = useQuery(api.users.getUserPreferences);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);

  const effectiveImageQuality = (systemSettings?.galaxyBrowserImageQuality as "high" | "low") || "low";

  const currentBounds = galaxyData?.currentBounds;
  const hasPrevious = page > 1;
  const hasNext = !!galaxyData?.hasNext;

  const hasPendingChanges = isSearchActive && (
    currentDraftSearchValues.searchId !== currentAppliedSearchValues.searchId ||
    currentDraftSearchValues.searchRaMin !== currentAppliedSearchValues.searchRaMin ||
    currentDraftSearchValues.searchRaMax !== currentAppliedSearchValues.searchRaMax ||
    currentDraftSearchValues.searchDecMin !== currentAppliedSearchValues.searchDecMin ||
    currentDraftSearchValues.searchDecMax !== currentAppliedSearchValues.searchDecMax ||
    currentDraftSearchValues.searchReffMin !== currentAppliedSearchValues.searchReffMin ||
    currentDraftSearchValues.searchReffMax !== currentAppliedSearchValues.searchReffMax ||
    currentDraftSearchValues.searchQMin !== currentAppliedSearchValues.searchQMin ||
    currentDraftSearchValues.searchQMax !== currentAppliedSearchValues.searchQMax ||
    currentDraftSearchValues.searchPaMin !== currentAppliedSearchValues.searchPaMin ||
    currentDraftSearchValues.searchPaMax !== currentAppliedSearchValues.searchPaMax ||
    currentDraftSearchValues.searchMagMin !== currentAppliedSearchValues.searchMagMin ||
    currentDraftSearchValues.searchMagMax !== currentAppliedSearchValues.searchMagMax ||
    currentDraftSearchValues.searchMeanMueMin !== currentAppliedSearchValues.searchMeanMueMin ||
    currentDraftSearchValues.searchMeanMueMax !== currentAppliedSearchValues.searchMeanMueMax ||
    currentDraftSearchValues.searchNucleus !== currentAppliedSearchValues.searchNucleus ||
    currentDraftSearchValues.searchTotalClassificationsMin !== currentAppliedSearchValues.searchTotalClassificationsMin ||
    currentDraftSearchValues.searchTotalClassificationsMax !== currentAppliedSearchValues.searchTotalClassificationsMax ||
    currentDraftSearchValues.searchNumVisibleNucleusMin !== currentAppliedSearchValues.searchNumVisibleNucleusMin ||
    currentDraftSearchValues.searchNumVisibleNucleusMax !== currentAppliedSearchValues.searchNumVisibleNucleusMax ||
    currentDraftSearchValues.searchNumAwesomeFlagMin !== currentAppliedSearchValues.searchNumAwesomeFlagMin ||
    currentDraftSearchValues.searchNumAwesomeFlagMax !== currentAppliedSearchValues.searchNumAwesomeFlagMax ||
    currentDraftSearchValues.searchNumFailedFittingMin !== currentAppliedSearchValues.searchNumFailedFittingMin ||
    currentDraftSearchValues.searchNumFailedFittingMax !== currentAppliedSearchValues.searchNumFailedFittingMax ||
    currentDraftSearchValues.searchTotalAssignedMin !== currentAppliedSearchValues.searchTotalAssignedMin ||
    currentDraftSearchValues.searchTotalAssignedMax !== currentAppliedSearchValues.searchTotalAssignedMax ||
    currentDraftSearchValues.searchAwesome !== currentAppliedSearchValues.searchAwesome ||
    currentDraftSearchValues.searchValidRedshift !== currentAppliedSearchValues.searchValidRedshift ||
    currentDraftSearchValues.searchVisibleNucleus !== currentAppliedSearchValues.searchVisibleNucleus
  );

  const hasAnySearchValuesComputed = hasAnySearchValues(currentDraftSearchValues);

  useEffect(() => {
    if (galaxyData && !hasPreviousData && !isViewUnavailable) {
      setHasPreviousData(true);
    }
  }, [galaxyData, hasPreviousData, isViewUnavailable]);

  const handleSort = (field: SortField) => {
    handleSortUtil(field, sortBy, sortOrder, setSortBy, setSortOrder);
  };

  const goNext = () => {
    if (!galaxyData?.hasNext) return;
    setPage((currentPage) => currentPage + 1);
  };

  const jumpToPage = (nextPage: number) => {
    console.log("[GalaxyBrowserDebug] jumpToPage called", {
      currentPage: page,
      nextPage,
      pageSize,
    });
    setPage(Math.max(1, nextPage));
  };

  const goPrev = () => {
    setPage((currentPage) => Math.max(1, currentPage - 1));
  };

  const goFirst = () => {
    setPage(1);
  };

  const applySearch = () => {
    applySearchStateValues(currentDraftSearchValues, { updateDraft: false, updateApplied: true });
    setIsSearchActive(true);
    setPage(1);
  };

  const clearSearch = () => {
    applySearchStateValues({}, { updateDraft: true, updateApplied: true });
    setIsSearchActive(false);
    setPage(1);
  };

  const getPlaceholderTextWrapper = (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'numFailedFitting' | 'totalAssigned', type: 'min' | 'max') => {
    const bounds = searchBounds ?? currentBounds;
    return getPlaceholderText(field, type, bounds);
  };

  const getBoundsForField = (field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'numFailedFitting' | 'totalAssigned') => {
    const boundsSource = searchBounds ?? currentBounds;
    if (!boundsSource) return undefined;

    const fieldBounds = (boundsSource as Record<string, any>)[field];
    if (!fieldBounds) return undefined;

    const normalize = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "bigint") return Number(value);
      return undefined;
    };

    const min = normalize(fieldBounds.min);
    const max = normalize(fieldBounds.max);
    if (min === undefined && max === undefined) return undefined;

    return { min, max };
  };

  const hasFieldChangedWrapper = (field: string) => {
    return hasFieldChanged(field, isSearchActive, currentDraftSearchValues, currentAppliedSearchValues);
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
    jumpToPage,
    goNext,
    goPrev,
    goFirst,
    isSearchFormCollapsed,
    setIsSearchFormCollapsed,

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
    appliedSearchValues: currentAppliedSearchValues,
    isSearchActive,
    hasPendingChanges,
    hasPreviousData,
    isUrlStateReady,
    isViewUnavailable,
    viewStateIssue,
    currentViewKey,

    // Queries
    galaxyData,
    searchBounds,
    userPrefs,
    effectiveImageQuality,

    // Computed values
  currentBounds,
    hasPrevious,
    hasNext,
    previewImageName,

    // Utility functions
    getPlaceholderText: getPlaceholderTextWrapper,
    getBoundsForField,
    hasFieldChanged: hasFieldChangedWrapper,
    getInputClass: getInputClassWrapper,
    hasAnySearchValues: hasAnySearchValuesComputed,

    // Handlers
    handleSort,
    applySearch,
    clearSearch,
  };
}