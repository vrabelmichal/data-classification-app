import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface MigrateUserSequenceProps {
  users: any[];
}

type LogLevel = "info" | "warning" | "error" | "success";

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: number;
};

type MigrationProgress = {
  currentBatch: number;
  totalBatches: number;
  totalProcessed: number;
  totalOperations: number;
  message: string;
};

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const formatUserDisplay = (name: string | null | undefined, email: string | null | undefined, userId: string) => {
  if (name && name.trim().length > 0) {
    return `${truncate(name, 24)} (${userId.slice(0, 8)})`;
  }
  if (email && email.trim().length > 0) {
    return `${truncate(email, 32)} (${userId.slice(0, 8)})`;
  }
  return `User ${userId.slice(0, 8)}`;
};

export function MigrateUserSequence({ users }: MigrateUserSequenceProps) {
  const [sourceUserId, setSourceUserId] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [replaceTargetSequence, setReplaceTargetSequence] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);

  const usersWithSequences = useQuery(api.galaxies.sequence.getUsersWithSequences);
  const migrateUserSequenceBatch = useMutation(api.galaxies.sequence.migrateUserSequenceBatch);

  const preflight = useQuery(
    api.galaxies.sequence.getSequenceMigrationPreflight,
    sourceUserId && targetUserId
      ? {
          sourceUserId: sourceUserId as Id<"users">,
          targetUserId: targetUserId as Id<"users">,
        }
      : "skip"
  );

  useEffect(() => {
    if (preflight && !preflight.target.hasSequence && replaceTargetSequence) {
      setReplaceTargetSequence(false);
    }
  }, [preflight, replaceTargetSequence]);

  const effectiveReplaceTarget = !!preflight?.target?.hasSequence && replaceTargetSequence;

  const blockingReasons = preflight
    ? effectiveReplaceTarget
      ? preflight.replaceBlockingReasons
      : preflight.noReplaceBlockingReasons
    : [];

  const canProceed = preflight
    ? effectiveReplaceTarget
      ? preflight.canMigrateWithReplace
      : preflight.canMigrateWithoutReplace
    : false;

  const targetOptions = useMemo(() => {
    const mapped = (users ?? [])
      .map((entry: any) => ({
        userId: (entry?.userId ?? "") as string,
        name: (entry?.user?.name ?? null) as string | null,
        email: (entry?.user?.email ?? null) as string | null,
      }))
      .filter((entry: { userId: string }) => !!entry.userId && entry.userId !== sourceUserId);

    mapped.sort((a: { name: string | null; email: string | null }, b: { name: string | null; email: string | null }) => {
      const aLabel = (a.name ?? a.email ?? "").toLowerCase();
      const bLabel = (b.name ?? b.email ?? "").toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    return mapped;
  }, [users, sourceUserId]);

  const appendLog = (level: LogLevel, message: string) => {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
    };

    setLogs((prev) => {
      const next = [...prev, entry];
      const MAX_LOG_ENTRIES = 300;
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  };

  const handleMigrate = async () => {
    if (!sourceUserId) {
      toast.error("Select a source user");
      return;
    }

    if (!targetUserId) {
      toast.error("Select a target user");
      return;
    }

    if (sourceUserId === targetUserId) {
      toast.error("Source and target users must be different");
      return;
    }

    if (!preflight) {
      toast.error("Preflight check is still loading");
      return;
    }

    if (!canProceed) {
      const reason = blockingReasons[0] ?? "Migration preflight failed";
      toast.error(reason);
      appendLog("error", `Preflight failed: ${reason}`);
      return;
    }

    const sourceDisplay = formatUserDisplay(preflight.source.name, preflight.source.email, sourceUserId);
    const targetDisplay = formatUserDisplay(preflight.target.name, preflight.target.email, targetUserId);

    try {
      setIsMigrating(true);
      setProgress(null);

      appendLog(
        "info",
        `Starting migration: ${sourceDisplay} -> ${targetDisplay}${effectiveReplaceTarget ? " (replacing target sequence)" : ""}. Remaining galaxies to move: ${preflight.source.remainingGalaxyCount ?? preflight.source.galaxyCount}`
      );

      let batchIndex = 0;

      while (true) {
        const result = await migrateUserSequenceBatch({
          sourceUserId: sourceUserId as Id<"users">,
          targetUserId: targetUserId as Id<"users">,
          replaceTargetSequence: effectiveReplaceTarget,
          batchIndex,
          batchSize: 250,
          sourceSequenceId: preflight.source.sequenceId ?? undefined,
          targetSequenceId: preflight.target.sequenceId ?? undefined,
        });

        setProgress({
          currentBatch: result.currentBatch ?? batchIndex + 1,
          totalBatches: result.totalBatches,
          totalProcessed: result.totalProcessed,
          totalOperations: result.totalOperations,
          message: result.message,
        });

        appendLog("info", result.message);

        if (result.isComplete) {
          appendLog(
            "success",
            `Migration completed. Moved ${result.migratedGalaxyCount ?? preflight.source.remainingGalaxyCount ?? preflight.source.galaxyCount} galaxies.`
          );
          toast.success("Sequence migrated successfully");

          setSourceUserId("");
          setTargetUserId("");
          setReplaceTargetSequence(false);
          break;
        }

        batchIndex += 1;
      }
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
      appendLog("error", `Migration failed: ${message}`);
      toast.error(`Migration failed: ${message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const progressPercent = progress
    ? progress.totalOperations > 0
      ? Math.min(100, (progress.totalProcessed / progress.totalOperations) * 100)
      : 100
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Migrate Generated Sequence</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Move a generated galaxy sequence from one user to another with batched updates of assignment counters.
          Migration runs in batches to stay within Convex transaction limits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Source User (has sequence)</label>
          <select
            value={sourceUserId}
            onChange={(e) => {
              setSourceUserId(e.target.value);
              setTargetUserId("");
            }}
            disabled={isMigrating}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select source user...</option>
            {(usersWithSequences ?? []).map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {formatUserDisplay(entry.user?.name, entry.user?.email, entry.userId)} - {entry.sequenceInfo.galaxyCount} galaxies
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Target User</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            disabled={isMigrating || !sourceUserId}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select target user...</option>
            {targetOptions.map((entry: { userId: string; name: string | null; email: string | null }) => (
              <option key={entry.userId} value={entry.userId}>
                {formatUserDisplay(entry.name, entry.email, entry.userId)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
          <input
            type="checkbox"
            checked={replaceTargetSequence}
            onChange={(e) => setReplaceTargetSequence(e.target.checked)}
            disabled={isMigrating || !preflight?.target.hasSequence}
            className="h-4 w-4"
          />
          <span>Replace target sequence if it already exists</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Replacement is allowed even when the target sequence has progress. Existing target sequence assignments are removed safely.
        </p>
      </div>

      {sourceUserId && targetUserId && preflight && (
        <div
          className={`rounded-lg border p-4 ${
            canProceed
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
          }`}
        >
          <p className={`text-sm font-semibold ${canProceed ? "text-green-900 dark:text-green-100" : "text-orange-900 dark:text-orange-100"}`}>
            Preflight check
          </p>

          <div className="mt-2 space-y-1 text-xs">
            <p className="text-gray-700 dark:text-gray-300">
              Source: {preflight.source.galaxyCount} galaxies total, {preflight.source.processedGalaxyCount ?? 0} already processed, {preflight.source.remainingGalaxyCount ?? preflight.source.galaxyCount} remaining to migrate
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Target: {preflight.target.hasSequence ? `${preflight.target.galaxyCount} galaxies (${preflight.target.processedGalaxyCount ?? 0} processed)` : "no existing sequence"}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Completed galaxies on the source are kept as source user work; only remaining galaxies are migrated.
            </p>
          </div>

          {blockingReasons.length > 0 ? (
            <ul className="mt-2 text-xs text-orange-800 dark:text-orange-200 space-y-1 list-disc pl-4">
              {blockingReasons.map((reason: string, idx: number) => (
                <li key={`${reason}-${idx}`}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-green-800 dark:text-green-200">All checks passed. Migration can proceed.</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void handleMigrate()}
          disabled={isMigrating || !sourceUserId || !targetUserId || !preflight || !canProceed}
          className="inline-flex items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {isMigrating && (
            <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isMigrating ? "Migrating..." : "Migrate Sequence"}
        </button>

        <button
          type="button"
          onClick={() => setLogs([])}
          disabled={isMigrating || logs.length === 0}
          className="inline-flex items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
        >
          Clear Logs
        </button>
      </div>

      {progress && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-2 bg-blue-200 dark:bg-blue-700 rounded-full flex-1">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {progress.totalProcessed}/{progress.totalOperations}
            </span>
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200">{progress.message}</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Batch {progress.currentBatch} of {progress.totalBatches}
          </p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Activity Log</p>
        </div>
        <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-1">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No log entries yet.</p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`${log.timestamp}-${idx}`}
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
                <span className="uppercase text-[10px] mr-2 tracking-wide font-semibold">{log.level}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
