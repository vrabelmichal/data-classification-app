import { usePageTitle } from "../hooks/usePageTitle";

export function Help() {
  usePageTitle("Help");
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Help & Guide</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Learn how to classify galaxies and contribute to scientific research
        </p>
      </div>

      <div className="space-y-8">
        {/* Getting Started */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🚀</span>
            Getting Started
          </h2>
          <div className="space-y-4 text-gray-600 dark:text-gray-300">
            <p>
              Welcome to Galaxy Classifier! You're contributing to real scientific research by helping astronomers 
              classify galaxies from telescope images. Here's how to get started:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Look at the galaxy image carefully</li>
              <li>Choose the LSB classification (Failed fitting, Non-LSB, or LSB)</li>
              <li>Choose the morphology (Featureless, Irregular, Spiral, or Elliptical)</li>
              <li>Set the awesome flag and valid redshift flags if applicable</li>
              <li>Add any comments or sky background notes if helpful</li>
              <li>Submit your classification or skip if unsure</li>
            </ol>
          </div>
        </div>

        {/* Classification Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🌌</span>
            Classification Categories
          </h2>
          
          <div className="space-y-6">
            {/* LSB Classification */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">LSB Classification</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    Failed Fitting (Press Q)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    The fitting process failed or could not be completed for this galaxy.
                  </p>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                    Non-LSB (Press W)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Normal surface brightness galaxy - not a Low Surface Brightness galaxy.
                  </p>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    LSB (Press E)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Low Surface Brightness galaxy - appears faint and diffuse.
                  </p>
                </div>
              </div>
            </div>

            {/* Morphology */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Morphology</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                    Featureless (Press 1)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No clear structural features visible - smooth appearance.
                  </p>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                    Not sure (Irr/other) (Press 2)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Irregular or uncertain morphology - doesn't fit other categories clearly.
                  </p>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                    LTG (Sp) (Press 3)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Late-type galaxy (Spiral) - shows spiral arms or disk structure.
                  </p>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                    ETG (Ell) (Press 4)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Early-type galaxy (Elliptical) - smooth, oval-shaped appearance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flags */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🏁</span>
            Classification Flags
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Awesome Flag (Press A)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Mark this galaxy as "awesome" if it shows particularly interesting or beautiful features 
                that might be worth highlighting for educational or outreach purposes.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Valid Redshift (Press R)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Check this if you believe the redshift measurement for this galaxy appears reliable 
                based on the image quality and galaxy features.
              </p>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">⌨️</span>
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">LSB Classification</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Failed Fitting</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Q</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Non-LSB</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">W</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">LSB</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">E</kbd>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Morphology</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Featureless</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">1</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Irregular</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">2</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Spiral</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">3</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Elliptical</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">4</kbd>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Actions</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Awesome flag</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">A</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Valid redshift</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">R</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Submit</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Skip</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Space</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Impact */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🔬</span>
            Your Scientific Impact
          </h2>
          <div className="text-gray-600 dark:text-gray-300 space-y-3">
            <p>
              Your classifications contribute to real astronomical research! Scientists use this data to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Study Low Surface Brightness galaxies and their properties</li>
              <li>Understand galaxy morphology and evolution</li>
              <li>Improve automated classification algorithms</li>
              <li>Create statistical samples for research papers</li>
              <li>Discover rare and unusual galaxy types</li>
            </ul>
            <p className="text-sm italic">
              Thank you for contributing to our understanding of the cosmos! 🌟
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
