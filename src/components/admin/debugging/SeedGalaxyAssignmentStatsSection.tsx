import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function SeedGalaxyAssignmentStatsSection() {
  const [seedingStats, setSeedingStats] = useState(false);
  const [seedingCursor, setSeedingCursor] = useState<string | null>(null);
  const [resetTotalAssigned, setResetTotalAssigned] = useState(false);
  const seedGalaxyAssignmentStats = useMutation(api.seedGalaxyAssignmentStats.seedGalaxyAssignmentStats);

  const handleSeedGalaxyAssignmentStats = async () => {
    try {
      setSeedingStats(true);
      let totalSeeded = 0;
      let iterations = 0;
      let currentCursor = seedingCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await seedGalaxyAssignmentStats({
          cursor: currentCursor || undefined,
          resetTotalAssigned,
        });
        totalSeeded += result.seeded;
        currentCursor = result.cursor;
        setSeedingCursor(result.cursor);

        if (result.isDone || result.seeded === 0) break;
        iterations++;
      }

      // Reset cursor when done
      if (currentCursor === null) {
        setSeedingCursor(null);
      }

      toast.success(`Seeded ${totalSeeded} galaxy assignment stats across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to seed galaxy assignment stats");
      console.error(error);
    } finally {
      setSeedingStats(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4">🌱 Seed Galaxy Assignment Stats</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Seed galaxy assignment stats for all galaxies that don't have them yet. Processes in batches of 500 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={resetTotalAssigned}
            onChange={(e) => setResetTotalAssigned(e.target.checked)}
            className="mr-2"
            disabled={seedingStats}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Reset totalAssigned to 0 (useful after removing user sequences)
          </span>
        </label>
      </div>
      <button
        onClick={() => void (async () => { await handleSeedGalaxyAssignmentStats(); })()}
        disabled={seedingStats}
        className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {seedingStats && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {seedingStats ? 'Seeding...' : 'Seed Stats'}
      </button>
    </div>
  );
}