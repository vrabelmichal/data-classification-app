import { HelpFeatureFlags } from "../types";
import { KidsExamplesCarousel } from "../KidsExamplesCarousel";

type ClassificationSectionProps = {
  settings: HelpFeatureFlags;
};

export function ClassificationSection({ settings }: ClassificationSectionProps) {
  const { failedFittingMode, showAwesomeFlag, showValidRedshift, showVisibleNucleus } = settings;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🌌</span>
          Classification Categories
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">LSB Classification</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {failedFittingMode === "legacy" && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    Failed Fitting
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    The fitting process failed or could not be completed for this galaxy.
                  </p>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                  Non-LSB
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Anything that is not a galaxy.</p>
              </div>

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  LSB
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Anything that looks like a galaxy.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {failedFittingMode === "legacy"
                ? 'Set the LSB classification in the form, or in quick input (first character: "-" failed fitting, "0" Non-LSB, "1" LSB).'
                : 'Set the LSB classification in the form, or in quick input (first character: "0" Non-LSB, "1" LSB). Failed fitting is a separate checkbox or "f" quick-input flag.'}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Morphology</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                  Featureless
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">No clear structural features visible - smooth appearance.</p>
              </div>

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  Not sure (Irr/other)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Irregular or uncertain morphology - does not fit other categories clearly.
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  LTG (Sp)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Late-type galaxy (Spiral) - shows spiral arms or disk structure.
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                  ETG (Ell)
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Early-type galaxy (Elliptical) - smooth, oval-shaped appearance.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Set morphology in the form, or in quick input (second character: "-" Featureless, "0" Not sure, "1" LTG, "2" ETG).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🏁</span>
          Classification Flags
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {failedFittingMode === "checkbox" && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Failed Fitting (Press F)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Check this if the fitting process failed or could not be completed for this galaxy.
              </p>
            </div>
          )}
          {showAwesomeFlag && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Awesome Flag (Press A)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Mark this galaxy as interesting or visually notable for future review.
              </p>
            </div>
          )}
          {showValidRedshift && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Valid Redshift (Press R)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Check this if the redshift estimate appears reliable for this object.
              </p>
            </div>
          )}
          {showVisibleNucleus && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Visible Nucleus (Press N)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Check this if a clear nucleus or central concentration is visible.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <KidsExamplesCarousel />
    </>
  );
}
