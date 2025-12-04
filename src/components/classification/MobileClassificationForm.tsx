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

  return (
    <div className="space-y-4">
      {/* LSB Classification */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 pt-3">
        <div className="absolute top-2 right-3 text-xs text-gray-500 dark:text-gray-400 select-none">
          Is it LSB?
        </div>
        <div className="space-y-2">
          {LSB_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="lsb-mobile"
                value={option.value}
                checked={lsbClass === option.value}
                onChange={() => onLsbClassChange(option.value)}
                disabled={formLocked}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="ml-3 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Morphology Classification */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 pt-3">
        <div className="absolute top-2 right-3 text-xs text-gray-500 dark:text-gray-400 select-none">
          Morphology Type
        </div>
        <div className="space-y-2">
          {MORPHOLOGY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="morphology-mobile"
                value={option.value}
                checked={morphology === option.value}
                onChange={() => onMorphologyChange(option.value)}
                disabled={formLocked}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="ml-3 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Flags + Comments Section */}
      {hasOptionalFlags && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="space-y-2">
            {failedFittingMode === "checkbox" && (
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={failedFitting}
                  onChange={(e) => onFailedFittingChange(e.target.checked)}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                  Failed fitting
                </span>
              </label>
            )}

            {showAwesomeFlag && (
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={awesomeFlag}
                  onChange={(e) => onAwesomeFlagChange(e.target.checked)}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                  Awesome
                </span>
              </label>
            )}

            {showValidRedshift && (
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={validRedshift}
                  onChange={(e) => onValidRedshiftChange(e.target.checked)}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                  Valid redshift
                </span>
              </label>
            )}

            {showVisibleNucleus && (
              <label
                className={cn(
                  "flex items-center cursor-pointer",
                  displayGalaxy.nucleus ? "bg-yellow-50 dark:bg-yellow-900/20 -mx-4 px-4 py-1" : ""
                )}
              >
                <input
                  type="checkbox"
                  checked={visibleNucleus}
                  onChange={(e) => onVisibleNucleusChange(e.target.checked)}
                  disabled={formLocked}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                  Visible nucleus
                </span>
              </label>
            )}

            {/* Comment Button Row */}
            <div className="flex items-center pt-1 border-t border-gray-100 dark:border-gray-700 mt-2">
              <button
                onClick={onOpenComments}
                disabled={formLocked}
                className={cn(
                  "flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  commentPreview && "text-blue-600 dark:text-blue-400"
                )}
              >
                <ChatIcon className="w-4 h-4 flex-shrink-0" />
                {commentPreview ? (
                  <span className="truncate max-w-[200px]">{commentPreview}</span>
                ) : (
                  <span>Add comment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment button standalone if no optional flags */}
      {!hasOptionalFlags && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={onOpenComments}
            disabled={formLocked}
            className={cn(
              "flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full",
              commentPreview && "text-blue-600 dark:text-blue-400"
            )}
          >
            <ChatIcon className="w-4 h-4 flex-shrink-0" />
            {commentPreview ? (
              <span className="truncate">{commentPreview}</span>
            ) : (
              <span>Add comment</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
