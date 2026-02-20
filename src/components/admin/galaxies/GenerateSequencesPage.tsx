import { GenerateBalancedUserSequence } from "../GenerateBalancedUserSequence";
import { usePageTitle } from "../../../hooks/usePageTitle";

interface GenerateSequencesPageProps {
  users: any[];
  systemSettings: any;
}

export function GenerateSequencesPage({ users, systemSettings }: GenerateSequencesPageProps) {
  usePageTitle("Admin – Galaxies – Generate Sequences");
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Generate New Sequences</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create new galaxy classification sequences for users
        </p>
      </div>
      <GenerateBalancedUserSequence users={users} systemSettings={systemSettings} />
    </div>
  );
}
