import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

export function DebuggingTab() {
  const [generatingMock, setGeneratingMock] = useState(false);
  const [clearingAggregate, setClearingAggregate] = useState(false);
  const [deletingGalaxies, setDeletingGalaxies] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [seedingStats, setSeedingStats] = useState(false);
  const [seedingCursor, setSeedingCursor] = useState<string | null>(null);
  const [clearingGalaxyAggregates, setClearingGalaxyAggregates] = useState(false);
  const [rebuildingGalaxyAggregates, setRebuildingGalaxyAggregates] = useState(false);
  const [fillingMagMeanMue, setFillingMagMeanMue] = useState(false);
  const [fillingCursor, setFillingCursor] = useState<string | null>(null);

  const generateMockGalaxies = useMutation(api.galaxies_mock.generateMockGalaxies);
  const clearGalaxyIdsAggregate = useMutation(api.galaxies.clearGalaxyIdsAggregate);
  const clearGalaxyAggregates = useMutation(api.galaxies.clearGalaxyAggregates);
  const rebuildGalaxyAggregates = useMutation(api.galaxies.rebuildGalaxyAggregates);
  const deleteAllGalaxies = useMutation(api.galaxies.deleteAllGalaxies);
  const seedGalaxyAssignmentStats = useMutation(api.seedGalaxyAssignmentStats.seedGalaxyAssignmentStats);
  const fillGalaxyMagAndMeanMue = useMutation(api.galaxies.fillGalaxyMagAndMeanMue);

  const handleGenerateMockGalaxies = async () => {
    try {
      setGeneratingMock(true);
      const result = await generateMockGalaxies();
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to generate mock galaxies");
      console.error(error);
    } finally {
      setGeneratingMock(false);
    }
  };

  const handleClearGalaxyAggregate = async () => {
    if (!confirm("Clear galaxy IDs aggregate? This cannot be undone.")) return;
    try {
      setClearingAggregate(true);
      const res: any = await clearGalaxyIdsAggregate();
      toast.success(res?.message || "Galaxy aggregate cleared");
    } catch (e) {
      toast.error("Failed to clear galaxy aggregate");
      console.error(e);
    } finally {
      setClearingAggregate(false);
    }
  };

  const handleDeleteAllGalaxies = async () => {
    try {
      setDeletingGalaxies(true);
      const res: any = await deleteAllGalaxies();
      toast.success(res?.message || "All galaxy data deleted successfully");
      setShowDeleteModal(false);
    } catch (e) {
      toast.error("Failed to delete galaxy data");
      console.error(e);
    } finally {
      setDeletingGalaxies(false);
    }
  };

  const handleSeedGalaxyAssignmentStats = async () => {
    try {
      setSeedingStats(true);
      let totalSeeded = 0;
      let iterations = 0;
      let currentCursor = seedingCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await seedGalaxyAssignmentStats({
          cursor: currentCursor || undefined,
        });
        totalSeeded += result.seeded;
        currentCursor = result.cursor;
        setSeedingCursor(result.cursor);

        if (result.isDone || result.seeded === 0) break;
        iterations++;
      }

      // Reset cursor when done
      if (currentCursor === null) {
        setSeedingCursor(null);
      }

      toast.success(`Seeded ${totalSeeded} galaxy assignment stats across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to seed galaxy assignment stats");
      console.error(error);
    } finally {
      setSeedingStats(false);
    }
  };

  const handleClearGalaxyAggregates = async () => {
    if (!confirm("Clear galaxy aggregates? This will affect pagination performance until aggregates are rebuilt.")) return;
    try {
      setClearingGalaxyAggregates(true);
      await clearGalaxyAggregates();
      toast.success("Galaxy aggregates cleared");
    } catch (e) {
      toast.error("Failed to clear galaxy aggregates");
      console.error(e);
    } finally {
      setClearingGalaxyAggregates(false);
    }
  };

  const handleRebuildGalaxyAggregates = async () => {
    if (!confirm("Rebuild galaxy aggregates? This may take some time for large datasets.")) return;
    try {
      setRebuildingGalaxyAggregates(true);
      await rebuildGalaxyAggregates();
      toast.success("Galaxy aggregates rebuilt successfully");
    } catch (e) {
      toast.error("Failed to rebuild galaxy aggregates");
      console.error(e);
    } finally {
      setRebuildingGalaxyAggregates(false);
    }
  };

  const handleFillGalaxyMagAndMeanMue = async () => {
    try {
      setFillingMagMeanMue(true);
      let totalUpdated = 0;
      let iterations = 0;
      let currentCursor = fillingCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await fillGalaxyMagAndMeanMue({
          cursor: currentCursor || undefined,
        });
        totalUpdated += result.updated;
        currentCursor = result.cursor;
        setFillingCursor(result.cursor);

        if (result.isDone || result.updated === 0) break;
        iterations++;
      }

      // Reset cursor when done
      if (currentCursor === null) {
        setFillingCursor(null);
      }

      toast.success(`Filled mag/mean_mue for ${totalUpdated} galaxies across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to fill galaxy mag and mean_mue");
      console.error(error);
    } finally {
      setFillingMagMeanMue(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Debugging Tools</h1>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4">🌱 Seed Galaxy Assignment Stats</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Seed galaxy assignment stats for all galaxies that don't have them yet. Processes in batches of 500 to avoid timeouts and will continue until all galaxies are processed.
          </p>
          <button
            onClick={() => void (async () => { await handleSeedGalaxyAssignmentStats(); })()}
            disabled={seedingStats}
            className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {seedingStats && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {seedingStats ? 'Seeding...' : 'Seed Stats'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4">🧪 Generate Mock Data</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Generate 100 mock galaxies for testing and development purposes.
          </p>
          <button
            onClick={() => void (async () => { await handleGenerateMockGalaxies(); })()}
            disabled={generatingMock}
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {generatingMock && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generatingMock ? 'Generating...' : 'Generate Mock Galaxies'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-4">🔄 Clear Galaxy Aggregates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Clear all galaxy aggregates used for pagination. This will affect pagination performance until aggregates are rebuilt.
          </p>
          <button
            onClick={() => void (async () => { await handleClearGalaxyAggregates(); })()}
            disabled={clearingGalaxyAggregates}
            className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {clearingGalaxyAggregates && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {clearingGalaxyAggregates ? 'Clearing...' : 'Clear Aggregates'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-4">🔨 Rebuild Galaxy Aggregates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Rebuild galaxy aggregates from scratch. Required after clearing aggregates or if aggregates become corrupted.
          </p>
          <button
            onClick={() => void (async () => { await handleRebuildGalaxyAggregates(); })()}
            disabled={rebuildingGalaxyAggregates}
            className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {rebuildingGalaxyAggregates && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {rebuildingGalaxyAggregates ? 'Rebuilding...' : 'Rebuild Aggregates'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-4">📊 Fill Galaxy Mag & Mean μ</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Fill missing mag and mean_mue values in galaxies table using data from galaxies_photometry_g. Processes in batches of 500 to avoid timeouts and will continue until all galaxies are processed.
          </p>
          <button
            onClick={() => void (async () => { await handleFillGalaxyMagAndMeanMue(); })()}
            disabled={fillingMagMeanMue}
            className="inline-flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {fillingMagMeanMue && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {fillingMagMeanMue ? 'Filling...' : 'Fill Mag & Mean μ'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clear Galaxy Aggregate</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            This will clear the galaxy IDs aggregate. This action cannot be undone.
          </p>
          <button
            onClick={() => void (async () => { await handleClearGalaxyAggregate(); })()}
            disabled={clearingAggregate}
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {clearingAggregate && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {clearingAggregate ? 'Clearing...' : 'Clear Galaxy Aggregate'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">⚠️ Delete All Galaxy Data</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            This will permanently delete ALL galaxy data including galaxies, photometry, source extractor data, thuruthipilly data, and galaxy IDs. This action cannot be undone and will affect all users.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={deletingGalaxies}
            className="inline-flex items-center justify-center bg-red-700 hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {deletingGalaxies && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {deletingGalaxies ? 'Deleting...' : 'Delete All Galaxy Data'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Deletion
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete ALL galaxy data? This will remove:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 mb-6 list-disc list-inside space-y-1">
              <li>All galaxy records</li>
              <li>Photometry data (g, r, i bands)</li>
              <li>Source extractor measurements</li>
              <li>Thuruthipilly parameters</li>
              <li>Galaxy ID mappings</li>
              <li>Aggregated data</li>
            </ul>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6 font-medium">
              This action cannot be undone!
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void (async () => { await handleDeleteAllGalaxies(); })()}
                disabled={deletingGalaxies}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {deletingGalaxies ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}