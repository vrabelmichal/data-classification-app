import { GenerateBalancedUserSequence } from "./GenerateBalancedUserSequence";
import { RemoveUserSequence } from "./RemoveUserSequence";

interface GalaxiesTabProps {
  users: any[];
}

export function GalaxiesTab({ users }: GalaxiesTabProps) {
  return (
    <div className="space-y-6">
      <GenerateBalancedUserSequence users={users} />
      <RemoveUserSequence users={users} />
    </div>
  );
}