interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { key: "P", description: "Previous galaxy in sequence" },
        { key: "N", description: "Next galaxy in sequence" },
        { key: "S", description: "Skip current galaxy" },
        { key: "Shift+P", description: "Global Previous (works anywhere)" },
        { key: "Shift+N", description: "Global Next (works anywhere)" },
        { key: "Shift+S", description: "Global Skip (works anywhere)" },
      ],
    },
    {
      category: "Image Controls",
      items: [
        { key: "C", description: "Cycle contrast groups" },
      ],
    },
    {
      category: "Quick Input",
      items: [
        { key: "Focus on input field", description: "Type classification directly (only -,0,1,a,r,n allowed)" },
        { key: "A (in input)", description: "Toggle Awesome flag" },
        { key: "R (in input)", description: "Toggle Valid redshift flag" },
        { key: "N (in input)", description: "Toggle Visible nucleus flag" },
        { key: "C (in input)", description: "Cycle contrast groups" },
        { key: "Enter (in input)", description: "Submit classification" },
      ],
    },
    {
      category: "Help",
      items: [
        { key: "?", description: "Show this help dialog" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 pr-6 rounded-b-lg">
          <div className="space-y-6 pr-2">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {item.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Quick Input Format
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Type directly in the "Input by typing" field (only these characters allowed: -, 0, 1, a, r, n):
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">-1</code> = Failed fitting, Featureless</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">0-</code> = Non-LSB, Featureless</li>
                <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">12arn</code> = LSB, ETG (Ell), Awesome, Valid redshift, Visible nucleus</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                <strong>Global shortcuts:</strong> Shift+P/N/S work anywhere in the interface. <strong>Quick input:</strong> Only allowed characters can be typed - others are filtered out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
