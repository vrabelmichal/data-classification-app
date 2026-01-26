import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_AVAILABLE_PAPERS } from "../../lib/defaults";

interface GenerateBalancedUserSequenceProps {
  users: any[];
  systemSettings: any;
}

export function GenerateBalancedUserSequence({ users: _users, systemSettings }: GenerateBalancedUserSequenceProps) {
  const LOG_STORAGE_KEY = "generateBalancedUserSequenceLogs";

  const [sequenceSize, setSequenceSize] = useState(50);
  const [expectedUsers, setExpectedUsers] = useState(10);
  const [minAssignmentsPerEntry, setMinAssignmentsPerEntry] = useState(3);
  const [maxAssignmentsPerUserPerEntry, setMaxAssignmentsPerUserPerEntry] = useState(1);
  const [allowOverAssign, setAllowOverAssign] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [generatingSequence, setGeneratingSequence] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(false);
  const [logs, setLogs] = useState<
    Array<{ level: "info" | "warning" | "error" | "success"; message: string; timestamp: number }>
  >([]);
  const [statsProgress, setStatsProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedGalaxies: number;
    totalGalaxies: number;
    message: string;
  } | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  const usersWithoutSequences = useQuery(api.galaxies.sequence.getUsersWithoutSequences);
  
  // Get available papers from system settings
  const availablePapers: string[] = systemSettings?.availablePapers || DEFAULT_AVAILABLE_PAPERS;

  const appendLog = (level: "info" | "warning" | "error" | "success", message: string) => {
    const entry = { level, message, timestamp: Date.now() };
    setLogs((prev) => {
      const next = [...prev, entry];
      // Keep the log bounded so local storage does not grow unbounded.
      const MAX_LOG_ENTRIES = 300;
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  };

  // Initialize all papers as selected when they load
  useEffect(() => {
    if (availablePapers.length > 0 && selectedPapers.size === 0) {
      setSelectedPapers(new Set(availablePapers));
    }
  }, [availablePapers, selectedPapers]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist logs to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (err) {
      console.warn("Failed to persist logs to localStorage", err);
    }
  }, [LOG_STORAGE_KEY, logs]);

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

  const handleClearLogs = () => {
    setLogs([]);
    setUserHasScrolled(false);
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear logs from localStorage", err);
    }
  };

  const generateBalancedUserSequence = useMutation(api.generateBalancedUserSequence.generateBalancedUserSequence);
  const updateGalaxyAssignmentStats = useMutation(api.generateBalancedUserSequence.updateGalaxyAssignmentStats);
  const sendSequenceGeneratedEmail = useAction(api.generateBalancedUserSequence.sendSequenceGeneratedEmail);

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

  const handleGenerateSequence = async () => {
    if (!selectedUserId) {
      appendLog("error", "Please select a user");
      return;
    }

    if (selectedPapers.size === 0) {
      appendLog("error", "Please select at least one paper to include");
      return;
    }

    // Enforce client-side limit
    const MAX_SEQUENCE_SIZE = 8192;
    const effectiveSequenceSize = Math.min(sequenceSize, MAX_SEQUENCE_SIZE);
    if (sequenceSize > MAX_SEQUENCE_SIZE) {
      appendLog("warning", `Sequence size capped at ${MAX_SEQUENCE_SIZE} (database limit)`);
    }

    const paperFilter =
      selectedPapers.size === availablePapers.length ? undefined : Array.from(selectedPapers);

    // Helper to format paper filter for display (handles empty strings)
    const formatPaperFilter = (papers: string[] | undefined): string => {
      if (!papers) return "all";
      return papers.map(p => p === "" ? '(empty)' : p).join(", ");
    };

    try {
      setGeneratingSequence(true);
      setStatsProgress(null);

      appendLog(
        "info",
        `Starting sequence generation for user ${selectedUserId} with S=${effectiveSequenceSize}, K=${minAssignmentsPerEntry}, M=${maxAssignmentsPerUserPerEntry}, overAssign=${allowOverAssign}, papers=[${formatPaperFilter(paperFilter)}]`
      );

      // Step 1: Generate the sequence
      const result = await generateBalancedUserSequence({
        targetUserId: selectedUserId as any,
        expectedUsers,
        minAssignmentsPerEntry,
        maxAssignmentsPerUserPerEntry,
        sequenceSize: effectiveSequenceSize,
        allowOverAssign,
        paperFilter,
      });

      if (!result.success) {
        result.warnings?.forEach((warning: string) => appendLog("warning", warning));
        (result.errors || []).forEach((error: string) => appendLog("error", error));
        appendLog(
          "error",
          `Failed to generate sequence: generated ${result.generated} of ${result.requested}. Check filters (papers) and thresholds (K, M).`
        );
        return;
      }

      result.warnings?.forEach((warning: string) => appendLog("warning", warning));
      appendLog(
        "success",
        `Generated ${result.generated} of ${result.requested} galaxies. K=${result.minAssignmentsPerEntry}, M=${result.perUserCap}`
      );

      // Step 2: Update stats in batches if needed
      if (result.statsBatchesNeeded && result.statsBatchesNeeded > 0) {
        const totalBatches = result.statsBatchesNeeded;
        const batchSize = result.statsBatchSize || 500;

        setStatsProgress({
          currentBatch: 1,
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
              ? "Completed stats updates"
              : `Updated stats for batch ${batchIndex + 1}/${totalBatches}`,
          });

          appendLog(
            "info",
            statsResult.isLastBatch
              ? "Completed stats updates"
              : `Updated stats for batch ${batchIndex + 1}/${totalBatches}`
          );

          if (statsResult.isLastBatch) {
            break;
          }
        }

        appendLog("success", "Sequence generation and stats updates completed!");
      } else {
        appendLog("success", "Sequence generation completed (no stats updates needed)");
      }

      if (sendEmailNotification) {
        try {
          appendLog("info", "Sending notification email...");
          const emailResult = await sendSequenceGeneratedEmail({
            targetUserId: selectedUserId as any,
            generated: result.generated,
            requested: result.requested,
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
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Failed to generate sequence: ${message}`);
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
              {usersWithoutSequences?.map((user: { userId: string; user?: { name?: string | null; email?: string | null } | null }) => (
                <option key={user.userId} value={user.userId}>
                  {user.user?.name || user.user?.email || "Anonymous"} ({user.userId})
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

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={sendEmailNotification}
                onChange={(e) => setSendEmailNotification(e.target.checked)}
                className="mr-2"
                disabled={generatingSequence}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Send email notification to user
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Sends a one-time email when the sequence has been generated.
            </p>
          </div>

          {/* Paper Filter Section */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Paper Filter
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select which papers to include in the sequence (based on misc.paper field)
              </span>
            </label>
            {availablePapers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No papers configured. Configure available papers in Settings tab.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPapers}
                    disabled={generatingSequence}
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPapers}
                    disabled={generatingSequence}
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50 text-gray-700 dark:text-gray-300"
                  >
                    Deselect All
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center ml-2">
                    {selectedPapers.size} of {availablePapers.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                  {availablePapers.map((paper: string) => (
                    <label key={paper} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPapers.has(paper)}
                        onChange={() => handlePaperToggle(paper)}
                        className="mr-2"
                        disabled={generatingSequence}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={paper || '(empty string)'}>
                        {paper === "" ? '(empty string)' : paper}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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

          {/* Persistent log view */}
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