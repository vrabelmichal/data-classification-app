import { HelpFeatureFlags } from "../types";

type KeyboardShortcutsSectionProps = {
  settings: HelpFeatureFlags;
};

export function KeyboardShortcutsSection({ settings }: KeyboardShortcutsSectionProps) {
  const { failedFittingMode, showAwesomeFlag, showValidRedshift, showVisibleNucleus } = settings;

  const allowedCharacters = [
    "-",
    "0",
    "1",
    "2",
    ...(showAwesomeFlag ? ["a"] : []),
    ...(showValidRedshift ? ["r"] : []),
    ...(showVisibleNucleus ? ["n"] : []),
    ...(failedFittingMode === "checkbox" ? ["f"] : []),
  ].join(",");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="mr-2">⌨️</span>
        Keyboard Shortcuts
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Navigation & Actions</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Previous galaxy</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+P</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Next galaxy</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+N</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Submit</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Skip</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">S</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Global Skip</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+S</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Open current galaxy in Aladin</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+A</kbd>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">View Controls</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Cycle contrast groups</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">C</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Previous contrast group</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+C</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Show keyboard help</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">?</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Toggle masking</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+M</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Toggle effective radius overlay</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+R</kbd>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Quick Input Field</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Allowed characters</span>
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {allowedCharacters}
              </span>
            </div>
            {showAwesomeFlag && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Awesome flag</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">A</kbd>
              </div>
            )}
            {showValidRedshift && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Valid redshift</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">R</kbd>
              </div>
            )}
            {showVisibleNucleus && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Visible nucleus</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">N</kbd>
              </div>
            )}
            {failedFittingMode === "checkbox" && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Failed fitting</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">F</kbd>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Only allowed characters can be typed. Shift shortcuts work globally.
          </p>
        </div>
      </div>
    </div>
  );
}
