import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

interface DeleteAllGalaxyDataSectionProps {
  onShowDeleteModal: () => void;
}

export function DeleteAllGalaxyDataSection({ onShowDeleteModal }: DeleteAllGalaxyDataSectionProps) {
  const [deletingGalaxies, setDeletingGalaxies] = useState(false);
  const deleteAllGalaxies = useMutation(api.galaxies.deleteAllGalaxies);

  const handleDeleteAllGalaxies = async () => {
    try {
      setDeletingGalaxies(true);
      const res: any = await deleteAllGalaxies();
      toast.success(res?.message || "All galaxy data deleted successfully");
      onShowDeleteModal(); // This will actually close the modal
    } catch (e) {
      toast.error("Failed to delete galaxy data");
      console.error(e);
    } finally {
      setDeletingGalaxies(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">⚠️ Delete All Galaxy Data</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        This will permanently delete ALL galaxy data including galaxies, photometry, source extractor data, thuruthipilly data, and galaxy IDs. This action cannot be undone and will affect all users.
      </p>
      <button
        onClick={onShowDeleteModal}
        disabled={deletingGalaxies}
        className="inline-flex items-center justify-center bg-red-700 hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {deletingGalaxies && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {deletingGalaxies ? 'Deleting...' : 'Delete All Galaxy Data'}
      </button>
    </div>
  );
}