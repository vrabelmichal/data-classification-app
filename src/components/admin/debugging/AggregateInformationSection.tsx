import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";

type StatRow = {
  label: string;
  value: ReactNode;
};

type StatCardProps = {
  title: string;
  description: string;
  rows: StatRow[];
};

const StatCard = ({ title, description, rows }: StatCardProps) => (
  <div className="bg-gray-50 dark:bg-gray-700 rounded p-4 h-full flex flex-col">
    <div className="mb-3">
      <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">{description}</p>
    </div>
    <dl className="text-sm text-gray-600 dark:text-gray-300 space-y-1 flex-1">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3">
          <dt className="pt-0.5">{row.label}</dt>
          <dd className="text-right leading-tight">{row.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const primaryValue = (text: string) => <span className="font-medium text-gray-900 dark:text-white">{text}</span>;

const twoLineValue = (primary: string, secondary: string) => (
  <span className="flex flex-col items-end text-right leading-tight">
    <span className="font-medium text-gray-900 dark:text-white">{primary}</span>
    <span className="text-xs text-gray-500 dark:text-gray-400">{secondary}</span>
  </span>
);

const formatValue = (value: number | bigint | string | boolean | null | undefined, digits?: number): ReactNode => {
  if (value === null || value === undefined) return primaryValue("N/A");
  if (typeof value === "boolean") return primaryValue(value ? "true" : "false");
  if (typeof value === "number") {
    if (Number.isNaN(value)) return primaryValue("N/A");
    if (typeof digits === "number") return primaryValue(value.toFixed(digits));
    return primaryValue(value.toLocaleString());
  }
  if (typeof value === "bigint") return primaryValue(value.toLocaleString());
  return primaryValue(value);
};

const formatTimestampValue = (value: number | null | undefined): ReactNode => {
  if (value === null || value === undefined) return primaryValue("N/A");
  if (Number.isNaN(value)) return primaryValue("N/A");

  // Convex _creationTime and app timestamps are ms since epoch.
  // If we ever get seconds, normalize.
  const millis = value > 1e12 ? value : value > 1e9 ? value * 1000 : value;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return formatValue(value);

  const human = date.toLocaleString();
  const raw = value.toLocaleString();
  return twoLineValue(human, raw);
};

export function AggregateInformationSection() {
  const aggregateInfo = useQuery(api.galaxies.aggregates.getAggregateInfo);
  const searchBounds = useQuery(api.galaxies.browse.getGalaxySearchBounds);

  if (!aggregateInfo) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-2"></div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Loading aggregate information...</div>
          </div>
        </div>
    );
  }

  const aggregateCards: StatCardProps[] = [
    {
      title: "Galaxy IDs",
      description: "Backs numeric ID allocation in ingestion and user sequences (convex/galaxies/core.ts, sequence.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxyIds.count) },
        { label: "Min ID", value: formatValue(aggregateInfo.galaxyIds.min) },
        { label: "Max ID", value: formatValue(aggregateInfo.galaxyIds.max) },
      ],
    },
    {
      title: "Galaxies by ID",
      description: "String ID ordering used in aggregate rebuilds and sanity checks for ingestion consistency.",
      rows: [{ label: "Count", value: formatValue(aggregateInfo.galaxiesById.count) }],
    },
    {
      title: "Galaxies by Numeric ID",
      description: "Numeric ID ordering kept in sync on create/update (convex/galaxies/core.ts) and during maintenance jobs.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByNumericId.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByNumericId.min) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByNumericId.max) },
      ],
    },
    {
      title: "Galaxies by RA",
      description: "Feeds RA range presets in the galaxy browser filters (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByRa.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByRa.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByRa.max, 4) },
      ],
    },
    {
      title: "Galaxies by Dec",
      description: "Used for Dec filter defaults and to verify aggregate rebuild coverage (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByDec.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByDec.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByDec.max, 4) },
      ],
    },
    {
      title: "Galaxies by Reff",
      description: "Powers size range suggestions in browse filters (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByReff.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByReff.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByReff.max, 4) },
      ],
    },
    {
      title: "Galaxies by Q",
      description: "Axis-ratio bounds reused by the galaxy browser filter UI (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByQ.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByQ.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByQ.max, 4) },
      ],
    },
    {
      title: "Galaxies by PA",
      description: "Position-angle aggregate used for filter defaults and integrity checks (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByPa.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByPa.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByPa.max, 4) },
      ],
    },
    {
      title: "Galaxies by Nucleus",
      description: "Tracks nucleus flag coverage for browse filters and backfill safety checks (convex/galaxies/browse.ts).",
      rows: [
        { label: "Total", value: formatValue(aggregateInfo.galaxiesByNucleus.count) },
        { label: "With Nucleus", value: formatValue(aggregateInfo.galaxiesByNucleus.trueCount) },
        { label: "Without Nucleus", value: formatValue(aggregateInfo.galaxiesByNucleus.falseCount) },
      ],
    },
    {
      title: "Galaxies by Mag",
      description: "Magnitude bounds used to prefill brightness filters (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByMag.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByMag.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByMag.max, 4) },
      ],
    },
    {
      title: "Galaxies by Mean μ",
      description: "Surface-brightness bounds reused in browse filters and maintenance checks (convex/galaxies/browse.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByMeanMue.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByMeanMue.min, 4) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByMeanMue.max, 4) },
      ],
    },
    {
      title: "Total Classifications",
      description: "Updated when classifications are written (convex/classification.ts) and used for filter bounds in browse.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByTotalClassifications?.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByTotalClassifications?.min) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByTotalClassifications?.max) },
      ],
    },
    {
      title: "Visible Nucleus Counts",
      description: "Maintained during classification updates (convex/classification.ts) for nucleus-count filters.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByNumVisibleNucleus?.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByNumVisibleNucleus?.min) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByNumVisibleNucleus?.max) },
      ],
    },
    {
      title: "Awesome Flag Counts",
      description: "Tracks how many times galaxies were flagged awesome; refreshed in classification flow (convex/classification.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByNumAwesomeFlag?.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByNumAwesomeFlag?.min) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByNumAwesomeFlag?.max) },
      ],
    },
    {
      title: "Total Assigned",
      description: "Assignment totals used in browse filters and checked during maintenance backfills (convex/galaxies/maintenance.ts).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.galaxiesByTotalAssigned?.count) },
        { label: "Min", value: formatValue(aggregateInfo.galaxiesByTotalAssigned?.min) },
        { label: "Max", value: formatValue(aggregateInfo.galaxiesByTotalAssigned?.max) },
      ],
    },
    {
      title: "Classifications • Awesome Flag",
      description: "Boolean aggregate of awesome_flag across all classifications.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByAwesomeFlag?.count) },
        { label: "True", value: formatValue(aggregateInfo.classificationsByAwesomeFlag?.trueCount) },
        { label: "False", value: formatValue(aggregateInfo.classificationsByAwesomeFlag?.falseCount) },
      ],
    },
    {
      title: "Classifications • Visible Nucleus",
      description: "Boolean aggregate of visible_nucleus across classifications.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByVisibleNucleus?.count) },
        { label: "True", value: formatValue(aggregateInfo.classificationsByVisibleNucleus?.trueCount) },
        { label: "False", value: formatValue(aggregateInfo.classificationsByVisibleNucleus?.falseCount) },
      ],
    },
    {
      title: "Classifications • Failed Fitting",
      description: "Boolean aggregate of failed_fitting flag.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByFailedFitting?.count) },
        { label: "True", value: formatValue(aggregateInfo.classificationsByFailedFitting?.trueCount) },
        { label: "False", value: formatValue(aggregateInfo.classificationsByFailedFitting?.falseCount) },
      ],
    },
    {
      title: "Classifications • Valid Redshift",
      description: "Boolean aggregate of valid_redshift flag.",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByValidRedshift?.count) },
        { label: "True", value: formatValue(aggregateInfo.classificationsByValidRedshift?.trueCount) },
        { label: "False", value: formatValue(aggregateInfo.classificationsByValidRedshift?.falseCount) },
      ],
    },
    {
      title: "Classifications • LSB Class",
      description: "Enum aggregate of lsb_class (-1,0,1).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByLsbClass?.count) },
        { label: "Min", value: formatValue(aggregateInfo.classificationsByLsbClass?.min) },
        { label: "Max", value: formatValue(aggregateInfo.classificationsByLsbClass?.max) },
        { label: "-1", value: formatValue(aggregateInfo.classificationsByLsbClass?.neg1Count) },
        { label: "0", value: formatValue(aggregateInfo.classificationsByLsbClass?.zeroCount) },
        { label: "1", value: formatValue(aggregateInfo.classificationsByLsbClass?.pos1Count) },
      ],
    },
    {
      title: "Classifications • Morphology",
      description: "Enum aggregate of morphology (-1,0,1,2).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByMorphology?.count) },
        { label: "Min", value: formatValue(aggregateInfo.classificationsByMorphology?.min) },
        { label: "Max", value: formatValue(aggregateInfo.classificationsByMorphology?.max) },
        { label: "-1", value: formatValue(aggregateInfo.classificationsByMorphology?.neg1Count) },
        { label: "0", value: formatValue(aggregateInfo.classificationsByMorphology?.zeroCount) },
        { label: "1", value: formatValue(aggregateInfo.classificationsByMorphology?.pos1Count) },
        { label: "2", value: formatValue(aggregateInfo.classificationsByMorphology?.twoCount) },
      ],
    },
    {
      title: "Classifications • Created Timeline",
      description: "Creation-time aggregate for classifications (used for chronological rebuilds).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.classificationsByCreated?.count) },
        { label: "Min ts", value: formatTimestampValue(aggregateInfo.classificationsByCreated?.min) },
        { label: "Max ts", value: formatTimestampValue(aggregateInfo.classificationsByCreated?.max) },
      ],
    },
    {
      title: "User Profiles • Classifications Count",
      description: "Aggregate on userProfiles.classificationsCount (for leaderboard ordering).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.userProfilesByClassificationsCount?.count) },
        { label: "Min", value: formatValue(aggregateInfo.userProfilesByClassificationsCount?.min) },
        { label: "Max", value: formatValue(aggregateInfo.userProfilesByClassificationsCount?.max) },
      ],
    },
    {
      title: "User Profiles • Last Active",
      description: "Aggregate on userProfiles.lastActiveAt (for recency ordering).",
      rows: [
        { label: "Count", value: formatValue(aggregateInfo.userProfilesByLastActive?.count) },
        { label: "Min", value: formatTimestampValue(aggregateInfo.userProfilesByLastActive?.min) },
        { label: "Max", value: formatTimestampValue(aggregateInfo.userProfilesByLastActive?.max) },
      ],
    },
  ];

  const searchBoundCards: StatCardProps[] = [
    {
      title: "Search Bounds • RA",
      description: "Min/max RA used to seed the galaxy browser filters (useGalaxyBrowser.ts).",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.ra.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.ra.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Dec",
      description: "Declination limits pulled into browse filter placeholders.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.dec.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.dec.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Reff",
      description: "Effective radius presets for browse filters (convex/galaxies/browse.ts).",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.reff.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.reff.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Q",
      description: "Axis-ratio bounds applied to the browser search form.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.q.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.q.max, 4) },
      ],
    },
    {
      title: "Search Bounds • PA",
      description: "Position-angle defaults derived from aggregates for filter UX.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.pa.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.pa.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Mag",
      description: "Magnitude limits feeding brightness filters in the browser UI.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.mag.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.mag.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Mean μ",
      description: "Surface-brightness presets for filter placeholders (useGalaxyBrowser.ts).",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.mean_mue.min, 4) },
        { label: "Max", value: formatValue(searchBounds?.mean_mue.max, 4) },
      ],
    },
    {
      title: "Search Bounds • Nucleus",
      description: "Nucleus presence counts that drive the nucleus filter radio options.",
      rows: [
        { label: "Has Nucleus", value: searchBounds ? (searchBounds.nucleus.hasNucleus ? "Yes" : "No") : "N/A" },
        { label: "Total Count", value: formatValue(searchBounds?.nucleus.totalCount) },
      ],
    },
    {
      title: "Search Bounds • Total Classifications",
      description: "Prefills classification-count filters in the browser (useGalaxyBrowser.ts).",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.totalClassifications.min) },
        { label: "Max", value: formatValue(searchBounds?.totalClassifications.max) },
      ],
    },
    {
      title: "Search Bounds • Visible Nucleus",
      description: "Supports filters that look at the number of visible nuclei per galaxy.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.numVisibleNucleus.min) },
        { label: "Max", value: formatValue(searchBounds?.numVisibleNucleus.max) },
      ],
    },
    {
      title: "Search Bounds • Awesome Flag",
      description: "Bounds for how often galaxies were flagged as awesome, reused in browse filters.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.numAwesomeFlag.min) },
        { label: "Max", value: formatValue(searchBounds?.numAwesomeFlag.max) },
      ],
    },
    {
      title: "Search Bounds • Total Assigned",
      description: "Assignment-count bounds shown in the browser filter presets.",
      rows: [
        { label: "Min", value: formatValue(searchBounds?.totalAssigned.min) },
        { label: "Max", value: formatValue(searchBounds?.totalAssigned.max) },
      ],
    },
  ];

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-10">
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Aggregate Information</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Live Convex aggregates that power ingestion, maintenance, and the galaxy browser filter defaults.
              Values come from `convex/galaxies/aggregates.ts` and are refreshed by rebuild/backfill flows.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aggregateCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search Bounds</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Min/max values returned by `convex/galaxies/browse.getGalaxySearchBounds` and consumed by the
              galaxy browser hook (`src/components/browse/useGalaxyBrowser.ts`) to prefill filter inputs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchBoundCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}