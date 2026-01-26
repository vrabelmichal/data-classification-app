import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_AVAILABLE_PAPERS } from "../../lib/defaults";

interface UpdateUserSequenceProps {
  users: any[];
  systemSettings: any;
}

type UpdateMode = "shorten" | "extend";

export function UpdateUserSequence({ users: _users, systemSettings }: UpdateUserSequenceProps) {
  const LOG_STORAGE_KEY = "updateUserSequenceLogs";

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [updateMode, setUpdateMode] = useState<UpdateMode>("extend");
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<
    Array<{ level: "info" | "warning" | "error" | "success"; message: string; timestamp: number }>
  >([]);
  const [progress, setProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedItems: number;
    totalItems: number;
    message: string;
  } | null>(null);

  // Shorten mode state
  const [newSize, setNewSize] = useState<number>(0);
  const [sendShortenEmail, setSendShortenEmail] = useState(false);

  // Extend mode state
  const [additionalSize, setAdditionalSize] = useState(50);
  const [sendExtendEmail, setSendExtendEmail] = useState(false);
  const [expectedUsers, setExpectedUsers] = useState(10);
  const [minAssignmentsPerEntry, setMinAssignmentsPerEntry] = useState(3);
  const [maxAssignmentsPerUserPerEntry, setMaxAssignmentsPerUserPerEntry] = useState(1);
  const [allowOverAssign, setAllowOverAssign] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());

  const logContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Queries
  const usersWithSequences = useQuery(api.galaxies.sequence.getUsersWithSequences);
  const sequenceInfo = useMutation(api.updateUserSequence.getUserSequenceInfo);

  // Current sequence info for the selected user
  const [currentSequenceInfo, setCurrentSequenceInfo] = useState<{
    totalGalaxies: number;
    currentIndex: number;
    numClassified: number;
    numSkipped: number;
    remaining: number;
  } | null>(null);

  // Mutations
  const shortenUserSequence = useMutation(api.updateUserSequence.shortenUserSequence);
  const extendUserSequence = useMutation(api.updateUserSequence.extendUserSequence);
  const updateExtendedSequenceStats = useMutation(api.updateUserSequence.updateExtendedSequenceStats);

  // Actions (email notifications)
  const sendSequenceShortenedEmail = useAction(api.updateUserSequence.sendSequenceShortenedEmail);
  const sendSequenceExtendedEmail = useAction(api.updateUserSequence.sendSequenceExtendedEmail);

  // Get available papers from system settings
  const availablePapers: string[] = systemSettings?.availablePapers || DEFAULT_AVAILABLE_PAPERS;

  const appendLog = (level: "info" | "warning" | "error" | "success", message: string) => {
    const entry = { level, message, timestamp: Date.now() };
    setLogs((prev) => {
      const next = [...prev, entry];
      const MAX_LOG_ENTRIES = 300;
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  };

  // Initialize all papers as selected when they load
  useEffect(() => {
    if (availablePapers.length > 0 && selectedPapers.size === 0) {
      setSelectedPapers(new Set(availablePapers));
    }
  }, [availablePapers, selectedPapers.size]);

  // Load persisted logs once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLogs(parsed);
        }
      }
    } catch (err) {
      console.warn("Failed to load logs from localStorage", err);
    }
  }, []);

  // Persist logs to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (err) {
      console.warn("Failed to persist logs to localStorage", err);
    }
  }, [logs]);

  // Auto-scroll to bottom when new logs appear (unless user has scrolled up)
  useEffect(() => {
    if (!userHasScrolled && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, userHasScrolled]);

  // Detect user scrolling
  const handleLogScroll = () => {
    if (!logContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
    
    setUserHasScrolled(!isAtBottom);
  };

  // Fetch sequence info when user is selected
  useEffect(() => {
    if (selectedUserId) {
      sequenceInfo({ targetUserId: selectedUserId as any })
        .then((info) => {
          setCurrentSequenceInfo(info);
          if (info) {
            // Initialize newSize to current size
            setNewSize(info.totalGalaxies);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch sequence info:", err);
          setCurrentSequenceInfo(null);
        });
    } else {
      setCurrentSequenceInfo(null);
    }
  }, [selectedUserId, sequenceInfo]);

  const handleClearLogs = () => {
    setLogs([]);
    setUserHasScrolled(false);
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear logs from localStorage", err);
    }
  };

  const handlePaperToggle = (paper: string) => {
    setSelectedPapers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paper)) {
        newSet.delete(paper);
      } else {
        newSet.add(paper);
      }
      return newSet;
    });
  };

  const handleSelectAllPapers = () => {
    setSelectedPapers(new Set(availablePapers));
  };

  const handleDeselectAllPapers = () => {
    setSelectedPapers(new Set());
  };

  const handleShortenSequence = async () => {
    if (!selectedUserId || !currentSequenceInfo) {
      appendLog("error", "Please select a user with a sequence");
      return;
    }

    if (newSize >= currentSequenceInfo.totalGalaxies) {
      appendLog("error", "New size must be smaller than current size");
      return;
    }

    if (newSize < currentSequenceInfo.currentIndex) {
      appendLog(
        "error",
        `Cannot shorten to ${newSize}: user has already processed ${currentSequenceInfo.currentIndex} galaxies`
      );
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(null);

      const toRemove = currentSequenceInfo.totalGalaxies - newSize;
      appendLog(
        "info",
        `Starting sequence shortening: removing ${toRemove} galaxies (${currentSequenceInfo.totalGalaxies} → ${newSize})`
      );

      const batchSize = 500;
      let batchIndex = 0;
      const totalBatches = Math.ceil(toRemove / batchSize);

      while (true) {
        const result = await shortenUserSequence({
          targetUserId: selectedUserId as any,
          newSize,
          batchIndex,
          batchSize,
        });

        if (!result.success) {
          throw new Error("Failed to process batch");
        }

        setProgress({
          currentBatch: batchIndex + 1,
          totalBatches,
          processedItems: result.totalProcessed ?? 0,
          totalItems: toRemove,
          message: result.message,
        });

        appendLog("info", result.message);

        if (result.isComplete) {
          appendLog(
            "success",
            `Successfully shortened sequence: removed ${result.galaxiesRemoved} galaxies`
          );

          // Send email notification if enabled
          if (sendShortenEmail) {
            try {
              appendLog("info", "Sending notification email...");
              const emailResult = await sendSequenceShortenedEmail({
                targetUserId: selectedUserId as any,
                previousSize: currentSequenceInfo.totalGalaxies,
                newSize: result.newSequenceSize!,
                galaxiesRemoved: result.galaxiesRemoved!,
              });

              if (!emailResult.success) {
                appendLog(
                  "warning",
                  emailResult.details
                    ? `${emailResult.message}: ${emailResult.details}`
                    : emailResult.message
                );
              } else {
                appendLog(
                  "success",
                  `Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
                );
              }
            } catch (emailError) {
              const message = (emailError as Error)?.message || "Unknown error";
              appendLog("warning", `Failed to send notification email: ${message}`);
            }
          }

          // Refresh sequence info
          const newInfo = await sequenceInfo({ targetUserId: selectedUserId as any });
          setCurrentSequenceInfo(newInfo);
          break;
        }

        batchIndex++;
      }
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Failed to shorten sequence: ${message}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleExtendSequence = async () => {
    if (!selectedUserId || !currentSequenceInfo) {
      appendLog("error", "Please select a user with a sequence");
      return;
    }

    if (additionalSize <= 0) {
      appendLog("error", "Additional size must be greater than 0");
      return;
    }

    if (selectedPapers.size === 0) {
      appendLog("error", "Please select at least one paper to include");
      return;
    }

    const paperFilter =
      selectedPapers.size === availablePapers.length ? undefined : Array.from(selectedPapers);

    try {
      setIsProcessing(true);
      setProgress(null);

      const previousSize = currentSequenceInfo.totalGalaxies;

      appendLog(
        "info",
        `Starting sequence extension: adding up to ${additionalSize} galaxies, K=${minAssignmentsPerEntry}, M=${maxAssignmentsPerUserPerEntry}`
      );

      // Phase 1: Extend the sequence (select and add galaxies)
      const result = await extendUserSequence({
        targetUserId: selectedUserId as any,
        additionalSize,
        expectedUsers,
        minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry,
        allowOverAssign,
        paperFilter,
      });

      result.warnings?.forEach((warning: string) => appendLog("warning", warning));

      if (!result.success) {
        (result.errors || []).forEach((error: string) => appendLog("error", error));
        appendLog(
          "error",
          `Failed to extend sequence: generated ${result.generated} of ${result.requested}`
        );
        return;
      }

      appendLog(
        "success",
        `Added ${result.generated} galaxies to sequence (${previousSize} → ${result.newSequenceSize})`
      );

      // Phase 2: Update stats in batches
      if (result.statsBatchesNeeded && result.statsBatchesNeeded > 0) {
        const totalBatches = result.statsBatchesNeeded;
        const batchSize = result.statsBatchSize || 500;

        setProgress({
          currentBatch: 1,
          totalBatches,
          processedItems: 0,
          totalItems: result.generated,
          message: "Starting stats updates...",
        });

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const statsResult = await updateExtendedSequenceStats({
            targetUserId: selectedUserId as any,
            startIndex: previousSize, // Start from where new galaxies begin
            batchIndex,
            batchSize,
            perUserCapM: maxAssignmentsPerUserPerEntry,
          });

          if (!statsResult.success) {
            throw new Error(`Failed to update stats batch ${batchIndex + 1}`);
          }

          setProgress({
            currentBatch: batchIndex + 1,
            totalBatches,
            processedItems: statsResult.totalProcessed,
            totalItems: result.generated,
            message: statsResult.isComplete
              ? "Completed stats updates"
              : `Updated stats for batch ${batchIndex + 1}/${totalBatches}`,
          });

          appendLog(
            "info",
            statsResult.isComplete
              ? "Completed stats updates"
              : `Updated stats for batch ${batchIndex + 1}/${totalBatches}`
          );

          if (statsResult.isComplete) {
            break;
          }
        }

        appendLog("success", "Sequence extension and stats updates completed!");
      } else {
        appendLog("success", "Sequence extension completed (no stats updates needed)");
      }

      // Send email notification if enabled
      if (sendExtendEmail && result.newSequenceSize) {
        try {
          appendLog("info", "Sending notification email...");
          const emailResult = await sendSequenceExtendedEmail({
            targetUserId: selectedUserId as any,
            previousSize,
            newSize: result.newSequenceSize,
            galaxiesAdded: result.generated,
          });

          if (!emailResult.success) {
            appendLog(
              "warning",
              emailResult.details
                ? `${emailResult.message}: ${emailResult.details}`
                : emailResult.message
            );
          } else {
            appendLog(
              "success",
              `Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
            );
          }
        } catch (emailError) {
          const message = (emailError as Error)?.message || "Unknown error";
          appendLog("warning", `Failed to send notification email: ${message}`);
        }
      }

      // Refresh sequence info
      const newInfo = await sequenceInfo({ targetUserId: selectedUserId as any });
      setCurrentSequenceInfo(newInfo);
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Failed to extend sequence: ${message}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const selectedUserInfo = usersWithSequences?.find((u) => u.userId === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Update User Sequence
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Modify an existing user's galaxy sequence by shortening it (remove galaxies from the end)
          or extending it (add more galaxies using balanced selection).
        </p>

        <div className="space-y-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Select User with Sequence
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isProcessing}
            >
              <option value="">Select a user...</option>
              {usersWithSequences?.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.user?.name || user.user?.email || "Anonymous"} -{" "}
                  {user.sequenceInfo.galaxyCount} galaxies (
                  {user.sequenceInfo.numClassified} classified)
                </option>
              ))}
            </select>
          </div>

          {/* Current Sequence Info */}
          {currentSequenceInfo && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Current Sequence Status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total galaxies:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {currentSequenceInfo.totalGalaxies}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Current position:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {currentSequenceInfo.currentIndex}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Classified:</span>
                  <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                    {currentSequenceInfo.numClassified}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Remaining:</span>
                  <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                    {currentSequenceInfo.remaining}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          {selectedUserId && currentSequenceInfo && (
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Update Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="updateMode"
                    value="extend"
                    checked={updateMode === "extend"}
                    onChange={() => setUpdateMode("extend")}
                    disabled={isProcessing}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    ➕ Extend (add more galaxies)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="updateMode"
                    value="shorten"
                    checked={updateMode === "shorten"}
                    onChange={() => setUpdateMode("shorten")}
                    disabled={isProcessing}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    ➖ Shorten (remove galaxies from end)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Shorten Mode Options */}
          {selectedUserId && currentSequenceInfo && updateMode === "shorten" && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-3">
                Shorten Sequence
              </h3>
              <p className="text-xs text-orange-700 dark:text-orange-300 mb-4">
                Remove galaxies from the end of the sequence. Assignment counters will be
                decremented for removed galaxies.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                    New Sequence Size
                    <span className="block text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Must be at least {currentSequenceInfo.currentIndex} (current position) and
                      less than {currentSequenceInfo.totalGalaxies} (current size)
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={currentSequenceInfo.currentIndex}
                      max={currentSequenceInfo.totalGalaxies - 1}
                      value={newSize}
                      onChange={(e) => setNewSize(Number(e.target.value))}
                      className="w-32 border border-orange-300 dark:border-orange-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      (removing{" "}
                      <span className="font-semibold">
                        {Math.max(0, currentSequenceInfo.totalGalaxies - newSize)}
                      </span>{" "}
                      galaxies)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sendShortenEmail}
                      onChange={(e) => setSendShortenEmail(e.target.checked)}
                      className="mr-2"
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      Send email notification to user
                    </span>
                  </label>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 ml-6">
                    Notifies the user that their sequence has been shortened.
                  </p>
                </div>

                <button
                  onClick={() => void handleShortenSequence()}
                  disabled={
                    isProcessing ||
                    newSize >= currentSequenceInfo.totalGalaxies ||
                    newSize < currentSequenceInfo.currentIndex
                  }
                  className="inline-flex items-center bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isProcessing && updateMode === "shorten" && (
                    <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isProcessing && updateMode === "shorten" ? "Shortening..." : "Shorten Sequence"}
                </button>
              </div>
            </div>
          )}

          {/* Extend Mode Options */}
          {selectedUserId && currentSequenceInfo && updateMode === "extend" && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
                Extend Sequence
              </h3>
              <p className="text-xs text-green-700 dark:text-green-300 mb-4">
                Add more galaxies to the sequence using balanced selection. The same selection
                algorithm as "Generate Balanced Sequence" is used.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Additional Galaxies
                      <span className="block text-xs text-green-600 dark:text-green-400 mt-1">
                        Number of galaxies to add (max{" "}
                        {Math.max(0, 8192 - currentSequenceInfo.totalGalaxies)})
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, 8192 - currentSequenceInfo.totalGalaxies)}
                      value={additionalSize}
                      onChange={(e) => setAdditionalSize(Number(e.target.value))}
                      className="w-full border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Expected Users (N)
                      <span className="block text-xs text-green-600 dark:text-green-400 mt-1">
                        For balancing calculations
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={expectedUsers}
                      onChange={(e) => setExpectedUsers(Number(e.target.value))}
                      className="w-full border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Min Assignments (K)
                      <span className="block text-xs text-green-600 dark:text-green-400 mt-1">
                        Prioritize galaxies with &lt; K assignments
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minAssignmentsPerEntry}
                      onChange={(e) => setMinAssignmentsPerEntry(Number(e.target.value))}
                      className="w-full border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Max Per User (M)
                      <span className="block text-xs text-green-600 dark:text-green-400 mt-1">
                        Max times user can classify same galaxy
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxAssignmentsPerUserPerEntry}
                      onChange={(e) => setMaxAssignmentsPerUserPerEntry(Number(e.target.value))}
                      className="w-full border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
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
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      Allow Over-Assign (use galaxies with totalAssigned &gt;= K)
                    </span>
                  </label>
                </div>

                {/* Paper Filter */}
                <div>
                  <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    Paper Filter
                    <span className="block text-xs text-green-600 dark:text-green-400 mt-1">
                      Select which papers to include
                    </span>
                  </label>
                  {availablePapers.length === 0 ? (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      No papers configured.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={handleSelectAllPapers}
                          disabled={isProcessing}
                          className="text-xs px-2 py-1 bg-green-200 dark:bg-green-700 hover:bg-green-300 dark:hover:bg-green-600 rounded disabled:opacity-50 text-green-800 dark:text-green-100"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllPapers}
                          disabled={isProcessing}
                          className="text-xs px-2 py-1 bg-green-200 dark:bg-green-700 hover:bg-green-300 dark:hover:bg-green-600 rounded disabled:opacity-50 text-green-800 dark:text-green-100"
                        >
                          Deselect All
                        </button>
                        <span className="text-xs text-green-600 dark:text-green-400 self-center ml-2">
                          {selectedPapers.size} of {availablePapers.length} selected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-white dark:bg-gray-800 rounded-md border border-green-200 dark:border-green-700 max-h-32 overflow-y-auto">
                        {availablePapers.map((paper: string) => (
                          <label key={paper} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPapers.has(paper)}
                              onChange={() => handlePaperToggle(paper)}
                              disabled={isProcessing}
                              className="mr-2"
                            />
                            <span className="text-green-900 dark:text-green-100 truncate">
                              {paper || "(empty)"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sendExtendEmail}
                      onChange={(e) => setSendExtendEmail(e.target.checked)}
                      className="mr-2"
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      Send email notification to user
                    </span>
                  </label>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 ml-6">
                    Notifies the user that new galaxies have been added to their sequence.
                  </p>
                </div>

                <button
                  onClick={() => void handleExtendSequence()}
                  disabled={
                    isProcessing ||
                    additionalSize <= 0 ||
                    selectedPapers.size === 0 ||
                    currentSequenceInfo.totalGalaxies >= 8192
                  }
                  className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isProcessing && updateMode === "extend" && (
                    <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isProcessing && updateMode === "extend" ? "Extending..." : "Extend Sequence"}
                </button>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {progress && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-2 bg-blue-200 dark:bg-blue-700 rounded-full flex-1">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${(progress.processedItems / progress.totalItems) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {progress.processedItems}/{progress.totalItems}
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">{progress.message}</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Batch {progress.currentBatch} of {progress.totalBatches}
              </p>
            </div>
          )}

          {/* Activity Log */}
          <div 
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto space-y-1"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
              <span>Activity Log</span>
              <button
                type="button"
                onClick={handleClearLogs}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-60"
                disabled={logs.length === 0}
              >
                Clear
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No log entries yet.</p>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={log.timestamp + idx}
                  className={`text-xs rounded px-2 py-1 border ${
                    log.level === "error"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100"
                      : log.level === "warning"
                        ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-100"
                        : log.level === "success"
                          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100"
                          : "border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  }`}
                >
                  <span className="text-[11px] mr-2 text-gray-500 dark:text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="uppercase text-[10px] mr-2 tracking-wide font-semibold">
                    {log.level}
                  </span>
                  <span className="align-middle">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
