import { useState } from "react";
import { cn } from "../../lib/utils";
import { getExperienceLabel, getRoleLabel } from "../../lib/permissions";
import { LSB_OPTIONS_CHECKBOX, LSB_OPTIONS_LEGACY, MORPHOLOGY_OPTIONS } from "./constants";

type SequenceState = "passed" | "current" | "upcoming" | "completed";

type GalaxyAssignmentDetailsData = {
  assignmentSourceTracked: boolean;
  users: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string;
    experience: string | null;
    isActive: boolean | null;
    currentlyAssigned: boolean;
    sequencePosition: number | null;
    sequenceLength: number | null;
    sequenceState: SequenceState | null;
    numClassifiedInSequence: number | null;
    numSkippedInSequence: number | null;
    classification: {
      lsb_class: number;
      morphology: number;
      awesome_flag: boolean;
      valid_redshift: boolean;
      visible_nucleus: boolean | null;
      failed_fitting: boolean;
      comments: string | null;
      timeSpent: number;
      createdAt: number;
    } | null;
    skipped: {
      comments: string | null;
    } | null;
  }>;
};

interface GalaxyAssignmentDetailsProps {
  requested: boolean;
  loading: boolean;
  details: GalaxyAssignmentDetailsData | undefined;
  onLoad: () => void;
}

const LSB_LABELS = new Map(
  [...LSB_OPTIONS_LEGACY, ...LSB_OPTIONS_CHECKBOX].map((option) => [
    option.value,
    stripShortcutSuffix(option.label),
  ])
);

const MORPHOLOGY_LABELS = new Map(
  MORPHOLOGY_OPTIONS.map((option) => [option.value, stripShortcutSuffix(option.label)])
);

function stripShortcutSuffix(label: string) {
  return label.replace(/\s*\[[^\]]+\]$/, "");
}

function getDisplayName(
  user: GalaxyAssignmentDetailsData["users"][number],
  showEmails: boolean
) {
  return user.name?.trim() || (showEmails ? user.email?.trim() : "") || user.userId;
}

function getLsbLabel(classification: NonNullable<GalaxyAssignmentDetailsData["users"][number]["classification"]>) {
  if (classification.failed_fitting) {
    return "Failed fitting";
  }

  return LSB_LABELS.get(classification.lsb_class) ?? `LSB ${classification.lsb_class}`;
}

function getMorphologyLabel(value: number) {
  return MORPHOLOGY_LABELS.get(value) ?? `Morphology ${value}`;
}

function getSequenceStateLabel(state: SequenceState) {
  switch (state) {
    case "passed":
      return "Passed in sequence";
    case "current":
      return "Current sequence item";
    case "completed":
      return "Already completed";
    case "upcoming":
      return "Upcoming in sequence";
  }
}

function getSequenceStateClassName(state: SequenceState) {
  switch (state) {
    case "passed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "current":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "completed":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200";
    case "upcoming":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
}

function getCheckedFlags(
  classification: NonNullable<GalaxyAssignmentDetailsData["users"][number]["classification"]>
) {
  const flags: string[] = [];

  if (classification.awesome_flag) {
    flags.push("Awesome");
  }
  if (classification.valid_redshift) {
    flags.push("Valid redshift");
  }
  if (classification.visible_nucleus) {
    flags.push("Visible nucleus");
  }
  if (classification.failed_fitting) {
    flags.push("Failed fitting");
  }

  return flags;
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function DetailBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function GalaxyAssignmentDetails({
  requested,
  loading,
  details,
  onLoad,
}: GalaxyAssignmentDetailsProps) {
  const [showEmails, setShowEmails] = useState(false);
  const users = details?.users ?? [];
  const assignedCount = users.filter((user) => user.currentlyAssigned).length;
  const classifiedCount = users.filter((user) => user.classification !== null).length;
  const skippedCount = users.filter((user) => user.skipped !== null).length;
  const hasHistoricalOnlyRows = users.some(
    (user) => !user.currentlyAssigned && (user.classification !== null || user.skipped !== null)
  );

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Assignment Details
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Loads separately so opening a galaxy stays on the existing fast path. Once loaded, it updates live while open.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {requested && !loading && details && users.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmails((current) => !current)}
              className="inline-flex items-center justify-center rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {showEmails ? "Hide emails" : "Show emails"}
            </button>
          )}
          {!requested && (
          <button
            type="button"
            onClick={onLoad}
            className="inline-flex items-center justify-center rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            Load assignment details
          </button>
          )}
        </div>
      </div>

      {requested && loading && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
          Loading assignment details...
        </div>
      )}

      {requested && !loading && details && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <DetailBadge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {assignedCount} current assignments
            </DetailBadge>
            <DetailBadge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {classifiedCount} classifications
            </DetailBadge>
            <DetailBadge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {skippedCount} skips
            </DetailBadge>
          </div>

          {/* {!details.assignmentSourceTracked && (
            <div className="rounded border border-dashed border-gray-300 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-600 dark:text-gray-400">
              Assignment origin is not shown here because the current schema does not record whether a galaxy reached a user through the regular sequence generator or the classification-based generator.
            </div>
          )} */}

          {hasHistoricalOnlyRows && (
            <div className="rounded border border-dashed border-gray-300 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-600 dark:text-gray-400">
              Rows marked as not currently assigned indicate users who already classified or skipped this galaxy, but do not have it in their current sequence anymore.
            </div>
          )}

          {users.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              No current assignments, classifications, or skips were found for this galaxy.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const displayName = getDisplayName(user, showEmails);
                const secondaryEmail =
                  showEmails && user.email && user.email !== displayName ? user.email : null;

                return (
                  <div
                    key={user.userId}
                    className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-900/30"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {displayName}
                        </div>
                        {secondaryEmail && (
                          <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {secondaryEmail}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {getRoleLabel(user.role)}
                          {user.experience ? ` · ${getExperienceLabel(user.experience)}` : ""}
                          {user.isActive === false ? " · Inactive" : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <DetailBadge
                          className={
                            user.currentlyAssigned
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                          }
                        >
                          {user.currentlyAssigned ? "Currently assigned" : "Not currently assigned"}
                        </DetailBadge>
                        {user.sequenceState && (
                          <DetailBadge className={getSequenceStateClassName(user.sequenceState)}>
                            {getSequenceStateLabel(user.sequenceState)}
                          </DetailBadge>
                        )}
                        {user.classification && (
                          <DetailBadge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                            Classified
                          </DetailBadge>
                        )}
                        {user.skipped && (
                          <DetailBadge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            Skipped
                          </DetailBadge>
                        )}
                      </div>
                    </div>

                    {user.currentlyAssigned && user.sequencePosition && user.sequenceLength && (
                      <div className="mt-2 grid gap-1 text-[11px] text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                        <div>
                          <span className="font-medium">Sequence slot:</span> {user.sequencePosition} / {user.sequenceLength}
                        </div>
                        <div>
                          <span className="font-medium">Sequence progress:</span> {user.numClassifiedInSequence ?? 0} classified, {user.numSkippedInSequence ?? 0} skipped
                        </div>
                      </div>
                    )}

                    {user.classification ? (
                      <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800/70">
                        {(() => {
                          const checkedFlags = getCheckedFlags(user.classification);

                          return (
                            <div className="mb-2 text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Flags checked:</span>{" "}
                              {checkedFlags.length > 0 ? checkedFlags.join(", ") : "None"}
                            </div>
                          );
                        })()}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700 dark:text-gray-200">
                          <div>
                            <span className="font-medium">LSB:</span> {getLsbLabel(user.classification)}
                          </div>
                          <div>
                            <span className="font-medium">Morphology:</span> {getMorphologyLabel(user.classification.morphology)}
                          </div>
                          <div>
                            <span className="font-medium">Saved:</span> {new Date(user.classification.createdAt).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Time spent:</span> {formatDuration(user.classification.timeSpent)}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {user.classification.failed_fitting && (
                            <DetailBadge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                              Failed fitting
                            </DetailBadge>
                          )}
                          {user.classification.awesome_flag && (
                            <DetailBadge className="bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200">
                              Awesome
                            </DetailBadge>
                          )}
                          {user.classification.valid_redshift && (
                            <DetailBadge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                              Valid redshift
                            </DetailBadge>
                          )}
                          {user.classification.visible_nucleus && (
                            <DetailBadge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                              Visible nucleus
                            </DetailBadge>
                          )}
                        </div>

                        {user.classification.comments && (
                          <div className="mt-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                            <span className="font-medium">Comment:</span> {user.classification.comments}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                        No saved classification for this galaxy.
                      </div>
                    )}

                    {user.skipped?.comments && (
                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                        <span className="font-medium">Skip note:</span> {user.skipped.comments}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}