import { cn } from "../../lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, AladinLogo } from "./icons";

interface MobileSliderControlsProps {
  currentIndex: number;
  totalImages: number;
  currentContrastGroup: number;
  totalContrastGroups: number;
  onPrevImage: () => void;
  onNextImage: () => void;
  onContrastClick: () => void;
  onAladinClick: () => void;
}

// icons are now imported from ./icons



export function MobileSliderControls({
  currentIndex,
  totalImages,
  currentContrastGroup,
  totalContrastGroups,
  onPrevImage,
  onNextImage,
  onContrastClick,
  onAladinClick,
}: MobileSliderControlsProps) {
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalImages - 1;

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Previous Image Button */}
      <button
        onClick={onPrevImage}
        disabled={!canGoPrev}
        className={cn(
          "p-2.5 rounded-lg transition-colors backdrop-blur-sm",
          canGoPrev
            ? "bg-white/80 hover:bg-white/90 text-gray-700"
            : "bg-white/40 text-gray-400 cursor-not-allowed"
        )}
        aria-label="Previous image"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      {/* View/Contrast Button */}
      <button
        onClick={onContrastClick}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/80 hover:bg-white/90 text-gray-700 font-medium transition-colors backdrop-blur-sm"
        aria-label={`Change view (${currentContrastGroup + 1} of ${totalContrastGroups})`}
      >
        <EyeIcon className="w-4 h-4" />
        <span className="text-sm">{currentContrastGroup + 1}/{totalContrastGroups}</span>
      </button>

      {/* Aladin Button */}
      <button
        onClick={onAladinClick}
        className="h-[42px] px-2.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-600/90 text-white transition-colors backdrop-blur-sm flex items-center justify-center"
        aria-label="Open in Aladin"
      >
        <AladinLogo className="h-5 w-auto" />
      </button>

      {/* Next Image Button */}
      <button
        onClick={onNextImage}
        disabled={!canGoNext}
        className={cn(
          "p-2.5 rounded-lg transition-colors backdrop-blur-sm",
          canGoNext
            ? "bg-white/80 hover:bg-white/90 text-gray-700"
            : "bg-white/40 text-gray-400 cursor-not-allowed"
        )}
        aria-label="Next image"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
