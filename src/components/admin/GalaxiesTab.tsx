import { GenerateBalancedUserSequence } from "./GenerateBalancedUserSequence";
import { RemoveUserSequence } from "./RemoveUserSequence";
import { BlacklistManagement } from "./BlacklistManagement";

interface GalaxiesTabProps {
  users: any[];
  systemSettings: any;
}

export function GalaxiesTab({ users, systemSettings }: GalaxiesTabProps) {
  return (
    <div className="space-y-6">
      <GenerateBalancedUserSequence users={users} systemSettings={systemSettings} />
      <RemoveUserSequence users={users} />
      <BlacklistManagement />
    </div>
  );
}