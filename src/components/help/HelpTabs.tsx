import { HelpTab } from "./types";

const tabs: Array<{ key: HelpTab; label: string }> = [
  { key: "getting-started", label: "Getting Started" },
  { key: "classification", label: "Categories & Flags" },
  { key: "shortcuts", label: "Keyboard" },
  { key: "image-docs", label: "Image Documentation" },
];

type HelpTabsProps = {
  activeTab: HelpTab;
  onChange: (tab: HelpTab) => void;
};

export function HelpTabs({ activeTab, onChange }: HelpTabsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2">
      <nav className="flex flex-wrap gap-2" aria-label="Help sections">
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                selected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
