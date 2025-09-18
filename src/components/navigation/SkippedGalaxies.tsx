import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePageTitle } from "../hooks/usePageTitle";
import { toast } from "sonner";
import { ImageViewer } from "../classification/ImageViewer";

export function SkippedGalaxies() {
  usePageTitle("Skipped Galaxies");
  const skippedGalaxies = useQuery(api.galaxies_skipped.getSkippedGalaxies);
  const removeFromSkipped = useMutation(api.galaxies_skipped.removeFromSkipped);
  const userPrefs = useQuery(api.users.getUserPreferences);

  const handleRemoveFromSkipped = async (skippedId: any) => {
    try {
      await removeFromSkipped({ skippedId });
      toast.success("Galaxy removed from skipped list");
    } catch (error) {
      toast.error("Failed to remove galaxy from skipped list");
      console.error(error);
    }
  };

  if (skippedGalaxies === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Skipped Galaxies</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Galaxies you've skipped during classification
        </p>
      </div>

      {skippedGalaxies.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏭️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Skipped Galaxies
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              You haven't skipped any galaxies yet. Keep up the great work!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skippedGalaxies.filter((item): item is NonNullable<typeof item> & { galaxy: NonNullable<typeof item.galaxy> } => Boolean(item?.galaxy)).map((item) => (
            <div
              key={item._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="aspect-square p-4">
                {(item.galaxy as any)?.imageUrl ? (
                  <ImageViewer
                    imageUrl={(item.galaxy as any).imageUrl}
                    alt={`Galaxy ${(item.galaxy as any).id}`}
                    preferences={userPrefs}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">🌌</div>
                      <p className="text-sm">No image</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {(item.galaxy as any).id}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item._creationTime).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  <div>RA: {(item.galaxy as any).ra.toFixed(4)}°</div>
                  <div>Dec: {(item.galaxy as any).dec.toFixed(4)}°</div>
                </div>

                {item.comments && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Comments:</span> {item.comments}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => handleRemoveFromSkipped(item._id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Remove from Skipped
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {skippedGalaxies.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Showing {skippedGalaxies.length} skipped {skippedGalaxies.length === 1 ? 'galaxy' : 'galaxies'}
          </p>
        </div>
      )}
    </div>
  );
}
