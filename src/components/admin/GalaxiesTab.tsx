import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

interface GalaxiesTabProps {
  users: any[];
}

export function GalaxiesTab({ users }: GalaxiesTabProps) {
  const [sequenceSize, setSequenceSize] = useState(50);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [generatingSequence, setGeneratingSequence] = useState(false);

  const generateUserSequence = useMutation(api.galaxies_sequence.generateRandomUserSequence);

  const handleGenerateSequence = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setGeneratingSequence(true);
      const result = await generateUserSequence({
        targetUserId: selectedUserId as any,
        sequenceSize,
      });
      toast.success(result.message);
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
          Generate User Sequence
        </h2>
        
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
          
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Sequence Size
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
          
          <button
            onClick={() => void (async () => { await handleGenerateSequence(); })()}
            disabled={!selectedUserId || generatingSequence}
            className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {generatingSequence && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generatingSequence ? 'Generating Sequence...' : 'Generate New Sequence'}
          </button>
          {generatingSequence && (
            <p className="text-xs text-gray-500 dark:text-gray-400">This may take a while for large sizes...</p>
          )}
        </div>
      </div>
    </div>
  );
}