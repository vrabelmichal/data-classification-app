import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import {
  GenerateMockDataSection,
  ZeroOutGalaxyStatisticsSection,
  DeleteAllGalaxyDataSection,
  DeleteConfirmationModal,
} from "../debugging";

export function DevelopmentTestingPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGalaxies, setDeletingGalaxies] = useState(false);
  const deleteAllGalaxies = useMutation(api.galaxies.maintenance.deleteAllGalaxies);

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

  return (
    <div>
      <section>
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Development & Testing</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Tools for testing, debugging, and resetting data during development.</p>
        <div className="grid grid-cols-2 gap-6">
          <GenerateMockDataSection />
          <ZeroOutGalaxyStatisticsSection />
          <DeleteAllGalaxyDataSection onShowDeleteModal={() => setShowDeleteModal(true)} />
        </div>
      </section>

      <DeleteConfirmationModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        deletingGalaxies={deletingGalaxies}
        onConfirmDelete={handleDeleteAllGalaxies}
      />
    </div>
  );
}
