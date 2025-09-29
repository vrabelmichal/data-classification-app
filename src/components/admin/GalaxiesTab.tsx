import { GenerateBalancedUserSequence } from "./GenerateBalancedUserSequence";

interface GalaxiesTabProps {
  users: any[];
}

export function GalaxiesTab({ users }: GalaxiesTabProps) {
  return (
    <div className="space-y-6">
      <GenerateBalancedUserSequence users={users} />
    </div>
  );
}