import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

interface GenerateBalancedUserSequenceProps {
  users: any[];
}

export function GenerateBalancedUserSequence({ users }: GenerateBalancedUserSequenceProps) {
  const [sequenceSize, setSequenceSize] = useState(50);
  const [expectedUsers, setExpectedUsers] = useState(10);
  const [minAssignmentsPerEntry, setMinAssignmentsPerEntry] = useState(3);
  const [maxAssignmentsPerUserPerEntry, setMaxAssignmentsPerUserPerEntry] = useState(1);
  const [allowOverAssign, setAllowOverAssign] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [generatingSequence, setGeneratingSequence] = useState(false);

  const userHasSequence = useQuery(api.galaxies_sequence.userHasSequence, {
    userId: selectedUserId ? (selectedUserId as any) : undefined,
  });

  const generateBalancedUserSequence = useMutation(api.generateBalancedUserSequence.generateBalancedUserSequence);

  const handleGenerateSequence = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setGeneratingSequence(true);
      const result = await generateBalancedUserSequence({
        targetUserId: selectedUserId as any,
        expectedUsers,
        minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry,
        sequenceSize,
        allowOverAssign,
        dryRun: false,
      });

      if (result.success) {
        toast.success(`Generated ${result.generated} of ${result.requested} galaxies. K=${result.minAssignmentsPerEntry}, M=${result.perUserCap}`);
        if (result.warnings) {
          result.warnings.forEach(warning => toast.warning(warning));
        }
      } else {
        toast.error("Failed to generate sequence");
      }
    } catch (error) {
      toast.error("Failed to generate sequence");
      console.error(error);
    } finally {
      setGeneratingSequence(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Generate Balanced User Sequence
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Creates a balanced sequence of galaxies for classification, prioritizing galaxies that need more classifications while respecting user assignment limits.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={generatingSequence}
            >
              <option value="">Select a user...</option>
              {users.filter(user => !user._id.toString().startsWith('temp_')).map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.user?.name || user.user?.email || "Anonymous"} ({user.classificationsCount} classifications)
                </option>
              ))}
            </select>
          </div>

          {selectedUserId && userHasSequence && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    User Already Has a Sequence
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>
                      This user already has an assigned sequence. New sequences cannot be created for users who already have one.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Expected Users (N)
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Total number of users in the system for balancing calculations
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={expectedUsers}
                onChange={(e) => setExpectedUsers(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={generatingSequence}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Min Assignments Per Entry (K)
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum classifications needed per galaxy (prioritizes galaxies with &lt; K assignments)
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={minAssignmentsPerEntry}
                onChange={(e) => setMinAssignmentsPerEntry(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={generatingSequence}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Max Per User Per Entry (M)
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum times this user can classify the same galaxy
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={maxAssignmentsPerUserPerEntry}
                onChange={(e) => setMaxAssignmentsPerUserPerEntry(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={generatingSequence}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Sequence Size (S)
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Number of galaxies to assign to this user
                </span>
              </label>
              <input
                type="number"
                min="1"
                max="500000"
                value={sequenceSize}
                onChange={(e) => setSequenceSize(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={generatingSequence}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={allowOverAssign}
                onChange={(e) => setAllowOverAssign(e.target.checked)}
                className="mr-2"
                disabled={generatingSequence}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Allow Over-Assign (use galaxies with totalAssigned &gt;= K)
              </span>
            </label>
          </div>

          <button
            onClick={() => void (async () => { await handleGenerateSequence(); })()}
            disabled={!selectedUserId || generatingSequence || userHasSequence}
            className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {generatingSequence && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generatingSequence ? 'Generating Balanced Sequence...' : 
             userHasSequence ? 'User Already Has Sequence' : 'Generate Balanced Sequence'}
          </button>
          {generatingSequence && (
            <p className="text-xs text-gray-500 dark:text-gray-400">This may take a while for large sizes...</p>
          )}
        </div>
      </div>
    </div>
  );
}