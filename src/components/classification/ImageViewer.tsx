import { useCallback, useEffect, useRef, useState } from "react";

// Enable/disable half-light radius circle overlay
const ENABLE_HALF_LIGHT_CIRCLE = true;

// Scale factors for half-light overlay
const HALF_LIGHT_ORIGINAL_SIZE = 256;
const HALF_LIGHT_IMAGE_SIZE = 500;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

// Background color for the zoomed image container (set to "white", "transparent", or any CSS color)
const ZOOMED_IMAGE_BACKGROUND = "white";

// Enable pixelated rendering for zoomed images (set to true for pixelation, false for smooth interpolation)
const ENABLE_PIXELATED_ZOOM = true;

const clampZoomValue = (value: number) => Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);

interface ImageViewerProps {
  imageUrl: string;
  alt: string;
  preferences?: {
    imageQuality?: "high" | "medium" | "low";
    contrast?: number;
  } | null;
  contrast?: number;
  reff?: number; // half-light radius in pixels
  pa?: number; // position angle in degrees
  q?: number; // axis ratio (b/a)
  x?: number; // center x coordinate
  y?: number; // center y coordinate
}

export function ImageViewer({ imageUrl, alt, preferences, contrast = 1.0, reff, pa, q, x, y }: ImageViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const panContainerRef = useRef<HTMLDivElement>(null);
  const pointerStateRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
    pointerId: number;
  } | null>(null);
  const shouldCenterRef = useRef(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageWidth(img.naturalWidth);
    setImageHeight(img.naturalHeight);
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleCloseZoom = () => {
    setIsZoomed(false);
    setZoom(1);
    pointerStateRef.current = null;
    setIsDragging(false);
  };

  const handleImageClick = () => {
    if (isZoomed) {
      handleCloseZoom();
      return;
    }
    setIsZoomed(true);
  };

  const computeFitScale = useCallback((updateZoom = false) => {
    if (!panContainerRef.current || !imageWidth || !imageHeight) {
      return;
    }

    const { clientWidth, clientHeight } = panContainerRef.current;
    if (!clientWidth || !clientHeight) {
      return;
    }

    const scale = Math.min(clientWidth / imageWidth, clientHeight / imageHeight, 1);
    setFitScale(scale);

    if (updateZoom) {
      shouldCenterRef.current = true;
      setZoom(clampZoomValue(scale));
    }
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    if (!isZoomed) {
      pointerStateRef.current = null;
      setIsDragging(false);
      return;
    }

    const raf = window.requestAnimationFrame(() => computeFitScale(true));

    const handleResize = () => computeFitScale(false);
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && panContainerRef.current) {
      observer = new ResizeObserver(() => computeFitScale(false));
      observer.observe(panContainerRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [isZoomed, computeFitScale]);

  useEffect(() => {
    if (!isZoomed) {
      return;
    }
    computeFitScale(true);
  }, [imageWidth, imageHeight, isZoomed, computeFitScale]);

  const baseWidth = imageWidth ?? HALF_LIGHT_IMAGE_SIZE;
  const baseHeight = imageHeight ?? HALF_LIGHT_IMAGE_SIZE;
  const scaledWidth = baseWidth * zoom;
  const scaledHeight = baseHeight * zoom;

  const centerContent = useCallback(() => {
    const container = panContainerRef.current;
    if (!container) {
      return;
    }

    const targetScrollLeft = Math.max(0, (scaledWidth - container.clientWidth) / 2);
    const targetScrollTop = Math.max(0, (scaledHeight - container.clientHeight) / 2);
    container.scrollLeft = targetScrollLeft;
    container.scrollTop = targetScrollTop;
  }, [scaledWidth, scaledHeight]);

  useEffect(() => {
    if (!panContainerRef.current) {
      return;
    }

    if (!isZoomed) {
      panContainerRef.current.scrollLeft = 0;
      panContainerRef.current.scrollTop = 0;
      return;
    }

    if (!pointerStateRef.current && (shouldCenterRef.current || zoom <= fitScale + 0.01)) {
      centerContent();
    }

    if (shouldCenterRef.current) {
      shouldCenterRef.current = false;
    }
  }, [zoom, fitScale, isZoomed, centerContent]);

  const canPan = zoom > fitScale + 0.01;

  const handleZoomIn = () => {
    shouldCenterRef.current = false;
    setZoom((prev) => clampZoomValue(prev * ZOOM_STEP));
  };

  const handleZoomOut = () => {
    shouldCenterRef.current = false;
    setZoom((prev) => clampZoomValue(prev / ZOOM_STEP));
  };

  const handleResetToFit = () => {
    shouldCenterRef.current = true;
    setZoom(clampZoomValue(fitScale));
  };

  const handleOneToOne = () => {
    shouldCenterRef.current = true;
    setZoom(clampZoomValue(1));
  };

  useEffect(() => {
    if (!isZoomed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleCloseZoom();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '1':
          handleOneToOne();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomed, handleCloseZoom, handleZoomIn, handleZoomOut, handleOneToOne]);

  const endPointerPan = (pointerId: number) => {
    const container = panContainerRef.current;
    if (!container) {
      return;
    }

    if (container.hasPointerCapture(pointerId)) {
      container.releasePointerCapture(pointerId);
    }
    pointerStateRef.current = null;
    setIsDragging(false);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPan || !panContainerRef.current) {
      return;
    }

    e.preventDefault();
    const container = panContainerRef.current;
    pointerStateRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      pointerId: e.pointerId,
    };
    setIsDragging(true);
    container.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = panContainerRef.current;
    const pointerState = pointerStateRef.current;
    if (!container || !pointerState || pointerState.pointerId !== e.pointerId) {
      return;
    }

    e.preventDefault();
    const deltaX = e.clientX - pointerState.x;
    const deltaY = e.clientY - pointerState.y;
    container.scrollLeft = pointerState.scrollLeft - deltaX;
    container.scrollTop = pointerState.scrollTop - deltaY;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStateRef.current?.pointerId !== e.pointerId) {
      return;
    }
    endPointerPan(e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStateRef.current?.pointerId !== e.pointerId) {
      return;
    }
    endPointerPan(e.pointerId);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStateRef.current?.pointerId !== e.pointerId) {
      return;
    }
    endPointerPan(e.pointerId);
  };

  const controlIconButtonClasses = "inline-flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gray-900 text-white shadow transition hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";
  const controlTextButtonClasses = "inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2 text-xl font-medium text-white shadow transition hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";
  const panContainerClasses = `relative flex w-auto max-w-full max-h-[85vh] items-center justify-center overflow-auto rounded-lg sm:max-w-[90vw] ${canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-auto'} ${isDragging ? 'cursor-grabbing' : ''}`;

  // Calculate scale factors for half-light overlay
  const scaleX = imageWidth ? imageWidth / HALF_LIGHT_ORIGINAL_SIZE : HALF_LIGHT_IMAGE_SIZE / HALF_LIGHT_ORIGINAL_SIZE;
  const scaleY = imageHeight ? imageHeight / HALF_LIGHT_ORIGINAL_SIZE : HALF_LIGHT_IMAGE_SIZE / HALF_LIGHT_ORIGINAL_SIZE;

  // Calculate ellipse parameters
  const ellipseParams = ENABLE_HALF_LIGHT_CIRCLE && reff && pa !== undefined && q && x !== undefined && y !== undefined ? {
    cx: x * scaleX,
    cy: y * scaleY,
    rx: reff * scaleX,
    ry: reff * q * scaleY,
    rotation: 90 - pa  // Adjusted for astronomical PA convention (east of north)
  } : null;

  if (hasError) {
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-2xl mb-1">❌</div>
          <p className="text-xs">Failed to load</p>
        </div>
      </div>
    );
  }

  const controlButtons = (
    <>
      <button
        type="button"
        onClick={handleZoomOut}
        className={controlIconButtonClasses}
        aria-label="Zoom out"
      >
        <span aria-hidden="true" className="text-2xl font-semibold">−</span>
      </button>
      <button
        type="button"
        onClick={handleZoomIn}
        className={controlIconButtonClasses}
        aria-label="Zoom in"
      >
        <span aria-hidden="true" className="text-2xl font-semibold">+</span>
      </button>
      <button
        type="button"
        onClick={handleResetToFit}
        className={controlTextButtonClasses}
        aria-label="Scale image to fit"
        disabled={Math.abs(zoom - fitScale) < 0.01}
      >
        <span aria-hidden="true" className="text-2xl">⤢</span>
      </button>
      <button
        type="button"
        onClick={handleOneToOne}
        className={controlTextButtonClasses}
        aria-label="Reset image to 1:1 scale"
        disabled={Math.abs(zoom - 1) < 0.01}
      >
        1:1
      </button>
      <button
        type="button"
        onClick={handleCloseZoom}
        className={controlIconButtonClasses}
        aria-label="Close enlarged image"
      >
        <span aria-hidden="true" className="text-3xl font-semibold">×</span>
      </button>
    </>
  );

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Thumbnail / inline image */}
      <img
        src={imageUrl}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onClick={handleImageClick}
        className={`w-full h-full object-cover rounded-lg cursor-pointer transition-all duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${isZoomed ? 'scale-100' : 'scale-100'}`}
        style={{
          filter: `contrast(${contrast})`,
        }}
      />

      {/* Half-light radius circle overlay */}
      {ellipseParams && (
        <svg
          viewBox={`0 0 ${imageWidth || HALF_LIGHT_IMAGE_SIZE} ${imageHeight || HALF_LIGHT_IMAGE_SIZE}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ filter: `contrast(${contrast})` }}
        >
          <ellipse
            cx={ellipseParams.cx}
            cy={ellipseParams.cy}
            rx={ellipseParams.rx}
            ry={ellipseParams.ry}
            fill="none"
            stroke="magenta"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            transform={`rotate(${ellipseParams.rotation}, ${ellipseParams.cx}, ${ellipseParams.cy})`}
          />
        </svg>
      )}

      {/* Modal + backdrop rendered when zoomed. Image modal must be above overlay/backdrop. */}
      {isZoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-0 py-2 sm:px-4 sm:py-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
          />

          {/* centered large image */}
          <div
            className="relative z-10 flex w-auto max-w-full max-h-full flex-col items-center gap-4 px-2 pb-32 sm:max-w-[90vw] sm:px-0 sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged image viewer"
          >
            <div
              ref={panContainerRef}
              className={panContainerClasses}
              style={{
                touchAction: canPan ? "none" : "auto",
                backgroundColor: canPan ? ZOOMED_IMAGE_BACKGROUND : "transparent",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
            >
              <div className="relative">
                <img
                  src={imageUrl}
                  alt={alt}
                  draggable={false}
                  className="select-none pointer-events-none"
                  style={{
                    width: scaledWidth,
                    height: scaledHeight,
                    maxWidth: "none",
                    maxHeight: "none",
                    filter: `contrast(${contrast})`,
                    imageRendering: ENABLE_PIXELATED_ZOOM ? 'pixelated' : 'auto',
                  }}
                />
                {/* Half-light radius circle overlay for modal */}
                {ellipseParams && (
                  <svg
                    width={scaledWidth}
                    height={scaledHeight}
                    viewBox={`0 0 ${imageWidth || HALF_LIGHT_IMAGE_SIZE} ${imageHeight || HALF_LIGHT_IMAGE_SIZE}`}
                    className="absolute inset-0 pointer-events-none"
                    style={{ filter: `contrast(${contrast})` }}
                  >
                    <ellipse
                      cx={ellipseParams.cx}
                      cy={ellipseParams.cy}
                      rx={ellipseParams.rx}
                      ry={ellipseParams.ry}
                      fill="none"
                      stroke="magenta"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      transform={`rotate(${ellipseParams.rotation}, ${ellipseParams.cx}, ${ellipseParams.cy})`}
                    />
                  </svg>
                )}
              </div>
            </div>

            <div className="hidden w-full justify-center sm:flex">
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/40 px-4 py-3 text-white backdrop-blur">
                {controlButtons}
              </div>
            </div>
          </div>

          <div className="sm:hidden pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center ">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-white/40 px-2 py-2 text-white backdrop-blur">
              {controlButtons}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
