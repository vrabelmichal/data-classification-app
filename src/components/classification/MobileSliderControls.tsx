import { cn } from "../../lib/utils";

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

// Chevron Left Icon
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// Chevron Right Icon
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// Eye Icon (for View/Contrast)
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

// External Link Icon (for Aladin)
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

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
        className="p-2.5 rounded-lg bg-blue-500/90 hover:bg-blue-600/90 text-white transition-colors backdrop-blur-sm"
        aria-label="Open in Aladin"
      >
        <ExternalLinkIcon className="w-5 h-5" />
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
