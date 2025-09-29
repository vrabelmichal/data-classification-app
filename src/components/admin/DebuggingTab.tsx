import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import {
  GenerateMockDataSection,
  SeedGalaxyAssignmentStatsSection,
  FillGalaxyMagMeanMueSection,
  FillGalaxyNumericIdSection,
  RebuildGalaxyIdsTableSection,
  ClearGalaxyIdsAggregateSection,
  RebuildGalaxyIdsAggregateSection,
  ClearGalaxyAggregatesSection,
  RebuildGalaxyAggregatesSection,
  DeleteAllGalaxyDataSection,
  AggregateInformationSection,
  DeleteConfirmationModal,
} from "./debugging";

export function DebuggingTab() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGalaxies, setDeletingGalaxies] = useState(false);
  const deleteAllGalaxies = useMutation(api.galaxies.deleteAllGalaxies);

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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Debugging Tools</h1>

      <div className="grid grid-cols-2 gap-6">
        <GenerateMockDataSection />
        <SeedGalaxyAssignmentStatsSection />
        <FillGalaxyMagMeanMueSection />
        <FillGalaxyNumericIdSection />
        <RebuildGalaxyIdsTableSection />
        <ClearGalaxyIdsAggregateSection />
        <RebuildGalaxyIdsAggregateSection />
        <ClearGalaxyAggregatesSection />
        <RebuildGalaxyAggregatesSection />
        <DeleteAllGalaxyDataSection onShowDeleteModal={() => setShowDeleteModal(true)} />
      </div>

      <AggregateInformationSection />

      <DeleteConfirmationModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        deletingGalaxies={deletingGalaxies}
        onConfirmDelete={handleDeleteAllGalaxies}
      />
    </div>
  );
}