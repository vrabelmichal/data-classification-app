import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function FillGalaxyMagMeanMueSection() {
  const [fillingMagMeanMue, setFillingMagMeanMue] = useState(false);
  const [fillingCursor, setFillingCursor] = useState<string | null>(null);
  const fillGalaxyMagAndMeanMue = useMutation(api.galaxies.maintenance.fillGalaxyMagAndMeanMue);

  const handleFillGalaxyMagAndMeanMue = async () => {
    try {
      setFillingMagMeanMue(true);
      let totalUpdated = 0;
      let iterations = 0;
      let currentCursor = fillingCursor;
      const maxIterations = 10000; // safety limit

      while (iterations < maxIterations) {
        const result = await fillGalaxyMagAndMeanMue({
          cursor: currentCursor || undefined,
        });
        totalUpdated += result.updated;
        currentCursor = result.cursor;
        setFillingCursor(result.cursor);

        if (result.isDone || result.updated === 0) break;
        iterations++;
      }

      // Reset cursor when done
      if (currentCursor === null) {
        setFillingCursor(null);
      }

      toast.success(`Filled mag/mean_mue for ${totalUpdated} galaxies across ${iterations + 1} batches`);
    } catch (error) {
      toast.error("Failed to fill galaxy mag and mean_mue");
      console.error(error);
    } finally {
      setFillingMagMeanMue(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-4">📊 Fill Galaxy Mag & Mean μ</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Fill missing mag and mean_mue values in galaxies table using data from galaxies_photometry_g. Processes in batches of 500 to avoid timeouts and will continue until all galaxies are processed.
      </p>
      <button
        onClick={() => void (async () => { await handleFillGalaxyMagAndMeanMue(); })()}
        disabled={fillingMagMeanMue}
        className="inline-flex items-center justify-center bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {fillingMagMeanMue && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {fillingMagMeanMue ? 'Filling...' : 'Fill Mag & Mean μ'}
      </button>
    </div>
  );
}