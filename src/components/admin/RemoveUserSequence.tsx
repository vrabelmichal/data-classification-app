import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

interface RemoveUserSequenceProps {
  users: any[];
}

export function RemoveUserSequence({ users }: RemoveUserSequenceProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [removingSequence, setRemovingSequence] = useState(false);

  const usersWithSequences = useQuery(api.galaxies_sequence.getUsersWithSequences);

  const removeUserSequence = useMutation(api.galaxies_sequence.removeUserSequence);

  const handleRemoveSequence = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setRemovingSequence(true);
      const result = await removeUserSequence({
        targetUserId: selectedUserId as any,
      });

      if (result.success) {
        toast.success(`Removed sequence with ${result.galaxiesRemoved} galaxies`);
        setSelectedUserId(""); // Reset selection
      } else {
        toast.error("Failed to remove sequence");
      }
    } catch (error) {
      toast.error("Failed to remove sequence");
      console.error(error);
    } finally {
      setRemovingSequence(false);
    }
  };

  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
      <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4">
        Remove User Sequence (Admin Only)
      </h2>

      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
        Permanently remove a user's assigned sequence. This will update galaxy assignment counters and cannot be undone.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-red-900 dark:text-red-100 mb-2">
            Select User
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full border border-red-300 dark:border-red-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-red-900 dark:text-red-100"
            disabled={removingSequence}
          >
            <option value="">Select a user...</option>
            {usersWithSequences?.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.user?.name || user.user?.email || "Anonymous"} ({user.classificationsCount} classifications) - {user.sequenceInfo.galaxyCount} galaxies in sequence
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => void (async () => { await handleRemoveSequence(); })()}
          disabled={!selectedUserId || removingSequence}
          className="inline-flex items-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {removingSequence && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {removingSequence ? 'Removing Sequence...' : 'Remove Sequence'}
        </button>

        {selectedUserId && (
          <p className="text-xs text-red-600 dark:text-red-400">
            ⚠️ This action cannot be undone and will update galaxy assignment statistics.
          </p>
        )}
      </div>
    </div>
  );
}