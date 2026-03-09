import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect, type ReactNode } from "react";
import { ImageViewer } from "./ImageViewer";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "./GalaxyImages";
import type { ImageType, GalaxyData, UserPreferences } from "./types";

const SLIDE_ANIMATION_DURATION_MS = 300;
const DRAG_RESET_THRESHOLD_PX = 3;

interface MobileImageSliderControlsRenderProps {
  goPrev: () => void;
  goNext: () => void;
}

interface MobileImageSliderProps {
  imageTypes: ImageType[];
  displayGalaxy: GalaxyData;
  userPrefs: UserPreferences | null | undefined;
  contrast: number;
  shouldShowEllipse: (showEllipse: boolean | undefined) => boolean;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  /** Optional controls to render as an overlay at the bottom of the image */
  renderControls?: (controls: MobileImageSliderControlsRenderProps) => ReactNode;
}

export function MobileImageSlider({
  imageTypes,
  displayGalaxy,
  userPrefs,
  contrast,
  shouldShowEllipse,
  currentIndex,
  onIndexChange,
  renderControls,
}: MobileImageSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [trackIndex, setTrackIndex] = useState(() => (imageTypes.length > 1 ? currentIndex + 1 : 0));
  const [loopResetTrackIndex, setLoopResetTrackIndex] = useState<number | null>(null);

  const hasMultipleImages = imageTypes.length > 1;
  const pendingInternalIndexRef = useRef<number | null>(null);
  const previousImageCountRef = useRef(imageTypes.length);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateContainerWidth = () => {
      const nextWidth = container.offsetWidth;
      setContainerWidth((previousWidth) => (previousWidth === nextWidth ? previousWidth : nextWidth));
    };

    updateContainerWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateContainerWidth);

      return () => {
        window.removeEventListener("resize", updateContainerWidth);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const renderedSlides = useMemo(() => {
    if (!hasMultipleImages) {
      return imageTypes.map((imageType, index) => ({
        imageType,
        originalIndex: index,
        key: `slide-${index}-${imageType.url ?? `slot-${index}`}`,
      }));
    }

    const lastIndex = imageTypes.length - 1;
    return [
      {
        imageType: imageTypes[lastIndex],
        originalIndex: lastIndex,
        key: `clone-last-${imageTypes[lastIndex]?.url ?? `slot-${lastIndex}`}`,
      },
      ...imageTypes.map((imageType, index) => ({
        imageType,
        originalIndex: index,
        key: `slide-${index}-${imageType.url ?? `slot-${index}`}`,
      })),
      {
        imageType: imageTypes[0],
        originalIndex: 0,
        key: `clone-first-${imageTypes[0]?.url ?? "slot-0"}`,
      },
    ];
  }, [imageTypes, hasMultipleImages]);

  const syncTrackToCurrentIndex = useCallback(() => {
    setIsAnimating(false);
    setLoopResetTrackIndex(null);
    setTranslateX(0);
    setTrackIndex(hasMultipleImages ? currentIndex + 1 : 0);
  }, [currentIndex, hasMultipleImages]);

  const navigateTo = useCallback((nextIndex: number) => {
    if (isAnimating || nextIndex === currentIndex) {
      return;
    }

    if (!hasMultipleImages) {
      onIndexChange(nextIndex);
      return;
    }

    const lastIndex = imageTypes.length - 1;
    const isWrapToLast = currentIndex === 0 && nextIndex === lastIndex;
    const isWrapToFirst = currentIndex === lastIndex && nextIndex === 0;
    const isAdjacentMove = Math.abs(nextIndex - currentIndex) === 1;
    const shouldAnimate = isAdjacentMove || isWrapToLast || isWrapToFirst;

    pendingInternalIndexRef.current = nextIndex;
    setTranslateX(0);

    if (!shouldAnimate) {
      setIsAnimating(false);
      setLoopResetTrackIndex(null);
      setTrackIndex(nextIndex + 1);
      onIndexChange(nextIndex);
      return;
    }

    setIsAnimating(true);

    if (isWrapToLast) {
      setLoopResetTrackIndex(imageTypes.length);
      setTrackIndex(0);
    } else if (isWrapToFirst) {
      setLoopResetTrackIndex(1);
      setTrackIndex(imageTypes.length + 1);
    } else {
      setLoopResetTrackIndex(null);
      setTrackIndex(nextIndex + 1);
    }

    onIndexChange(nextIndex);
  }, [isAnimating, currentIndex, hasMultipleImages, imageTypes.length, onIndexChange]);

  const goToPreviousImage = useCallback(() => {
    if (!imageTypes.length) {
      return;
    }

    navigateTo((currentIndex - 1 + imageTypes.length) % imageTypes.length);
  }, [navigateTo, currentIndex, imageTypes.length]);

  const goToNextImage = useCallback(() => {
    if (!imageTypes.length) {
      return;
    }

    navigateTo((currentIndex + 1) % imageTypes.length);
  }, [navigateTo, currentIndex, imageTypes.length]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating || !hasMultipleImages) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  }, [isAnimating, hasMultipleImages]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  }, [isDragging, startX]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = containerWidth > 0 ? containerWidth * 0.2 : Number.POSITIVE_INFINITY; // 20% of slide width to trigger change
    const dragDistance = Math.abs(translateX);

    if (hasMultipleImages && translateX > threshold) {
      // Swipe right - go to previous, wrapping from first to last
      goToPreviousImage();
    } else if (hasMultipleImages && translateX < -threshold) {
      // Swipe left - go to next, wrapping from last to first
      goToNextImage();
    } else if (dragDistance > DRAG_RESET_THRESHOLD_PX) {
      setIsAnimating(true);
      setTranslateX(0);
    } else {
      setIsAnimating(false);
      setTranslateX(0);
    }
  }, [isDragging, translateX, containerWidth, hasMultipleImages, goToPreviousImage, goToNextImage]);

  // Handle mouse events for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isAnimating || !hasMultipleImages) return;
    setIsDragging(true);
    setStartX(e.clientX);
    e.preventDefault();
  }, [isAnimating, hasMultipleImages]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    setTranslateX(diff);
  }, [isDragging, startX]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    handleTouchEnd();
  }, [isDragging, handleTouchEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleTouchEnd();
    }
  }, [isDragging, handleTouchEnd]);

  // Sync the track when the parent changes index outside this component
  useEffect(() => {
    const imageCountChanged = previousImageCountRef.current !== imageTypes.length;
    previousImageCountRef.current = imageTypes.length;

    if (imageCountChanged) {
      pendingInternalIndexRef.current = null;
      syncTrackToCurrentIndex();
      return;
    }

    if (pendingInternalIndexRef.current === currentIndex) {
      pendingInternalIndexRef.current = null;
      return;
    }

    syncTrackToCurrentIndex();
  }, [currentIndex, imageTypes.length, syncTrackToCurrentIndex]);

  const handleTrackTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") {
      return;
    }

    if (loopResetTrackIndex !== null) {
      setIsAnimating(false);
      setTrackIndex(loopResetTrackIndex);
      setLoopResetTrackIndex(null);
      return;
    }

    setIsAnimating(false);
  }, [loopResetTrackIndex]);

  const currentImage = imageTypes[currentIndex];
  
  // For mobile, parse the name to separate main part and parenthetical part
  const imageName = currentImage?.name?.replace(/\n/g, ' ') ?? '';
  const parenMatch = imageName.match(/^(.+?)(\s*\([^)]+\))$/);
  const mainName = parenMatch ? parenMatch[1] : imageName;
  const parenPart = parenMatch ? parenMatch[2] : '';

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-[400px] mx-auto">
      {/* Header: Image title on left, position indicator on right - single line */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700 min-h-0">
        {/* Image name - single line with ellipsis overflow, parenthetical text smaller */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate min-w-0 flex-1 mr-2 leading-tight">
          {mainName}
          {parenPart && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{parenPart}</span>}
        </h3>
        
        {/* Position indicator with dots */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {imageTypes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => navigateTo(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex
                  ? "bg-blue-600 dark:bg-blue-400 w-2 h-2"
                  : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              }`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Slider container */}
      <div
        ref={containerRef}
        className="relative touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`flex ${isAnimating ? "transition-transform ease-out" : ""}`}
          style={{
            transform: `translateX(calc(-${trackIndex * 100}% + ${translateX}px))`,
            transitionDuration: isAnimating ? `${SLIDE_ANIMATION_DURATION_MS}ms` : undefined,
          }}
          onTransitionEnd={handleTrackTransitionEnd}
        >
          {renderedSlides.map(({ imageType, key }) => (
            <div
              key={key}
              className="w-full flex-shrink-0 p-2"
              style={{ minWidth: "100%" }}
            >
              <div className="aspect-square">
                {imageType.url ? (
                  <ImageViewer
                    imageUrl={imageType.url}
                    alt={`${displayGalaxy.id} - ${imageType.name}`}
                    preferences={userPrefs}
                    contrast={contrast}
                    defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                    {...(shouldShowEllipse(imageType.showEllipse) && {
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

        {/* Fixed overlay controls at the bottom - stays in place while images slide */}
        {renderControls && (
          <div
            className="absolute bottom-4 left-2 right-2 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {renderControls({
              goPrev: goToPreviousImage,
              goNext: goToNextImage,
            })}
          </div>
        )}
      </div>
    </div>
  );
}
