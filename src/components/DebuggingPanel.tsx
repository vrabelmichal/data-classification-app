import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function DebuggingPanel() {
  const [clearingAggregate, setClearingAggregate] = useState(false);
  const [deletingGalaxies, setDeletingGalaxies] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const clearGalaxyIdsAggregate = useMutation(api.galaxies.clearGalaxyIdsAggregate);
  const deleteAllGalaxies = useMutation(api.galaxies.deleteAllGalaxies);

  const handleClearGalaxyAggregate = () => {
    if (!confirm("Clear galaxy IDs aggregate? This cannot be undone.")) return;
    void (async () => {
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
    })();
  };

  const handleDeleteAllGalaxies = () => {
    void (async () => {
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
    })();
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Debugging Tools</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clear Galaxy Aggregate</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          This will clear the galaxy IDs aggregate. This action cannot be undone.
        </p>
        <button
          onClick={handleClearGalaxyAggregate}
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
                onClick={handleDeleteAllGalaxies}
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
