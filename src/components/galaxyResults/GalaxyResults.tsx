import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { useParams, Link } from "react-router";
import { getImageUrl } from "../../images";
import { loadImageDisplaySettings } from "../../images/displaySettings";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

import { GalaxyInfo } from "../classification/GalaxyInfo";
import { ImageViewer, type DefaultZoomOptions } from "../classification/ImageViewer";
import { ReportIssueModal } from "../ReportIssueModal";
import { ImageUrlsModal, type ImageUrlGroup } from "../classification/ImageUrlsModal";

import {
  EyeIcon,
  AladinLogo,
  EllipseIcon,
  SettingsIcon,
  MaskIcon,
  BugIcon,
  CachePurgeIcon,
} from "../classification/icons";

import { useAdminCloudflareCachePurgeAvailability } from "../../hooks/useAdminCloudflareCachePurgeAvailability";

import type { ImageType } from "../classification/types";
import type { ContrastGroupEntry } from "../../images/types";
import type { PaperMetadataEntry } from "../../lib/paperDisplay";
import {
  getImagePriority,
  processImageLabel,
  shouldShowEllipse as shouldShowEllipseHelper,
} from "../classification/helpers";
import {
  LSB_OPTIONS_CHECKBOX,
  LSB_OPTIONS_LEGACY,
  MORPHOLOGY_OPTIONS,
} from "../classification/constants";
import { getExperienceLabel, getRoleLabel } from "../../lib/permissions";

const imageDisplaySettings = loadImageDisplaySettings();
const classificationImageSettings = imageDisplaySettings.classification;
const imageContrastGroups = classificationImageSettings.contrastGroups;
const defaultContrastGroupIndex = classificationImageSettings.defaultGroupIndex;
const defaultPreviewImageName = imageDisplaySettings.previewImageName;
const defaultMobileOrder = classificationImageSettings.defaultMobileOrder;

const DESKTOP_IMAGE_COLS = 6;

const THUMB_ZOOM: DefaultZoomOptions = {
  mode: "multiple",
  value: 2,
  applyIfOriginalSizeBelow: 500,
};

const ELLIPSE_SETTINGS_MODE: "position" | "key" = "position";

function resolveContrastGroupEntry(
  entry: ContrastGroupEntry,
  showMasks: boolean,
): { key: string; label: string; configKey: string } {
  const key = showMasks ? (entry.key_masked ?? entry.key) : entry.key;
  const label = showMasks
    ? (entry.label_masked ?? entry.label ?? key)
    : (entry.label ?? entry.label_masked ?? key);
  const configKey = entry.key;
  return { key, label, configKey };
}

function appendCacheBustParam(url: string, cacheBustToken: number): string {
  if (!url || cacheBustToken <= 0) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}reload=${cacheBustToken}`;
}

function flattenImageLabel(label: string): string {
  return label.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

const LSB_LABELS = new Map(
  [...LSB_OPTIONS_LEGACY, ...LSB_OPTIONS_CHECKBOX].map((option) => [
    option.value,
    option.label.replace(/\s*\[[^\]]+\]$/, ""),
  ])
);

const MORPHOLOGY_LABELS = new Map(
  MORPHOLOGY_OPTIONS.map((option) => [
    option.value,
    option.label.replace(/\s*\[[^\]]+\]$/, ""),
  ])
);

interface ClassificationRow {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string;
  userExperience: string;
  userIsActive: boolean | null;
  lsb_class: number;
  morphology: number;
  awesome_flag: boolean;
  valid_redshift: boolean;
  visible_nucleus: boolean | null;
  failed_fitting: boolean;
  comments: string | null;
  timeSpent: number;
  createdAt: number;
}

interface GalaxySummary {
  totalClassifications: number;
  totalClassifiers: number;
  nonLsbCount: number;
  lsbCount: number;
  failedFittingCount: number;
  featurelessCount: number;
  irregularCount: number;
  spiralCount: number;
  ellipticalCount: number;
  awesomeCount: number;
  validRedshiftCount: number;
  visibleNucleusCount: number;
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "0s";
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  const pct = (value / total) * 100;
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

function GalaxyResultsKeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Display</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Toggle ellipse overlay</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Shift+R</kbd>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Toggle masked images</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Shift+M</kbd>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Next contrast group</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">C</kbd>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Previous contrast group</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Shift+C</kbd>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">External</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Open in Aladin</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Shift+A</kbd>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">Show this help</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">?</kbd>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type ImageMode = "single" | "double" | "grid";

export function GalaxyResults() {
  const { galaxyId } = useParams<{ galaxyId: string }>();
  const isOnline = useOnlineStatus();

  const [showMasks, setShowMasks] = useState(true);
  const [showEllipseOverlay, setShowEllipseOverlay] = useState(true);
  const [currentContrastGroup, setCurrentContrastGroup] = useState(defaultContrastGroupIndex);
  const [showEllipseSettings, setShowEllipseSettings] = useState(false);
  const [contrastGroupReloadToken, setContrastGroupReloadToken] = useState(0);
  const [isPurgingContrastGroupCache, setIsPurgingContrastGroupCache] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showImageUrlsModal, setShowImageUrlsModal] = useState(false);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>("grid");
  const [mobileImagesExpanded, setMobileImagesExpanded] = useState(false);
  const [showEmails, setShowEmails] = useState(false);

  const userProfile = useQuery(api.users.getUserProfile);
  const userPrefs = useQuery(api.users.getUserPreferences);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);

  const canViewResults =
    userProfile?.permissions?.viewGalaxyResults === true;

  const galaxyResults = useQuery(
    api.classification.getGalaxyResults,
    galaxyId && canViewResults ? { galaxyExternalId: galaxyId } : "skip"
  );

  const loadAdditionalDetailsMutation = useMutation(
    api.galaxies.core.getAdditionalGalaxyDetailsByExternalId
  );
  const updatePreferences = useMutation(api.users.updatePreferences);
  const purgeImageUrls = useAction(api.cloudflareCache.purgeImageUrls);

  const { isAvailable: isCloudflareCachePurgeAvailable } =
    useAdminCloudflareCachePurgeAvailability();

  const displayGalaxy = galaxyResults?.galaxy ?? null;
  const classifications = (galaxyResults?.classifications ?? []) as ClassificationRow[];
  const summary = (galaxyResults?.summary ?? null) as GalaxySummary | null;

  const resolvedGalaxyId = displayGalaxy?.id ?? galaxyId ?? null;

  usePageTitle(() => (displayGalaxy?.id ? `Results for ${displayGalaxy.id}` : "Galaxy Results"));

  const defaultImageQuality = (systemSettings?.defaultImageQuality as "high" | "low") || "high";
  const effectiveImageQuality = userPrefs?.imageQuality || defaultImageQuality;

  const currentImageGroup =
    imageContrastGroups[currentContrastGroup] ?? imageContrastGroups[defaultContrastGroupIndex];

  const imageTypes = currentImageGroup
    .map<ImageType | null>((entry, index) => {
      const resolvedEntry = resolveContrastGroupEntry(entry, showMasks);
      const { key, label, configKey } = resolvedEntry;
      const { showEllipse, rectangle, allowEllipse } = entry;
      const baseUrl = resolvedGalaxyId
        ? getImageUrl(resolvedGalaxyId, key, { quality: effectiveImageQuality })
        : null;

      const settingsKey = ELLIPSE_SETTINGS_MODE === "position" ? `pos_${index}` : configKey;
      const userPref = userPrefs?.ellipseSettings?.[settingsKey];
      const isAllowed = allowEllipse !== false;
      const effectiveShowEllipse = isAllowed ? (userPref ?? showEllipse === true) : false;

      return {
        key,
        configKey,
        name: label,
        displayName: processImageLabel(label),
        url: baseUrl ? appendCacheBustParam(baseUrl, contrastGroupReloadToken) : null,
        showEllipse: effectiveShowEllipse,
        rectangle,
        allowEllipse: allowEllipse !== false,
        defaultShowEllipse: showEllipse === true,
        positionIndex: index,
      };
    })
    .filter((item): item is ImageType => item !== null);

  const sortedImageTypes = [...imageTypes].sort(
    (a, b) =>
      getImagePriority(a.key, DESKTOP_IMAGE_COLS, defaultPreviewImageName) -
      getImagePriority(b.key, DESKTOP_IMAGE_COLS, defaultPreviewImageName)
  );

  // Mobile image order: use defaultMobileOrder if provided, otherwise use original order
  const mobileImageTypes = defaultMobileOrder
    ? defaultMobileOrder
      .filter((idx) => idx >= 0 && idx < imageTypes.length)
      .map((idx) => imageTypes[idx])
    : imageTypes;

  // On small screens, show limited images by default; expand shows all.
  // Single mode: 1 image default. Double mode: 2 images default.
  const visibleMobileImages = (() => {
    if (mobileImagesExpanded) return mobileImageTypes;
    if (imageMode === "double") return mobileImageTypes.slice(0, 2);
    return mobileImageTypes.slice(0, 1);
  })();

  // Build image URL groups for the ImageUrlsModal
  const allContrastGroupImageUrls: ImageUrlGroup[] = displayGalaxy?.id
    ? imageContrastGroups.map((group, groupIndex) => ({
      label: classificationImageSettings.groupLabels?.[groupIndex] || `Contrast Group ${groupIndex + 1}`,
      entries: group.map((entry) => {
        const resolvedEntry = resolveContrastGroupEntry(entry, showMasks);
        return {
          key: resolvedEntry.key,
          label: flattenImageLabel(resolvedEntry.label),
          url: getImageUrl(displayGalaxy.id, resolvedEntry.key, {
            quality: effectiveImageQuality,
          }),
        };
      }),
    }))
    : [];

  // Track screen size changes
  useEffect(() => {
    const checkScreenSize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 1024);
      if (w < 480) {
        setImageMode("single");
      } else if (w < 768) {
        setImageMode("double");
      } else {
        setImageMode("grid");
      }
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("showEllipseOverlay");
      if (saved !== null) setShowEllipseOverlay(JSON.parse(saved));
    } catch {
      // Ignore malformed localStorage data
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("showMasks");
      if (saved !== null) setShowMasks(JSON.parse(saved));
    } catch {
      // Ignore malformed localStorage data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("showEllipseOverlay", JSON.stringify(showEllipseOverlay));
  }, [showEllipseOverlay]);

  useEffect(() => {
    localStorage.setItem("showMasks", JSON.stringify(showMasks));
  }, [showMasks]);

  useEffect(() => {
    setContrastGroupReloadToken(0);
  }, [displayGalaxy?.id, currentContrastGroup, showMasks]);

  useEffect(() => {
    setShowAdditionalDetails(false);
    setAdditionalDetails(null);
    setShowImageUrlsModal(false);
    setMobileImagesExpanded(false);
  }, [displayGalaxy?.id]);

  const handleToggleDetails = async () => {
    if (showAdditionalDetails) {
      setShowAdditionalDetails(false);
      return;
    }
    if (additionalDetails) {
      setShowAdditionalDetails(true);
      return;
    }
    if (!displayGalaxy?.id) return;
    setLoadingDetails(true);
    try {
      const result = await loadAdditionalDetailsMutation({
        externalId: displayGalaxy.id,
      });
      setAdditionalDetails(result);
      setShowAdditionalDetails(true);
    } catch {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAladinClick = () => {
    if (displayGalaxy) {
      const url = `https://aladin.cds.unistra.fr/AladinLite/?target=${displayGalaxy.ra}%20${displayGalaxy.dec}&fov=0.1&survey=P/DESI-Legacy-Surveys/DR10/color`;
      window.open(url, "_blank");
    }
  };

  const handleContrastClick = () => {
    setCurrentContrastGroup((prev) => {
      const next = (prev + 1) % imageContrastGroups.length;
      toast.info(`Contrast Group: ${next + 1} of ${imageContrastGroups.length}`);
      return next;
    });
  };

  const handleContrastPrevious = () => {
    setCurrentContrastGroup((prev) => {
      const next = (prev - 1 + imageContrastGroups.length) % imageContrastGroups.length;
      toast.info(`Contrast Group: ${next + 1} of ${imageContrastGroups.length}`);
      return next;
    });
  };

  const shouldShowEllipseFunc = (showEllipse: boolean | undefined) =>
    shouldShowEllipseHelper(showEllipse, showEllipseOverlay);

  const handleToggleEllipseSetting = async (settingsKey: string, currentVal: boolean) => {
    if (!showEllipseOverlay) setShowEllipseOverlay(true);
    const newSettings = {
      ...(userPrefs?.ellipseSettings || {}),
      [settingsKey]: !currentVal,
    };
    await updatePreferences({ ellipseSettings: newSettings });
  };

  const getSettingsKey = (img: any, index: number): string =>
    ELLIPSE_SETTINGS_MODE === "position" ? `pos_${index}` : img.configKey;

  const handlePurgeCurrentContrastGroup = async () => {
    if (!isCloudflareCachePurgeAvailable || !isOnline) return;
    const urls = currentImageGroup
      .map((entry) => {
        if (!resolvedGalaxyId) return null;
        const resolved = resolveContrastGroupEntry(entry, showMasks);
        return getImageUrl(resolvedGalaxyId, resolved.key, { quality: effectiveImageQuality });
      })
      .filter((url): url is string => typeof url === "string" && url.length > 0);
    if (urls.length === 0) {
      toast.error("No visible image URLs available to invalidate");
      return;
    }
    setIsPurgingContrastGroupCache(true);
    try {
      const result = await purgeImageUrls({ urls });
      if (result.success) {
        toast.success(`Cache invalidation submitted for ${result.submittedCount} image${result.submittedCount === 1 ? "" : "s"}`);
      } else {
        toast.error("Cloudflare rejected part of the purge request");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invalidate Cloudflare cache");
    } finally {
      setIsPurgingContrastGroupCache(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showReportIssueModal || showKeyboardHelp) return;
      if (e.target instanceof HTMLInputElement) {
        const type = e.target.type.toLowerCase();
        if (type !== "radio" && type !== "checkbox") return;
      }
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.dataset.noShortcuts !== undefined) return;

      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "r":
            e.preventDefault();
            setShowEllipseOverlay((prev) => !prev);
            return;
          case "m":
            e.preventDefault();
            setShowMasks((prev) => !prev);
            return;
          case "a":
            e.preventDefault();
            handleAladinClick();
            return;
        }
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case "c":
          e.preventDefault();
          if (e.shiftKey) handleContrastPrevious();
          else handleContrastClick();
          break;
        case "?":
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showReportIssueModal, showKeyboardHelp, displayGalaxy]);

  if (!galaxyId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center text-gray-500 dark:text-gray-400">
          No galaxy ID specified.
        </div>
      </div>
    );
  }

  if (userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (canViewResults === false) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h3>
            <p className="text-gray-600 dark:text-gray-300">
              You do not have permission to view galaxy classification results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (galaxyResults === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!displayGalaxy) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Galaxy Not Found</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Galaxy ID <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">{galaxyId}</code> was not found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderEllipseControl = () => (
    <div className="relative inline-block text-left">
      <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
        <button
          onClick={() => setShowEllipseOverlay(!showEllipseOverlay)}
          className={cn(
            "relative flex items-center justify-center gap-2 rounded-md transition-all duration-200 font-medium px-3 py-1",
            showEllipseOverlay
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          )}
          title="Toggle Effective Radius Overlay (Shift+R)"
        >
          <EllipseIcon className="w-4 h-4" />
          <span className="text-sm flex items-center">
            <span className="font-semibold inline-block w-[3ch] text-center">
              {showEllipseOverlay ? "ON" : "OFF"}
            </span>
          </span>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <button
          onClick={() => setShowEllipseSettings(!showEllipseSettings)}
          className={cn(
            "rounded-md transition-colors flex items-center justify-center p-1.5",
            showEllipseSettings
              ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          )}
          title="Configure Overlay Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
      {showEllipseSettings && (
        <div className="absolute right-0 top-full mt-2 w-[400px] z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
            Configure Effective Radius Overlay (r<sub>eff</sub>) per image
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sortedImageTypes.map((img, index) => {
              const rawImg = img as any;
              if (rawImg.allowEllipse === false) {
                return <div key={`${img.key}-${index}`} className="invisible" />;
              }
              const isChecked = img.showEllipse === true;
              const settingsKey = getSettingsKey(rawImg, rawImg.positionIndex ?? index);
              return (
                <label
                  key={`${img.key}-${index}`}
                  className="flex items-center cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleEllipseSetting(settingsKey, isChecked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-2"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 select-none">
                    {img.displayName}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderMaskControl = () => (
    <div className="relative inline-block text-left">
      <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
        <button
          onClick={() => setShowMasks((prev) => !prev)}
          className={cn(
            "relative flex items-center justify-center gap-2 rounded-md transition-all duration-200 font-medium px-3 py-1",
            showMasks
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          )}
          title="Toggle masked images (Shift+M)"
        >
          <MaskIcon className="w-4 h-4" />
          <span className="text-sm flex items-center">
            <span className="font-semibold inline-block w-[3ch] text-center">
              {showMasks ? "ON" : "OFF"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  const renderCachePurgeControl = () => {
    if (!isCloudflareCachePurgeAvailable) return null;
    return (
      <div className="relative inline-block text-left">
        <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
          <button
            onClick={handlePurgeCurrentContrastGroup}
            disabled={isPurgingContrastGroupCache}
            className={cn(
              "relative flex items-center justify-center rounded-md transition-all duration-200 font-medium px-2 py-1",
              isPurgingContrastGroupCache
                ? "bg-amber-500 text-white"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
            )}
            title="Invalidate Cloudflare cache for visible images"
          >
            {isPurgingContrastGroupCache ? (
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <CachePurgeIcon className="w-4 h-5" />
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderReportButton = () => (
    <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
      <button
        onClick={() => setShowReportIssueModal(true)}
        className="rounded-md transition-colors flex items-center justify-center p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        title="Report issue"
      >
        <BugIcon className="w-4 h-4" />
      </button>
    </div>
  );

  const renderClassifyButton = () => (
    <Link
      to={`/classify/${displayGalaxy.id}`}
      className="inline-flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5"
      title="Open in classification interface"
    >
      <span className="flex items-center justify-center gap-1.5 rounded-md transition-colors p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        {!isMobile && <span className="text-sm font-medium">Classify</span>}
      </span>
    </Link>
  );

  const renderImageCard = (imageType: ImageType) => (
    <div
      key={imageType.url ?? imageType.key}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 max-w-[256px] mx-auto"
    >
      <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-2 text-center truncate">
        {imageType.displayName}
      </h3>
      <div className="aspect-square max-w-[256px] mx-auto">
        {imageType.url ? (
          <ImageViewer
            imageUrl={imageType.url}
            alt={`${displayGalaxy.id} - ${imageType.name}`}
            preferences={userPrefs}
            contrast={1.0}
            defaultZoomOptions={THUMB_ZOOM}
            {...(shouldShowEllipseFunc(imageType.showEllipse) && {
              reff: displayGalaxy.reff_pixels,
              pa: displayGalaxy.pa,
              q: displayGalaxy.q,
              x: displayGalaxy.x,
              y: displayGalaxy.y,
            })}
            rectangle={imageType.rectangle}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🌌</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {showReportIssueModal && (
        <ReportIssueModal isOpen={showReportIssueModal} onClose={() => setShowReportIssueModal(false)} />
      )}
      {showKeyboardHelp && (
        <GalaxyResultsKeyboardHelp onClose={() => setShowKeyboardHelp(false)} />
      )}
      {displayGalaxy?.id && (
        <ImageUrlsModal
          isOpen={showImageUrlsModal}
          onClose={() => setShowImageUrlsModal(false)}
          galaxyId={displayGalaxy.id}
          groups={allContrastGroupImageUrls}
          maskSummary={showMasks ? "Masked variants when available" : "Default image variants"}
        />
      )}
      <div className="p-4 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
      <div className={cn("flex items-center gap-2", isMobile && "flex-col items-stretch")}>
        <div className="text-sm text-gray-600 dark:text-gray-300 mr-auto">
          <span className="font-medium">Galaxy:</span> {displayGalaxy.id}
        </div>
        <div className={cn("flex items-center gap-1.5", isMobile && "flex-wrap")}>
          {renderEllipseControl()}
          {renderMaskControl()}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
            <button
              onClick={handleContrastClick}
              className="flex items-center justify-center rounded-md transition-colors p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              title={`Switch contrast group ${currentContrastGroup + 1}/${imageContrastGroups.length} (C / Shift+C)`}
            >
              <EyeIcon className="w-4 h-4" />
              {!isMobile && (
                <span className="text-sm font-medium ml-1.5">
                  Group {currentContrastGroup + 1}/{imageContrastGroups.length}
                </span>
              )}
            </button>
          </div>
          <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
            <button
              onClick={handleAladinClick}
              className="flex items-center justify-center rounded-md transition-colors p-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
              title="Open in Aladin (Shift+A)"
            >
              <AladinLogo size={16} />
            </button>
          </div>
          {renderCachePurgeControl()}
          {renderReportButton()}
          {renderClassifyButton()}
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {/* Images */}
      {imageMode !== "grid" ? (
        <div className="space-y-3">
          <div className={imageMode === "double" ? "grid grid-cols-2 gap-4" : "flex flex-col items-center gap-4"}>
            {visibleMobileImages.map(renderImageCard)}
          </div>
          {(imageMode === "single" ? mobileImageTypes.length > 1 : mobileImageTypes.length > 2) && (
            <div className="flex justify-center">
              <button
                onClick={() => setMobileImagesExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {mobileImagesExpanded ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                    Hide images
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    Show all {mobileImageTypes.length} images
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {sortedImageTypes.map(renderImageCard)}
        </div>
      )}

      {/* Galaxy Details Panel */}
      <GalaxyInfo
        displayGalaxy={{
          _id: displayGalaxy._id,
          id: displayGalaxy.id,
          ra: displayGalaxy.ra,
          dec: displayGalaxy.dec,
          reff: displayGalaxy.reff,
          reff_pixels: displayGalaxy.reff_pixels,
          q: displayGalaxy.q,
          pa: displayGalaxy.pa,
          nucleus: displayGalaxy.nucleus ?? false,
          x: displayGalaxy.x,
          y: displayGalaxy.y,
        }}
        showAdditionalDetails={showAdditionalDetails}
        additionalDetails={additionalDetails}
        loadingDetails={loadingDetails}
        onToggleDetails={handleToggleDetails}
        onOpenImageUrls={() => setShowImageUrlsModal(true)}
        showGalaxyHeader={false}
        paperMetadata={systemSettings?.paperMetadata as PaperMetadataEntry[] | undefined}
      />

      {/* Summary Statistics */}
      {summary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Classification Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {summary.totalClassifications}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Classifications</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.totalClassifiers}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Classifiers</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {summary.nonLsbCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Non-LSB</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.lsbCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">LSB</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {summary.failedFittingCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Failed Fitting</div>
            </div>
          </div>

          {/* LSB Distribution Bar */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LSB Classification
            </h3>
            <div className="flex h-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              {summary.totalClassifications > 0 && (
                <>
                  <div
                    className="bg-gray-400 h-full transition-all"
                    style={{
                      width: `${(summary.nonLsbCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Non-LSB: ${summary.nonLsbCount} (${formatPercent(summary.nonLsbCount, summary.totalClassifications)})`}
                  />
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${(summary.lsbCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`LSB: ${summary.lsbCount} (${formatPercent(summary.lsbCount, summary.totalClassifications)})`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{
                      width: `${(summary.failedFittingCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Failed Fitting: ${summary.failedFittingCount} (${formatPercent(summary.failedFittingCount, summary.totalClassifications)})`}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Non-LSB: {formatPercent(summary.nonLsbCount, summary.totalClassifications)}</span>
              <span>LSB: {formatPercent(summary.lsbCount, summary.totalClassifications)}</span>
              <span>Failed: {formatPercent(summary.failedFittingCount, summary.totalClassifications)}</span>
            </div>
          </div>

          {/* Morphology Distribution Bar */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Morphology Classification
            </h3>
            <div className="flex h-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              {summary.totalClassifications > 0 && (
                <>
                  <div
                    className="bg-gray-500 h-full transition-all"
                    style={{
                      width: `${(summary.featurelessCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Featureless: ${summary.featurelessCount}`}
                  />
                  <div
                    className="bg-yellow-500 h-full transition-all"
                    style={{
                      width: `${(summary.irregularCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Irregular: ${summary.irregularCount}`}
                  />
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{
                      width: `${(summary.spiralCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Spiral: ${summary.spiralCount}`}
                  />
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{
                      width: `${(summary.ellipticalCount / summary.totalClassifications) * 100}%`,
                    }}
                    title={`Elliptical: ${summary.ellipticalCount}`}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Feat: {formatPercent(summary.featurelessCount, summary.totalClassifications)}</span>
              <span>Irr: {formatPercent(summary.irregularCount, summary.totalClassifications)}</span>
              <span>Sp: {formatPercent(summary.spiralCount, summary.totalClassifications)}</span>
              <span>Ell: {formatPercent(summary.ellipticalCount, summary.totalClassifications)}</span>
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Awesome: {summary.awesomeCount}
              </span>
              <span className="text-xs text-gray-500">
                ({formatPercent(summary.awesomeCount, summary.totalClassifications)})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-500">🔴</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Valid Redshift: {summary.validRedshiftCount}
              </span>
              <span className="text-xs text-gray-500">
                ({formatPercent(summary.validRedshiftCount, summary.totalClassifications)})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-orange-500">🎯</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Visible Nucleus: {summary.visibleNucleusCount}
              </span>
              <span className="text-xs text-gray-500">
                ({formatPercent(summary.visibleNucleusCount, summary.totalClassifications)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Classification List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Classifications ({classifications.length})
          </h2>
          {classifications.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmails((prev) => !prev)}
              className="inline-flex items-center justify-center rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {showEmails ? "Hide emails" : "Show emails"}
            </button>
          )}
        </div>

        {classifications.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No classifications yet for this galaxy.
          </div>
        ) : (
          <div className="space-y-3">
            {classifications.map((c, idx) => {
              const displayName = c.userName?.trim() || (showEmails ? c.userEmail?.trim() : "") || c.userId;
              const secondaryEmail =
                showEmails && c.userEmail?.trim() && c.userEmail.trim() !== displayName
                  ? c.userEmail.trim()
                  : null;
              const flags: string[] = [];
              if (c.awesome_flag) flags.push("Awesome");
              if (c.valid_redshift) flags.push("Valid Redshift");
              if (c.visible_nucleus) flags.push("Visible Nucleus");
              if (c.failed_fitting) flags.push("Failed Fitting");

              const lsbLabel = c.failed_fitting
                ? "Failed fitting"
                : (LSB_LABELS.get(c.lsb_class) ?? `LSB ${c.lsb_class}`);
              const morphLabel =
                MORPHOLOGY_LABELS.get(c.morphology) ?? `Morphology ${c.morphology}`;

              return (
                <div
                  key={`${c.userId}-${idx}`}
                  className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {displayName}
                      </div>
                      {secondaryEmail && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {secondaryEmail}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {getRoleLabel(c.userRole)}
                        {c.userExperience ? ` · ${getExperienceLabel(c.userExperience)}` : ""}
                        {c.userIsActive === false ? " · Inactive" : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.failed_fitting && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                          Failed fitting
                        </span>
                      )}
                      {c.awesome_flag && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200">
                          Awesome
                        </span>
                      )}
                      {c.valid_redshift && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                          Valid redshift
                        </span>
                      )}
                      {c.visible_nucleus && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                          Visible nucleus
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-200">
                    <div>
                      <span className="font-medium">LSB:</span> {lsbLabel}
                    </div>
                    <div>
                      <span className="font-medium">Morphology:</span> {morphLabel}
                    </div>
                    <div>
                      <span className="font-medium">Saved:</span>{" "}
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Time:</span> {formatDuration(c.timeSpent)}
                    </div>
                  </div>

                  {c.comments && (
                    <div className="mt-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                      <span className="font-medium">Comment:</span> {c.comments}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
