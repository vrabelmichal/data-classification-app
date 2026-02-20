import { BlacklistManagement } from "../BlacklistManagement";
import { usePageTitle } from "../../../hooks/usePageTitle";

export function BlacklistPage() {
  usePageTitle("Admin – Galaxies – Blacklist");
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Galaxy Blacklist</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage galaxies that should be excluded from classification sequences
        </p>
      </div>
      <BlacklistManagement />
    </div>
  );
}
