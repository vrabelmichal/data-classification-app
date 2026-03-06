import { MigrateUserSequence } from "../MigrateUserSequence";
import { usePageTitle } from "../../../hooks/usePageTitle";

interface MigrateSequencesPageProps {
  users: any[];
}

export function MigrateSequencesPage({ users }: MigrateSequencesPageProps) {
  usePageTitle("Admin – Galaxies – Migrate Sequences");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Migrate Sequences</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Move generated galaxy sequences between users safely
        </p>
      </div>
      <MigrateUserSequence users={users} />
    </div>
  );
}
