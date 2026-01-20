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
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [fillWindow, setFillWindow] = useState(false);
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

  const openViewer = useCallback(() => {
    setIsViewerOpen(true);
    setFillWindow(false);
  }, []);

  const closeViewer = useCallback(() => {
    setIsViewerOpen(false);
    setFillWindow(false);
  }, []);

  const toggleFillWindow = useCallback(() => {
    setFillWindow((prev) => !prev);
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
      } else if (e.key === "Escape" && isViewerOpen) {
        e.preventDefault();
        closeViewer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious, isViewerOpen, closeViewer]);

  useEffect(() => {
    if (!isViewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isViewerOpen]);

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
          title="Previous image"
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
          title="Next image"
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

      {/* Footer controls - styled like presentation mode */}
      <div className="mt-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">
              {currentIndex + 1} / {kidsExampleImages.length}
            </span>
            <span className="text-xs">Use arrow keys or swipe</span>
          </div>
          <button
            type="button"
            onClick={openViewer}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
            aria-label="Open presentation view"
            title="Open presentation view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2m-8 0H6a2 2 0 01-2-2v-2" />
            </svg>
            <span className="text-sm">Expand</span>
          </button>
        </div>
      </div>

      {isViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeViewer(); }}
        >
          {/* Close button at top right */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            className="absolute top-4 right-4 z-[60] bg-gray-800/80 hover:bg-gray-700 text-white rounded-full p-2 shadow"
            aria-label="Close presentation view"
            title="Close presentation view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image area - takes remaining space */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 p-4">
            {imageError ? (
              <div className="flex items-center justify-center bg-gray-800 rounded border border-gray-700 w-full h-full max-w-4xl max-h-full">
                <div className="text-center text-gray-300">
                  <p className="text-sm">Image failed to load</p>
                  <p className="text-xs mt-1">{currentImage.filename}</p>
                </div>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={currentImage.alt}
                className={`object-contain transition-all duration-200 ${
                  fillWindow
                    ? "w-full h-full max-w-none max-h-none"
                    : "max-w-[85vw] max-h-[70vh]"
                }`}
              />
            )}

            {/* Navigation buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              disabled={currentIndex === 0}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-40 rounded-full p-3 text-white z-[55]"
              aria-label="Previous image"
              title="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              disabled={currentIndex === kidsExampleImages.length - 1}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 disabled:opacity-40 rounded-full p-3 text-white z-[55]"
              aria-label="Next image"
              title="Next image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Footer - always below image */}
          <div className="flex-shrink-0 bg-gray-900/80 border-t border-gray-700 p-4">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-white/10 rounded-full">
                    {currentIndex + 1} / {kidsExampleImages.length}
                  </span>
                  <span className="text-xs text-white/80">Use arrows or swipe; Esc to close</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFillWindow(); }}
                    className={`p-2 rounded-md shadow transition-colors ${
                      fillWindow ? "bg-blue-600 hover:bg-blue-700" : "bg-white/15 hover:bg-white/25"
                    }`}
                    aria-label="Toggle fit to window"
                    title="Toggle fit to window"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2m-8 0H6a2 2 0 01-2-2v-2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); closeViewer(); }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md shadow"
                    aria-label="Close"
                    title="Close"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-white/90">
                <p className="font-semibold">{currentImage.title}</p>
                {currentImage.caption && <p className="text-white/80">{currentImage.caption}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
