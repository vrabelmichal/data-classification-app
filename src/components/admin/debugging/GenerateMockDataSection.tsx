import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";

export function GenerateMockDataSection() {
  const [generatingMock, setGeneratingMock] = useState(false);
  const generateMockGalaxies = useMutation(api.galaxies_mock.generateMockGalaxies);

  const handleGenerateMockGalaxies = async () => {
    try {
      setGeneratingMock(true);
      const result = await generateMockGalaxies();
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to generate mock galaxies");
      console.error(error);
    } finally {
      setGeneratingMock(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-4">🧪 Generate Mock Data</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Generate 100 mock galaxies for testing and development purposes.
      </p>
      <button
        onClick={() => void (async () => { await handleGenerateMockGalaxies(); })()}
        disabled={generatingMock}
        className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {generatingMock && (
          <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {generatingMock ? 'Generating...' : 'Generate Mock Galaxies'}
      </button>
    </div>
  );
}