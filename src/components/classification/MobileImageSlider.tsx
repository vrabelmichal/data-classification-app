import { useState, useRef, useCallback, useEffect } from "react";
import { ImageViewer } from "./ImageViewer";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "./GalaxyImages";
import type { ImageType, GalaxyData, UserPreferences } from "./types";

interface MobileImageSliderProps {
  imageTypes: ImageType[];
  displayGalaxy: GalaxyData;
  userPrefs: UserPreferences | null | undefined;
  contrast: number;
  shouldShowEllipse: (imageName: string) => boolean;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function MobileImageSlider({
  imageTypes,
  displayGalaxy,
  userPrefs,
  contrast,
  shouldShowEllipse,
  currentIndex,
  onIndexChange,
}: MobileImageSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const slideWidth = containerRef.current?.offsetWidth ?? 0;

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  }, [isAnimating]);

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

    const threshold = slideWidth * 0.2; // 20% of slide width to trigger change

    if (translateX > threshold && currentIndex > 0) {
      // Swipe right - go to previous
      onIndexChange(currentIndex - 1);
    } else if (translateX < -threshold && currentIndex < imageTypes.length - 1) {
      // Swipe left - go to next
      onIndexChange(currentIndex + 1);
    }

    // Animate back to position
    setIsAnimating(true);
    setTranslateX(0);
    setTimeout(() => setIsAnimating(false), 300);
  }, [isDragging, translateX, slideWidth, currentIndex, imageTypes.length, onIndexChange]);

  // Handle mouse events for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isAnimating) return;
    setIsDragging(true);
    setStartX(e.clientX);
    e.preventDefault();
  }, [isAnimating]);

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

  // Reset translate when index changes externally
  useEffect(() => {
    setTranslateX(0);
  }, [currentIndex]);

  const currentImage = imageTypes[currentIndex];
  
  // For mobile, parse the name to separate main part and parenthetical part
  const imageName = currentImage?.name?.replace(/\n/g, ' ') ?? '';
  const parenMatch = imageName.match(/^(.+?)(\s*\([^)]+\))$/);
  const mainName = parenMatch ? parenMatch[1] : imageName;
  const parenPart = parenMatch ? parenMatch[2] : '';

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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
              onClick={() => onIndexChange(idx)}
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
          className={`flex ${isAnimating ? "transition-transform duration-300 ease-out" : ""}`}
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${translateX}px))`,
          }}
        >
          {imageTypes.map((imageType, index) => (
            <div
              key={index}
              className="w-full flex-shrink-0 p-4"
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
      </div>
    </div>
  );
}
