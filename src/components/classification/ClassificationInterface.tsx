import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { ProgressBar } from "./ProgressBar";
import { ImageViewer } from "./ImageViewer";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { useParams, useNavigate } from "react-router";
import { getImageUrl } from "../../images";
import { loadImageDisplaySettings } from "../../images/displaySettings";
import { usePageTitle } from "../../hooks/usePageTitle";

// let lastSelectedMorphology: number | null = null;

const imageDisplaySettings = loadImageDisplaySettings();
const classificationImageSettings = imageDisplaySettings.classification;
const imageContrastGroups = classificationImageSettings.contrastGroups;
const defaultContrastGroupIndex = classificationImageSettings.defaultGroupIndex;
const defaultPreviewImageName = imageDisplaySettings.previewImageName;

export function ClassificationInterface() {
  // State for additional galaxy details
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { galaxyId: routeGalaxyId } = useParams<{ galaxyId: string }>();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);
  const [numColumns, setNumColumns] = useState(3);

  const [lsbClass, setLsbClass] = useState<number | null>(null);
  const [morphology, setMorphology] = useState<number | null>(null);
  const [awesomeFlag, setAwesomeFlag] = useState(false);
  const [validRedshift, setValidRedshift] = useState(false);
  const [visibleNucleus, setVisibleNucleus] = useState(false);
  const [comments, setComments] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [contrast, setContrast] = useState(1.0);
  const [currentContrastGroup, setCurrentContrastGroup] = useState(defaultContrastGroupIndex);
  const [currentGalaxy, setCurrentGalaxy] = useState<any>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  // Track last applied classification doc so we don't overwrite user edits repeatedly
  const lastAppliedClassificationId = useRef<string | null>(null);
  // Lock form inputs while classification data loads for a new galaxy
  const [formLocked, setFormLocked] = useState<boolean>(true);
  // Show/hide ellipse overlay on Masked g-Band images
  const [showEllipseOverlay, setShowEllipseOverlay] = useState(true);

  // "skip" prevevents the query from running

  const galaxyByExternalId = useQuery(
    api.galaxies_navigation.getGalaxyByExternalId,
    routeGalaxyId ? { externalId: routeGalaxyId } : "skip"
  );
  const galaxy = useQuery(api.galaxies_navigation.getNextGalaxyToClassify, routeGalaxyId ? "skip" : {});

  const progress = useQuery(api.classification.getProgress);
  const userPrefs = useQuery(api.users.getUserPreferences);
  const userProfile = useQuery(api.users.getUserProfile);

  const navigation = useQuery(
    api.galaxies_navigation.getGalaxyNavigation,
    currentGalaxy ? { currentGalaxyExternalId: currentGalaxy.id } : {}
  );

  const isSkipped = useQuery(api.galaxies_skipped.isGalaxySkipped, currentGalaxy ? { galaxyExternalId: currentGalaxy.id } : "skip");


  const submitClassification = useMutation(api.classification.submitClassification);
  const skipGalaxy = useMutation(api.galaxies_skipped.skipGalaxy);
  // const generateSequence = useMutation(api.galaxies.generateUserSequence);
  const navigateToGalaxy = useMutation(api.galaxies_navigation.navigateToGalaxyInSequence);

  const loadAdditionalDetails = useMutation(api.galaxies.getAdditionalGalaxyDetailsByExternalId);

  // ----

  // Determine which galaxy ID to use: by external param or generated sequence
  const resolvedGalaxyId = routeGalaxyId
    ? galaxyByExternalId?.id
    : galaxy?.id;
  
  // Get current contrast group images
  const currentImageGroup = imageContrastGroups[currentContrastGroup] ?? imageContrastGroups[defaultContrastGroupIndex];
  
  // Function to process image labels: make parenthetical parts small
  const processImageLabel = (label: string) => {
    const lines = label.split('\n');
    if (lines.length === 2 && lines[1].startsWith('(') && lines[1].endsWith(')')) {
      return (
        <>
          {lines[0]}
          <br />
          <small className="text-xs">{lines[1]}</small>
        </>
      );
    }
    return label;
  };
  
  // Create imageTypes array with resolved URLs using the current contrast group
  const imageTypes = currentImageGroup.map(({ key, label }) => ({
    key,
    name: label,
    displayName: processImageLabel(label),
    url: resolvedGalaxyId ? getImageUrl(resolvedGalaxyId, key, { 
      quality: userPrefs?.imageQuality || "medium" 
    }) : null,
  }));

  // Function to get priority for sorting images
  const getPriority = (key: string, numColumns: number) => {
    if (numColumns === 3) return 0; // default order
    if (key.includes('g_') && key.includes('_masked')) return 1;
    if (numColumns === 1) {
      if (key === defaultPreviewImageName) return 2;
      if (key.includes('residual')) return 3;
      if (key.includes('aplpy') && key !== defaultPreviewImageName) return 4;
      if (key.includes('model')) return 5;
    } else if (numColumns === 2) {
      if (key.includes('residual')) return 2;
      if (key === defaultPreviewImageName) return 3;
      if (key.includes('aplpy') && key !== defaultPreviewImageName) return 4;
      if (key.includes('model')) return 5;
    }
    return 6; // fallback
  };

  // Sort imageTypes based on numColumns
  const sortedImageTypes = [...imageTypes].sort((a, b) => getPriority(a.key, numColumns) - getPriority(b.key, numColumns));

  // Helper to determine if an image should show the ellipse overlay
  const shouldShowEllipse = (imageName: string) => imageName.includes("Masked g-Band") && showEllipseOverlay;

  // ----


  // Track screen size changes
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 1024); // lg breakpoint is 1024px in Tailwind
      // if (width < 768) {
      //   setNumColumns(1);
      // } else if (width < 1024) {
      //   setNumColumns(2);
      // } else {
      //   setNumColumns(3);
      // }
    };

    checkScreenSize(); // Check on mount
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

  // Generate sequence if not exists
  // useEffect(() => {
  //   if (userProfile && !userProfile.sequenceGenerated && galaxy === null) {
  //     generateSequence({}).then(() => {
  //       toast.success("Galaxy sequence generated!");
  //     }).catch((error) => {
  //       console.error("Failed to generate sequence:", error);
  //     });
  //   }
  // }, [userProfile, galaxy, generateSequence]);

  // (moved effects that depend on existingClassification below its declaration)

  // Parse quick input
  const parseQuickInput = (input: string) => {
    const cleanInput = input.toLowerCase().trim();
    if (!cleanInput) return;

    // Extract LSB class (first character)
    const lsbChar = cleanInput[0];
    let newLsbClass = null;
    if (lsbChar === '-') newLsbClass = -1;
    else if (lsbChar === '0') newLsbClass = 0;
    else if (lsbChar === '1') newLsbClass = 1;

    // Extract morphology (second character)
    let newMorphology = null;
    if (cleanInput.length > 1) {
      const morphChar = cleanInput[1];
      if (morphChar === '-') newMorphology = -1;
      else if (morphChar === '0') newMorphology = 0;
      else if (morphChar === '1') newMorphology = 1;
      else if (morphChar === '2') newMorphology = 2;
    }

    // Check for flags
    const hasAwesome = cleanInput.includes('a');
    const hasRedshift = cleanInput.includes('r');
    const hasNucleus = cleanInput.includes('n');

    // Update state
    if (newLsbClass !== null) setLsbClass(newLsbClass);
    if (newMorphology !== null) setMorphology(newMorphology);
    setAwesomeFlag(hasAwesome);
    setValidRedshift(hasRedshift);
    setVisibleNucleus(hasNucleus);
  };

  // Handle quick input change
  const handleQuickInputChange = (value: string) => {
    setQuickInput(value);
    parseQuickInput(value);
  };

  // Handle quick input key events
  const handleQuickInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && lsbClass !== null && morphology !== null) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'a') {
      e.preventDefault();
      setAwesomeFlag(!awesomeFlag);
      // Update the input to reflect the change
      const currentInput = quickInput.toLowerCase();
      if (currentInput.includes('a')) {
        setQuickInput(currentInput.replace('a', ''));
      } else {
        setQuickInput(currentInput + 'a');
      }
    } else if (e.key === 'r') {
      e.preventDefault();
      setValidRedshift(!validRedshift);
      // Update the input to reflect the change
      const currentInput = quickInput.toLowerCase();
      if (currentInput.includes('r')) {
        setQuickInput(currentInput.replace('r', ''));
      } else {
        setQuickInput(currentInput + 'r');
      }
    } else if (e.key === 'n') {
      e.preventDefault();
      setVisibleNucleus(!visibleNucleus);
      // Update the input to reflect the change
      const currentInput = quickInput.toLowerCase();
      if (currentInput.includes('n')) {
        setQuickInput(currentInput.replace('n', ''));
      } else {
        setQuickInput(currentInput + 'n');
      }
    }
  };

  // Navigation handlers
  const handlePrevious = useCallback(async () => {
    if (!currentGalaxy || !navigation?.hasPrevious) return;
    try {
      const result = await navigateToGalaxy({ direction: "previous", currentGalaxyExternalId: currentGalaxy.id });
      setCurrentGalaxy(result.galaxy);
      if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
      // toast.info(`Navigated to galaxy ${result.position} of ${result.total}`);
    } catch (error) {
      toast.error("Failed to navigate to previous galaxy");
      console.error(error);
    }
  }, [currentGalaxy, navigation, navigateToGalaxy, navigate]);

  const handleNext = useCallback(async () => {
    if (!currentGalaxy || !navigation?.hasNext) return;
    try {
      const result = await navigateToGalaxy({ direction: "next", currentGalaxyExternalId: currentGalaxy.id });
      setCurrentGalaxy(result.galaxy);
      if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
      // toast.info(`Navigated to galaxy ${result.position} of ${result.total}`);
    } catch (error) {
      toast.error("Failed to navigate to next galaxy");
      console.error(error);
    }
  }, [currentGalaxy, navigation, navigateToGalaxy, navigate]);

  const handleSubmit = useCallback(async () => {
    if (!currentGalaxy || lsbClass === null || morphology === null) return;
    try {
      const timeSpent = Date.now() - startTime;
      await submitClassification({ galaxyExternalId: currentGalaxy.id, lsb_class: lsbClass, morphology, awesome_flag: awesomeFlag, valid_redshift: validRedshift, visible_nucleus: visibleNucleus, comments: comments.trim() || undefined, sky_bkg: undefined, timeSpent });
      toast.success("Classification submitted successfully!");
      if (navigation?.hasNext) {
        try {
          const result = await navigateToGalaxy({ direction: "next", currentGalaxyExternalId: currentGalaxy.id });
          setCurrentGalaxy(result.galaxy);
          if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
        } catch (error) {
          console.error("Auto-navigation failed:", error);
        }
      }
    } catch (error) {
      toast.error("Failed to submit classification");
      console.error(error);
    }
  }, [currentGalaxy, lsbClass, morphology, awesomeFlag, validRedshift, visibleNucleus, comments, startTime, submitClassification, navigation, navigateToGalaxy, navigate]);

  const handleSkip = useCallback(async () => {
    if (!currentGalaxy) return;
    try {
      await skipGalaxy({ galaxyExternalId: currentGalaxy.id, comments: comments.trim() || undefined });
      toast.info("Galaxy skipped");
      if (navigation?.hasNext) {
        try {
          const result = await navigateToGalaxy({ direction: "next", currentGalaxyExternalId: currentGalaxy.id });
          setCurrentGalaxy(result.galaxy);
          if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
        } catch (error) {
          console.error("Auto-navigation failed:", error);
        }
      }
    } catch (error) {
      toast.error("Failed to skip galaxy");
      console.error(error);
    }
  }, [currentGalaxy, comments, skipGalaxy, navigation, navigateToGalaxy, navigate]);

  const handleAladinClick = () => {
    if (currentGalaxy) {
      const url = `https://aladin.cds.unistra.fr/AladinLite/?target=${currentGalaxy.ra}%20${currentGalaxy.dec}&fov=0.1`;
      window.open(url, '_blank');
    }
  };

  const handleContrastClick = () => {
    // Cycle through contrast groups
    const nextGroup = (currentContrastGroup + 1) % imageContrastGroups.length;
    setCurrentContrastGroup(nextGroup);
    toast.info(`Contrast Group: ${nextGroup + 1} of ${imageContrastGroups.length}`);
  };

  // Simplified keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      // Only handle lone key presses (no Ctrl, Alt, or Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault()
          const nextGroup = (currentContrastGroup + 1) % imageContrastGroups.length;
          setCurrentContrastGroup(nextGroup);
          toast.info(`View Group: ${nextGroup + 1} of ${imageContrastGroups.length}`)
          break
        case 'p':
          e.preventDefault()
          handlePrevious()
          break
        case 'n':
          e.preventDefault()
          handleNext()
          break
        case 's':
          e.preventDefault()
          handleSkip()
          break
        case '?':
          e.preventDefault()
          setShowKeyboardHelp(true)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentContrastGroup, handlePrevious, handleNext, handleSkip])


  // after parseQuickInput, add helper:
  const buildQuickInputString = (
    lsb: number | null,
    morph: number | null,
    awesome: boolean,
    redshift: boolean,
    nucleus: boolean = false
  ) => {
    let str = "";
    if (lsb !== null) str += lsb === -1 ? "-" : lsb.toString();
    if (morph !== null) str += morph === -1 ? "-" : morph.toString();
    if (redshift) str += "r";
    if (awesome) str += "a";
    if (nucleus) str += "n";
    return str;
  };

  // TODO: eliminate displayGalaxy and just use currentGalaxy, invesitigate if there are any cases where currentGalaxy is null but galaxy is not
  const displayGalaxy = currentGalaxy || galaxy;

  const existingClassification = useQuery(
    api.classification.getUserClassificationForGalaxy,
    displayGalaxy?.id ? { galaxyExternalId: displayGalaxy.id } : "skip"
  );

  // Reset form when new galaxy loads (independent of whether classification doc has arrived yet)
  useEffect(() => {
    if (!currentGalaxy) return;
    setCurrentContrastGroup(0);
    setLsbClass(null);
    setMorphology(null);
    setAwesomeFlag(false);
    setValidRedshift(false);
    setVisibleNucleus(false);
    setComments("");
    setQuickInput("");
    lastAppliedClassificationId.current = null; // allow re-application when classification loads
    setFormLocked(true); // lock until classification query resolves
    setStartTime(Date.now());
    setTimeout(() => quickInputRef.current?.focus(), 100);
  }, [currentGalaxy?._id]);

  // Apply existing classification once it becomes available (or changes) for the current galaxy
  useEffect(() => {
    if (!currentGalaxy || !existingClassification) return;
    const sameGalaxy = String(existingClassification.galaxyExternalId) === String(currentGalaxy.id);
    if (!sameGalaxy) return;
    if (lastAppliedClassificationId.current === existingClassification._id) return;
    setLsbClass(existingClassification.lsb_class);
    setMorphology(existingClassification.morphology);
    setAwesomeFlag(existingClassification.awesome_flag);
    setValidRedshift(existingClassification.valid_redshift);
    setVisibleNucleus(existingClassification.visible_nucleus || false);
    setComments(existingClassification.comments || "");
    setQuickInput(
      buildQuickInputString(
        existingClassification.lsb_class,
        existingClassification.morphology,
        existingClassification.awesome_flag,
        existingClassification.valid_redshift,
        existingClassification.visible_nucleus || false
      )
    );
    lastAppliedClassificationId.current = existingClassification._id;
    setFormLocked(false);
  }, [existingClassification?._id, currentGalaxy?._id]);

  // Unlock if query finished and no classification found
  useEffect(() => {
    if (!currentGalaxy) return;
    if (existingClassification === null) {
      setFormLocked(false);
    }
  }, [existingClassification, currentGalaxy?._id]);

  // Load showEllipseOverlay from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('showEllipseOverlay');
    if (saved !== null) {
      setShowEllipseOverlay(JSON.parse(saved));
    }
  }, []);

  // Save showEllipseOverlay to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('showEllipseOverlay', JSON.stringify(showEllipseOverlay));
  }, [showEllipseOverlay]);

  // Dynamic page title: show galaxy id when available
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
  
  // Toggle + (lazy) load additional details
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
      const result = await loadAdditionalDetails({ externalId: displayGalaxy.id });
      setAdditionalDetails(result);
      setShowAdditionalDetails(true);
    } catch (err) {
      toast.error("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Helpers to format and filter fields
  const shouldIncludeKey = (key: string) => !key.startsWith("_") && key !== "band" && key !== "galaxyRef";
  const formatNumber = (val: number) => {
    if (Math.abs(val) >= 1000 || Math.abs(val) < 1e-3) return val.toExponential(3);
    return val.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  };
  const renderKeyVal = (label: string, value: any) => {
    if (value === null || value === undefined) return null;
    return (
      <div key={label} className="flex justify-between text-[11px] py-0.5">
        <span className="text-gray-500 dark:text-gray-400 mr-2">{label}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{typeof value === 'number' ? formatNumber(value) : String(value)}</span>
      </div>
    );
  };

  const renderSersic = (sersic: any) => {
    if (!sersic) return null;
    return (
      <div className="mt-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">Sersic</div>
        {Object.entries(sersic).filter(([k]) => shouldIncludeKey(k) && k !== 'psf').map(([k,v]) => renderKeyVal(k, v as any))}
        {sersic.psf && (
          <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">PSF</div>
            {Object.entries(sersic.psf).filter(([k]) => shouldIncludeKey(k)).map(([k,v]) => renderKeyVal(k, v as any))}
          </div>
        )}
      </div>
    );
  };

  const renderPhotometryBlock = (label: string, block: any) => {
    if (!block) return null;
    return (
      <div className="mb-3">
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Photometry ({label})</div>
        {renderSersic(block.sersic)}
      </div>
    );
  };

  const renderSourceExtractor = (doc: any) => {
    if (!doc) return null;
    const bandKeys = ['g','r','i','y','z'];
    return (
      <div className="mb-3">
        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Source Extractor</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bandKeys.filter(k => doc[k]).map(band => (
            <div key={band} className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">{band}-band</div>
              {Object.entries(doc[band]).filter(([k]) => shouldIncludeKey(k)).map(([k,v]) => renderKeyVal(k, v as any))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderThuruthipilly = (doc: any) => {
    if (!doc) return null;
    return (
      <div className="mb-1">
        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Thuruthipilly</div>
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2">
          {Object.entries(doc).filter(([k]) => shouldIncludeKey(k)).map(([k,v]) => renderKeyVal(k, v as any))}
        </div>
      </div>
    );
  };

  const renderAdditionalDetails = () => {
    if (!additionalDetails || !showAdditionalDetails) return null;
    return (
      <div className="mt-4 text-xs text-gray-700 dark:text-gray-200">
        {renderPhotometryBlock('g-band', additionalDetails.photometry_g)}
        {renderPhotometryBlock('r-band', additionalDetails.photometry_r)}
        {renderPhotometryBlock('i-band', additionalDetails.photometry_i)}
        {renderSourceExtractor(additionalDetails.source_extractor)}
        {renderThuruthipilly(additionalDetails.thuruthipilly)}
      </div>
    );
  };
  

  if (currentGalaxy === undefined && galaxy === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading galaxy...</p>
        </div>
      </div>
    );
  }
  
  if (!currentGalaxy && !galaxy) {
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

  const lsbOptions = [
    { value: -1, label: "Failed fitting [-1]", color: "bg-red-500" },
    { value: 0, label: "Non-LSB [0]", color: "bg-gray-500" },
    { value: 1, label: "LSB [1]", color: "bg-green-500" },
  ];

  const morphologyOptions = [
    { value: -1, label: "Featureless [-]", color: "bg-gray-500" },
    { value: 0, label: "Not sure (Irr/other) [0]", color: "bg-yellow-500" },
    { value: 1, label: "LTG (Sp) [1]", color: "bg-blue-500" },
    { value: 2, label: "ETG (Ell) [2]", color: "bg-purple-500" },
  ];

  // Handler for morphology radio button clicks
  const handleMorphologyChange = (value: number) => {
    setMorphology(value);
    setQuickInput(buildQuickInputString(lsbClass, value, awesomeFlag, validRedshift, visibleNucleus));
    // lastSelectedMorphology = value;
  };

  const canSubmit = lsbClass !== null && morphology !== null;



  let mainContentToRender;
  if (isMobile) {
    mainContentToRender = (
      <div className="block space-y-6">
        {/* Classification Form - Mobile (Above Images) */}
        <div className="space-y-6">
          {/* LSB Classification */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Is it LSB?
            </h3>
            <div className="space-y-3">
              {lsbOptions.map((option) => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="lsb-mobile"
                    value={option.value}
                    checked={lsbClass === option.value}
                    onChange={() => {
                      setLsbClass(option.value);
                      setQuickInput(
                        buildQuickInputString(
                          option.value,
                          morphology,
                          awesomeFlag,
                          validRedshift,
                          visibleNucleus
                        )
                      );
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div className="ml-3 flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Morphology Classification */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Morphology Type
            </h3>
            <div className="space-y-3" key={isMobile ? "mobile" : "desktop"}>
              {morphologyOptions.map((option) => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="morphology-mobile"
                    value={option.value}
                    checked={morphology === option.value}
                    onChange={() => handleMorphologyChange(option.value)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div className="ml-3 flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons - Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || formLocked}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                canSubmit && !formLocked
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Submit
            </button>
            <button
              onClick={handleSkip}
              disabled={formLocked}
              className="py-3 px-4 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handlePrevious}
              disabled={!navigation?.hasPrevious}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                navigation?.hasPrevious
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!navigation?.hasNext}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                navigation?.hasNext
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Next
            </button>
          </div>
        </div>

          {/* Images - Mobile */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedImageTypes.map((imageType, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 text-center">
                    {imageType.displayName}
                  </h3>
                  <div className="aspect-square">
                    {imageType.url ? (
                      <ImageViewer
                        imageUrl={imageType.url}
                        alt={`${displayGalaxy.id} - ${imageType.name}`}
                        preferences={userPrefs}
                        contrast={contrast}
                        {...(shouldShowEllipse(imageType.name) && {
                          reff: displayGalaxy.reff_pixels,
                          pa: displayGalaxy.pa,
                          q: displayGalaxy.q,
                          x: displayGalaxy.x,
                          y: displayGalaxy.y,
                        })}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <div className="text-2xl mb-1">🌌</div>
                          <p className="text-xs">No image</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>          {/* Galaxy Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
              <div><span className="font-medium">RA:</span> {displayGalaxy.ra.toFixed(4)}°</div>
              <div><span className="font-medium">Dec:</span> {displayGalaxy.dec.toFixed(4)}°</div>
              <div><span className="font-medium">r<sub>eff</sub>:</span> {displayGalaxy.reff.toFixed(2)}″ ({displayGalaxy.reff_pixels.toFixed(2)} pixels)</div>
              <div><span className="font-medium">q:</span> {displayGalaxy.q.toFixed(3)}</div>
              <div><span className="font-medium">PA:</span> {displayGalaxy.pa.toFixed(1)}°</div>
              <div><span className="font-medium">Nucleus:</span> {displayGalaxy.nucleus ? "Yes" : "No"}</div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                onClick={handleToggleDetails}
                disabled={loadingDetails}
              >
                {loadingDetails ? 'Loading...' : (showAdditionalDetails ? 'Hide details' : 'Show details')}
              </button>
            </div>
            {renderAdditionalDetails()}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAladinClick}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Aladin
            </button>
            <button
              onClick={handleContrastClick}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              View {currentContrastGroup + 1}/{imageContrastGroups.length}
            </button>
          </div>
        </div>

        {/* Additional Fields - Mobile (Below Images) */}
        <div className="space-y-6">
          {/* Flags */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={awesomeFlag}
                  onChange={(e) => {
                    setAwesomeFlag(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        e.target.checked,
                        validRedshift,
                        visibleNucleus
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Awesome</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={validRedshift}
                  onChange={(e) => {
                    setValidRedshift(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        awesomeFlag,
                        e.target.checked,
                        visibleNucleus
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Valid redshift</span>
              </label>

              <label className={cn("flex items-center cursor-pointer", displayGalaxy.nucleus ? "bg-yellow-50 dark:bg-yellow-900/20" : "")}>
                <input
                  type="checkbox"
                  checked={visibleNucleus}
                  onChange={(e) => {
                    setVisibleNucleus(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        awesomeFlag,
                        validRedshift,
                        e.target.checked
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Visible nucleus</span>
              </label>
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
              Comments
            </h4>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any observations or comments..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              rows={3}
            />
          </div>

          {/* Quick Input - Mobile */}
          {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
              Input by typing
            </h4>
            <input
              ref={quickInputRef}
              type="text"
              value={quickInput}
              onChange={(e) => handleQuickInputChange(e.target.value)}
              onKeyDown={handleQuickInputKeyDown}
              placeholder="Example: -1 or 1- or 0r (with a for awesome)"
              disabled={formLocked}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Format: [LSB: -/0/1] [Morph: -/0/1/2] (add "r" for redshift, "a" for awesome). Press Enter to submit.
            </p>
          </div> */}
        </div>
      </div>
    );
  }
  else {
    mainContentToRender = (
      <div className="lg:grid lg:grid-cols-3 gap-8">
        {/* Left Panel - Images */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedImageTypes.map((imageType, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 text-center">
                  {imageType.displayName}
                </h3>
                <div className="aspect-square">
                  {imageType.url ? (
                    <ImageViewer
                      imageUrl={imageType.url}
                      alt={`${displayGalaxy.id} - ${imageType.name}`}
                      preferences={userPrefs}
                      contrast={contrast}
                      {...(shouldShowEllipse(imageType.name) && {
                        reff: displayGalaxy.reff_pixels,
                        pa: displayGalaxy.pa,
                        q: displayGalaxy.q,
                        x: displayGalaxy.x,
                        y: displayGalaxy.y,
                      })}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="text-2xl mb-1">🌌</div>
                        <p className="text-xs">No image</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Galaxy Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-300">
              <div><span className="font-medium">RA:</span> {displayGalaxy.ra.toFixed(4)}°</div>
              <div><span className="font-medium">Dec:</span> {displayGalaxy.dec.toFixed(4)}°</div>
              <div><span className="font-medium">r<sub>eff</sub>:</span> {displayGalaxy.reff.toFixed(2)}″ ({displayGalaxy.reff_pixels.toFixed(2)} pixels)</div>
              <div><span className="font-medium">q:</span> {displayGalaxy.q.toFixed(3)}</div>
              <div><span className="font-medium">PA:</span> {displayGalaxy.pa.toFixed(1)}°</div>
              <div><span className="font-medium">Nucleus:</span> {displayGalaxy.nucleus ? "Yes" : "No"}</div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                onClick={handleToggleDetails}
                disabled={loadingDetails}
              >
                {loadingDetails ? 'Loading...' : (showAdditionalDetails ? 'Hide details' : 'Show details')}
              </button>
            </div>
            {renderAdditionalDetails()}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAladinClick}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Aladin
            </button>
            <button
              onClick={handleContrastClick}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              View {currentContrastGroup + 1}/{imageContrastGroups.length}
            </button>
          </div>
        </div>

        {/* Right Panel - Classification Form */}
        <div className="space-y-6">

          {/* Quick Input - Desktop */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
              Input by typing
            </h4>
            <input
              ref={quickInputRef}
              type="text"
              value={quickInput}
              onChange={(e) => handleQuickInputChange(e.target.value)}
              onKeyDown={handleQuickInputKeyDown}
              placeholder="Example: -1 or 1- or 0r (with a for awesome)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Format: [LSB: -/0/1] [Morph: -/0/1/2] (add "r" for redshift, "a" for awesome). Press Enter to submit.
            </p>
          </div>

          {/* LSB Classification */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Is it LSB?
            </h3>
            <div className="space-y-3">
              {lsbOptions.map((option) => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="lsb"
                    value={option.value}
                    checked={lsbClass === option.value}
                    onChange={() => {
                      setLsbClass(option.value);
                      setQuickInput(
                        buildQuickInputString(
                          option.value,
                          morphology,
                          awesomeFlag,
                          validRedshift,
                          visibleNucleus
                        )
                      );
                    }}
                    disabled={formLocked}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Morphology Classification */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Morphology Type
            </h3>
            <div className="space-y-3" key={isMobile ? "mobile" : "desktop"}>
              {morphologyOptions.map((option) => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="morphology"
                    value={option.value}
                    checked={morphology === option.value}
                    // checked={lastSelectedMorphology === option.value}
                    onChange={() => handleMorphologyChange(option.value)}
                    disabled={formLocked}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons - Desktop */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                canSubmit
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Submit
            </button>
            <button
              onClick={handleSkip}
              className="py-3 px-4 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handlePrevious}
              disabled={!navigation?.hasPrevious}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                navigation?.hasPrevious
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!navigation?.hasNext}
              className={cn(
                "py-3 px-4 rounded-lg font-semibold transition-colors",
                navigation?.hasNext
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              )}
            >
              Next
            </button>
          </div>

          {/* Flags */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={awesomeFlag}
                  onChange={(e) => {
                    setAwesomeFlag(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        e.target.checked,
                        validRedshift,
                        visibleNucleus
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Awesome</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={validRedshift}
                  onChange={(e) => {
                    setValidRedshift(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        awesomeFlag,
                        e.target.checked,
                        visibleNucleus
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Valid redshift</span>
              </label>

              <label className={cn("flex items-center cursor-pointer", displayGalaxy.nucleus ? "bg-yellow-50 dark:bg-yellow-900/20" : "")}>
                <input
                  type="checkbox"
                  checked={visibleNucleus}
                  onChange={(e) => {
                    setVisibleNucleus(e.target.checked);
                    setQuickInput(
                      buildQuickInputString(
                        lsbClass,
                        morphology,
                        awesomeFlag,
                        validRedshift,
                        e.target.checked
                      )
                    );
                  }}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">Visible nucleus</span>
              </label>
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
              Comments
            </h4>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any observations or comments..."
              disabled={formLocked}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              rows={3}
            />
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-2 sm:px-6 lg:px-12 py-6 pb-20 md:pb-6" style={{ maxWidth: "1920px" }}>
      {/* Header with keyboard shortcuts button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className={cn("text-2xl font-bold text-gray-900 dark:text-white", isSkipped === true && "bg-yellow-100 dark:bg-yellow-900/20 px-2 py-1 rounded")}>
            Galaxy: {displayGalaxy.id}
            {isSkipped === true && <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">(in skipped table)</span>}
          </h1>
          {navigation && navigation.currentIndex !== -1 ? (
            <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
              Position: {navigation.currentIndex + 1} of {navigation.totalGalaxies}
            </div>
          ) : navigation ? (
            <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
              Not in your galaxies
            </div>
          ) : null}
        </div>
        <div className="hidden sm:flex items-center space-x-2">
          <label className="flex items-center cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showEllipseOverlay}
              onChange={(e) => setShowEllipseOverlay(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mr-2"
            />
            Show <em>r<sub>eff</sub></em>
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

      {/* Main Content */}
      {/* <p>Is Mobile: {isMobile ? "Yes" : "No"}; Morphology: {morphology}</p> */}
      {mainContentToRender}

      {/* Progress Bar at Bottom */}
      <div className="mt-8">
        {progress && <ProgressBar progress={progress} />}
      </div>

      <KeyboardShortcuts
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}
