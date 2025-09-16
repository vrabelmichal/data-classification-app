import { useState } from "react";

interface ImageViewerProps {
  imageUrl: string;
  alt: string;
  preferences?: {
    imageQuality?: "high" | "medium" | "low";
    contrast?: number;
  } | null;
  contrast?: number;
}

export function ImageViewer({ imageUrl, alt, preferences, contrast = 1.0 }: ImageViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleImageClick = () => {
    setIsZoomed(!isZoomed);
  };

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

      {/* Modal + backdrop rendered when zoomed. Image modal must be above overlay/backdrop. */}
      {isZoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsZoomed(false)}
          />

          {/* centered large image */}
            <div className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-900">
            <img
              src={imageUrl}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="block max-w-[90vw] max-h-[90vh] object-contain"
              style={{ filter: `contrast(${contrast})` }}
            />
            </div>
        </div>
      )}
    </div>
  );
}
