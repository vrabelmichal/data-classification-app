import { useState, useEffect, useCallback } from "react";
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
import { EyeIcon, AladinLogo } from "./icons";
import { MobileClassificationForm } from "./MobileClassificationForm";
import { CommentsModal } from "./CommentsModal";

// Hooks
import { useClassificationForm } from "./useClassificationForm";
import { useClassificationNavigation } from "./useClassificationNavigation";

// Helpers
import { getImagePriority, processImageLabel, shouldShowEllipse as shouldShowEllipseHelper, buildQuickInputString } from "./helpers";

// Types
import type { ImageType } from "./types";

const imageDisplaySettings = loadImageDisplaySettings();
const classificationImageSettings = imageDisplaySettings.classification;
const imageContrastGroups = classificationImageSettings.contrastGroups;
const defaultContrastGroupIndex = classificationImageSettings.defaultGroupIndex;
const defaultPreviewImageName = imageDisplaySettings.previewImageName;
const defaultMobileOrder = classificationImageSettings.defaultMobileOrder;

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
  const [showEllipseOverlay, setShowEllipseOverlay] = useState(true);

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
  const progress = useQuery(api.classification.getProgress);
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
  const imageTypes: ImageType[] = currentImageGroup.map(({ key, label, showEllipse, rectangle }) => ({
    key,
    name: label,
    displayName: processImageLabel(label),
    url: resolvedGalaxyId ? getImageUrl(resolvedGalaxyId, key, {
      quality: effectiveImageQuality
    }) : null,
    showEllipse,
    rectangle,
  }));

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
    if (!formLocked && !isMobile && formState.quickInputRef.current) {
      // Use a longer delay to ensure toast notifications don't steal focus
      // and images have started loading
      const timeoutId = setTimeout(() => {
        formState.quickInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timeoutId);
    }
  }, [formLocked, isMobile, formState.quickInputRef, currentGalaxy?._id]);

  // Load/save showEllipseOverlay
  useEffect(() => {
    const saved = localStorage.getItem('showEllipseOverlay');
    if (saved !== null) {
      setShowEllipseOverlay(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('showEllipseOverlay', JSON.stringify(showEllipseOverlay));
  }, [showEllipseOverlay]);

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
      if (navigation?.hasNext) {
        const result = await navNext();
        if (result) setCurrentGalaxy(result);
      }
    } catch (error) {
      toast.error("Failed to submit classification");
      console.error(error);
    }
  }, [currentGalaxy, formState, startTime, submitClassification, navigation, navNext, isOnline]);

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
        if (navigation?.hasNext) {
          const result = await navNext();
          if (result) setCurrentGalaxy(result);
        }
      }
    } catch (error) {
      toast.error(isSkipped ? "Failed to unskip galaxy" : "Failed to skip galaxy");
      console.error(error);
    }
  }, [currentGalaxy, formState.comments, skipGalaxy, unskipGalaxy, navigation, navNext, isOnline, isSkipped]);

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
      const url = `https://aladin.cds.unistra.fr/AladinLite/?target=${currentGalaxy.ra}%20${currentGalaxy.dec}&fov=0.1`;
      window.open(url, '_blank');
    }
  };

  const handleContrastClick = () => {
    const nextGroup = (currentContrastGroup + 1) % imageContrastGroups.length;
    setCurrentContrastGroup(nextGroup);
    toast.info(`Contrast Group: ${nextGroup + 1} of ${imageContrastGroups.length}`);
  };

  // Quick input key handler
  const handleQuickInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (isOnline) handlePrevious();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (isOnline) handleNext();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (isOnline) handleSkip();
      return;
    }
    if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleContrastClick();
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <label className="flex items-center cursor-pointer text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showEllipseOverlay}
            onChange={(e) => setShowEllipseOverlay(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-2"
          />
          Show&nbsp;<em>r<sub>eff</sub></em>
        </label>
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
              <label className="flex items-center cursor-pointer text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showEllipseOverlay}
                  onChange={(e) => setShowEllipseOverlay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-2"
                />
                Show&nbsp;<em>r<sub>eff</sub></em>
              </label>
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Keyboard shortcuts (?)"
              >
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  ?
                </kbd>
              </button>
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
