import { v } from "convex/values";

export const galaxyBrowserSortFieldValidator = v.union(
  v.literal("id"),
  v.literal("ra"),
  v.literal("dec"),
  v.literal("reff"),
  v.literal("q"),
  v.literal("pa"),
  v.literal("mag"),
  v.literal("mean_mue"),
  v.literal("nucleus"),
  v.literal("numericId"),
  v.literal("totalClassifications"),
  v.literal("numVisibleNucleus"),
  v.literal("numAwesomeFlag"),
  v.literal("numFailedFitting"),
  v.literal("totalAssigned"),
);

export const galaxyBrowserSortOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

export const galaxyBrowserFilterValidator = v.union(
  v.literal("all"),
  v.literal("my_sequence"),
  v.literal("classified"),
  v.literal("unclassified"),
  v.literal("skipped"),
);

export const galaxyBrowserViewScopeValidator = v.union(v.literal("global"), v.literal("owner"));

export const galaxyBrowserViewStateValidator = v.object({
  filter: galaxyBrowserFilterValidator,
  sortBy: galaxyBrowserSortFieldValidator,
  sortOrder: galaxyBrowserSortOrderValidator,
  isSearchActive: v.boolean(),
  searchId: v.optional(v.string()),
  searchRaMin: v.optional(v.string()),
  searchRaMax: v.optional(v.string()),
  searchDecMin: v.optional(v.string()),
  searchDecMax: v.optional(v.string()),
  searchReffMin: v.optional(v.string()),
  searchReffMax: v.optional(v.string()),
  searchQMin: v.optional(v.string()),
  searchQMax: v.optional(v.string()),
  searchPaMin: v.optional(v.string()),
  searchPaMax: v.optional(v.string()),
  searchMagMin: v.optional(v.string()),
  searchMagMax: v.optional(v.string()),
  searchMeanMueMin: v.optional(v.string()),
  searchMeanMueMax: v.optional(v.string()),
  searchNucleus: v.optional(v.boolean()),
  searchTotalClassificationsMin: v.optional(v.string()),
  searchTotalClassificationsMax: v.optional(v.string()),
  searchNumVisibleNucleusMin: v.optional(v.string()),
  searchNumVisibleNucleusMax: v.optional(v.string()),
  searchNumAwesomeFlagMin: v.optional(v.string()),
  searchNumAwesomeFlagMax: v.optional(v.string()),
  searchNumFailedFittingMin: v.optional(v.string()),
  searchNumFailedFittingMax: v.optional(v.string()),
  searchTotalAssignedMin: v.optional(v.string()),
  searchTotalAssignedMax: v.optional(v.string()),
  searchAwesome: v.optional(v.boolean()),
  searchValidRedshift: v.optional(v.boolean()),
  searchVisibleNucleus: v.optional(v.boolean()),
});

export const galaxyBrowserResolvedViewValidator = v.object({
  status: v.union(v.literal("ok"), v.literal("owner_only"), v.literal("not_found")),
  message: v.optional(v.string()),
  scope: v.optional(galaxyBrowserViewScopeValidator),
  viewKey: v.optional(v.string()),
  state: v.optional(galaxyBrowserViewStateValidator),
});

const SEARCH_STRING_FIELDS = [
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
] as const;

const SEARCH_BOOLEAN_FIELDS = [
  "searchNucleus",
  "searchAwesome",
  "searchValidRedshift",
  "searchVisibleNucleus",
] as const;

const OWNER_ONLY_FILTERS = new Set(["my_sequence", "classified", "unclassified", "skipped"]);

export type GalaxyBrowserViewState = {
  filter: "all" | "my_sequence" | "classified" | "unclassified" | "skipped";
  sortBy:
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
  sortOrder: "asc" | "desc";
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
};

export function normalizeGalaxyBrowserViewState(source: Partial<GalaxyBrowserViewState>): GalaxyBrowserViewState {
  const normalized: GalaxyBrowserViewState = {
    filter: source.filter ?? "all",
    sortBy: source.sortBy ?? "numericId",
    sortOrder: source.sortOrder === "desc" ? "desc" : "asc",
    isSearchActive: source.isSearchActive === true,
  };

  if (normalized.isSearchActive) {
    for (const field of SEARCH_STRING_FIELDS) {
      const rawValue = source[field];
      if (typeof rawValue !== "string") continue;
      const trimmedValue = rawValue.trim();
      if (!trimmedValue) continue;
      normalized[field] = trimmedValue;
    }

    for (const field of SEARCH_BOOLEAN_FIELDS) {
      const rawValue = source[field];
      if (typeof rawValue === "boolean") {
        normalized[field] = rawValue;
      }
    }
  }

  return normalized;
}

export function getGalaxyBrowserViewScope(filter: GalaxyBrowserViewState["filter"]): "global" | "owner" {
  return OWNER_ONLY_FILTERS.has(filter) ? "owner" : "global";
}

export function buildGalaxyBrowserViewHash(state: GalaxyBrowserViewState, ownerScopeKey: string): string {
  return JSON.stringify({
    ownerScopeKey,
    filter: state.filter,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    isSearchActive: state.isSearchActive,
    searchId: state.searchId,
    searchRaMin: state.searchRaMin,
    searchRaMax: state.searchRaMax,
    searchDecMin: state.searchDecMin,
    searchDecMax: state.searchDecMax,
    searchReffMin: state.searchReffMin,
    searchReffMax: state.searchReffMax,
    searchQMin: state.searchQMin,
    searchQMax: state.searchQMax,
    searchPaMin: state.searchPaMin,
    searchPaMax: state.searchPaMax,
    searchMagMin: state.searchMagMin,
    searchMagMax: state.searchMagMax,
    searchMeanMueMin: state.searchMeanMueMin,
    searchMeanMueMax: state.searchMeanMueMax,
    searchNucleus: state.searchNucleus,
    searchTotalClassificationsMin: state.searchTotalClassificationsMin,
    searchTotalClassificationsMax: state.searchTotalClassificationsMax,
    searchNumVisibleNucleusMin: state.searchNumVisibleNucleusMin,
    searchNumVisibleNucleusMax: state.searchNumVisibleNucleusMax,
    searchNumAwesomeFlagMin: state.searchNumAwesomeFlagMin,
    searchNumAwesomeFlagMax: state.searchNumAwesomeFlagMax,
    searchNumFailedFittingMin: state.searchNumFailedFittingMin,
    searchNumFailedFittingMax: state.searchNumFailedFittingMax,
    searchTotalAssignedMin: state.searchTotalAssignedMin,
    searchTotalAssignedMax: state.searchTotalAssignedMax,
    searchAwesome: state.searchAwesome,
    searchValidRedshift: state.searchValidRedshift,
    searchVisibleNucleus: state.searchVisibleNucleus,
  });
}

export function createGalaxyBrowserViewKey(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `gbv_${Date.now().toString(36)}_${randomSuffix}`;
}
