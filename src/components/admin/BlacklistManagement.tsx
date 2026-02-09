import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

export function BlacklistManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [newGalaxyId, setNewGalaxyId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    added: number;
    skipped: number;
    notFound: number;
  } | null>(null);
  const [clearProgress, setClearProgress] = useState<{
    removed: number;
    total?: number;
    batches: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const blacklistData = useQuery(
    api.galaxyBlacklist.getAllBlacklistedGalaxies,
    searchTerm.trim() ? "skip" : { limit: 100 }
  );
  const searchResults = useQuery(
    api.galaxyBlacklist.searchBlacklistedGalaxies,
    searchTerm.trim() ? { searchTerm: searchTerm.trim(), limit: 50 } : "skip"
  );
  const blacklistCount = useQuery(api.galaxyBlacklist.getBlacklistCount);

  // Mutations
  const addToBlacklist = useMutation(api.galaxyBlacklist.addToBlacklist);
  const removeFromBlacklist = useMutation(api.galaxyBlacklist.removeFromBlacklist);
  const bulkAddToBlacklist = useMutation(api.galaxyBlacklist.bulkAddToBlacklist);
  const clearBlacklist = useMutation(api.galaxyBlacklist.clearBlacklist);

  // Use search results when searching, otherwise use all blacklist data
  const displayItems = searchTerm.trim() ? searchResults?.items : blacklistData?.items;
  const isLoading = searchTerm.trim() ? searchResults === undefined : blacklistData === undefined;

  const handleAddSingle = async () => {
    const galaxyId = newGalaxyId.trim();
    if (!galaxyId) {
      toast.error("Please enter a galaxy ID");
      return;
    }

    try {
      const result = await addToBlacklist({
        galaxyExternalId: galaxyId,
        reason: newReason.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Galaxy ${galaxyId} added to blacklist`);
        setNewGalaxyId("");
        setNewReason("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to add galaxy to blacklist");
      console.error(error);
    }
  };

  const handleRemove = async (galaxyExternalId: string) => {
    try {
      const result = await removeFromBlacklist({ galaxyExternalId });
      if (result.success) {
        toast.success(`Galaxy ${galaxyExternalId} removed from blacklist`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to remove galaxy from blacklist");
      console.error(error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(null);

      const text = await file.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      if (lines.length === 0) {
        toast.error("File is empty or contains no valid galaxy IDs");
        return;
      }

      // Process in batches of 100 to avoid mutation timeout
      const BATCH_SIZE = 100;
      let totalAdded = 0;
      let totalSkipped = 0;
      let totalNotFound = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const result = await bulkAddToBlacklist({
          galaxyExternalIds: batch,
          reason: bulkReason.trim() || undefined,
        });

        totalAdded += result.added;
        totalSkipped += result.skipped;
        totalNotFound += result.notFound;
        if (result.errors) {
          allErrors.push(...result.errors);
        }

        setUploadProgress({
          processed: Math.min(i + BATCH_SIZE, lines.length),
          total: lines.length,
          added: totalAdded,
          skipped: totalSkipped,
          notFound: totalNotFound,
        });
      }

      if (totalAdded > 0) {
        toast.success(`Added ${totalAdded} galaxies to blacklist`);
      }
      if (totalSkipped > 0) {
        toast.info(`Skipped ${totalSkipped} already blacklisted galaxies`);
      }
      if (totalNotFound > 0) {
        toast.warning(`${totalNotFound} galaxies not found in database`);
      }
      if (allErrors.length > 0) {
        console.warn("Upload errors:", allErrors);
      }
    } catch (error) {
      toast.error("Failed to upload blacklist file");
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClearBlacklist = async () => {
    if (isClearing) {
      return;
    }
    if (!window.confirm("Are you sure you want to clear the entire blacklist? This cannot be undone.")) {
      return;
    }

    try {
      const total = typeof blacklistCount === "number" ? blacklistCount : undefined;
      setIsClearing(true);
      setClearProgress({ removed: 0, total, batches: 0 });

      let removedTotal = 0;
      let batches = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await clearBlacklist({ batchSize: 250 });
        batches += 1;
        removedTotal += result.removed;
        hasMore = result.hasMore;

        setClearProgress({ removed: removedTotal, total, batches });

        if (result.removed === 0) {
          break;
        }
      }

      toast.success(`Removed ${removedTotal} galaxies from blacklist`);
    } catch (error) {
      toast.error("Failed to clear blacklist");
      console.error(error);
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Unified widget: header, add controls, search, and list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Galaxy Blacklist Management
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Blacklisted galaxies are excluded from assignment and classification.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {blacklistCount ?? "..."}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">blacklisted galaxies</div>
          </div>
        </div>

        {/* Add controls (single + bulk) */}
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Add Single Galaxy</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newGalaxyId}
                  onChange={(e) => setNewGalaxyId(e.target.value)}
                  placeholder="Galaxy ID (e.g., NGC1234)"
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                />
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => void handleAddSingle()}
                  disabled={!newGalaxyId.trim()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Add galaxy to blacklist"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Bulk Upload from File</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Upload a .txt file with one galaxy ID per line.</p>
            <div className="space-y-3">
              <input
                type="text"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Reason for all (optional)"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
              />
              <div className="flex justify-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={(e) => void handleFileUpload(e)}
                  disabled={isUploading}
                  className="hidden"
                  id="blacklist-file-input"
                />
                <label
                  htmlFor="blacklist-file-input"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    isUploading ? "bg-gray-400 cursor-not-allowed text-white" : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  title="Upload a file with galaxy IDs"
                >
                  {isUploading ? "Uploading..." : "Upload File"}
                </label>
              </div>
            </div>
            {uploadProgress && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  Processing: {uploadProgress.processed} / {uploadProgress.total}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Added: {uploadProgress.added} | Skipped: {uploadProgress.skipped} | Not found: {uploadProgress.notFound}
                </div>
                <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search + list within same widget */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Search & Manage Blacklist</h3>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by galaxy ID..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : displayItems && displayItems.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Make the list area scrollable and limit height to show ~10 items */}
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr className="sticky top-0">
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 uppercase tracking-wider">
                        Galaxy ID
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 uppercase tracking-wider">
                        Added
                      </th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 uppercase tracking-wider">
                        By
                      </th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {displayItems.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-1.5 text-sm font-mono text-gray-900 dark:text-white">
                          {item.galaxyExternalId}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">{item.reason || "-"}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">{formatDate(item.addedAt)}</td>
                        <td className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">{item.addedByName}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => void handleRemove(item.galaxyExternalId)}
                            title={`Remove ${item.galaxyExternalId} from blacklist`}
                            aria-label={`Remove ${item.galaxyExternalId} from blacklist`}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm.trim() ? "No matching galaxies found in blacklist" : "No galaxies in blacklist"}
            </div>
          )}

          {(searchTerm.trim() ? searchResults?.hasMore : blacklistData?.hasMore) && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Showing first {displayItems?.length} results. Use search to find specific galaxies.
            </div>
          )}

          {(blacklistCount ?? 0) > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => void handleClearBlacklist()}
                title="Permanently remove all galaxies from the blacklist (irreversible)"
                aria-label="Permanently clear the entire blacklist (irreversible)"
                disabled={isClearing}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{isClearing ? "Clearing blacklist..." : "Clear entire blacklist (irreversible)"}</span>
              </button>
            </div>
          )}
          {clearProgress && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-sm text-red-900 dark:text-red-100">
                {isClearing ? "Clearing blacklist in batches..." : "Cleanup complete."}
              </div>
              <div className="text-xs text-red-700 dark:text-red-200 mt-1">
                Removed: {clearProgress.removed}
                {clearProgress.total !== undefined ? ` / ${clearProgress.total}` : ""} | Batches: {clearProgress.batches}
              </div>
              <div className="mt-2 h-2 bg-red-200 dark:bg-red-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${clearProgress.total !== undefined ? "bg-red-600" : "bg-red-500 animate-pulse"}`}
                  style={{
                    width:
                      clearProgress.total && clearProgress.total > 0
                        ? `${Math.min(100, (clearProgress.removed / clearProgress.total) * 100)}%`
                        : "100%",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
