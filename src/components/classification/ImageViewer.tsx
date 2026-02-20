import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Enable/disable half-light radius circle overlay
const ENABLE_HALF_LIGHT_CIRCLE = true;

// Scale factors for half-light overlay
const HALF_LIGHT_ORIGINAL_SIZE = 256;
const HALF_LIGHT_IMAGE_SIZE = 256;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

// Background color for the zoomed image container
const ZOOMED_IMAGE_BACKGROUND = "white";

// Enable pixelated rendering for zoomed images (set to true for pixelation, false for smooth interpolation)
const ENABLE_PIXELATED_ZOOM = true;

// ── Pixel coordinate corrections for the ellipse overlay ────────────────────
//
// GALFIT stores pixel positions in 1-based FITS coordinates:
//   x  increases RIGHTWARD  (same direction as SVG +x)
//   y  increases UPWARD     (opposite to SVG +y which points downward)
//
// X correction  (PIXEL_OFFSET_CORRECTION_X = -0.5)
// ─────────────────────────────────────────────────
//   In FITS, pixel 1 has its centre at x_fits = 1.
//   In the SVG viewBox, pixel 0 has its centre at x_svg = 0.5.
//   Conversion (1-based pixel-centre → SVG pixel-centre):
//     x_svg = x_fits − 1 + 0.5 = x_fits − 0.5
//   Implemented as: (x + PIXEL_OFFSET_CORRECTION_X)  where  PIXEL_OFFSET_CORRECTION_X = −0.5.
//
// Y correction  (PIXEL_OFFSET_CORRECTION_Y = +1.5)
// ─────────────────────────────────────────────────
//   The PNG images served to the browser are vertically flipped relative to
//   raw FITS storage order (np.flipud applied at tile-generation time), so
//   FITS y = 1 (sky bottom) maps to the BOTTOM of the displayed image, and
//   FITS y = H (sky top) maps to the TOP — correct astronomical orientation.
//
//   The axis flip from FITS (y-up) to SVG (y-down) is: y_svg_row = H − y_fits.
//   Then adding the pixel-centre shift (+0.5) gives:
//     cy_theoretical = (H − y + 0.5) × scaleY
//
//   In practice an additional +1.0 offset was found empirically – most likely
//   a 1-pixel boundary shift introduced by the tile-cutting pipeline (e.g. the
//   cutout of size H is extracted starting one pixel off from the GALFIT stamp
//   origin). This gives the combined constant:
//     PIXEL_OFFSET_CORRECTION_Y = 0.5 + 1.0 = 1.5
//
//   Implemented as: (H − y + PIXEL_OFFSET_CORRECTION_Y) × scaleY.
//
// These constants should be revisited if the tile-generation pipeline changes.
const PIXEL_OFFSET_CORRECTION_X = -0.5;
const PIXEL_OFFSET_CORRECTION_Y = +1.5;

const clampZoomValue = (value: number) => Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);

export interface DefaultZoomOptions {
  mode: "pixels" | "multiple";
  value: number;
  applyIfOriginalSizeBelow?: number;
}

export interface ImageRectangleOverlay {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  defaultZoomOptions?: DefaultZoomOptions;
  rectangle?: ImageRectangleOverlay; // rectangle overlay
}

export function ImageViewer({ imageUrl, alt, preferences, contrast = 1.0, reff, pa, q, x, y, defaultZoomOptions, rectangle }: ImageViewerProps) {
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
  const defaultZoomAppliedRef = useRef(false);
  const shouldRespectDefaultZoomRef = useRef(false);
  const previousImageUrlRef = useRef<string>(imageUrl);

  // Reset loading/error state when imageUrl changes (e.g., when contrast group changes)
  // Skip the initial render to avoid resetting state before the first image loads
  useEffect(() => {
    if (previousImageUrlRef.current !== imageUrl) {
      previousImageUrlRef.current = imageUrl;
      setIsLoading(true);
      setHasError(false);
    }
  }, [imageUrl]);

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
    defaultZoomAppliedRef.current = false;
    shouldRespectDefaultZoomRef.current = false;
  };

  const handleImageClick = () => {
    if (isZoomed) {
      handleCloseZoom();
      return;
    }
    defaultZoomAppliedRef.current = false;
    shouldRespectDefaultZoomRef.current = !!defaultZoomOptions;
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
      const shouldSkipFitZoom = shouldRespectDefaultZoomRef.current && !defaultZoomAppliedRef.current;
      if (!shouldSkipFitZoom) {
        setZoom(clampZoomValue(scale));
      } else {
      }
    }
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    if (!isZoomed) {
      pointerStateRef.current = null;
      setIsDragging(false);
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      const shouldUpdateZoom = !shouldRespectDefaultZoomRef.current;
      computeFitScale(shouldUpdateZoom);
    });

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
    // Don't update zoom if we're waiting for default zoom to be applied
    const shouldUpdateZoom = !shouldRespectDefaultZoomRef.current || defaultZoomAppliedRef.current;
    computeFitScale(shouldUpdateZoom);
  }, [imageWidth, imageHeight, isZoomed, computeFitScale]);

  const baseWidth = imageWidth ?? HALF_LIGHT_IMAGE_SIZE;
  const baseHeight = imageHeight ?? HALF_LIGHT_IMAGE_SIZE;
  const scaledWidth = baseWidth * zoom;
  const scaledHeight = baseHeight * zoom;

  const centerContent = useCallback(() => {
    const container = panContainerRef.current;
    if (!container || !imageWidth || !imageHeight) {
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate scroll position to center the image
    const targetScrollLeft = Math.max(0, (scaledWidth - containerWidth) / 2);
    const targetScrollTop = Math.max(0, (scaledHeight - containerHeight) / 2);
    container.scrollLeft = targetScrollLeft;
    container.scrollTop = targetScrollTop;
  }, [scaledWidth, scaledHeight, imageWidth, imageHeight]);

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
    const container = panContainerRef.current;
    if (!container || !imageWidth || !imageHeight) {
      shouldCenterRef.current = false;
      setZoom((prev) => clampZoomValue(prev * ZOOM_STEP));
      return;
    }

    // Calculate current center point in image coordinates
    const currentScrollLeft = container.scrollLeft;
    const currentScrollTop = container.scrollTop;
    const centerX = (currentScrollLeft + container.clientWidth / 2) / scaledWidth;
    const centerY = (currentScrollTop + container.clientHeight / 2) / scaledHeight;

    shouldCenterRef.current = false;
    const newZoom = clampZoomValue(zoom * ZOOM_STEP);
    setZoom(newZoom);

    // Schedule adjustment for after zoom is applied
    requestAnimationFrame(() => {
      if (!container) return;
      const newScaledWidth = imageWidth * newZoom;
      const newScaledHeight = imageHeight * newZoom;
      container.scrollLeft = centerX * newScaledWidth - container.clientWidth / 2;
      container.scrollTop = centerY * newScaledHeight - container.clientHeight / 2;
    });
  };

  const handleZoomOut = () => {
    const container = panContainerRef.current;
    if (!container || !imageWidth || !imageHeight) {
      shouldCenterRef.current = false;
      setZoom((prev) => clampZoomValue(prev / ZOOM_STEP));
      return;
    }

    // Calculate current center point in image coordinates
    const currentScrollLeft = container.scrollLeft;
    const currentScrollTop = container.scrollTop;
    const centerX = (currentScrollLeft + container.clientWidth / 2) / scaledWidth;
    const centerY = (currentScrollTop + container.clientHeight / 2) / scaledHeight;

    shouldCenterRef.current = false;
    const newZoom = clampZoomValue(zoom / ZOOM_STEP);
    setZoom(newZoom);

    // Schedule adjustment for after zoom is applied
    requestAnimationFrame(() => {
      if (!container) return;
      const newScaledWidth = imageWidth * newZoom;
      const newScaledHeight = imageHeight * newZoom;
      container.scrollLeft = centerX * newScaledWidth - container.clientWidth / 2;
      container.scrollTop = centerY * newScaledHeight - container.clientHeight / 2;
    });
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

  useEffect(() => {
    if (!isZoomed || !defaultZoomOptions || !imageWidth || !imageHeight) {
      return;
    }

    if (defaultZoomAppliedRef.current) {
      return;
    }

    const maxDimension = Math.max(imageWidth, imageHeight);
    if (
      defaultZoomOptions.applyIfOriginalSizeBelow !== undefined &&
      maxDimension >= defaultZoomOptions.applyIfOriginalSizeBelow
    ) {
      defaultZoomAppliedRef.current = true;
      return;
    }

    const referenceDimension = Math.max(imageWidth, imageHeight);

    let desiredZoom: number | null = null;
    if (defaultZoomOptions.mode === "pixels") {
      desiredZoom = defaultZoomOptions.value / referenceDimension;
    } else if (defaultZoomOptions.mode === "multiple") {
      desiredZoom = defaultZoomOptions.value;
    }

    if (desiredZoom !== null && Number.isFinite(desiredZoom) && desiredZoom > 0) {
      defaultZoomAppliedRef.current = true;
      shouldCenterRef.current = true;
      const clamped = clampZoomValue(desiredZoom);
      setZoom(clamped);
    } else {
      defaultZoomAppliedRef.current = true;
    }
  }, [isZoomed, defaultZoomOptions, imageWidth, imageHeight]);

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
  const panContainerClasses = `relative w-auto max-w-full max-h-[85vh] overflow-auto rounded-lg sm:max-w-[90vw] ${canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-auto'} ${isDragging ? 'cursor-grabbing' : ''}`;

  // Calculate scale factors for half-light overlay
  const scaleX = imageWidth ? imageWidth / HALF_LIGHT_ORIGINAL_SIZE : HALF_LIGHT_IMAGE_SIZE / HALF_LIGHT_ORIGINAL_SIZE;
  const scaleY = imageHeight ? imageHeight / HALF_LIGHT_ORIGINAL_SIZE : HALF_LIGHT_IMAGE_SIZE / HALF_LIGHT_ORIGINAL_SIZE;

  // ── Ellipse overlay parameters ────────────────────────────────────────────
  //
  // Centre coordinates – see PIXEL_OFFSET_CORRECTION_X/Y constants above for
  // the full derivation.  Summary:
  //
  //   cx = (x + PIXEL_OFFSET_CORRECTION_X) × scaleX
  //      = (x − 0.5) × scaleX
  //        [x is 1-based rightward; −0.5 aligns to SVG pixel centre]
  //
  //   cy = (HALF_LIGHT_ORIGINAL_SIZE − y + PIXEL_OFFSET_CORRECTION_Y) × scaleY
  //      = (H − y + 1.5) × scaleY
  //        [H − y flips the FITS y-up axis to SVG y-down;
  //         +0.5 is the pixel-centre correction;
  //         +1.0 is an empirical pipeline offset]
  //
  // ── Position angle ────────────────────────────────────────────────────────
  //
  // SVG rotate(angle, cx, cy) rotates CLOCKWISE on screen for positive angle
  // (because SVG +y points downward).
  //
  // The semi-major axis (rx) starts along +x (East on screen).
  // Rotating 90° CW places it along −y = North (upward).
  // GALFIT PA is measured CCW from North; CCW is opposite to SVG's CW positive,
  // so each degree of PA subtracts from the base 90° rotation:
  //
  //   svgRotation = 90 − pa
  //
  // Verification: PA = 0 → 90° CW → North ✓ | PA = 90 → 0° → East ✓
  // Matches the Python reference: mpl_angle = 90 + (−pa) = 90 − pa.
  const ellipseParams = ENABLE_HALF_LIGHT_CIRCLE && reff && pa !== undefined && q && x !== undefined && y !== undefined ? {
    cx: (x + PIXEL_OFFSET_CORRECTION_X) * scaleX,
    cy: (HALF_LIGHT_ORIGINAL_SIZE - y + PIXEL_OFFSET_CORRECTION_Y) * scaleY,
    rx: reff * scaleX,
    ry: reff * q * scaleY,
    rotation: 90 - pa,
  } : null;

  // Rectangle overlay parameters (uses absolute pixel coordinates from config)
  const rectangleParams = rectangle ? {
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height,
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
          // imageRendering: 'pixelated',
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

      {/* Rectangle overlay */}
      {rectangleParams && (
        <svg
          viewBox={`0 0 ${imageWidth || HALF_LIGHT_IMAGE_SIZE} ${imageHeight || HALF_LIGHT_IMAGE_SIZE}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <rect
            x={rectangleParams.x}
            y={rectangleParams.y}
            width={rectangleParams.width}
            height={rectangleParams.height}
            fill="none"
            stroke="lime"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Modal + backdrop rendered when zoomed using Portal to escape any container constraints */}
      {isZoomed && createPortal(
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
                backgroundColor: ZOOMED_IMAGE_BACKGROUND,
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
            >
              <div 
                className="relative"
                style={{
                  width: scaledWidth,
                  height: scaledHeight,
                  margin: '0 auto',
                }}
              >
                <img
                  src={imageUrl}
                  alt={alt}
                  draggable={false}
                  className="block select-none pointer-events-none"
                  style={{
                    width: '100%',
                    height: '100%',
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
                {/* Rectangle overlay for modal */}
                {rectangleParams && (
                  <svg
                    width={scaledWidth}
                    height={scaledHeight}
                    viewBox={`0 0 ${imageWidth || HALF_LIGHT_IMAGE_SIZE} ${imageHeight || HALF_LIGHT_IMAGE_SIZE}`}
                    className="absolute inset-0 pointer-events-none"
                  >
                    <rect
                      x={rectangleParams.x}
                      y={rectangleParams.y}
                      width={rectangleParams.width}
                      height={rectangleParams.height}
                      fill="none"
                      stroke="lime"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
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
        </div>,
        document.body
      )}
    </div>
  );
}
