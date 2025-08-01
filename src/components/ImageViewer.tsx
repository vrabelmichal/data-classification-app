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
      
      <img
        src={imageUrl}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onClick={handleImageClick}
        className={`w-full h-full object-cover rounded-lg cursor-pointer transition-all duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${isZoomed ? 'scale-150 z-10' : 'scale-100'}`}
        style={{
          filter: `contrast(${contrast})`,
        }}
      />
      
      {isZoomed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsZoomed(false)}
        />
      )}
    </div>
  );
}
