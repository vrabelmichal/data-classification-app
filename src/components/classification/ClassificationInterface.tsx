import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { useParams, useNavigate } from "react-router";
import { getImageUrl } from "../../images";
import { loadImageDisplaySettings } from "../../images/displaySettings";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

// Components
import { ProgressBar } from "./ProgressBar";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { GalaxyImages } from "./GalaxyImages";
import { GalaxyInfo } from "./GalaxyInfo";
import { QuickInput } from "./QuickInput";
import { ClassificationForm } from "./ClassificationForm";
import { ActionButtons } from "./ActionButtons";
import { OfflineBanner } from "./OfflineBanner";
import { CommentsField } from "./CommentsField";

// Mobile-specific components
import { MobileImageSlider } from "./MobileImageSlider";
import { MobileSliderControls } from "./MobileSliderControls";
import { EyeIcon, AladinLogo, EllipseIcon, SettingsIcon, MaskIcon } from "./icons";
import { MobileClassificationForm } from "./MobileClassificationForm";
import { CommentsModal } from "./CommentsModal";

// Hooks
import { useClassificationForm } from "./useClassificationForm";
import { useClassificationNavigation } from "./useClassificationNavigation";

// Helpers
import { getImagePriority, processImageLabel, shouldShowEllipse as shouldShowEllipseHelper, buildQuickInputString } from "./helpers";

// Types
import type { ImageType } from "./types";
import type { ContrastGroupEntry } from "../../images/types";

const imageDisplaySettings = loadImageDisplaySettings();
const classificationImageSettings = imageDisplaySettings.classification;
const imageContrastGroups = classificationImageSettings.contrastGroups;
const defaultContrastGroupIndex = classificationImageSettings.defaultGroupIndex;
const defaultPreviewImageName = imageDisplaySettings.previewImageName;
const defaultMobileOrder = classificationImageSettings.defaultMobileOrder;

/**
 * Ellipse settings mode:
 * - 'position': Settings are tied to grid positions (0, 1, 2, ...). When contrast group changes,
 *               the setting for "position 0" applies to whatever image is at position 0.
 * - 'key': Settings are tied to specific image keys. The setting follows the image across groups.
 */
const ELLIPSE_SETTINGS_MODE: 'position' | 'key' = 'position';

function resolveContrastGroupEntry(
  entry: ContrastGroupEntry,
  showMasks: boolean,
): {
  key: string;
  label: string;
  configKey: string;
} {
  const key = showMasks
    ? (entry.key_masked ?? entry.key)
    : entry.key;

  const label = showMasks
    ? (entry.label_masked ?? entry.label ?? key)
    : (entry.label ?? entry.label_masked ?? key);

  const configKey = entry.key;

  return {
    key,
    label,
    configKey,
  };
}

export function ClassificationInterface() {
  // Route and navigation
  const { galaxyId: routeGalaxyId } = useParams<{ galaxyId: string }>();
  const navigate = useNavigate();

  // Local state
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [numColumns, setNumColumns] = useState(3);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [contrast, setContrast] = useState(1.0);
  const [currentContrastGroup, setCurrentContrastGroup] = useState(defaultContrastGroupIndex);
  const [currentGalaxy, setCurrentGalaxy] = useState<any>(null);
  const [formLocked, setFormLocked] = useState<boolean>(true);
  const [shouldRefocusQuickInput, setShouldRefocusQuickInput] = useState(false);

  const [showEllipseOverlay, setShowEllipseOverlay] = useState(true);
  const [showMasks, setShowMasks] = useState(true);
  const [showEllipseSettings, setShowEllipseSettings] = useState(false);
  const settingsButtonRef = useRef<HTMLDivElement>(null);

  // Mobile-specific state
  const [mobileSliderIndex, setMobileSliderIndex] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Online status
  const isOnline = useOnlineStatus();

  // Queries
  const galaxyByExternalId = useQuery(
    api.galaxies.navigation.getGalaxyByExternalId,
    routeGalaxyId ? { externalId: routeGalaxyId } : "skip"
  );
  const galaxy = useQuery(api.galaxies.navigation.getNextGalaxyToClassify, routeGalaxyId ? "skip" : {});
  const progress = useQuery(api.classification.getProgress, {});
  const userPrefs = useQuery(api.users.getUserPreferences);
  const userProfile = useQuery(api.users.getUserProfile);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const navigation = useQuery(
    api.galaxies.navigation.getGalaxyNavigation,
    currentGalaxy ? { currentGalaxyExternalId: currentGalaxy.id } : {}
  );
  const isSkipped = useQuery(
    api.galaxies.skipped.isGalaxySkipped,
    currentGalaxy ? { galaxyExternalId: currentGalaxy.id } : "skip"
  );

  // Mutations
  const submitClassification = useMutation(api.classification.submitClassification);
  const skipGalaxy = useMutation(api.galaxies.skipped.skipGalaxy);
  const unskipGalaxy = useMutation(api.galaxies.skipped.unskipGalaxy);
  const loadAdditionalDetailsMutation = useMutation(api.galaxies.core.getAdditionalGalaxyDetailsByExternalId);

  const getNextGalaxyMutation = useMutation(api.galaxies.navigation.getNextGalaxyToClassifyMutation);
  const updatePreferences = useMutation(api.users.updatePreferences);

  // Display galaxy
  const displayGalaxy = currentGalaxy || galaxy;

  // Existing classification query
  const existingClassification = useQuery(
    api.classification.getUserClassificationForGalaxy,
    displayGalaxy?.id ? { galaxyExternalId: displayGalaxy.id } : "skip"
  );

  // Custom hooks
  const failedFittingMode = (systemSettings?.failedFittingMode as "legacy" | "checkbox") || "checkbox";
  const showAwesomeFlag = systemSettings?.showAwesomeFlag !== false;
  const showValidRedshift = systemSettings?.showValidRedshift !== false;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus !== false;

  const formState = useClassificationForm(
    currentGalaxy,
    existingClassification,
    formLocked,
    failedFittingMode,
    showAwesomeFlag,
    showValidRedshift,
    showVisibleNucleus
  );
  const { handlePrevious: navPrevious, handleNext: navNext } = useClassificationNavigation(currentGalaxy, navigation);

  // Resolved galaxy ID
  const resolvedGalaxyId = routeGalaxyId ? galaxyByExternalId?.id : galaxy?.id;

  // Get current contrast group images
  const currentImageGroup = imageContrastGroups[currentContrastGroup] ?? imageContrastGroups[defaultContrastGroupIndex];

  // Get the effective image quality (user preference or system default)
  const defaultImageQuality = (systemSettings?.defaultImageQuality as "high" | "low") || "high";
  const effectiveImageQuality = userPrefs?.imageQuality || defaultImageQuality;

  // Create imageTypes array
  const imageTypes = currentImageGroup.map<ImageType | null>((entry, index) => {
    const resolvedEntry = resolveContrastGroupEntry(entry, showMasks);
    const { key, label, configKey } = resolvedEntry;
    const { showEllipse, rectangle, allowEllipse } = entry;

    // Determine effective showEllipse based on user preferences and mode
    // In 'position' mode, use index as key; in 'key' mode, use actual image key
    const settingsKey = ELLIPSE_SETTINGS_MODE === 'position' ? `pos_${index}` : configKey;
    const userPref = userPrefs?.ellipseSettings?.[settingsKey];
    const isAllowed = allowEllipse !== false;
    const effectiveShowEllipse = isAllowed ? (userPref ?? showEllipse === true) : false;

    return {
      key,
      name: label,
      displayName: processImageLabel(label),
      url: resolvedGalaxyId ? getImageUrl(resolvedGalaxyId, key, {
        quality: effectiveImageQuality
      }) : null,
      showEllipse: effectiveShowEllipse,
      rectangle,
      // Pass original static config for settings UI
      allowEllipse: allowEllipse !== false,
      defaultShowEllipse: showEllipse === true,
      // Store position index for settings
      positionIndex: index,
    };
  }).filter((item): item is ImageType => item !== null);

  // Sort imageTypes based on numColumns
  const sortedImageTypes = [...imageTypes].sort(
    (a, b) => getImagePriority(a.key, numColumns, defaultPreviewImageName) -
      getImagePriority(b.key, numColumns, defaultPreviewImageName)
  );

  // Mobile image order: use defaultMobileOrder if provided, otherwise use original order
  const mobileImageTypes = defaultMobileOrder
    ? defaultMobileOrder
      .filter((idx) => idx >= 0 && idx < imageTypes.length)
      .map((idx) => imageTypes[idx])
    : imageTypes;

  // Track screen size changes
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Update current galaxy when galaxy changes
  useEffect(() => {
    if (routeGalaxyId && galaxyByExternalId) {
      setCurrentGalaxy(galaxyByExternalId);
    } else if (!routeGalaxyId && galaxy) {
      setCurrentGalaxy(galaxy);
      if (galaxy?.id) {
        navigate(`/classify/${galaxy.id}`, { replace: true });
      }
    }
  }, [routeGalaxyId, galaxyByExternalId, galaxy, navigate]);

  // Reset form when new galaxy loads
  useEffect(() => {
    if (!currentGalaxy) return;
    setCurrentContrastGroup(0);
    setMobileSliderIndex(0);
    setFormLocked(true);
    setStartTime(Date.now());
  }, [currentGalaxy?._id]);

  // Flag quick input to refocus whenever the galaxy changes
  useEffect(() => {
    if (!currentGalaxy?._id) return;
    setShouldRefocusQuickInput(true);
  }, [currentGalaxy?._id]);

  // Unlock form when classification query resolves
  useEffect(() => {
    if (!currentGalaxy) return;
    if (existingClassification === null) {
      setFormLocked(false);
    }
  }, [existingClassification, currentGalaxy?._id]);

  // Unlock after existing classification loads
  useEffect(() => {
    if (existingClassification) {
      setFormLocked(false);
    }
  }, [existingClassification]);

  // Focus quick input on desktop when form unlocks
  useEffect(() => {
    if (!shouldRefocusQuickInput || formLocked || isMobile) return;

    // Delay to let images and toasts settle before focusing input
    const timeoutId = window.setTimeout(() => {
      formState.quickInputRef.current?.focus();
      setShouldRefocusQuickInput(false);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [formLocked, isMobile, formState.quickInputRef, shouldRefocusQuickInput]);

  // Load/save showEllipseOverlay
  useEffect(() => {
    const saved = localStorage.getItem('showEllipseOverlay');
    if (saved !== null) {
      setShowEllipseOverlay(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('showMasks');
    if (saved !== null) {
      setShowMasks(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('showEllipseOverlay', JSON.stringify(showEllipseOverlay));
  }, [showEllipseOverlay]);

  useEffect(() => {
    localStorage.setItem('showMasks', JSON.stringify(showMasks));
  }, [showMasks]);

  // Dynamic page title
  usePageTitle(() => {
    if (displayGalaxy?.id) {
      const title = `Classify ${displayGalaxy.id}`;
      if (isSkipped === true) return `${title} (Skipped)`;
      return title;
    }
    return "Classify";
  });

  // Hide details when galaxy changes
  useEffect(() => {
    setShowAdditionalDetails(false);
    setAdditionalDetails(null);
    setLoadingDetails(false);
  }, [displayGalaxy?.id]);

  // Handlers
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
      const result = await loadAdditionalDetailsMutation({ externalId: displayGalaxy.id });
      setAdditionalDetails(result);
      setShowAdditionalDetails(true);
    } catch (err) {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!isOnline) {
      toast.error("Cannot submit while offline");
      return;
    }
    if (!currentGalaxy || formState.lsbClass === null || formState.morphology === null) return;
    try {
      const timeSpent = Date.now() - startTime;
      await submitClassification({
        galaxyExternalId: currentGalaxy.id,
        lsb_class: formState.lsbClass,
        morphology: formState.morphology,
        awesome_flag: formState.awesomeFlag,
        valid_redshift: formState.validRedshift,
        visible_nucleus: formState.visibleNucleus,
        failed_fitting: formState.failedFitting,
        comments: formState.comments.trim() || undefined,
        sky_bkg: undefined,
        timeSpent
      });
      toast.success("Classification submitted successfully!");
      // Get next unprocessed galaxy (skipping skipped and classified ones)
      const nextGalaxy = await getNextGalaxyMutation();
      if (nextGalaxy?.id) {
        navigate(`/classify/${nextGalaxy.id}`);
      } else {
        // No more galaxies to classify
        navigate('/classify');
      }
    } catch (error) {
      toast.error("Failed to submit classification");
      console.error(error);
    }
  }, [currentGalaxy, formState, startTime, submitClassification, getNextGalaxyMutation, navigate, isOnline]);

  const handleSkip = useCallback(async () => {
    if (!isOnline) {
      toast.error("Cannot skip while offline");
      return;
    }
    if (!currentGalaxy) return;
    try {
      if (isSkipped) {
        // Unskip the galaxy
        await unskipGalaxy({
          galaxyExternalId: currentGalaxy.id,
        });
        toast.info("Galaxy removed from skipped list");
      } else {
        // Skip the galaxy
        await skipGalaxy({
          galaxyExternalId: currentGalaxy.id,
          comments: formState.comments.trim() || undefined
        });
        toast.info("Galaxy skipped");
        // Get next unprocessed galaxy (skipping skipped and classified ones)
        const nextGalaxy = await getNextGalaxyMutation();
        if (nextGalaxy?.id) {
          navigate(`/classify/${nextGalaxy.id}`);
        } else {
          // No more galaxies to classify
          navigate('/classify');
        }
      }
    } catch (error) {
      toast.error(isSkipped ? "Failed to unskip galaxy" : "Failed to skip galaxy");
      console.error(error);
    }
  }, [currentGalaxy, formState.comments, skipGalaxy, unskipGalaxy, getNextGalaxyMutation, navigate, isOnline, isSkipped]);

  const handlePrevious = useCallback(async () => {
    if (!isOnline) {
      toast.error("Cannot navigate while offline");
      return;
    }
    const result = await navPrevious();
    if (result) setCurrentGalaxy(result);
  }, [navPrevious, isOnline]);

  const handleNext = useCallback(async () => {
    if (!isOnline) {
      toast.error("Cannot navigate while offline");
      return;
    }
    const result = await navNext();
    if (result) setCurrentGalaxy(result);
  }, [navNext, isOnline]);

  const handleAladinClick = () => {
    if (currentGalaxy) {
      const url = `https://aladin.cds.unistra.fr/AladinLite/?target=${currentGalaxy.ra}%20${currentGalaxy.dec}&fov=0.1&survey=P/DESI-Legacy-Surveys/DR10/color`;
      window.open(url, '_blank');
    }
  };

  const handleContrastClick = () => {
    setCurrentContrastGroup((prev) => {
      const nextGroup = (prev + 1) % imageContrastGroups.length;
      toast.info(`Contrast Group: ${nextGroup + 1} of ${imageContrastGroups.length}`);
      return nextGroup;
    });
  };

  const handleContrastPrevious = () => {
    setCurrentContrastGroup((prev) => {
      const nextGroup = (prev - 1 + imageContrastGroups.length) % imageContrastGroups.length;
      toast.info(`Contrast Group: ${nextGroup + 1} of ${imageContrastGroups.length}`);
      return nextGroup;
    });
  };

  // Quick input key handler
  const handleQuickInputKeyDown = (e: React.KeyboardEvent) => {
    // Let browser/system shortcuts that use Ctrl/Meta/Alt pass through untouched
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      if (isOnline) handlePrevious();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      e.stopPropagation();
      handleAladinClick();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      e.stopPropagation();
      if (isOnline) handleNext();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      if (isOnline) handleSkip();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      e.stopPropagation();
      handleContrastPrevious();
      return;
    }
    if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      e.stopPropagation();
      handleContrastClick();
      return;
    }
    // Shift+R shortcut for toggle ellipse overlay (handled here to prevent quick input conflict if focused)
    if (e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      e.stopPropagation();
      setShowEllipseOverlay((prev) => !prev);
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      e.stopPropagation();
      setShowMasks((prev) => !prev);
      return;
    }
    if (e.key === 'Enter' && formState.canSubmit && isOnline) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'a' && showAwesomeFlag) {
      e.preventDefault();
      formState.setAwesomeFlag(!formState.awesomeFlag);
      const currentInput = formState.quickInput.toLowerCase();
      formState.setQuickInput(currentInput.includes('a') ? currentInput.replace('a', '') : currentInput + 'a');
    } else if (e.key === 'r' && showValidRedshift) {
      e.preventDefault();
      formState.setValidRedshift(!formState.validRedshift);
      const currentInput = formState.quickInput.toLowerCase();
      formState.setQuickInput(currentInput.includes('r') ? currentInput.replace('r', '') : currentInput + 'r');
    } else if (e.key === 'n' && showVisibleNucleus) {
      e.preventDefault();
      formState.setVisibleNucleus(!formState.visibleNucleus);
      const currentInput = formState.quickInput.toLowerCase();
      formState.setQuickInput(currentInput.includes('n') ? currentInput.replace('n', '') : currentInput + 'n');
    } else if (e.key === 'f' && failedFittingMode === "checkbox") {
      e.preventDefault();
      formState.setFailedFitting(!formState.failedFitting);
      const currentInput = formState.quickInput.toLowerCase();
      formState.setQuickInput(currentInput.includes('f') ? currentInput.replace('f', '') : currentInput + 'f');
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'p':
            e.preventDefault();
            if (isOnline) handlePrevious();
            return;
          case 'n':
            e.preventDefault();
            if (isOnline) handleNext();
            return;
          case 's':
            e.preventDefault();
            if (isOnline) handleSkip();
            return;
          case 'r':
            e.preventDefault();
            setShowEllipseOverlay((prev) => !prev);
            return;
          case 'm':
            e.preventDefault();
            setShowMasks((prev) => !prev);
            return;
          case 'a':
            e.preventDefault();
            handleAladinClick();
            return;
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      switch (e.key.toLowerCase()) {
          case 'c':
            if (e.shiftKey) {
              e.preventDefault();
              handleContrastPrevious();
              break;
            }
          e.preventDefault();
          handleContrastClick();
          break;
        case 'p':
          e.preventDefault();
          if (isOnline) handlePrevious();
          break;
        case 'n':
          e.preventDefault();
          if (isOnline) handleNext();
          break;
        case 's':
          e.preventDefault();
          if (isOnline) handleSkip();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(true);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext, handleSkip, currentContrastGroup, isOnline]);

  // Helper for ellipse overlay
  const shouldShowEllipseFunc = (showEllipse: boolean | undefined) =>
    shouldShowEllipseHelper(showEllipse, showEllipseOverlay);

  // Ellipse settings handlers
  const handleToggleEllipseSetting = async (settingsKey: string, currentVal: boolean) => {
    // Re-enable global overlay if it was off
    if (!showEllipseOverlay) {
      setShowEllipseOverlay(true);
    }

    const newSettings = {
      ...(userPrefs?.ellipseSettings || {}),
      [settingsKey]: !currentVal
    };

    await updatePreferences({
      ellipseSettings: newSettings
    });
  };

  // Get the settings key for an image based on mode
  const getSettingsKey = (img: any, index: number): string => {
    return ELLIPSE_SETTINGS_MODE === 'position' ? `pos_${index}` : img.key;
  };

  const renderEllipseSettingsContent = () => {
    // We use sortedImageTypes to match the grid layout
    const items = sortedImageTypes.map((img, index) => {
      // Logic for visibility in the settings grid
      // Checkbox and label not visible if allowEllipse == false
      const rawImg = img as any;
      if (rawImg.allowEllipse === false) {
        return (
          <div key={`${img.key}-${index}`} className={cn("flex items-center p-2 rounded invisible", !isMobile && "border border-transparent")}></div>
        );
      }

      const isChecked = img.showEllipse === true;
      const settingsKey = getSettingsKey(rawImg, rawImg.positionIndex ?? index);

      return (
        <label
          key={`${img.key}-${index}`}
          className={cn(
            "flex items-center cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
            !isMobile && "border border-gray-200 dark:border-gray-700"
          )}
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
    });

    if (isMobile) {
      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEllipseSettings(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm flex flex-col overflow-hidden max-h-[80vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Overlay Settings
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Toggle the Effective Radius (r<sub>eff</sub>) overlay for each image type.
              </div>
              <div className="flex flex-col space-y-2">
                {items}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => setShowEllipseSettings(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute right-0 top-full mt-2 w-[400px] z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
          Configure Effective Radius Overlay (r<sub>eff</sub>) per image
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items}
        </div>
      </div>
    );
  };

  const renderEllipseControl = () => (
    <div className={cn("relative inline-block text-left", isMobile && "w-full")} ref={settingsButtonRef}>
      <div className={cn(
        "flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700",
        isMobile ? "p-1 w-full" : "p-0.5"
      )}>
        {/* Toggle Button */}
        <button
          onClick={() => setShowEllipseOverlay(!showEllipseOverlay)}
          className={cn(
            "relative flex items-center justify-center gap-2 rounded-md transition-all duration-200 font-medium",
            isMobile ? "flex-1 py-2.5" : "px-3 py-1",
            showEllipseOverlay
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          )}
          title="Toggle Effective Radius Overlay (Shift+R)"
        >
          {/* Icon is now static (no scaling) to prevent visual jitter */}
          <EllipseIcon className="w-4 h-4" />
          <span className="text-sm flex items-center">
            {isMobile ? (
              <span className="mr-1">r<sub>eff</sub>:</span>
            ) : (
              <></>
            )}
            {/* Fixed width container for status text to prevent button width change */}
            <span className="font-semibold inline-block w-[3ch] text-center">
              {showEllipseOverlay ? "ON" : "OFF"}
            </span>
          </span>
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>

        {/* Settings Dropdown Button */}
        <button
          onClick={() => setShowEllipseSettings(!showEllipseSettings)}
          className={cn(
            "rounded-md transition-colors flex items-center justify-center",
            isMobile ? "px-4 py-3 h-full" : "p-1.5",
            showEllipseSettings
              ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          )}
          title="Configure Overlay Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Popup/Content */}
      {showEllipseSettings && renderEllipseSettingsContent()}
    </div>
  );

  const renderMaskControl = () => (
    <div className={cn("relative inline-block text-left", isMobile && "w-full")}>
      <div className={cn(
        "flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700",
        isMobile ? "p-1 w-full" : "p-0.5"
      )}>
        <button
          onClick={() => setShowMasks((prev) => !prev)}
          className={cn(
            "relative flex items-center justify-center gap-2 rounded-md transition-all duration-200 font-medium",
            isMobile ? "flex-1 py-2.5" : "px-3 py-1",
            showMasks
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          )}
          title="Toggle masked images (Shift+M)"
        >
          <MaskIcon className="w-4 h-4" />
          <span className="text-sm flex items-center">
            {isMobile && <span className="mr-1">Masks:</span>}
            <span className="font-semibold inline-block w-[3ch] text-center">
              {showMasks ? "ON" : "OFF"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  // Loading state - check if the relevant galaxy query is still loading
  // When routeGalaxyId exists, we use galaxyByExternalId; otherwise we use galaxy
  const isGalaxyQueryLoading = routeGalaxyId
    ? galaxyByExternalId === undefined
    : galaxy === undefined;

  if (isGalaxyQueryLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading galaxy...</p>
        </div>
      </div>
    );
  }

  // Galaxy ID was provided in URL but not found in database
  if (routeGalaxyId && galaxyByExternalId === null && !currentGalaxy) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/40 rounded-full">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Galaxy Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              The galaxy ID <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">{routeGalaxyId}</code> was not found in the database.
            </p>
            <button
              onClick={() => navigate('/classify')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Go to Classification
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No galaxy state - galaxy query has resolved but returned null (no more galaxies)
  if (!currentGalaxy && !galaxy && !galaxyByExternalId) {
    // If userProfile is still loading, show loading state instead of "All Done"
    if (userProfile === undefined) {
      return (
        <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/40 rounded-full">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {userProfile?.sequenceGenerated ? "All Done! 🎉" : "User does not have a generated sequence."}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {userProfile?.sequenceGenerated
                ? "You've classified all galaxies in your sequence. Thank you for your contribution!"
                : "We're generating a personalized sequence of galaxies for you to classify."
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!displayGalaxy) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <div className="text-center max-w-md">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/40 rounded-full">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No galaxies to show
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              There are currently no galaxies available for classification in your sequence.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render mobile or desktop layout
  const renderMobileLayout = () => (
    <div className="block space-y-4">
      {/* 1. Image Slider with overlay controls */}
      <MobileImageSlider
        imageTypes={mobileImageTypes}
        displayGalaxy={displayGalaxy}
        userPrefs={userPrefs}
        contrast={contrast}
        shouldShowEllipse={shouldShowEllipseFunc}
        currentIndex={mobileSliderIndex}
        onIndexChange={setMobileSliderIndex}
        renderControls={
          <MobileSliderControls
            currentIndex={mobileSliderIndex}
            totalImages={mobileImageTypes.length}
            currentContrastGroup={currentContrastGroup}
            totalContrastGroups={imageContrastGroups.length}
            onPrevImage={() => setMobileSliderIndex(Math.max(0, mobileSliderIndex - 1))}
            onNextImage={() => setMobileSliderIndex(Math.min(mobileImageTypes.length - 1, mobileSliderIndex + 1))}
            onContrastClick={handleContrastClick}
            onAladinClick={handleAladinClick}
          />
        }
      />

      {/* 3. Classification Form with embedded comments button */}
      <MobileClassificationForm
        lsbClass={formState.lsbClass}
        morphology={formState.morphology}
        awesomeFlag={formState.awesomeFlag}
        validRedshift={formState.validRedshift}
        visibleNucleus={formState.visibleNucleus}
        failedFitting={formState.failedFitting}
        comments={formState.comments}
        formLocked={formLocked}
        displayGalaxy={displayGalaxy}
        failedFittingMode={failedFittingMode}
        showAwesomeFlag={showAwesomeFlag}
        showValidRedshift={showValidRedshift}
        showVisibleNucleus={showVisibleNucleus}
        onLsbClassChange={formState.setLsbClass}
        onMorphologyChange={formState.setMorphology}
        onAwesomeFlagChange={formState.setAwesomeFlag}
        onValidRedshiftChange={formState.setValidRedshift}
        onVisibleNucleusChange={formState.setVisibleNucleus}
        onFailedFittingChange={formState.setFailedFitting}
        onOpenComments={() => setShowCommentsModal(true)}
      />

      {/* Action Buttons */}
      <ActionButtons
        canSubmit={formState.canSubmit}
        formLocked={formLocked}
        navigation={navigation}
        isOnline={isOnline}
        isSkipped={isSkipped === true}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />

      {/* Display Options */}
      <div className="w-full">
        <div className="flex gap-2">
          <div className="flex-1">{renderMaskControl()}</div>
          <div className="flex-1">{renderEllipseControl()}</div>
        </div>
      </div>

      {/* 4. Galaxy Info with header */}
      <GalaxyInfo
        displayGalaxy={displayGalaxy}
        showAdditionalDetails={showAdditionalDetails}
        additionalDetails={additionalDetails}
        loadingDetails={loadingDetails}
        onToggleDetails={handleToggleDetails}
        showGalaxyHeader={true}
        navigation={navigation}
      />
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="lg:grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <GalaxyImages
          imageTypes={sortedImageTypes}
          displayGalaxy={displayGalaxy}
          userPrefs={userPrefs}
          contrast={contrast}
          showEllipseOverlay={showEllipseOverlay}
          shouldShowEllipse={shouldShowEllipseFunc}
        />
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleAladinClick}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium p-3 rounded-lg transition-colors inline-flex items-center justify-center"
            aria-label="Open in Aladin"
            title="Open in Aladin"
          >
            <AladinLogo className="text-white" size={28} />
          </button>
          <button
            onClick={handleContrastClick}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <EyeIcon className="w-4 h-4" />
            <span>View {currentContrastGroup + 1}/{imageContrastGroups.length}</span>
          </button>
        </div>
        <GalaxyInfo
          displayGalaxy={displayGalaxy}
          showAdditionalDetails={showAdditionalDetails}
          additionalDetails={additionalDetails}
          loadingDetails={loadingDetails}
          onToggleDetails={handleToggleDetails}
        />
      </div>

      <div className="space-y-6">
        <QuickInput
          value={formState.quickInput}
          onChange={formState.handleQuickInputChange}
          onKeyDown={handleQuickInputKeyDown}
          inputRef={formState.quickInputRef}
          disabled={formLocked}
          showAwesomeFlag={showAwesomeFlag}
          showValidRedshift={showValidRedshift}
          showVisibleNucleus={showVisibleNucleus}
          failedFittingMode={failedFittingMode}
        />
        <ClassificationForm
          lsbClass={formState.lsbClass}
          morphology={formState.morphology}
          awesomeFlag={formState.awesomeFlag}
          validRedshift={formState.validRedshift}
          visibleNucleus={formState.visibleNucleus}
          failedFitting={formState.failedFitting}
          comments={formState.comments}
          formLocked={formLocked}
          displayGalaxy={displayGalaxy}
          failedFittingMode={failedFittingMode}
          showAwesomeFlag={showAwesomeFlag}
          showValidRedshift={showValidRedshift}
          showVisibleNucleus={showVisibleNucleus}
          onLsbClassChange={formState.setLsbClass}
          onMorphologyChange={formState.setMorphology}
          onAwesomeFlagChange={formState.setAwesomeFlag}
          onValidRedshiftChange={formState.setValidRedshift}
          onVisibleNucleusChange={formState.setVisibleNucleus}
          onFailedFittingChange={formState.setFailedFitting}
          onCommentsChange={formState.setComments}
        />
        <ActionButtons
          canSubmit={formState.canSubmit}
          formLocked={formLocked}
          navigation={navigation}
          isOnline={isOnline}
          isSkipped={isSkipped === true}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </div>
    </div>
  );

  return (
    <>
      {!isOnline && <OfflineBanner />}
      <div className={cn("w-full mx-auto px-2 sm:px-6 lg:px-12 pb-20 md:pb-6", isMobile ? "pt-3" : "pt-6")} style={{ maxWidth: "1920px" }}>
        {/* Desktop header - hidden on mobile */}
        {!isMobile && (
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <h1 className={cn(
                "text-2xl font-bold text-gray-900 dark:text-white",
                isSkipped === true && "bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded"
              )}>
                Galaxy: {displayGalaxy.id}
                {isSkipped === true && <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">(in skipped table)</span>}
              </h1>
              {navigation && navigation.currentIndex !== -1 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Position: {navigation.currentIndex + 1} of {navigation.totalGalaxies}
                </div>
              ) : navigation ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Not in your galaxies
                </div>
              ) : null}
            </div>
            <div className="flex items-center space-x-2">
              {renderMaskControl()}
              {renderEllipseControl()}
              <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-0.5">
                <button
                  onClick={() => setShowKeyboardHelp(true)}
                  className="rounded-md transition-colors flex items-center justify-center px-3 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  title="Keyboard shortcuts (?)"
                >
                  <span className="text-sm font-medium">?</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {isMobile ? renderMobileLayout() : renderDesktopLayout()}

        <div className="mt-8">
          {progress && <ProgressBar progress={progress} />}
        </div>

        <KeyboardShortcuts
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
          failedFittingMode={failedFittingMode}
          showAwesomeFlag={showAwesomeFlag}
          showValidRedshift={showValidRedshift}
          showVisibleNucleus={showVisibleNucleus}
        />

        {/* Comments Modal - works on both mobile and desktop */}
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          value={formState.comments}
          onChange={formState.setComments}
          disabled={formLocked}
        />
      </div>
    </>
  );
}
