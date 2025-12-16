import { useState, useRef, useCallback, useEffect } from "react";
import { kidsExampleImages } from "./kidsExamplesData";
import { getKidsExampleImageUrl } from "../../images/assetUrl";

/**
 * Simple image carousel for displaying KiDS example images
 * Inspired by the MobileImageSlider component but simplified for static images
 */
export function KidsExamplesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slideWidth = containerRef.current?.offsetWidth ?? 0;
  const currentImage = kidsExampleImages[currentIndex];
  const imageUrl = getKidsExampleImageUrl(currentImage.filename);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < kidsExampleImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setImageError(false);
    }
  }, [currentIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setImageError(false);
    }
  }, [currentIndex]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setImageError(false);
  }, []);

  // Touch/drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  }, [isDragging, startX]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = slideWidth * 0.2;

    if (translateX > threshold && currentIndex > 0) {
      goToPrevious();
    } else if (translateX < -threshold && currentIndex < kidsExampleImages.length - 1) {
      goToNext();
    }

    setIsAnimating(true);
    setTranslateX(0);
    setTimeout(() => setIsAnimating(false), 300);
  }, [isDragging, translateX, slideWidth, currentIndex, goToNext, goToPrevious]);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  // Reset translate when index changes
  useEffect(() => {
    setTranslateX(0);
  }, [currentIndex]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="mr-2">📚</span>
        KiDS Manual Labeling Examples
      </h2>
      
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        These figures show common cases and decision guidelines for manual labeling of KiDS survey 
        galaxy cutouts (masked g-band, model, residuals, and context panels).
      </p>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 italic">
        Credit: H. Thuruthipilly et al.
      </p>

      <div className="relative">
        {/* Main carousel container with fixed aspect ratio to prevent layout shift */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900 touch-pan-y aspect-video"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`flex h-full ${isAnimating ? "transition-transform duration-300 ease-out" : ""}`}
            style={{
              transform: `translateX(calc(-${currentIndex * 100}% + ${translateX}px))`,
            }}
          >
            {kidsExampleImages.map((image, idx) => (
              <div
                key={image.filename}
                className="min-w-full flex items-center justify-center p-4"
                style={{ flexShrink: 0 }}
              >
                <div className="w-full max-w-3xl mx-auto h-full flex items-center justify-center">
                  {idx === currentIndex && (
                    <>
                      {imageError ? (
                        <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 w-full h-full">
                          <div className="text-center text-gray-500 dark:text-gray-400">
                            <p className="text-sm">Image failed to load</p>
                            <p className="text-xs mt-1">{image.filename}</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={imageUrl}
                          alt={image.alt}
                          className="max-w-full max-h-full rounded shadow-sm object-contain"
                          onError={() => setImageError(true)}
                          loading="lazy"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation buttons */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-full p-2 shadow-lg transition-all"
          aria-label="Previous image"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToNext}
          disabled={currentIndex === kidsExampleImages.length - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-full p-2 shadow-lg transition-all"
          aria-label="Next image"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Image title and caption */}
      <div className="mt-4 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {currentImage.title}
        </h3>
        {currentImage.caption && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentImage.caption}
          </p>
        )}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mt-4 min-h-[12px]">
        {kidsExampleImages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToSlide(idx)}
            className={`rounded-full transition-colors ${
              idx === currentIndex
                ? "bg-blue-600 dark:bg-blue-400 w-3 h-3"
                : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 w-2 h-2"
            }`}
            aria-label={`Go to image ${idx + 1}: ${kidsExampleImages[idx].title}`}
          />
        ))}
      </div>

      {/* Counter and keyboard hint */}
      <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          {currentIndex + 1} / {kidsExampleImages.length}
        </p>
        <p className="text-xs mt-1">
          Use arrow keys or swipe to navigate
        </p>
      </div>
    </div>
  );
}
