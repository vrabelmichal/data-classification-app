import { SortField } from "./GalaxyBrowser";

export const STORAGE_KEY = "galaxyBrowserSettings";

/**
 * Format a number with adaptive decimal places
 * Uses as few decimals as needed to represent the value accurately
 */
const formatDynamicDecimals = (value: number, minDecimals: number = 0, maxDecimals: number = 10): string => {
  // For integers, return without decimals
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Convert to string to count actual significant decimals
  const str = value.toString();
  
  // Handle scientific notation
  if (str.includes('e')) {
    // For very small numbers in scientific notation, use maxDecimals
    return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
  }

  // Find actual decimal places in the value
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) return value.toString();

  const actualDecimals = str.length - decimalIndex - 1;
  const decimalsToUse = Math.max(minDecimals, Math.min(actualDecimals, maxDecimals));

  return value.toFixed(decimalsToUse).replace(/\.?0+$/, '');
};

export type SearchField =
  | 'searchId'
  | 'searchRaMin'
  | 'searchRaMax'
  | 'searchDecMin'
  | 'searchDecMax'
  | 'searchReffMin'
  | 'searchReffMax'
  | 'searchQMin'
  | 'searchQMax'
  | 'searchPaMin'
  | 'searchPaMax'
  | 'searchMagMin'
  | 'searchMagMax'
  | 'searchMeanMueMin'
  | 'searchMeanMueMax'
  | 'searchNucleus'
  | 'searchClassificationStatus'
  | 'searchLsbClass'
  | 'searchMorphology'
  | 'searchAwesome'
  | 'searchValidRedshift'
  | 'searchVisibleNucleus';

/**
 * Get placeholder text for search bounds based on field type and min/max
 */
export const getPlaceholderText = (
  field: 'ra' | 'dec' | 'reff' | 'q' | 'pa' | 'mag' | 'mean_mue' | 'totalClassifications' | 'numVisibleNucleus' | 'numAwesomeFlag' | 'totalAssigned',
  type: 'min' | 'max',
  bounds?: any,
  isSearchActive?: boolean,
  currentBounds?: any
) => {
  const activeBounds = isSearchActive && currentBounds ? currentBounds : bounds;
  if (!activeBounds) return type === 'min' ? 'Min' : 'Max';

  const fieldBounds = activeBounds[field];
  if (!fieldBounds) return type === 'min' ? 'Min' : 'Max';

  const value = fieldBounds[type];
  if (value === null) return type === 'min' ? 'Min' : 'Max';

  const label = type === 'min' ? 'Min' : 'Max';

  // Format based on field type with adaptive decimals
  switch (field) {
    case 'ra':
    case 'dec':
      // Degrees: typically need 4 decimals for arcsecond precision, but use adaptive
      return `${label}: ${formatDynamicDecimals(value, 0, 8)}`;
    case 'reff':
    case 'mag':
    case 'mean_mue':
      // These can have varying precision, use adaptive decimals
      return `${label}: ${formatDynamicDecimals(value, 0, 6)}`;
    case 'q':
      // Axis ratio: typically 0-1 range, use adaptive
      return `${label}: ${formatDynamicDecimals(value, 0, 6)}`;
    case 'pa':
      // Position angle: degrees, use adaptive
      return `${label}: ${formatDynamicDecimals(value, 0, 5)}`;
    case 'totalClassifications':
    case 'numVisibleNucleus':
    case 'numAwesomeFlag':
    case 'totalAssigned':
      // Integer counts, no decimals
      return `${label}: ${value}`;
    default:
      return label;
  }
};

/**
 * Check if a search field has changed or has a value
 */
export const hasFieldChanged = (
  field: string,
  isSearchActive: boolean,
  currentValues: Record<string, any>,
  appliedValues: Record<string, any>
): boolean => {
  if (!isSearchActive) {
    // When search is not active, highlight fields that have values
    switch (field) {
      case 'searchId': return currentValues.searchId !== "";
      case 'searchRaMin': return currentValues.searchRaMin !== "";
      case 'searchRaMax': return currentValues.searchRaMax !== "";
      case 'searchDecMin': return currentValues.searchDecMin !== "";
      case 'searchDecMax': return currentValues.searchDecMax !== "";
      case 'searchReffMin': return currentValues.searchReffMin !== "";
      case 'searchReffMax': return currentValues.searchReffMax !== "";
      case 'searchQMin': return currentValues.searchQMin !== "";
      case 'searchQMax': return currentValues.searchQMax !== "";
      case 'searchPaMin': return currentValues.searchPaMin !== "";
      case 'searchPaMax': return currentValues.searchPaMax !== "";
      case 'searchMagMin': return currentValues.searchMagMin !== "";
      case 'searchMagMax': return currentValues.searchMagMax !== "";
      case 'searchMeanMueMin': return currentValues.searchMeanMueMin !== "";
      case 'searchMeanMueMax': return currentValues.searchMeanMueMax !== "";
      case 'searchTotalClassificationsMin': return currentValues.searchTotalClassificationsMin !== "";
      case 'searchTotalClassificationsMax': return currentValues.searchTotalClassificationsMax !== "";
      case 'searchNumVisibleNucleusMin': return currentValues.searchNumVisibleNucleusMin !== "";
      case 'searchNumVisibleNucleusMax': return currentValues.searchNumVisibleNucleusMax !== "";
      case 'searchNumAwesomeFlagMin': return currentValues.searchNumAwesomeFlagMin !== "";
      case 'searchNumAwesomeFlagMax': return currentValues.searchNumAwesomeFlagMax !== "";
      case 'searchTotalAssignedMin': return currentValues.searchTotalAssignedMin !== "";
      case 'searchTotalAssignedMax': return currentValues.searchTotalAssignedMax !== "";
      default: return false;
    }
  }
  // When search is active, check for pending changes
  return currentValues[field] !== appliedValues[field];
};

/**
 * Check if there are any search values set
 */
export const hasAnySearchValues = (values: Record<string, any>): boolean => {
  return (
    values.searchId !== "" ||
    values.searchRaMin !== "" ||
    values.searchRaMax !== "" ||
    values.searchDecMin !== "" ||
    values.searchDecMax !== "" ||
    values.searchReffMin !== "" ||
    values.searchReffMax !== "" ||
    values.searchQMin !== "" ||
    values.searchQMax !== "" ||
    values.searchPaMin !== "" ||
    values.searchPaMax !== "" ||
    values.searchNucleus !== undefined ||
    values.searchTotalClassificationsMin !== "" ||
    values.searchTotalClassificationsMax !== "" ||
    values.searchNumVisibleNucleusMin !== "" ||
    values.searchNumVisibleNucleusMax !== "" ||
    values.searchNumAwesomeFlagMin !== "" ||
    values.searchNumAwesomeFlagMax !== "" ||
    values.searchTotalAssignedMin !== "" ||
    values.searchTotalAssignedMax !== "" ||
    values.searchAwesome !== undefined ||
    values.searchValidRedshift !== undefined ||
    values.searchVisibleNucleus !== undefined
  );
};

/**
 * Get CSS class for input field with visual indicator for changed fields
 */
export const getInputClass = (field: string, baseClass: string, hasChanged: boolean): string => {
  return hasChanged
    ? `${baseClass} ring-2 ring-orange-400 border-orange-400`
    : baseClass;
};

/**
 * Handle sort change for table headers
 */
export const handleSort = (
  field: SortField,
  currentSortBy: SortField,
  currentSortOrder: 'asc' | 'desc',
  setSortBy: (field: SortField) => void,
  setSortOrder: (order: 'asc' | 'desc') => void
) => {
  if (currentSortBy === field) {
    setSortOrder(currentSortOrder === "asc" ? "desc" : "asc");
  } else {
    setSortBy(field);
    setSortOrder("asc");
  }
};

/**
 * Handle jump to page functionality
 */
export const handleJumpToPage = (
  jumpToPage: string,
  totalPages: number,
  setPage: (page: number) => void,
  setJumpToPage: (value: string) => void
) => {
  const pageNum = parseInt(jumpToPage);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
    // Invalid page number, clear the input
    setJumpToPage("");
    return;
  }
  setPage(pageNum);
  setJumpToPage("");
};

/**
 * Handle keyboard events for jump to page input
 */
export const handleJumpKeyPress = (
  e: React.KeyboardEvent,
  handleJump: () => void
) => {
  if (e.key === "Enter") {
    handleJump();
  }
};