interface DeleteConfirmationModalProps {
  showDeleteModal: boolean;
  setShowDeleteModal: (show: boolean) => void;
  deletingGalaxies: boolean;
  onConfirmDelete: () => void;
}

export function DeleteConfirmationModal({
  showDeleteModal,
  setShowDeleteModal,
  deletingGalaxies,
  onConfirmDelete,
}: DeleteConfirmationModalProps) {
  if (!showDeleteModal) return null;

  return (
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
            onClick={onConfirmDelete}
            disabled={deletingGalaxies}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {deletingGalaxies ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}