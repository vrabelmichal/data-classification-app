import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export function AggregateInformationSection() {
  const aggregateInfo = useQuery(api.galaxies.aggregates.getAggregateInfo);
  const searchBounds = useQuery(api.galaxies.browse.getGalaxySearchBounds);

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

            {/* Galaxies by Total Classifications */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Total Classifications</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByTotalClassifications?.count.toLocaleString() ?? 'N/A'}</div>
                <div>Min: {aggregateInfo.galaxiesByTotalClassifications?.min ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByTotalClassifications?.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Num Visible Nucleus */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Num Visible Nucleus</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByNumVisibleNucleus?.count.toLocaleString() ?? 'N/A'}</div>
                <div>Min: {aggregateInfo.galaxiesByNumVisibleNucleus?.min ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByNumVisibleNucleus?.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Num Awesome Flag */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Num Awesome Flag</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByNumAwesomeFlag?.count.toLocaleString() ?? 'N/A'}</div>
                <div>Min: {aggregateInfo.galaxiesByNumAwesomeFlag?.min ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByNumAwesomeFlag?.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Galaxies by Total Assigned */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Galaxies by Total Assigned</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Count: {aggregateInfo.galaxiesByTotalAssigned?.count.toLocaleString() ?? 'N/A'}</div>
                <div>Min: {aggregateInfo.galaxiesByTotalAssigned?.min ?? 'N/A'}</div>
                <div>Max: {aggregateInfo.galaxiesByTotalAssigned?.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds RA */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - RA</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.ra.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.ra.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Dec */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Dec</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.dec.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.dec.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Reff */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Reff</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.reff.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.reff.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Q */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Q</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.q.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.q.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds PA */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - PA</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.pa.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.pa.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Mag */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Mag</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.mag.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.mag.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Mean μ */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Mean μ</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.mean_mue.min?.toFixed(4) ?? 'N/A'}</div>
                <div>Max: {searchBounds?.mean_mue.max?.toFixed(4) ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Nucleus */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Nucleus</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Has Nucleus: {searchBounds?.nucleus.hasNucleus ? 'Yes' : 'No'}</div>
                <div>Total Count: {searchBounds?.nucleus.totalCount.toLocaleString() ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Total Classifications */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Total Classifications</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.totalClassifications.min ?? 'N/A'}</div>
                <div>Max: {searchBounds?.totalClassifications.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Num Visible Nucleus */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Num Visible Nucleus</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.numVisibleNucleus.min ?? 'N/A'}</div>
                <div>Max: {searchBounds?.numVisibleNucleus.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Num Awesome Flag */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Num Awesome Flag</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.numAwesomeFlag.min ?? 'N/A'}</div>
                <div>Max: {searchBounds?.numAwesomeFlag.max ?? 'N/A'}</div>
              </div>
            </div>

            {/* Search Bounds Total Assigned */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Bounds - Total Assigned</h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>Min: {searchBounds?.totalAssigned.min ?? 'N/A'}</div>
                <div>Max: {searchBounds?.totalAssigned.max ?? 'N/A'}</div>
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