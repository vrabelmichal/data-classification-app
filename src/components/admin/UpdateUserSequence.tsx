import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DEFAULT_ASSIGNMENT_PREVIEW_COUNT,
  DEFAULT_AVAILABLE_PAPERS,
  DEFAULT_EXPECTED_USERS,
} from "../../lib/defaults";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ManualGalaxyIdProcedureFields,
  getManualGalaxyIdInputState,
  parseGalaxyIds,
} from "./ManualGalaxyIdSequenceAssignment";
import {
  SearchableUserSelect,
  SearchableUserChecklist,
  type SearchableUserOption,
} from "../shared/UserPickers";
import { getPaperCitation, getPaperLabel } from "../../lib/paperDisplay";

interface UpdateUserSequenceProps {
  users: any[];
  systemSettings: any;
}

type UpdateMode = "shorten" | "extend";
type AssignmentProcedure = "balanced" | "classificationBased" | "manualList";

type ClassificationAssignmentDiagnostics = {
  effectiveBlacklistCount: number;
  systemBlacklistedCount: number;
  additionalBlacklistedCount: number;
  excludedSequenceGalaxyCount: number;
  excludedSequenceUserCount: number;
  targetExistingSequenceCount: number;
  classificationPrioritySelectedCount: number;
  balancedFallbackSelectedCount: number;
  balancedFallbackUnderAssignedCount: number;
  balancedFallbackOverAssignedCount: number;
};

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
    userDisplayName?: string;
    userIdShort?: string;
  } | null>(null);

  // Shorten mode state
  const [newSize, setNewSize] = useState<number>(0);
  const [sendShortenEmail, setSendShortenEmail] = useState(false);

  // Extend mode state
  const [assignmentProcedure, setAssignmentProcedure] = useState<AssignmentProcedure>("balanced");
  const [additionalSize, setAdditionalSize] = useState(50);
  const [sendExtendEmail, setSendExtendEmail] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [expectedUsers, setExpectedUsers] = useState(DEFAULT_EXPECTED_USERS);
  const [minAssignmentsPerEntry, setMinAssignmentsPerEntry] = useState(3);
  const [maxAssignmentsPerUserPerEntry, setMaxAssignmentsPerUserPerEntry] = useState(1);
  const [allowOverAssign, setAllowOverAssign] = useState(false);
  const [targetClassificationCount, setTargetClassificationCount] = useState(3);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [additionalBlacklistIds, setAdditionalBlacklistIds] = useState<string[]>([]);
  const [additionalBlacklistFileName, setAdditionalBlacklistFileName] = useState("");
  const [manualGalaxyIdsText, setManualGalaxyIdsText] = useState("");
  const [manualUploadedGalaxyIds, setManualUploadedGalaxyIds] = useState<string[]>([]);
  const [manualUploadedFileName, setManualUploadedFileName] = useState("");
  const [excludedSequenceUserIds, setExcludedSequenceUserIds] = useState<Set<string>>(new Set());

  const logContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const expectedUsersEditedRef = useRef(false);

  // Queries
  const usersWithSequences = useQuery(api.galaxies.sequence.getUsersWithSequences);
  const sequenceInfo = useMutation(api.updateUserSequence.getUserSequenceInfo);
  const manualInputState = getManualGalaxyIdInputState(manualGalaxyIdsText, manualUploadedGalaxyIds);

  const userOptions = useMemo<SearchableUserOption[]>(
    () =>
      (usersWithSequences ?? []).map((user) => ({
        id: user.userId,
        userId: user.userId,
        name: user.user?.name,
        email: user.user?.email,
        description: `${user.sequenceInfo.galaxyCount} galaxies · ${user.sequenceInfo.numClassified} classified`,
      })),
    [usersWithSequences],
  );

  const excludedSequenceUserOptions = useMemo<SearchableUserOption[]>(
    () =>
      (usersWithSequences ?? [])
        .filter((user) => user.userId !== selectedUserId)
        .map((user) => ({
          id: user.userId,
          userId: user.userId,
          name: user.user?.name,
          email: user.user?.email,
          description: `${user.sequenceInfo.galaxyCount} galaxies in sequence`,
        })),
    [usersWithSequences, selectedUserId],
  );

  // Current sequence info for the selected user
  const [currentSequenceInfo, setCurrentSequenceInfo] = useState<{
    totalGalaxies: number;
    effectiveTotalGalaxies?: number;
    blacklistedGalaxies?: number;
    blacklistedClassifiedCount?: number;
    currentIndex: number;
    numClassified: number;
    numSkipped: number;
    remaining: number;
    effectiveRemaining?: number;
  } | null>(null);

  // Mutations
  const shortenUserSequence = useMutation(api.updateUserSequence.shortenUserSequence);
  const extendUserSequence = useMutation(api.updateUserSequence.extendUserSequence);
  const assignGalaxyIdsToSequence = useMutation(api.updateUserSequence.assignGalaxyIdsToSequence);
  const extendSequenceByClassificationTarget = useAction(
    api.classificationBasedAssignment.extendSequenceByClassificationTarget
  );
  const updateExtendedSequenceStats = useMutation(api.updateUserSequence.updateExtendedSequenceStats);
  const updateManualSequenceAssignmentStats = useMutation(api.updateUserSequence.updateManualSequenceAssignmentStats);

  // Actions (email notifications)
  const sendSequenceShortenedEmail = useAction(api.updateUserSequence.sendSequenceShortenedEmail);
  const sendSequenceExtendedEmail = useAction(api.updateUserSequence.sendSequenceExtendedEmail);

  // Get available papers from system settings
  const availablePapers: string[] = systemSettings?.availablePapers || DEFAULT_AVAILABLE_PAPERS;
  const paperMetadata = systemSettings?.paperMetadata;
  const defaultExpectedUsers = Math.max(DEFAULT_EXPECTED_USERS, usersWithSequences?.length ?? 0);

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

  useEffect(() => {
    if (!expectedUsersEditedRef.current) {
      setExpectedUsers(defaultExpectedUsers);
    }
  }, [defaultExpectedUsers]);

  useEffect(() => {
    if (assignmentProcedure !== "manualList") {
      return;
    }

    setDryRun(false);
  }, [assignmentProcedure]);

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

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    setExcludedSequenceUserIds((prev) => {
      if (!prev.has(selectedUserId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(selectedUserId);
      return next;
    });
  }, [selectedUserId]);

  const handleClearLogs = () => {
    setLogs([]);
    setUserHasScrolled(false);
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear logs from localStorage", err);
    }
  };

  const handleExpectedUsersChange = (value: string) => {
    expectedUsersEditedRef.current = true;
    setExpectedUsers(Number(value));
  };

  const handleDryRunChange = (checked: boolean) => {
    setDryRun(checked);
    if (checked) {
      setSendExtendEmail(false);
    }
  };

  const getExtendButtonLabel = () => {
    if (isProcessing && updateMode === "extend") return "Extending...";

    if (assignmentProcedure === "manualList") {
      return "Append Sequence (Manual ID List)";
    }

    const prefix = dryRun ? "Dry Run " : "";
    const suffix = assignmentProcedure === "classificationBased"
      ? "Extend Sequence (Classification-Based)"
      : "Extend Sequence";
    return prefix + suffix;
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

  const formatPaperFilter = (papers: string[] | undefined): string => {
    if (!papers) return "all";
    return papers.map((paper) => (paper === "" ? "(empty)" : paper)).join(", ");
  };

  const appendClassificationDiagnosticsLogs = (
    userDisplayName: string,
    userIdShort: string,
    diagnostics: ClassificationAssignmentDiagnostics | undefined
  ) => {
    if (!diagnostics) {
      return;
    }

    appendLog(
      "info",
      `[${userDisplayName} (${userIdShort})] Exclusions resolved: currentSequence=${diagnostics.targetExistingSequenceCount}, effectiveBlacklist=${diagnostics.effectiveBlacklistCount} (system=${diagnostics.systemBlacklistedCount}, extra=${diagnostics.additionalBlacklistedCount}, excludedSequenceGalaxies=${diagnostics.excludedSequenceGalaxyCount} from ${diagnostics.excludedSequenceUserCount} selected sequence users)`
    );
    appendLog(
      "info",
      `[${userDisplayName} (${userIdShort})] Selection details: classificationPriority=${diagnostics.classificationPrioritySelectedCount}, fallbackUnderK=${diagnostics.balancedFallbackUnderAssignedCount}, overAssignFallback=${diagnostics.balancedFallbackOverAssignedCount}`
    );
  };

  const appendAssignedGalaxyPreviewLogs = (
    userDisplayName: string,
    userIdShort: string,
    selectedGalaxyIds: string[] | undefined,
    selectedGalaxyIdsCount: number | undefined,
    dryRunMode: boolean
  ) => {
    if (!selectedGalaxyIds || selectedGalaxyIds.length === 0) {
      return;
    }

    const previewIds = selectedGalaxyIds.slice(0, DEFAULT_ASSIGNMENT_PREVIEW_COUNT);
    const totalSelectedCount = selectedGalaxyIdsCount ?? selectedGalaxyIds.length;
    appendLog(
      "info",
      `[${userDisplayName} (${userIdShort})] Showing first ${previewIds.length} of ${totalSelectedCount} galaxies ${dryRunMode ? "that would be added" : "added to the sequence"}`
    );
    appendLog(
      "info",
      `[${userDisplayName} (${userIdShort})] ${dryRunMode ? "Dry-run preview galaxies" : "Added galaxies"}: ${previewIds.join(", ")}`
    );
  };

  const handleExcludedSequenceToggle = (userId: string) => {
    setExcludedSequenceUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSelectAllExcludedSequences = () => {
    const allIds = (usersWithSequences ?? [])
      .map((user) => user.userId)
      .filter((userId) => userId !== selectedUserId);
    setExcludedSequenceUserIds(new Set(allIds));
  };

  const handleDeselectAllExcludedSequences = () => {
    setExcludedSequenceUserIds(new Set());
  };

  const handleAdditionalBlacklistFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsedIds = Array.from(
        new Set(
          content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        )
      );

      setAdditionalBlacklistIds(parsedIds);
      setAdditionalBlacklistFileName(file.name);
      appendLog("info", `Loaded ${parsedIds.length} additional blacklisted galaxy IDs from ${file.name}`);
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Failed to read blacklist file: ${message}`);
    }
  };

  const handleClearAdditionalBlacklist = () => {
    setAdditionalBlacklistIds([]);
    setAdditionalBlacklistFileName("");
  };

  const handleManualGalaxyIdFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsedIds = parseGalaxyIds(content);
      setManualUploadedGalaxyIds(parsedIds);
      setManualUploadedFileName(file.name);
      appendLog("info", `Loaded ${parsedIds.length} galaxy IDs from ${file.name}`);
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Failed to read galaxy ID file: ${message}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleClearManualGalaxyIdFile = () => {
    setManualUploadedGalaxyIds([]);
    setManualUploadedFileName("");
  };

  const resetManualGalaxyIdInputs = () => {
    setManualGalaxyIdsText("");
    setManualUploadedGalaxyIds([]);
    setManualUploadedFileName("");
  };

  const handleShortenSequence = async () => {
    if (!selectedUserId || !currentSequenceInfo) {
      appendLog("error", "Please select a user with a sequence");
      return;
    }

    // Resolve user display info for logs
    const userInfo = usersWithSequences?.find((u) => u.userId === selectedUserId);
    const userEmail = userInfo?.user?.email || "";
    const userName = userInfo?.user?.name || "";
    const truncateString = (str: string, maxLen: number) => (str.length > maxLen ? str.substring(0, maxLen) + "..." : str);
    const userDisplayName = userName ? truncateString(userName, 20) : (userEmail ? truncateString(userEmail, 30) : "Unknown");
    const userIdShort = selectedUserId.substring(0, 8);

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
        `[${userDisplayName} (${userIdShort})] Starting sequence shortening: removing ${toRemove} galaxies (${currentSequenceInfo.totalGalaxies} → ${newSize})`
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
          userDisplayName,
          userIdShort,
        });

        appendLog("info", `[${userDisplayName} (${userIdShort})] ${result.message}`);

        if (result.isComplete) {
          appendLog(
            "success",
            `[${userDisplayName} (${userIdShort})] Successfully shortened sequence: removed ${result.galaxiesRemoved} galaxies`
          );

          // Send email notification if enabled
          if (sendShortenEmail) {
            try {
              appendLog("info", `[${userDisplayName} (${userIdShort})] Sending notification email...`);
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
                    ? `[${userDisplayName} (${userIdShort})] ${emailResult.message}: ${emailResult.details}`
                    : `[${userDisplayName} (${userIdShort})] ${emailResult.message}`
                );
              } else {
                appendLog(
                  "success",
                  `[${userDisplayName} (${userIdShort})] Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
                );
              }
            } catch (emailError) {
              const message = (emailError as Error)?.message || "Unknown error";
              appendLog("warning", `[${userDisplayName} (${userIdShort})] Failed to send notification email: ${message}`);
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
      const userInfoErr = usersWithSequences?.find((u) => u.userId === selectedUserId);
      const userEmailErr = userInfoErr?.user?.email || "";
      const userNameErr = userInfoErr?.user?.name || "";
      const userDisplayNameErr = userNameErr ? truncateString(userNameErr, 20) : (userEmailErr ? truncateString(userEmailErr, 30) : "Unknown");
      const userIdShortErr = selectedUserId.substring(0, 8);
      appendLog("error", `[${userDisplayNameErr} (${userIdShortErr})] Failed to shorten sequence: ${message}`);
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

    // Resolve user display info for logs
    const userInfo = usersWithSequences?.find((u) => u.userId === selectedUserId);
    const userEmail = userInfo?.user?.email || "";
    const userName = userInfo?.user?.name || "";
    const truncateString = (str: string, maxLen: number) => (str.length > maxLen ? str.substring(0, maxLen) + "..." : str);
    const userDisplayName = userName ? truncateString(userName, 20) : (userEmail ? truncateString(userEmail, 30) : "Unknown");
    const userIdShort = selectedUserId.substring(0, 8);

    if (assignmentProcedure === "manualList" && manualInputState.combinedGalaxyIds.length === 0) {
      appendLog("error", "Provide at least one galaxy ID by pasting text or uploading a TXT file.");
      return;
    }

    if (assignmentProcedure !== "manualList" && additionalSize <= 0) {
      appendLog("error", "Additional size must be greater than 0");
      return;
    }

    if (assignmentProcedure !== "manualList" && selectedPapers.size === 0) {
      appendLog("error", "Please select at least one paper to include");
      return;
    }

    const paperFilter =
      selectedPapers.size === availablePapers.length ? undefined : Array.from(selectedPapers);

    try {
      setIsProcessing(true);
      setProgress(null);

      const previousSize = currentSequenceInfo.totalGalaxies;

      if (assignmentProcedure === "manualList") {
        appendLog(
          "info",
          `[${userDisplayName} (${userIdShort})] Starting manual sequence extension from ${manualInputState.combinedGalaxyIds.length} supplied galaxy IDs`
        );

        const result = await assignGalaxyIdsToSequence({
          targetUserId: selectedUserId as Id<"users">,
          galaxyExternalIds: manualInputState.combinedGalaxyIds,
        });

        result.warnings?.forEach((warning: string) => appendLog("warning", `[${userDisplayName} (${userIdShort})] ${warning}`));

        if (!result.success) {
          (result.errors || []).forEach((error: string) => appendLog("error", `[${userDisplayName} (${userIdShort})] ${error}`));
          if (result.invalidGalaxyIds?.length) {
            appendLog(
              "info",
              `[${userDisplayName} (${userIdShort})] Missing galaxy IDs: ${result.invalidGalaxyIds.slice(0, 5).join(", ")}${result.invalidGalaxyIds.length > 5 ? ", ..." : ""}`
            );
          }
          return;
        }

        if (result.statsBatchesNeeded && result.statsBatchesNeeded > 0) {
          for (let batchIndex = 0; batchIndex < result.statsBatchesNeeded; batchIndex++) {
            const statsResult = await updateManualSequenceAssignmentStats({
              targetUserId: selectedUserId as Id<"users">,
              startIndex: result.statsStartIndex,
              batchIndex,
              batchSize: result.statsBatchSize,
            });

            if (!statsResult.success) {
              throw new Error(
                `Manual stats update failed for targetUserId=${selectedUserId} batchIndex=${batchIndex}: ${statsResult.message ?? (statsResult as { error?: string }).error ?? "Unknown error"}`
              );
            }

            setProgress({
              currentBatch: batchIndex + 1,
              totalBatches: result.statsBatchesNeeded,
              processedItems: statsResult.totalProcessed,
              totalItems: result.addedCount,
              message: statsResult.isComplete
                ? "Completed stats updates"
                : `Updated stats for batch ${batchIndex + 1}/${result.statsBatchesNeeded}`,
              userDisplayName,
              userIdShort,
            });
          }
        }

        appendLog(
          "success",
          `[${userDisplayName} (${userIdShort})] Added ${result.addedCount} galaxies from the supplied list (${previousSize} → ${result.newSequenceSize})`
        );
        appendAssignedGalaxyPreviewLogs(
          userDisplayName,
          userIdShort,
          result.selectedGalaxyIdsPreview,
          result.selectedGalaxyIdsCount,
          false
        );

        if (sendExtendEmail) {
          try {
            appendLog("info", `[${userDisplayName} (${userIdShort})] Sending notification email...`);
            const emailResult = await sendSequenceExtendedEmail({
              targetUserId: selectedUserId as Id<"users">,
              previousSize,
              newSize: result.newSequenceSize,
              galaxiesAdded: result.addedCount,
              procedureType: "manualList",
            });

            if (!emailResult.success) {
              appendLog(
                "warning",
                emailResult.details
                  ? `[${userDisplayName} (${userIdShort})] ${emailResult.message}: ${emailResult.details}`
                  : `[${userDisplayName} (${userIdShort})] ${emailResult.message}`
              );
            } else {
              appendLog(
                "success",
                `[${userDisplayName} (${userIdShort})] Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
              );
            }
          } catch (emailError) {
            const message = (emailError as Error)?.message || "Unknown error";
            appendLog("warning", `[${userDisplayName} (${userIdShort})] Failed to send notification email: ${message}`);
          }
        }

        resetManualGalaxyIdInputs();
      } else if (dryRun) {
        appendLog(
          "info",
          `[${userDisplayName} (${userIdShort})] Dry run is enabled. This extension will only preview the first ${DEFAULT_ASSIGNMENT_PREVIEW_COUNT} galaxies and will not change the sequence, counters, or emails.`
        );
      }

      if (assignmentProcedure === "classificationBased") {
        appendLog(
          "info",
          `[${userDisplayName} (${userIdShort})] Starting classification-based sequence extension: adding up to ${additionalSize} galaxies, currentSequenceSize=${previousSize}, N=${expectedUsers}, C=${targetClassificationCount}, K=${minAssignmentsPerEntry}, M=${maxAssignmentsPerUserPerEntry}, overAssign=${allowOverAssign}, dryRun=${dryRun}, paperFilter=[${formatPaperFilter(paperFilter)}], extraBlacklist=${additionalBlacklistIds.length}, excludedSequenceUsers=${excludedSequenceUserIds.size}`
        );

        if (allowOverAssign) {
          appendLog(
            "info",
            `[${userDisplayName} (${userIdShort})] Over-assign fallback is enabled and may use galaxies with totalAssigned >= K if lower-assignment fallback candidates are exhausted.`
          );
        }

        const result = await extendSequenceByClassificationTarget({
          targetUserId: selectedUserId as Id<"users">,
          additionalSize,
          expectedUsers,
          targetClassificationCount,
          minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry,
          allowOverAssign,
          dryRun,
          paperFilter,
          additionalBlacklistedIds: additionalBlacklistIds,
          excludedSequenceUserIds: Array.from(excludedSequenceUserIds) as Id<"users">[],
        });

        appendClassificationDiagnosticsLogs(
          userDisplayName,
          userIdShort,
          result.diagnostics as ClassificationAssignmentDiagnostics | undefined
        );

        result.warnings?.forEach((warning: string) => appendLog("warning", `[${userDisplayName} (${userIdShort})] ${warning}`));

        if (!result.success) {
          (result.errors || []).forEach((error: string) => appendLog("error", `[${userDisplayName} (${userIdShort})] ${error}`));
          appendLog(
            "error",
            `[${userDisplayName} (${userIdShort})] Failed to extend sequence: generated ${result.generated} of ${result.requested}`
          );
          return;
        }

        if (dryRun) {
          appendLog(
            "success",
            `[${userDisplayName} (${userIdShort})] Dry run would add ${result.generated} galaxies (${previousSize} → ${result.newSequenceSize}) using the classification-based procedure; no sequence, counters, or emails were changed`
          );
          appendAssignedGalaxyPreviewLogs(
            userDisplayName,
            userIdShort,
            result.selectedGalaxyIds,
            result.selectedGalaxyIds?.length,
            true
          );
        } else {
          appendLog(
            "success",
            `[${userDisplayName} (${userIdShort})] Added ${result.generated} galaxies to sequence (${previousSize} → ${result.newSequenceSize}) using the classification-based procedure`
          );
          appendAssignedGalaxyPreviewLogs(
            userDisplayName,
            userIdShort,
            result.selectedGalaxyIds,
            result.selectedGalaxyIds?.length,
            false
          );

          if (sendExtendEmail && result.newSequenceSize) {
            try {
              appendLog("info", `[${userDisplayName} (${userIdShort})] Sending notification email...`);
              const emailResult = await sendSequenceExtendedEmail({
                targetUserId: selectedUserId as any,
                previousSize,
                newSize: result.newSequenceSize,
                galaxiesAdded: result.generated,
                procedureType: "classificationBased",
              });

              if (!emailResult.success) {
                appendLog(
                  "warning",
                  emailResult.details
                    ? `[${userDisplayName} (${userIdShort})] ${emailResult.message}: ${emailResult.details}`
                    : `[${userDisplayName} (${userIdShort})] ${emailResult.message}`
                );
              } else {
                appendLog(
                  "success",
                  `[${userDisplayName} (${userIdShort})] Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
                );
              }
            } catch (emailError) {
              const message = (emailError as Error)?.message || "Unknown error";
              appendLog("warning", `[${userDisplayName} (${userIdShort})] Failed to send notification email: ${message}`);
            }
          }
        }
      } else if (assignmentProcedure === "balanced") {
        appendLog(
          "info",
          `[${userDisplayName} (${userIdShort})] Starting sequence extension: adding up to ${additionalSize} galaxies, K=${minAssignmentsPerEntry}, M=${maxAssignmentsPerUserPerEntry}, overAssign=${allowOverAssign}, dryRun=${dryRun}`
        );

        const result = await extendUserSequence({
          targetUserId: selectedUserId as any,
          additionalSize,
          expectedUsers,
          minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry,
          allowOverAssign,
          dryRun,
          paperFilter,
        });

        result.warnings?.forEach((warning: string) => appendLog("warning", `[${userDisplayName} (${userIdShort})] ${warning}`));

        if (!result.success) {
          (result.errors || []).forEach((error: string) => appendLog("error", `[${userDisplayName} (${userIdShort})] ${error}`));
          appendLog(
            "error",
            `[${userDisplayName} (${userIdShort})] Failed to extend sequence: generated ${result.generated} of ${result.requested}`
          );
          return;
        }

        if (dryRun) {
          const projectedNewSequenceSize = result.projectedNewSequenceSize ?? result.newSequenceSize;
          appendLog(
            "success",
            `[${userDisplayName} (${userIdShort})] Dry run would add ${result.generated} galaxies (${previousSize} → ${projectedNewSequenceSize}); no sequence, counters, or emails were changed`
          );
          appendAssignedGalaxyPreviewLogs(
            userDisplayName,
            userIdShort,
            result.selectedGalaxyIdsPreview,
            result.selectedGalaxyIdsCount,
            true
          );
        } else {
          appendLog(
            "success",
            `[${userDisplayName} (${userIdShort})] Added ${result.generated} galaxies to sequence (${previousSize} → ${result.newSequenceSize})`
          );
          appendAssignedGalaxyPreviewLogs(
            userDisplayName,
            userIdShort,
            result.selectedGalaxyIdsPreview,
            result.selectedGalaxyIdsCount,
            false
          );

          if (result.statsBatchesNeeded && result.statsBatchesNeeded > 0) {
            const totalBatches = result.statsBatchesNeeded;
            const batchSize = result.statsBatchSize || 500;

            setProgress({
              currentBatch: 1,
              totalBatches,
              processedItems: 0,
              totalItems: result.generated,
              message: "Starting stats updates...",
              userDisplayName,
              userIdShort,
            });

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
              const statsResult = await updateExtendedSequenceStats({
                targetUserId: selectedUserId as any,
                startIndex: previousSize,
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
                userDisplayName,
                userIdShort,
              });

              appendLog(
                "info",
                statsResult.isComplete
                  ? `[${userDisplayName} (${userIdShort})] Completed stats updates`
                  : `[${userDisplayName} (${userIdShort})] Updated stats for batch ${batchIndex + 1}/${totalBatches}`
              );

              if (statsResult.isComplete) {
                break;
              }
            }

            appendLog("success", `[${userDisplayName} (${userIdShort})] Sequence extension and stats updates completed!`);
          } else {
            appendLog("success", `[${userDisplayName} (${userIdShort})] Sequence extension completed (no stats updates needed)`);
          }

          if (sendExtendEmail && result.newSequenceSize) {
            try {
              appendLog("info", `[${userDisplayName} (${userIdShort})] Sending notification email...`);
              const emailResult = await sendSequenceExtendedEmail({
                targetUserId: selectedUserId as any,
                previousSize,
                newSize: result.newSequenceSize,
                galaxiesAdded: result.generated,
                procedureType: "balanced",
              });

              if (!emailResult.success) {
                appendLog(
                  "warning",
                  emailResult.details
                    ? `[${userDisplayName} (${userIdShort})] ${emailResult.message}: ${emailResult.details}`
                    : `[${userDisplayName} (${userIdShort})] ${emailResult.message}`
                );
              } else {
                appendLog(
                  "success",
                  `[${userDisplayName} (${userIdShort})] Notification email sent${emailResult.to ? ` to ${emailResult.to}` : ""}`
                );
              }
            } catch (emailError) {
              const message = (emailError as Error)?.message || "Unknown error";
              appendLog("warning", `[${userDisplayName} (${userIdShort})] Failed to send notification email: ${message}`);
            }
          }
        }
      }

      // Refresh sequence info
      if (!dryRun) {
        const newInfo = await sequenceInfo({ targetUserId: selectedUserId as any });
        setCurrentSequenceInfo(newInfo);
      }
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      const userInfoErr = usersWithSequences?.find((u) => u.userId === selectedUserId);
      const userEmailErr = userInfoErr?.user?.email || "";
      const userNameErr = userInfoErr?.user?.name || "";
      const userDisplayNameErr = userNameErr ? truncateString(userNameErr, 20) : (userEmailErr ? truncateString(userEmailErr, 30) : "Unknown");
      const userIdShortErr = selectedUserId.substring(0, 8);
      appendLog("error", `[${userDisplayNameErr} (${userIdShortErr})] Failed to extend sequence: ${message}`);
      console.error(error);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Update User Sequence
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Modify an existing user's galaxy sequence by shortening it (remove galaxies from the end)
          or extending it with the regular balanced assignment procedure, the classification-based alternative, or a manual galaxy-ID list.
        </p>

        <div className="space-y-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Select User with Sequence
            </label>
            <SearchableUserSelect
              options={userOptions}
              value={selectedUserId || null}
              onChange={(v) => setSelectedUserId(v ?? "")}
              placeholder="Select a user..."
              disabled={isProcessing}
              emptyMessage="No users with sequences found."
            />
          </div>

          {/* Current Sequence Info */}
          {currentSequenceInfo && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Current Sequence Status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Stored galaxies:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {currentSequenceInfo.totalGalaxies}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Effective galaxies:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {currentSequenceInfo.effectiveTotalGalaxies ?? currentSequenceInfo.totalGalaxies}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Blacklisted:</span>
                  <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">
                    {currentSequenceInfo.blacklistedGalaxies ?? 0}
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
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Effective remaining:</span>
                  <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                    {currentSequenceInfo.effectiveRemaining ?? currentSequenceInfo.remaining}
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
                Add more galaxies to the sequence using the regular balanced assignment procedure
                or switch to the classification-based procedure, which prioritizes galaxies by
                current classification count before falling back to the balanced rules.
              </p>

              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-gray-800 p-4">
                  <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-3">
                    Assignment Procedure
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-start gap-3 rounded-md border border-green-200 dark:border-green-700 p-3 cursor-pointer">
                      <input
                        type="radio"
                        name="extendAssignmentProcedure"
                        value="balanced"
                        checked={assignmentProcedure === "balanced"}
                        onChange={() => setAssignmentProcedure("balanced")}
                        disabled={isProcessing}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block text-sm font-medium text-green-900 dark:text-green-100">Regular balanced assignment</span>
                        <span className="block text-xs text-green-700 dark:text-green-300 mt-1">
                          Prioritizes galaxies with lower total assignment counts.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-md border border-green-200 dark:border-green-700 p-3 cursor-pointer">
                      <input
                        type="radio"
                        name="extendAssignmentProcedure"
                        value="classificationBased"
                        checked={assignmentProcedure === "classificationBased"}
                        onChange={() => setAssignmentProcedure("classificationBased")}
                        disabled={isProcessing}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block text-sm font-medium text-green-900 dark:text-green-100">Classification-based assignment</span>
                        <span className="block text-xs text-green-700 dark:text-green-300 mt-1">
                          Prioritizes galaxies below a target classification count, breaks ties by fewer senior-classifier classifications, then falls back to the balanced rules.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-md border border-green-200 dark:border-green-700 p-3 cursor-pointer">
                      <input
                        type="radio"
                        name="extendAssignmentProcedure"
                        value="manualList"
                        checked={assignmentProcedure === "manualList"}
                        onChange={() => setAssignmentProcedure("manualList")}
                        disabled={isProcessing}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block text-sm font-medium text-green-900 dark:text-green-100">Manual galaxy ID list</span>
                        <span className="block text-xs text-green-700 dark:text-green-300 mt-1">
                          Appends a known list of galaxy IDs directly to the current sequence and skips IDs already present.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {assignmentProcedure === "manualList" && (
                  <>
                    <ManualGalaxyIdProcedureFields
                      mode="extend"
                      disabled={isProcessing}
                      typedGalaxyIds={manualGalaxyIdsText}
                      uploadedGalaxyIds={manualUploadedGalaxyIds}
                      uploadedFileName={manualUploadedFileName}
                      onTypedGalaxyIdsChange={setManualGalaxyIdsText}
                      onFileChange={handleManualGalaxyIdFileChange}
                      onClearFile={handleClearManualGalaxyIdFile}
                      tone="green"
                    />

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
                        Notifies the user that galaxies from the supplied list were added to their sequence.
                      </p>
                    </div>
                  </>
                )}

                {assignmentProcedure !== "manualList" && (
                <>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                    <label className="block text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                      Additional Galaxies
                      <span className="block text-xs font-normal text-green-600 dark:text-green-400 mt-1">
                        Number of galaxies to add to this user&apos;s sequence in this update.
                      </span>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, 8192 - currentSequenceInfo.totalGalaxies)}
                        value={additionalSize}
                        onChange={(e) => setAdditionalSize(Number(e.target.value))}
                        className="w-full sm:max-w-xs border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={isProcessing}
                      />
                      <span className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-300">
                        Max {Math.max(0, 8192 - currentSequenceInfo.totalGalaxies)} galaxies
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-gray-800 p-4">
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
                      onChange={(e) => handleExpectedUsersChange(e.target.value)}
                      className="w-full border border-green-300 dark:border-green-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
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

                {assignmentProcedure === "classificationBased" && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Classification-Based Priority And Exclusions
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        The balanced settings in this form stay active as fallback rules and per-user limits. The fields below add the classification-count priority and run-scoped exclusions.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                        Target Classification Count
                        <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Galaxies with fewer than this many classifications are prioritized first.
                        </span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={targetClassificationCount}
                        onChange={(e) => setTargetClassificationCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full md:w-48 border border-amber-300 dark:border-amber-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        disabled={isProcessing}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                        Additional Blacklist File
                        <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Upload a plain-text file with one galaxy ID per line to exclude those galaxies for this extension only.
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          accept=".txt,text/plain"
                          onChange={(event) => void handleAdditionalBlacklistFileChange(event)}
                          disabled={isProcessing}
                          className="block text-sm text-amber-900 dark:text-amber-100"
                        />
                        <button
                          type="button"
                          onClick={handleClearAdditionalBlacklist}
                          disabled={isProcessing || additionalBlacklistIds.length === 0}
                          className="text-xs px-2 py-1 bg-amber-200 dark:bg-amber-700 hover:bg-amber-300 dark:hover:bg-amber-600 rounded disabled:opacity-50 text-amber-900 dark:text-amber-100"
                        >
                          Clear Uploaded Blacklist
                        </button>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                        {additionalBlacklistIds.length > 0
                          ? `${additionalBlacklistIds.length} extra galaxy IDs loaded${additionalBlacklistFileName ? ` from ${additionalBlacklistFileName}` : ""}.`
                          : "No extra blacklist file loaded."}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                        Exclude Galaxies From Existing User Sequences
                        <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Any galaxy already present in the selected users&apos; current sequences will be excluded from the extension candidates.
                        </span>
                      </label>
                      <SearchableUserChecklist
                        options={excludedSequenceUserOptions}
                        selectedIds={excludedSequenceUserIds}
                        onSelectedIdsChange={setExcludedSequenceUserIds}
                        disabled={isProcessing}
                        emptyMessage="No other user sequences are available to exclude."
                        listClassName="max-h-40"
                      />
                    </div>
                  </div>
                )}

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
                            <span
                              className="text-green-900 dark:text-green-100 truncate"
                              title={`${getPaperLabel(paper, paperMetadata)}${getPaperCitation(paper, paperMetadata) ? `\n\nCitation: ${getPaperCitation(paper, paperMetadata)}` : ""}`}
                            >
                              {getPaperLabel(paper, paperMetadata)}
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
                      checked={dryRun}
                      onChange={(e) => handleDryRunChange(e.target.checked)}
                      className="mr-2"
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      Dry run only
                    </span>
                  </label>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 ml-6">
                    Preview the extension and log the first {DEFAULT_ASSIGNMENT_PREVIEW_COUNT} galaxies without changing the sequence, counters, or emails.
                  </p>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sendExtendEmail}
                      onChange={(e) => setSendExtendEmail(e.target.checked)}
                      className="mr-2"
                      disabled={isProcessing || dryRun}
                    />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      Send email notification to user
                    </span>
                  </label>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 ml-6">
                    Notifies the user that new galaxies have been added to their sequence.
                  </p>
                </div>
                </>
                )}

                <button
                  onClick={() => void handleExtendSequence()}
                  disabled={
                    isProcessing ||
                    (assignmentProcedure === "manualList"
                      ? manualInputState.combinedGalaxyIds.length === 0
                      : additionalSize <= 0 ||
                        selectedPapers.size === 0 ||
                        currentSequenceInfo.totalGalaxies >= 8192)
                  }
                  className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isProcessing && updateMode === "extend" && (
                    <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {getExtendButtonLabel()}
                </button>
              </div>
            </div>
          )}

          {isProcessing && updateMode === "extend" && assignmentProcedure === "classificationBased" && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block h-4 w-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Classification-Based Run In Progress
                </span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This workflow runs server-side as one request, so exact percentage progress is not available yet.
              </p>
              <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                <p>1. Resolve blacklists and sequence-based exclusions</p>
                <p>2. Select galaxies with totalClassifications below the target and rank them</p>
                <p>3. Fall back to assignment-count selection if needed</p>
                <p>4. Persist the sequence and update assignment counters</p>
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
                {progress.userDisplayName && progress.userIdShort ? `${progress.userDisplayName} (${progress.userIdShort}) — ` : ''}Batch {progress.currentBatch} of {progress.totalBatches}
              </p>
            </div>
          )}

          {/* Activity Log */}
          <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100 p-3 pb-2">
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
            <div
              ref={logContainerRef}
              onScroll={handleLogScroll}
              className="max-h-56 overflow-y-auto px-3 pb-3 space-y-1"
            >
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
    </div>
  );
}
