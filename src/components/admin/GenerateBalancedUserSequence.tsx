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
  const [statsProgress, setStatsProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedGalaxies: number;
    totalGalaxies: number;
    message: string;
  } | null>(null);

  const usersWithoutSequences = useQuery(api.galaxies_sequence.getUsersWithoutSequences);

  const generateBalancedUserSequence = useMutation(api.generateBalancedUserSequence.generateBalancedUserSequence);
  const updateGalaxyAssignmentStats = useMutation(api.generateBalancedUserSequence.updateGalaxyAssignmentStats);

  const handleGenerateSequence = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    // Enforce client-side limit
    const MAX_SEQUENCE_SIZE = 8192;
    const effectiveSequenceSize = Math.min(sequenceSize, MAX_SEQUENCE_SIZE);
    if (sequenceSize > MAX_SEQUENCE_SIZE) {
      toast.warning(`Sequence size capped at ${MAX_SEQUENCE_SIZE} (database limit)`);
    }

    try {
      setGeneratingSequence(true);
      setStatsProgress(null);

      // Step 1: Generate the sequence
      const result = await generateBalancedUserSequence({
        targetUserId: selectedUserId as any,
        expectedUsers,
        minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry,
        sequenceSize: effectiveSequenceSize,
        allowOverAssign,
        dryRun: false,
      });

      if (!result.success) {
        toast.error("Failed to generate sequence");
        return;
      }

      toast.success(`Generated ${result.generated} of ${result.requested} galaxies. K=${result.minAssignmentsPerEntry}, M=${result.perUserCap}`);
      if (result.warnings) {
        result.warnings.forEach(warning => toast.warning(warning));
      }

      // Step 2: Update stats in batches if needed
      if (result.statsBatchesNeeded && result.statsBatchesNeeded > 0) {
        const totalBatches = result.statsBatchesNeeded;
        const batchSize = result.statsBatchSize || 500;

        setStatsProgress({
          currentBatch: 0,
          totalBatches,
          processedGalaxies: 0,
          totalGalaxies: result.generated,
          message: "Starting stats updates...",
        });

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const statsResult = await updateGalaxyAssignmentStats({
            targetUserId: selectedUserId as any,
            batchIndex,
            batchSize,
            perUserCapM: maxAssignmentsPerUserPerEntry,
          });

          if (!statsResult.success) {
            throw new Error(`Failed to update stats batch ${batchIndex + 1}`);
          }

          setStatsProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedGalaxies: statsResult.totalProcessed,
            totalGalaxies: result.generated,
            message: statsResult.isLastBatch
              ? "Stats updates completed!"
              : `Updated stats for batch ${batchIndex + 1}/${totalBatches}`,
          });

          if (statsResult.isLastBatch) {
            break;
          }
        }

        toast.success("Sequence generation and stats updates completed!");
      }
    } catch (error) {
      toast.error("Failed to generate sequence");
      console.error(error);
    } finally {
      setGeneratingSequence(false);
      setStatsProgress(null);
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
              {usersWithoutSequences?.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.user?.name || user.user?.email || "Anonymous"} ({user.classificationsCount} classifications)
                </option>
              ))}
            </select>
          </div>

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
                  Number of galaxies to assign to this user (max 8192)
                </span>
              </label>
              <input
                type="number"
                min="1"
                max="8192"
                value={sequenceSize}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSequenceSize(Math.min(Math.max(1, value), 8192));
                }}
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
            disabled={!selectedUserId || generatingSequence}
            className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {generatingSequence && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generatingSequence ? 'Generating Balanced Sequence...' : 'Generate Balanced Sequence'}
          </button>
          {generatingSequence && (
            <p className="text-xs text-gray-500 dark:text-gray-400">This may take a while for large sizes...</p>
          )}

          {statsProgress && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-2 bg-blue-200 dark:bg-blue-700 rounded-full flex-1">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${(statsProgress.processedGalaxies / statsProgress.totalGalaxies) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {statsProgress.processedGalaxies}/{statsProgress.totalGalaxies}
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {statsProgress.message}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Batch {statsProgress.currentBatch} of {statsProgress.totalBatches}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}