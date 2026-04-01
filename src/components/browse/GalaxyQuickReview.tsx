import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ImageViewer, type DefaultZoomOptions } from "../classification/ImageViewer";
import { getImageUrl } from "../../images";
import { loadImageDisplaySettings } from "../../images/displaySettings";
import type { FilterType, SortField, SortOrder } from "./GalaxyBrowser";

function shouldKeepQuickReviewOpenOnClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

// 2× zoom applied on first load for each galaxy
const REVIEW_DEFAULT_ZOOM: DefaultZoomOptions = {
  mode: "multiple",
  value: 3,
  applyIfOriginalSizeBelow: 9999,
};

// ─────────────────────────────────────────────────────────────
// Image option extraction from defaultImageDisplaySettings
// ─────────────────────────────────────────────────────────────
interface ImageOption {
  key: string;
  label: string;
  allowEllipse: boolean;
}

function findImageOptionMetadata(key: string): Pick<ImageOption, "label" | "allowEllipse"> | null {
  const settings = loadImageDisplaySettings();

  for (const group of settings.classification.contrastGroups) {
    for (const entry of group) {
      if (entry.key === key) {
        return {
          label: (entry.label ?? entry.key).replace(/\n/g, " "),
          allowEllipse: entry.allowEllipse !== false,
        };
      }

      if (entry.key_masked === key) {
        return {
          label: (entry.label_masked ?? entry.key_masked).replace(/\n/g, " "),
          allowEllipse: entry.allowEllipse !== false,
        };
      }
    }
  }

  return null;
}

function buildImageOptions(): ImageOption[] {
  const settings = loadImageDisplaySettings();
  const seen = new Set<string>();
  const options: ImageOption[] = [];

  // Preview image first
  const previewKey = settings.previewImageName;
  if (!seen.has(previewKey)) {
    seen.add(previewKey);
    const previewMetadata = findImageOptionMetadata(previewKey);
    options.push({
      key: previewKey,
      label: previewMetadata?.label ?? "Preview (default)",
      allowEllipse: previewMetadata?.allowEllipse !== false,
    });
  }

  for (const group of settings.classification.contrastGroups) {
    for (const entry of group) {
      // Unmasked key
      if (!seen.has(entry.key)) {
        seen.add(entry.key);
        const rawLabel = entry.label ?? entry.key;
        options.push({
          key: entry.key,
          label: rawLabel.replace(/\n/g, " "),
          allowEllipse: entry.allowEllipse !== false,
        });
      }
      // Masked key (if different)
      if (entry.key_masked && !seen.has(entry.key_masked)) {
        seen.add(entry.key_masked);
        const rawLabel = entry.label_masked ?? entry.key_masked;
        options.push({
          key: entry.key_masked,
          label: rawLabel.replace(/\n/g, " "),
          allowEllipse: entry.allowEllipse !== false,
        });
      }
    }
  }

  return options;
}

const IMAGE_OPTIONS = buildImageOptions();
const QUICK_REVIEW_IMAGE_STORAGE_KEY = "galaxyQuickReview:selectedImageKey";

function isKnownImageOption(key: string | null | undefined): key is string {
  return !!key && IMAGE_OPTIONS.some((option) => option.key === key);
}

function getInitialSelectedImageKey(): string {
  const fallback = loadImageDisplaySettings().previewImageName;

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedImageKey = window.localStorage.getItem(QUICK_REVIEW_IMAGE_STORAGE_KEY);
    return isKnownImageOption(storedImageKey) ? storedImageKey : fallback;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
export interface GalaxyQuickReviewFilters {
  sortBy: SortField;
  sortOrder: SortOrder;
  filter: FilterType;
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

interface GalaxyQuickReviewProps {
  filters: GalaxyQuickReviewFilters;
  effectiveImageQuality: "high" | "medium" | "low";
  userPrefs: any;
  /** Initial index to resume at (0-based in the ordered result set) */
  initialIndex: number;
  initialSelectedImageKey?: string;
  initialShowEllipse?: boolean;
  /** Called whenever the displayed galaxy changes */
  onGalaxyChange: (id: string, index: number) => void;
  onReviewStateChange?: (state: {
    galaxyId: string | null;
    index: number;
    selectedImageKey: string;
    showEllipse: boolean;
  }) => void;
  onClose: (state: {
    galaxyId: string | null;
    index: number;
    selectedImageKey: string;
    showEllipse: boolean;
  }) => void;
}

const BATCH_SIZE = 50;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function buildQueryArgs(filters: GalaxyQuickReviewFilters, cursor: string | undefined) {
  const s = filters.isSearchActive;
  return {
    offset: 0,
    numItems: BATCH_SIZE,
    cursor,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    filter: filters.filter,
    searchId: s ? filters.searchId : undefined,
    searchRaMin: s ? (filters.searchRaMin || undefined) : undefined,
    searchRaMax: s ? (filters.searchRaMax || undefined) : undefined,
    searchDecMin: s ? (filters.searchDecMin || undefined) : undefined,
    searchDecMax: s ? (filters.searchDecMax || undefined) : undefined,
    searchReffMin: s ? (filters.searchReffMin || undefined) : undefined,
    searchReffMax: s ? (filters.searchReffMax || undefined) : undefined,
    searchQMin: s ? (filters.searchQMin || undefined) : undefined,
    searchQMax: s ? (filters.searchQMax || undefined) : undefined,
    searchPaMin: s ? (filters.searchPaMin || undefined) : undefined,
    searchPaMax: s ? (filters.searchPaMax || undefined) : undefined,
    searchMagMin: s ? (filters.searchMagMin || undefined) : undefined,
    searchMagMax: s ? (filters.searchMagMax || undefined) : undefined,
    searchMeanMueMin: s ? (filters.searchMeanMueMin || undefined) : undefined,
    searchMeanMueMax: s ? (filters.searchMeanMueMax || undefined) : undefined,
    searchNucleus: s ? filters.searchNucleus : undefined,
    searchTotalClassificationsMin: s ? (filters.searchTotalClassificationsMin || undefined) : undefined,
    searchTotalClassificationsMax: s ? (filters.searchTotalClassificationsMax || undefined) : undefined,
    searchNumVisibleNucleusMin: s ? (filters.searchNumVisibleNucleusMin || undefined) : undefined,
    searchNumVisibleNucleusMax: s ? (filters.searchNumVisibleNucleusMax || undefined) : undefined,
    searchNumAwesomeFlagMin: s ? (filters.searchNumAwesomeFlagMin || undefined) : undefined,
    searchNumAwesomeFlagMax: s ? (filters.searchNumAwesomeFlagMax || undefined) : undefined,
    searchNumFailedFittingMin: s ? (filters.searchNumFailedFittingMin || undefined) : undefined,
    searchNumFailedFittingMax: s ? (filters.searchNumFailedFittingMax || undefined) : undefined,
    searchTotalAssignedMin: s ? (filters.searchTotalAssignedMin || undefined) : undefined,
    searchTotalAssignedMax: s ? (filters.searchTotalAssignedMax || undefined) : undefined,
    searchAwesome: s ? filters.searchAwesome : undefined,
    searchValidRedshift: s ? filters.searchValidRedshift : undefined,
    searchVisibleNucleus: s ? filters.searchVisibleNucleus : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function GalaxyQuickReview({
  filters,
  effectiveImageQuality,
  userPrefs,
  initialIndex,
  initialSelectedImageKey,
  initialShowEllipse,
  onGalaxyChange,
  onReviewStateChange,
  onClose,
}: GalaxyQuickReviewProps) {
  // Image + overlay state
  const [selectedImageKey, setSelectedImageKey] = useState<string>(() => (
    isKnownImageOption(initialSelectedImageKey) ? initialSelectedImageKey : getInitialSelectedImageKey()
  ));
  const [showEllipse, setShowEllipse] = useState(initialShowEllipse === true);

  // Navigation
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Galaxy buffer
  const [galaxies, setGalaxies] = useState<any[]>([]);

  // Cursor management
  const [fetchCursor, setFetchCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const processedCursors = useRef<Set<string>>(new Set());
  const selectedImageOption = IMAGE_OPTIONS.find((option) => option.key === selectedImageKey);
  const ellipseAllowed = selectedImageOption?.allowEllipse !== false;

  useEffect(() => {
    try {
      window.localStorage.setItem(QUICK_REVIEW_IMAGE_STORAGE_KEY, selectedImageKey);
    } catch {
      // Ignore storage failures and continue with in-memory state.
    }
  }, [selectedImageKey]);

  useEffect(() => {
    if (!ellipseAllowed && showEllipse) {
      setShowEllipse(false);
    }
  }, [ellipseAllowed, showEllipse]);

  useEffect(() => {
    if (!isKnownImageOption(initialSelectedImageKey)) return;
    setSelectedImageKey(initialSelectedImageKey);
  }, [initialSelectedImageKey]);

  useEffect(() => {
    setShowEllipse(initialShowEllipse === true);
  }, [initialShowEllipse]);



  // Query
  const queryArgs = buildQueryArgs(filters, fetchCursor);
  const batchResult = useQuery(api.galaxies.browse.browseGalaxies, queryArgs);

  // Accumulate batch results
  useEffect(() => {
    if (!batchResult) return;
    const cursorKey = fetchCursor ?? "__initial__";
    if (processedCursors.current.has(cursorKey)) return;
    processedCursors.current.add(cursorKey);

    setGalaxies((prev) => [...prev, ...(batchResult.galaxies ?? [])]);

    if (batchResult.hasNext && batchResult.cursor) {
      setNextCursor(batchResult.cursor);
      setIsAtEnd(false);
    } else {
      setNextCursor(null);
      setIsAtEnd(true);
    }
  }, [batchResult, fetchCursor]);

  // Prefetch next batch when approaching the end of the current buffer
  const PREFETCH_THRESHOLD = 10;
  useEffect(() => {
    if (isAtEnd) return;
    if (nextCursor === null || nextCursor === undefined) return;
    if (currentIndex >= galaxies.length - PREFETCH_THRESHOLD) {
      if (!processedCursors.current.has(nextCursor)) {
        setFetchCursor(nextCursor);
      }
    }
  }, [currentIndex, galaxies.length, isAtEnd, nextCursor]);

  // Notify parent of current galaxy.
  const currentGalaxy = galaxies[currentIndex] ?? null;
  useEffect(() => {
    if (!currentGalaxy?.id) return;
    onGalaxyChange(currentGalaxy.id, currentIndex);
    onReviewStateChange?.({
      galaxyId: currentGalaxy.id,
      index: currentIndex,
      selectedImageKey,
      showEllipse,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGalaxy?.id, currentIndex, selectedImageKey, showEllipse]);

  // Navigation
  const canGoNext = currentIndex < galaxies.length - 1 || (!isAtEnd && nextCursor !== null);
  const canGoPrev = currentIndex > 0;

  // Track whether the user pressed Next while at the buffer edge
  const pendingAdvance = useRef(false);

  const goNext = useCallback(() => {
    if (currentIndex < galaxies.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (!isAtEnd && nextCursor !== null && nextCursor !== undefined) {
      // At the end of current buffer but more data available — trigger fetch
      pendingAdvance.current = true;
      if (!processedCursors.current.has(nextCursor)) {
        setFetchCursor(nextCursor);
      }
    }
  }, [currentIndex, galaxies.length, isAtEnd, nextCursor]);

  // Auto-advance once new data arrives after the user pressed Next at boundary
  useEffect(() => {
    if (pendingAdvance.current && currentIndex < galaxies.length - 1) {
      pendingAdvance.current = false;
      setCurrentIndex((i) => i + 1);
    }
  }, [galaxies.length, currentIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  const goFirst = useCallback(() => setCurrentIndex(0), []);

  const handleClassifyClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (shouldKeepQuickReviewOpenOnClick(event)) {
      return;
    }
  }, []);

  const handleClose = useCallback(() => {
    onClose({
      galaxyId: currentGalaxy?.id ?? null,
      index: currentIndex,
      selectedImageKey,
      showEllipse,
    });
  }, [currentGalaxy?.id, currentIndex, onClose, selectedImageKey, showEllipse]);

  // Keyboard
  const toggleEllipse = useCallback(() => {
    if (!ellipseAllowed) return;
    setShowEllipse((v) => !v);
  }, [ellipseAllowed]);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "ArrowRight" || e.key === "n") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft" || e.key === "p") { e.preventDefault(); goPrev(); }
      else if (e.key === "R" && e.shiftKey) { e.preventDefault(); toggleEllipse(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose, toggleEllipse]);

  const isLoading = !batchResult && galaxies.length === 0;

  // ── Render ──
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        {/* Jump-to-first (matching << icon from GalaxyBrowserControls) */}
        <button
          onClick={goFirst}
          disabled={currentIndex === 0}
          title="Jump to first"
          className="flex-shrink-0 p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Position */}
        <span className="text-gray-400 text-xs whitespace-nowrap flex-shrink-0">
          {galaxies.length > 0 ? `${currentIndex + 1} / ${isAtEnd ? galaxies.length : `${galaxies.length}+`}` : "…"}
        </span>

        {/* Galaxy ID + Classify button */}
        {currentGalaxy && (
          <>
            <span className="text-blue-300 text-xs font-mono truncate min-w-0">{currentGalaxy.id}</span>
            <Link
              to={`/classify/${currentGalaxy.id}`}
              onClick={handleClassifyClick}
              className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-1 sm:px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow"
              title="Click to classify this galaxy in detail"
              aria-label={`Classify galaxy ${currentGalaxy.id}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="hidden sm:inline">Classify</span>
            </Link>
          </>
        )}

        <div className="flex-1 min-w-0" />

        {/* Image selector */}
        <select
          value={selectedImageKey}
          onChange={(e) => setSelectedImageKey(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px] sm:max-w-[220px] flex-shrink-0"
          title="Select image type"
        >
          {IMAGE_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        {/* Reff ellipse toggle */}
        <button
          onClick={toggleEllipse}
          disabled={!ellipseAllowed}
          title={ellipseAllowed
            ? "Toggle Reff ellipse overlay"
            : "r_eff overlay is not available for this image type"}
          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors
            ${ellipseAllowed
              ? (showEllipse ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700")
              : "bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed opacity-60"}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <ellipse cx="12" cy="12" rx="10" ry="6" />
          </svg>
          <span className="hidden sm:inline text-xs">Reff</span>
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          title="Close"
          className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex items-stretch overflow-hidden min-h-0">
        {/* Prev arrow */}
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="flex-shrink-0 w-10 sm:w-14 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors hover:bg-gray-800/60"
          title="Previous (← or p)"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Central content: image, then info stacked below */}
        <div className="flex-1 flex flex-col items-center overflow-y-auto min-w-0 py-3 gap-3">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
              <p className="text-gray-400 text-sm">Loading galaxies…</p>
            </div>
          ) : currentGalaxy ? (
            <>
              {/* Image */}
              <div className="flex-shrink-0 w-full flex justify-center px-2">
                <div className="w-full" style={{ maxWidth: "min(90vw, 70vh, 640px)" }}>
                  {/* key forces ImageViewer to remount (reset zoom) each time the galaxy changes */}
                  <ImageViewer
                    key={`${currentGalaxy.id}-${selectedImageKey}`}
                    imageUrl={getImageUrl(currentGalaxy.id, selectedImageKey, { quality: effectiveImageQuality })}
                    alt={`Galaxy ${currentGalaxy.id}`}
                    preferences={userPrefs}
                    defaultZoomOptions={REVIEW_DEFAULT_ZOOM}
                    {...(ellipseAllowed && showEllipse && currentGalaxy.reff_pixels != null
                      ? { reff: currentGalaxy.reff_pixels, pa: currentGalaxy.pa, q: currentGalaxy.q, x: currentGalaxy.x, y: currentGalaxy.y }
                      : {})}
                  />
                </div>
              </div>

              {/* Info panel */}
              <div className="flex-shrink-0 w-full max-w-2xl px-3 pb-2">
                <GalaxyInfoPanel galaxy={currentGalaxy} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 text-sm">No galaxies found.</p>
            </div>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="flex-shrink-0 w-10 sm:w-14 flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors hover:bg-gray-800/60"
          title="Next (→ or n)"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Footer: keyboard hints ── */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-4 py-1.5 bg-gray-900 border-t border-gray-800 text-xs text-gray-600">
        <span>← / p — prev</span>
        <span>→ / n — next</span>
        <span>{ellipseAllowed ? "Shift+R — toggle Reff" : "Shift+R — Reff unavailable for this image"}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info panel — compact dark layout, below the image
// ─────────────────────────────────────────────────────────────
function GalaxyInfoPanel({ galaxy }: { galaxy: any }) {
  const fields: [string, string][] = [
    ["#", galaxy.numericId?.toString() ?? "—"],
    ["RA", typeof galaxy.ra === "number" ? `${galaxy.ra.toFixed(4)}°` : "—"],
    ["Dec", typeof galaxy.dec === "number" ? `${galaxy.dec.toFixed(4)}°` : "—"],
    ["x (px)", galaxy.x != null ? String(Math.round(galaxy.x)) : "—"],
    ["y (px)", galaxy.y != null ? String(Math.round(galaxy.y)) : "—"],
    ["Reff", typeof galaxy.reff === "number" ? galaxy.reff.toFixed(2) : "—"],
    ["q", typeof galaxy.q === "number" ? galaxy.q.toFixed(3) : "—"],
    ["PA", typeof galaxy.pa === "number" ? galaxy.pa.toFixed(1) : "—"],
    ["Mag", typeof galaxy.mag === "number" ? galaxy.mag.toFixed(2) : "—"],
    ["μ₀", typeof galaxy.mean_mue === "number" ? galaxy.mean_mue.toFixed(2) : "—"],
    ["Nucleus", galaxy.nucleus ? "Yes" : "No"],
    ["Classif.", String(galaxy.totalClassifications ?? 0)],
    ["Vis. Nuc.", String(galaxy.numVisibleNucleus ?? 0)],
    ["Awesome", String(galaxy.numAwesomeFlag ?? 0)],
    ["Failed", String(galaxy.numFailedFitting ?? 0)],
    ["Assigned", String(galaxy.totalAssigned ?? 0)],
    ...(galaxy.misc?.paper ? [["Paper", galaxy.misc.paper] as [string, string]] : []),
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-0.5 text-xs">
      {fields.map(([label, value]) => (
        <div key={label} className="flex gap-1 items-baseline min-w-0">
          <span className="text-gray-500 whitespace-nowrap flex-shrink-0">{label}:</span>
          <span className="text-gray-200 truncate">{value}</span>
        </div>
      ))}
    </div>
  );
}
