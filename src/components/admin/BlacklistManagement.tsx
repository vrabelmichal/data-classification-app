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
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    added: number;
    skipped: number;
    notFound: number;
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
    if (!window.confirm("Are you sure you want to clear the entire blacklist? This cannot be undone.")) {
      return;
    }

    try {
      const result = await clearBlacklist({});
      toast.success(`Removed ${result.removed} galaxies from blacklist`);
    } catch (error) {
      toast.error("Failed to clear blacklist");
      console.error(error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header with count */}
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

        {/* Add Single Galaxy */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Add Single Galaxy
          </h3>
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
            <button
              onClick={() => void handleAddSingle()}
              disabled={!newGalaxyId.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Bulk Upload */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Bulk Upload from File
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Upload a .txt file with one galaxy ID per line.
          </p>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Reason for all (optional)"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
            />
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
              className={`px-4 py-2 font-medium rounded-lg transition-colors cursor-pointer ${
                isUploading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isUploading ? "Uploading..." : "Upload File"}
            </label>
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

      {/* Search and List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Search & Manage Blacklist
          </h3>
          {(blacklistCount ?? 0) > 0 && (
            <button
              onClick={() => void handleClearBlacklist()}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear All
            </button>
          )}
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
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Galaxy ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    By
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {displayItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-white">
                      {item.galaxyExternalId}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                      {item.reason || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(item.addedAt)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                      {item.addedByName}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => void handleRemove(item.galaxyExternalId)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchTerm.trim()
              ? "No matching galaxies found in blacklist"
              : "No galaxies in blacklist"}
          </div>
        )}

        {(searchTerm.trim() ? searchResults?.hasMore : blacklistData?.hasMore) && (
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Showing first {displayItems?.length} results. Use search to find specific galaxies.
          </div>
        )}
      </div>
    </div>
  );
}
