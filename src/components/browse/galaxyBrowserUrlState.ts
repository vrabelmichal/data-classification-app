import type { FilterType, SortField, SortOrder } from "./GalaxyBrowser";

export interface GalaxyBrowserViewState {
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
}

export interface GalaxyBrowserAppliedSearchValues {
  searchId: string;
  searchRaMin: string;
  searchRaMax: string;
  searchDecMin: string;
  searchDecMax: string;
  searchReffMin: string;
  searchReffMax: string;
  searchQMin: string;
  searchQMax: string;
  searchPaMin: string;
  searchPaMax: string;
  searchMagMin: string;
  searchMagMax: string;
  searchMeanMueMin: string;
  searchMeanMueMax: string;
  searchNucleus: boolean | undefined;
  searchTotalClassificationsMin: string;
  searchTotalClassificationsMax: string;
  searchNumVisibleNucleusMin: string;
  searchNumVisibleNucleusMax: string;
  searchNumAwesomeFlagMin: string;
  searchNumAwesomeFlagMax: string;
  searchNumFailedFittingMin: string;
  searchNumFailedFittingMax: string;
  searchTotalAssignedMin: string;
  searchTotalAssignedMax: string;
  searchAwesome: boolean | undefined;
  searchValidRedshift: boolean | undefined;
  searchVisibleNucleus: boolean | undefined;
}

export interface ParsedGalaxyBrowserUrlState {
  viewKey: string | null;
  page: number;
  pageSize: number | null;
  signature: string;
}

export interface ParsedGalaxyQuickReviewUrlState {
  isOpen: boolean;
  reviewIndex: number;
  reviewGalaxyId: string | null;
  imageKey: string | null;
  showEllipse: boolean;
  signature: string;
}

const SEARCH_STRING_FIELDS: Array<keyof GalaxyBrowserAppliedSearchValues> = [
  "searchId",
  "searchRaMin",
  "searchRaMax",
  "searchDecMin",
  "searchDecMax",
  "searchReffMin",
  "searchReffMax",
  "searchQMin",
  "searchQMax",
  "searchPaMin",
  "searchPaMax",
  "searchMagMin",
  "searchMagMax",
  "searchMeanMueMin",
  "searchMeanMueMax",
  "searchTotalClassificationsMin",
  "searchTotalClassificationsMax",
  "searchNumVisibleNucleusMin",
  "searchNumVisibleNucleusMax",
  "searchNumAwesomeFlagMin",
  "searchNumAwesomeFlagMax",
  "searchNumFailedFittingMin",
  "searchNumFailedFittingMax",
  "searchTotalAssignedMin",
  "searchTotalAssignedMax",
];

const SEARCH_BOOLEAN_FIELDS: Array<
  "searchNucleus" | "searchAwesome" | "searchValidRedshift" | "searchVisibleNucleus"
> = ["searchNucleus", "searchAwesome", "searchValidRedshift", "searchVisibleNucleus"];

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

function normalizeSearchString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function buildGalaxyBrowserViewState(options: {
  filter: FilterType;
  sortBy: SortField;
  sortOrder: SortOrder;
  isSearchActive: boolean;
  appliedSearchValues: GalaxyBrowserAppliedSearchValues;
}): GalaxyBrowserViewState {
  const state: GalaxyBrowserViewState = {
    filter: options.filter,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    isSearchActive: options.isSearchActive,
  };

  if (!options.isSearchActive) {
    return state;
  }

  for (const field of SEARCH_STRING_FIELDS) {
    const normalized = normalizeSearchString(options.appliedSearchValues[field]);
    if (normalized !== undefined) {
      state[field] = normalized as never;
    }
  }

  for (const field of SEARCH_BOOLEAN_FIELDS) {
    const value = options.appliedSearchValues[field];
    if (typeof value === "boolean") {
      state[field] = value as never;
    }
  }

  return state;
}

export function parseGalaxyBrowserUrlState(searchParams: URLSearchParams): ParsedGalaxyBrowserUrlState {
  const viewKey = searchParams.get("view");
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSizeParam = searchParams.get("pageSize");
  const pageSize = pageSizeParam ? parsePositiveInteger(pageSizeParam, 10) : null;

  return {
    viewKey: viewKey && viewKey.trim() ? viewKey.trim() : null,
    page,
    pageSize,
    signature: JSON.stringify({
      viewKey: viewKey && viewKey.trim() ? viewKey.trim() : null,
      page,
      pageSize,
    }),
  };
}

export function parseGalaxyQuickReviewUrlState(searchParams: URLSearchParams): ParsedGalaxyQuickReviewUrlState {
  const isOpen = parseBooleanParam(searchParams.get("review"));
  const reviewIndex = parsePositiveInteger(searchParams.get("reviewIndex"), 1) - 1;
  const reviewGalaxyId = searchParams.get("reviewGalaxyId");
  const imageKey = searchParams.get("reviewImage");
  const showEllipse = parseBooleanParam(searchParams.get("reviewEllipse"));

  return {
    isOpen,
    reviewIndex: Math.max(reviewIndex, 0),
    reviewGalaxyId: reviewGalaxyId && reviewGalaxyId.trim() ? reviewGalaxyId.trim() : null,
    imageKey: imageKey && imageKey.trim() ? imageKey.trim() : null,
    showEllipse,
    signature: JSON.stringify({
      isOpen,
      reviewIndex: Math.max(reviewIndex, 0),
      reviewGalaxyId: reviewGalaxyId && reviewGalaxyId.trim() ? reviewGalaxyId.trim() : null,
      imageKey: imageKey && imageKey.trim() ? imageKey.trim() : null,
      showEllipse,
    }),
  };
}
