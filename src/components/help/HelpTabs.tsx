import { Link, useLocation } from "react-router";
import { HelpTab } from "./types";

const tabs: Array<{ key: HelpTab; label: string; path: string }> = [
  { key: "getting-started", label: "Getting Started", path: "/help" },
  { key: "classification", label: "Categories & Flags", path: "/help/classification" },
  { key: "shortcuts", label: "Keyboard", path: "/help/shortcuts" },
  { key: "image-docs", label: "Image Documentation", path: "/help/image-docs" },
];

export function HelpTabs() {
  const location = useLocation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2">
      <nav className="flex flex-wrap gap-2" aria-label="Help sections">
        {tabs.map((tab) => {
          const selected = location.pathname === tab.path;
          return (
            <Link
              key={tab.key}
              to={tab.path}
              className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                selected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
