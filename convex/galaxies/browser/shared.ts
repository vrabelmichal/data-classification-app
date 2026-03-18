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

interface GalaxyBoundsInput {
  ra?: number;
  dec?: number;
  reff?: number;
  q?: number;
  pa?: number;
  mag?: number;
  mean_mue?: number;
  nucleus?: boolean;
}

const isValidNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

const computeNumericBounds = (values: number[]) =>
  values.reduce<{ min: number; max: number } | null>((bounds, value) => {
    if (bounds === null) {
      return { min: value, max: value };
    }

    return {
      min: value < bounds.min ? value : bounds.min,
      max: value > bounds.max ? value : bounds.max,
    };
  }, null);

export const computeBounds = (galaxies: GalaxyBoundsInput[]) => {
  const raValues = galaxies.map((g) => g.ra).filter(isValidNumber);
  const decValues = galaxies.map((g) => g.dec).filter(isValidNumber);
  const reffValues = galaxies.map((g) => g.reff).filter(isValidNumber);
  const qValues = galaxies.map((g) => g.q).filter(isValidNumber);
  const paValues = galaxies.map((g) => g.pa).filter(isValidNumber);
  const magValues = galaxies.map((g) => g.mag).filter(isValidNumber);
  const meanMueValues = galaxies.map((g) => g.mean_mue).filter(isValidNumber);
  const nucleusCount = galaxies.filter((g) => g.nucleus === true).length;

  const raBounds = computeNumericBounds(raValues);
  const decBounds = computeNumericBounds(decValues);
  const reffBounds = computeNumericBounds(reffValues);
  const qBounds = computeNumericBounds(qValues);
  const paBounds = computeNumericBounds(paValues);
  const magBounds = computeNumericBounds(magValues);
  const meanMueBounds = computeNumericBounds(meanMueValues);

  return {
    ra: {
      min: raBounds?.min ?? null,
      max: raBounds?.max ?? null,
    },
    dec: {
      min: decBounds?.min ?? null,
      max: decBounds?.max ?? null,
    },
    reff: {
      min: reffBounds?.min ?? null,
      max: reffBounds?.max ?? null,
    },
    q: {
      min: qBounds?.min ?? null,
      max: qBounds?.max ?? null,
    },
    pa: {
      min: paBounds?.min ?? null,
      max: paBounds?.max ?? null,
    },
    mag: {
      min: magBounds?.min ?? null,
      max: magBounds?.max ?? null,
    },
    mean_mue: {
      min: meanMueBounds?.min ?? null,
      max: meanMueBounds?.max ?? null,
    },
    nucleus: {
      hasNucleus: nucleusCount > 0,
      totalCount: galaxies.length,
    },
  };
};
