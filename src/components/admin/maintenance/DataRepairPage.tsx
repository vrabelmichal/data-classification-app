import {
  FillGalaxyMagMeanMueSection,
  FillGalaxyNumericIdSection,
  FastBackfillGalaxyClassificationsSection,
  BackfillGalaxyClassificationsSection,
  BackfillUserGalaxyClassificationsSection,
  FastBackfillUserClassificationCountersSection,
  BackfillUserClassificationCountersSection,
} from "../debugging";

export function DataRepairPage() {
  return (
    <section>
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Data Repair & Backfill</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Tools for fixing missing or inconsistent data in the database.</p>
      <div className="grid grid-cols-2 gap-6">
        <FillGalaxyMagMeanMueSection />
        <FillGalaxyNumericIdSection />
        <FastBackfillGalaxyClassificationsSection />
        <BackfillGalaxyClassificationsSection />
        <BackfillUserGalaxyClassificationsSection />
        <FastBackfillUserClassificationCountersSection />
        <BackfillUserClassificationCountersSection />
      </div>
    </section>
  );
}
