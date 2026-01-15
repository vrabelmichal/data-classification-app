import { usePageTitle } from "../hooks/usePageTitle";
import { OverviewTab } from "./statistics/OverviewTab";

export function OverviewPage() {
  usePageTitle("Overview");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Labeling Overview</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Live aggregates for galaxy classifications.
        </p>
      </div>
      <OverviewTab />
    </div>
  );
}
