import { cn } from "../../lib/utils";
import { LSB_OPTIONS_LEGACY, LSB_OPTIONS_CHECKBOX, MORPHOLOGY_OPTIONS } from "./constants";
import { buildQuickInputString } from "./helpers";
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
  onLsbClassChange,
  onMorphologyChange,
  onAwesomeFlagChange,
  onValidRedshiftChange,
  onVisibleNucleusChange,
  onFailedFittingChange,
  onCommentsChange,
}: ClassificationFormProps) {
  const LSB_OPTIONS = failedFittingMode === "legacy" ? LSB_OPTIONS_LEGACY : LSB_OPTIONS_CHECKBOX;
  
  return (
    <div className="space-y-6">
      {/* LSB Classification */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Is it LSB?
        </h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Morphology Type
        </h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
          Comments
        </h4>
        <textarea
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
          placeholder="Add any observations or comments..."
          disabled={formLocked}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
