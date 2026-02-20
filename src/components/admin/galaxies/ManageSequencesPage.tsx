import { UpdateUserSequence } from "../UpdateUserSequence";
import { RemoveUserSequence } from "../RemoveUserSequence";
import { usePageTitle } from "../../../hooks/usePageTitle";

interface ManageSequencesPageProps {
  users: any[];
  systemSettings: any;
}

export function ManageSequencesPage({ users, systemSettings }: ManageSequencesPageProps) {
  usePageTitle("Admin – Galaxies – Manage Sequences");
  
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Sequences</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update or delete existing user sequences
        </p>
      </div>
      <UpdateUserSequence users={users} systemSettings={systemSettings} />
      <RemoveUserSequence users={users} />
    </div>
  );
}
