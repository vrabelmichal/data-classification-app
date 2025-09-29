import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export function AggregateInformationSection() {
  const aggregateInfo = useQuery(api.galaxies_aggregates.getAggregateInfo);

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Aggregate Information</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Galaxy Aggregates Status</h3>

        {aggregateInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Galaxy IDs Aggregate */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxy IDs</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxyIds.count.toLocaleString()}</div>
                <div>Min ID: {aggregateInfo.galaxyIds.min ?? 'N/A'}</div>
                <div>Max ID: {aggregateInfo.galaxyIds.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by ID */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by ID</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesById.count.toLocaleString()}</div>
              </div>
            </div>

            {/* Galaxies by RA */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by RA</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByRa.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByRa.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByRa.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Dec */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Dec</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByDec.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByDec.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByDec.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Reff */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Reff</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByReff.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByReff.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByReff.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Q */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Q</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByQ.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByQ.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByQ.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by PA */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by PA</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByPa.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByPa.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByPa.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Nucleus */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Nucleus</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Total: {aggregateInfo.galaxiesByNucleus.count.toLocaleString()}</div>
                <div>With Nucleus: {aggregateInfo.galaxiesByNucleus.trueCount.toLocaleString()}</div>
                <div>Without Nucleus: {aggregateInfo.galaxiesByNucleus.falseCount.toLocaleString()}</div>
              </div>
            </div>

            {/* Galaxies by Mag */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Mag</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByMag.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByMag.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByMag.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Mean Mue */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Mean μ</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByMeanMue.count.toLocaleString()}</div>
                <div>Min: {aggregateInfo.galaxiesByMeanMue.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByMeanMue.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-2"></div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Loading aggregate information...</div>
          </div>
        )}
      </div>
    </div>
  );
}