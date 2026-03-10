import { MaintenanceModeSection } from "../MaintenanceModeSection";
import { TestEmailSection } from "../debugging";
import { SeedGalaxyAssignmentStatsSection } from "../debugging";

export function MaintenanceModeAndRegularPage() {
  return (
    <div>
      {/* Maintenance Mode Toggles */}
      <MaintenanceModeSection />

      {/* Regular Maintenance Section */}
      <section className="mt-12">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Regular Maintenance</h2>
        <div className="grid grid-cols-2 gap-6">
          <TestEmailSection />
          <SeedGalaxyAssignmentStatsSection />
        </div>
      </section>
    </div>
  );
}
