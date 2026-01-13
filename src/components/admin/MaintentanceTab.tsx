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
  LabelingAggregatesSection,
  DeleteAllGalaxyDataSection,
  AggregateInformationSection,
  DeleteConfirmationModal,
  ZeroOutGalaxyStatisticsSection,
  TestEmailSection,
  BackfillGalaxyClassificationsSection,
  RebuildTotalClassificationsAggregateSection,
} from "./debugging";

export function MaintenanceTab() {
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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-8 text-gray-900 dark:text-white">Maintenance & System Tools</h1>

      {/* Regular Maintenance Section */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Regular Maintenance</h2>
        <div className="grid grid-cols-2 gap-6">
          <TestEmailSection />
          <SeedGalaxyAssignmentStatsSection />
        </div>
      </section>

      {/* Data Repair & Backfill Section */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Data Repair & Backfill</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Tools for fixing missing or inconsistent data in the database.</p>
        <div className="grid grid-cols-2 gap-6">
          <FillGalaxyMagMeanMueSection />
          <FillGalaxyNumericIdSection />
          <BackfillGalaxyClassificationsSection />
        </div>
      </section>

      {/* Aggregate Management Section */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Aggregate Management</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Manage database aggregates used for pagination and performance optimization.</p>
        <div className="grid grid-cols-2 gap-6">
          <RebuildGalaxyIdsTableSection />
          <ClearGalaxyIdsAggregateSection />
          <RebuildGalaxyIdsAggregateSection />
          <ClearGalaxyAggregatesSection />
          <RebuildGalaxyAggregatesSection />
          <RebuildTotalClassificationsAggregateSection />
          <LabelingAggregatesSection />
        </div>
      </section>

      {/* Development & Testing Section */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">Development & Testing</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Tools for testing, debugging, and resetting data during development.</p>
        <div className="grid grid-cols-2 gap-6">
          <GenerateMockDataSection />
          <ZeroOutGalaxyStatisticsSection />
          <DeleteAllGalaxyDataSection onShowDeleteModal={() => setShowDeleteModal(true)} />
        </div>
      </section>

      {/* System Information Section */}
      <section>
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">System Information</h2>
        <AggregateInformationSection />
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