import { ImageViewer, type DefaultZoomOptions } from "./ImageViewer";
import type { ImageType, GalaxyData, UserPreferences } from "./types";

export const SMALL_IMAGE_DEFAULT_ZOOM: DefaultZoomOptions = {
  mode: "multiple",
  value: 2,
  applyIfOriginalSizeBelow: 500,
};

interface GalaxyImagesProps {
  imageTypes: ImageType[];
  displayGalaxy: GalaxyData;
  userPrefs: UserPreferences | null | undefined;
  contrast: number;
  showEllipseOverlay: boolean;
  shouldShowEllipse: (showEllipse: boolean | undefined) => boolean;
}

export function GalaxyImages({
  imageTypes,
  displayGalaxy,
  userPrefs,
  contrast,
  showEllipseOverlay,
  shouldShowEllipse,
}: GalaxyImagesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {imageTypes.map((imageType, index) => (
        <div 
          key={index} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
        >
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
  );
}
