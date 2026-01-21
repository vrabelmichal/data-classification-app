import { useState } from "react";
import { cn } from "../../lib/utils";
import { LSB_OPTIONS_LEGACY, LSB_OPTIONS_CHECKBOX, MORPHOLOGY_OPTIONS } from "./constants";
import type { GalaxyData } from "./types";

interface ClassificationFormProps {
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
  hideComments?: boolean;
  onLsbClassChange: (value: number) => void;
  onMorphologyChange: (value: number) => void;
  onAwesomeFlagChange: (value: boolean) => void;
  onValidRedshiftChange: (value: boolean) => void;
  onVisibleNucleusChange: (value: boolean) => void;
  onFailedFittingChange: (value: boolean) => void;
  onCommentsChange: (value: string) => void;
}

export function ClassificationForm({
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
  hideComments = false,
  onLsbClassChange,
  onMorphologyChange,
  onAwesomeFlagChange,
  onValidRedshiftChange,
  onVisibleNucleusChange,
  onFailedFittingChange,
  onCommentsChange,
}: ClassificationFormProps) {
  const LSB_OPTIONS = failedFittingMode === "legacy" ? LSB_OPTIONS_LEGACY : LSB_OPTIONS_CHECKBOX;
  const [commentExpanded, setCommentExpanded] = useState(false);
  
  return (
    <div className="space-y-6">
      {/* LSB Classification */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 pt-6"
        role="group"
        aria-label="LSB classification"
      >
        <span className="absolute top-3 right-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          LSB
        </span>
        <div className="space-y-3">
          {LSB_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="lsb"
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
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 pt-6"
        role="group"
        aria-label="Morphology"
      >
        <span className="absolute top-3 right-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Morphology
        </span>
        <div className="space-y-3">
          {MORPHOLOGY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="morphology"
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

      {/* Flags */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 pt-6"
        role="group"
        aria-label="Flags"
      >
        <span className="absolute top-3 right-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Flags
        </span>
        <div className="space-y-3">
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
                displayGalaxy.nucleus ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
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
        </div>
      </div>

      {/* Comments */}
      {!hideComments && (
        <div
          className="rounded-lg"
        >
          <div
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            onClick={(e) => {
              // keep expand button working without double toggles
              const target = e.target as HTMLElement;
              if (target.tagName === "BUTTON") return;
              const textarea = e.currentTarget.querySelector("textarea");
              textarea?.focus();
            }}
          >
            <textarea
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Add comments (optional)..."
              disabled={formLocked}
              className={cn(
                "w-full pr-16 pl-3 py-1.5 border-0 bg-transparent rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-transparent dark:text-white resize-none leading-tight min-h-[2.25rem]",
                commentExpanded ? "text-sm" : "text-xs"
              )}
              rows={commentExpanded ? 4 : 1}
            />
            <button
              type="button"
              onClick={() => {
                setCommentExpanded((prev) => !prev);
              }}
              className="absolute top-1 right-1 px-2 py-1 text-xs font-medium rounded-md text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700"
            >
              {commentExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
