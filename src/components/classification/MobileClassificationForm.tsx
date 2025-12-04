import { cn } from "../../lib/utils";
import { LSB_OPTIONS_LEGACY, LSB_OPTIONS_CHECKBOX, MORPHOLOGY_OPTIONS } from "./constants";
import type { GalaxyData } from "./types";

// Chat/Comment Icon
function ChatIcon({ className }: { className?: string }) {
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
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

// Compact label map for mobile buttons
const MOBILE_LSB_LABELS: Record<number, string> = {
  [-1]: "Failed",
  0: "Non-LSB",
  1: "LSB",
};

const MOBILE_MORPHOLOGY_LABELS: Record<number, string> = {
  [-1]: "Featureless",
  0: "Irr/other",
  1: "LTG (Sp)",
  2: "ETG (Ell)",
};

interface MobileClassificationFormProps {
  lsbClass: number | null;
  morphology: number | null;
  awesomeFlag: boolean;
  validRedshift: boolean;
  visibleNucleus: boolean;
  failedFitting: boolean;
  comments: string;
  formLocked: boolean;
  displayGalaxy: GalaxyData;
  failedFittingMode: "legacy" | "checkbox";
  showAwesomeFlag?: boolean;
  showValidRedshift?: boolean;
  showVisibleNucleus?: boolean;
  onLsbClassChange: (value: number) => void;
  onMorphologyChange: (value: number) => void;
  onAwesomeFlagChange: (value: boolean) => void;
  onValidRedshiftChange: (value: boolean) => void;
  onVisibleNucleusChange: (value: boolean) => void;
  onFailedFittingChange: (value: boolean) => void;
  onOpenComments: () => void;
}

export function MobileClassificationForm({
  lsbClass,
  morphology,
  awesomeFlag,
  validRedshift,
  visibleNucleus,
  failedFitting,
  comments,
  formLocked,
  displayGalaxy,
  failedFittingMode,
  showAwesomeFlag = true,
  showValidRedshift = true,
  showVisibleNucleus = true,
  onLsbClassChange,
  onMorphologyChange,
  onAwesomeFlagChange,
  onValidRedshiftChange,
  onVisibleNucleusChange,
  onFailedFittingChange,
  onOpenComments,
}: MobileClassificationFormProps) {
  const LSB_OPTIONS = failedFittingMode === "legacy" ? LSB_OPTIONS_LEGACY : LSB_OPTIONS_CHECKBOX;

  // Check if any optional flags are shown
  const hasOptionalFlags = showAwesomeFlag || showValidRedshift || showVisibleNucleus || failedFittingMode === "checkbox";

  // Truncate comment for preview
  const commentPreview = comments.trim();

  // Build flags array for grid layout
  const flagItems: Array<{
    key: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    highlight?: boolean;
  }> = [];

  if (failedFittingMode === "checkbox") {
    flagItems.push({
      key: "failed",
      label: "Failed",
      checked: failedFitting,
      onChange: onFailedFittingChange,
    });
  }
  if (showAwesomeFlag) {
    flagItems.push({
      key: "awesome",
      label: "Awesome",
      checked: awesomeFlag,
      onChange: onAwesomeFlagChange,
    });
  }
  if (showValidRedshift) {
    flagItems.push({
      key: "redshift",
      label: "Valid z",
      checked: validRedshift,
      onChange: onValidRedshiftChange,
    });
  }
  if (showVisibleNucleus) {
    flagItems.push({
      key: "nucleus",
      label: "Nucleus",
      checked: visibleNucleus,
      onChange: onVisibleNucleusChange,
      highlight: displayGalaxy.nucleus,
    });
  }

  return (
    <div className="space-y-2">
      {/* LSB Classification - Grid of pill buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 w-12">LSB?</span>
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {LSB_OPTIONS.map((option) => {
              const isSelected = lsbClass === option.value;
              const colorClass = option.color; // e.g. 'bg-green-500'
              const colorLight = colorClass.replace("-500", "-50"); // e.g. 'bg-green-50'
              const borderColor = colorClass.replace("bg-", "border-"); // e.g. 'border-green-500'
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLsbClassChange(option.value)}
                  disabled={formLocked}
                  className={cn(
                    "h-10 px-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    "border-2 active:scale-95",
                    isSelected
                      ? cn(borderColor, colorClass, "text-white dark:text-white")
                      : cn("border-gray-200 dark:border-gray-600", colorLight, "text-gray-700 dark:text-gray-300"),
                    formLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="truncate">{MOBILE_LSB_LABELS[option.value] ?? option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Morphology Classification - Grid of pill buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 w-12">Morph</span>
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {MORPHOLOGY_OPTIONS.map((option) => {
              const isSelected = morphology === option.value;
              const colorClass = option.color; // e.g. 'bg-blue-500'
              const colorLight = colorClass.replace("-500", "-50");
              const borderColor = colorClass.replace("bg-", "border-");
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onMorphologyChange(option.value)}
                  disabled={formLocked}
                  className={cn(
                    "h-10 px-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    "border-2 active:scale-95",
                    isSelected
                      ? cn(borderColor, colorClass, "text-white dark:text-white")
                      : cn("border-gray-200 dark:border-gray-600", colorLight, "text-gray-700 dark:text-gray-300"),
                    formLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="truncate">{MOBILE_MORPHOLOGY_LABELS[option.value] ?? option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Flags + Comments Section - Compact grid */}
      {hasOptionalFlags && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 w-12">Flags</span>
            <div className="grid grid-cols-2 gap-1.5 flex-1">
              {flagItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => item.onChange(!item.checked)}
                  disabled={formLocked}
                  className={cn(
                    "h-10 px-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                    "border-2 active:scale-95",
                    item.checked
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
                    item.highlight && !item.checked && "border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
                    formLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 text-xs",
                    item.checked
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-300 dark:border-gray-500"
                  )}>
                    {item.checked && "✓"}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
              {/* Comment button in grid */}
              <button
                type="button"
                onClick={onOpenComments}
                disabled={formLocked}
                className={cn(
                  "h-10 px-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                  "border-2 active:scale-95",
                  commentPreview
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
                  formLocked && "opacity-50 cursor-not-allowed",
                  flagItems.length % 2 === 0 && "col-span-2"
                )}
              >
                <ChatIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{commentPreview || "Comment"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment button standalone if no optional flags */}
      {!hasOptionalFlags && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0 w-12"></span>
            <button
              type="button"
              onClick={onOpenComments}
              disabled={formLocked}
              className={cn(
                "h-10 px-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 flex-1",
                "border-2 active:scale-95",
                commentPreview
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
                formLocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChatIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{commentPreview || "Comment"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
