export type Sortable =
  | "numericId"
  | "id"
  | "ra"
  | "dec"
  | "reff"
  | "q"
  | "pa"
  | "mag"
  | "mean_mue"
  | "nucleus"
  | "totalClassifications"
  | "numVisibleNucleus"
  | "numAwesomeFlag"
  | "numFailedFitting"
  | "totalAssigned";

export type GalaxySearchFilters = {
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
};

export const allowedSort: Record<Sortable, { index: string; field: string }> = {
  numericId: { index: "by_numeric_id", field: "numericId" },
  id: { index: "by_external_id", field: "id" },
  ra: { index: "by_ra", field: "ra" },
  dec: { index: "by_dec", field: "dec" },
  reff: { index: "by_reff", field: "reff" },
  q: { index: "by_q", field: "q" },
  pa: { index: "by_pa", field: "pa" },
  mag: { index: "by_mag", field: "mag" },
  mean_mue: { index: "by_mean_mue", field: "mean_mue" },
  nucleus: { index: "by_nucleus", field: "nucleus" },
  totalClassifications: { index: "by_totalClassifications", field: "totalClassifications" },
  numVisibleNucleus: { index: "by_numVisibleNucleus", field: "numVisibleNucleus" },
  numAwesomeFlag: { index: "by_numAwesomeFlag", field: "numAwesomeFlag" },
  numFailedFitting: { index: "by_numFailedFitting", field: "numFailedFitting" },
  totalAssigned: { index: "by_totalAssigned_numericId", field: "totalAssigned" },
};

export const safeBigInt = (value: string | undefined | null): bigint | null => {
  if (value === undefined || value === null || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

export const createEmptyCurrentBounds = () => ({
  ra: { min: null, max: null },
  dec: { min: null, max: null },
  reff: { min: null, max: null },
  q: { min: null, max: null },
  pa: { min: null, max: null },
  mag: { min: null, max: null },
  mean_mue: { min: null, max: null },
  nucleus: { hasNucleus: false, totalCount: 0 },
});

export const createEmptyBrowseResult = (options?: {
  total?: number;
  hasPrevious?: boolean;
  cursor?: string | null;
  isDone?: boolean;
}) => ({
  galaxies: [],
  total: options?.total ?? 0,
  hasNext: false,
  hasPrevious: options?.hasPrevious ?? false,
  totalPages: 0,
  aggregatesPopulated: false,
  currentBounds: createEmptyCurrentBounds(),
  cursor: options?.cursor ?? null,
  isDone: options?.isDone ?? true,
});

export const createEmptySearchBounds = () => ({
  ra: { min: null, max: null },
  dec: { min: null, max: null },
  reff: { min: null, max: null },
  q: { min: null, max: null },
  pa: { min: null, max: null },
  mag: { min: null, max: null },
  mean_mue: { min: null, max: null },
  nucleus: { hasNucleus: false, totalCount: 0 },
  totalClassifications: { min: null, max: null },
  numVisibleNucleus: { min: null, max: null },
  numAwesomeFlag: { min: null, max: null },
  totalAssigned: { min: null, max: null },
});

export const computeBounds = (galaxies: any[]) => {
  const raValues = galaxies.map((g) => g.ra).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const decValues = galaxies.map((g) => g.dec).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const reffValues = galaxies.map((g) => g.reff).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const qValues = galaxies.map((g) => g.q).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const paValues = galaxies.map((g) => g.pa).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const magValues = galaxies.map((g) => g.mag).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const meanMueValues = galaxies.map((g) => g.mean_mue).filter((v) => typeof v === "number" && !Number.isNaN(v));
  const nucleusCount = galaxies.filter((g) => g.nucleus === true).length;

  return {
    ra: {
      min: raValues.length > 0 ? Math.min(...raValues) : null,
      max: raValues.length > 0 ? Math.max(...raValues) : null,
    },
    dec: {
      min: decValues.length > 0 ? Math.min(...decValues) : null,
      max: decValues.length > 0 ? Math.max(...decValues) : null,
    },
    reff: {
      min: reffValues.length > 0 ? Math.min(...reffValues) : null,
      max: reffValues.length > 0 ? Math.max(...reffValues) : null,
    },
    q: {
      min: qValues.length > 0 ? Math.min(...qValues) : null,
      max: qValues.length > 0 ? Math.max(...qValues) : null,
    },
    pa: {
      min: paValues.length > 0 ? Math.min(...paValues) : null,
      max: paValues.length > 0 ? Math.max(...paValues) : null,
    },
    mag: {
      min: magValues.length > 0 ? Math.min(...magValues) : null,
      max: magValues.length > 0 ? Math.max(...magValues) : null,
    },
    mean_mue: {
      min: meanMueValues.length > 0 ? Math.min(...meanMueValues) : null,
      max: meanMueValues.length > 0 ? Math.max(...meanMueValues) : null,
    },
    nucleus: {
      hasNucleus: nucleusCount > 0,
      totalCount: galaxies.length,
    },
  };
};
