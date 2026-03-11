import {
  RebuildGalaxyIdsTableSection,
  ClearGalaxyIdsAggregateSection,
  RebuildGalaxyIdsAggregateSection,
  ClearGalaxyAggregatesSection,
  RebuildGalaxyAggregatesSection,
  RebuildGalaxyBlacklistAggregateSection,
  LabelingAggregatesSection,
  RebuildTotalClassificationsAggregateSection,
  FastBackfillClassificationAggregatesSection,
  BackfillClassificationAggregatesSection,
} from "../debugging";

export function AggregateManagementPage() {
  return (
    <section>
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Aggregate Management</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Manage database aggregates used for pagination and performance optimization.</p>
      <div className="grid grid-cols-2 gap-6">
        <RebuildGalaxyIdsTableSection />
        <ClearGalaxyIdsAggregateSection />
        <RebuildGalaxyIdsAggregateSection />
        <ClearGalaxyAggregatesSection />
        <RebuildGalaxyAggregatesSection />
        <RebuildGalaxyBlacklistAggregateSection />
        <RebuildTotalClassificationsAggregateSection />
        <LabelingAggregatesSection />
        <FastBackfillClassificationAggregatesSection />
        <BackfillClassificationAggregatesSection />
      </div>
    </section>
  );
}
