import { AggregateInformationSection, GalaxyCountDiagnosticsSection } from "./debugging";

export function SystemTab() {
  return (
    <div className="space-y-6">
      <GalaxyCountDiagnosticsSection />
      <AggregateInformationSection />
    </div>
  );
}
