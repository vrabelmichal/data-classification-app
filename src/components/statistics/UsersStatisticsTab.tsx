import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { UserStatisticsTable, type UserStatisticsRow } from "../userStatistics/UserStatisticsTable";
import { EmailVisibilityToggle } from "../shared/EmailVisibilityToggle";

export function UsersStatisticsTab() {
  const rows = useQuery(api.users.getUsersStatisticsOverview) as UserStatisticsRow[] | undefined;
  const [showEmails, setShowEmails] = useState(false);

  if (rows === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="h-10 w-10 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <UserStatisticsTable
      rows={rows}
      title="Per-user statistics"
      description="Toggle columns to focus on key metrics without losing access to detailed counters."
      storageKeyPrefix="usersStats"
      showEmails={showEmails}
      footer={
        <div className="flex justify-end">
          <EmailVisibilityToggle
            showEmails={showEmails}
            onToggle={() => setShowEmails((current) => !current)}
            variant="compact"
          />
        </div>
      }
    />
  );
}
