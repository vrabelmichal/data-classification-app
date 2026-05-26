import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  PaperCatalogSection,
  ProgressSection,
  SummaryCardsSection,
} from "../overview/OverviewSections";
import { LoadingPanel } from "../overview/shared";
import { RemainingGalaxyDetailsModal } from "./RemainingGalaxyDetailsModal";
import type {
  PaperCount,
  PaperFilter,
  TargetProgressMetrics,
  Totals,
} from "../overview/types";
import { cn } from "../../../lib/utils";
import { getExperienceLabel, getRoleLabel } from "../../../lib/permissions";
import type { PaperMetadataEntry } from "../../../lib/paperDisplay";
import { getPaperLabel } from "../../../lib/paperDisplay";

const DEFAULT_TARGET_CLASSIFICATIONS = 3;
const MAX_TARGET_CLASSIFICATIONS = 25;
const GLOBAL_SCOPE_KEY = "__all__";

type ClassificationCoverageSystemSettings = {
  paperAssignmentCoverageDefaultPaper?: string | null;
  classificationCoverageDefaultPaper?: string | null;
  paperMetadata?: PaperMetadataEntry[];
};

type UserDirectoryEntry = {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: string;
  isActive: boolean;
  experience?: "normal" | "senior";
};

type GalaxyIdBucketChunks = string[][][];

type ScopeSnapshot = {
  scopeKey: string;
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
  activeClassifiers: number;
  userAssignmentCounts: Array<{
    userId: string;
    counts: number[];
    classifiedByUserCount?: number;
    processedByUserCounts?: number[];
    remainingGalaxyIdsByBucket?: GalaxyIdBucketChunks;
  }>;
  unassignedCounts: number[];
  unassignedGalaxyIdsByBucket?: GalaxyIdBucketChunks;
  updatedAt: number;
};

type SharedSnapshot = {
  catalog: {
    availablePapers: string[];
    paperCounts: Record<string, PaperCount>;
  };
  userDirectory: UserDirectoryEntry[];
  updatedAt: number;
};

type CachedCoveragePayload = {
  sharedSnapshot: SharedSnapshot | null;
  scopeSnapshots: ScopeSnapshot[];
};

type LiveCoveragePayload = {
  sharedSnapshot: SharedSnapshot;
  scopeSnapshots: ScopeSnapshot[];
};

export type ClassificationCoverageTabProps = {
  systemSettings: ClassificationCoverageSystemSettings;
  canAccessLiveVariant?: boolean;
};

type DashboardProps = {
  mode: "cached" | "live";
  sharedSnapshot: SharedSnapshot;
  scopeSnapshots: ScopeSnapshot[];
  defaultPaper: string | null | undefined;
  alternateModeLink?: string;
  alternateModeLabel?: string;
};

type AssignmentRow = {
  key: string;
  userId: string;
  label: string;
  labelKind: "name" | "email" | "identifier" | "special";
  secondaryLabel?: string | null;
  secondaryKind?: "email" | "identifier" | null;
  roleLabel: string;
  experienceLabel: string;
  assignedCount: number;
  classifiedCount: number;
  remainingCount: number;
  remainingGalaxyIdsByBucket?: GalaxyIdBucketChunks;
  isActive?: boolean;
  isSpecial?: boolean;
};

function sanitizeTargetClassifications(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TARGET_CLASSIFICATIONS;
  }

  return Math.min(MAX_TARGET_CLASSIFICATIONS, Math.max(1, Math.floor(parsed)));
}

function paperLabel(value: string, metadata?: PaperMetadataEntry[]) {
  return getPaperLabel(value, metadata);
}

function obfuscateEmail(email: string) {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 0) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  const [domainName, ...domainTail] = domainPart.split(".");
  const localPrefix = localPart.slice(0, Math.min(2, localPart.length));
  const domainPrefix = domainName.slice(0, Math.min(2, domainName.length));

  return `${localPrefix}${localPart.length > 2 ? "***" : ""}@${domainPrefix}${domainName.length > 2 ? "***" : ""}${domainTail.length > 0 ? `.${domainTail.join(".")}` : ""}`;
}

function getUserIdentity(
  user: UserDirectoryEntry | undefined,
  fallbackUserId: string,
  showEmails: boolean,
) {
  const displayName = user?.name?.trim() || null;
  const email = user?.email?.trim() || null;

  if (displayName) {
    return {
      label: displayName,
      labelKind: "name" as const,
      secondaryLabel: showEmails && email ? email : null,
      secondaryKind: showEmails && email ? ("email" as const) : null,
    };
  }

  if (email) {
    return {
      label: showEmails ? email : obfuscateEmail(email),
      labelKind: "email" as const,
      secondaryLabel: fallbackUserId,
      secondaryKind: "identifier" as const,
    };
  }

  return {
    label: fallbackUserId,
    labelKind: "identifier" as const,
    secondaryLabel: null,
    secondaryKind: null,
  };
}

function buildModeLink(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function useCoverageFilters(defaultPaper: string | null | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPaperParam = searchParams.has("paper");
  const rawPaper = searchParams.get("paper");
  const selectedPaper = !hasPaperParam
    ? (defaultPaper !== null ? defaultPaper : undefined)
    : rawPaper === null || rawPaper === "__all__"
      ? undefined
      : rawPaper;
  const targetClassifications = sanitizeTargetClassifications(searchParams.get("target"));

  const updateSearchParams = (updateFn: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      updateFn(next);
      return next;
    }, { replace: true, preventScrollReset: true });
  };

  const handleSelectPaper = (paper: string | undefined) => {
    updateSearchParams((next) => {
      if (paper === undefined) {
        if (defaultPaper !== null && defaultPaper !== undefined) {
          next.set("paper", "__all__");
        } else {
          next.delete("paper");
        }
        return;
      }

      next.set("paper", paper);
    });
  };

  const handleTargetClassificationsChange = (nextValue: number) => {
    updateSearchParams((next) => {
      next.set("target", String(sanitizeTargetClassifications(nextValue)));
    });
  };

  return {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  };
}

function deriveTargetProgressFromBuckets({
  targetClassifications,
  totals,
  classificationBuckets,
}: {
  targetClassifications: number;
  totals: Totals;
  classificationBuckets: number[];
}): TargetProgressMetrics {
  const buckets = Array.from({ length: MAX_TARGET_CLASSIFICATIONS + 1 }, (_, index) => {
    const value = classificationBuckets[index] ?? 0;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });

  if (classificationBuckets.length > buckets.length) {
    for (let index = buckets.length; index < classificationBuckets.length; index += 1) {
      const value = classificationBuckets[index] ?? 0;
      if (Number.isFinite(value) && value > 0) {
        buckets[buckets.length - 1] += Math.floor(value);
      }
    }
  }

  const galaxiesAtTarget = buckets.slice(targetClassifications).reduce((sum, count) => sum + count, 0);
  const galaxiesWithMultipleClassifications = buckets.slice(2).reduce((sum, count) => sum + count, 0);
  const remainingClassificationsToTarget = buckets
    .slice(0, targetClassifications)
    .reduce(
      (sum, count, classificationCount) =>
        sum + (targetClassifications - classificationCount) * count,
      0,
    );
  const targetClassificationsTotal = totals.galaxies * targetClassifications;

  return {
    targetClassifications,
    targetClassificationsTotal,
    targetCompletionPercent:
      targetClassificationsTotal > 0
        ? (totals.totalClassifications / targetClassificationsTotal) * 100
        : 0,
    galaxiesAtTarget,
    galaxiesBelowTarget: Math.max(totals.galaxies - galaxiesAtTarget, 0),
    galaxiesWithMultipleClassifications,
    repeatClassifications: Math.max(totals.totalClassifications - totals.classifiedGalaxies, 0),
    remainingClassificationsToTarget,
  };
}

function buildPaperFilter(
  selectedPaper: string | undefined,
  paperCounts: Record<string, PaperCount>,
): PaperFilter {
  if (selectedPaper === undefined) {
    return null;
  }

  const counts = paperCounts[selectedPaper];
  if (!counts) {
    return null;
  }

  return {
    paper: selectedPaper,
    galaxies: counts.total,
    blacklisted: counts.blacklisted,
    adjusted: counts.adjusted,
  };
}

function sumCountsToTarget(counts: number[], targetClassifications: number) {
  return counts.slice(0, targetClassifications).reduce((sum, count) => sum + count, 0);
}

function sumGalaxyIdBucketsToTarget(galaxyIdsByBucket: GalaxyIdBucketChunks, targetClassifications: number) {
  return galaxyIdsByBucket
    .slice(0, targetClassifications)
    .reduce(
      (sum, bucket) => sum + bucket.reduce((bucketSum, chunk) => bucketSum + chunk.length, 0),
      0,
    );
}

function flattenGalaxyIdBucketsToTarget(galaxyIdsByBucket: GalaxyIdBucketChunks, targetClassifications: number) {
  return galaxyIdsByBucket
    .slice(0, targetClassifications)
    .flatMap((bucket) => bucket.flatMap((chunk) => chunk));
}

function sumAllCounts(counts: number[]) {
  return counts.reduce((sum, count) => sum + count, 0);
}

function sumClassifiedCounts(counts: number[]) {
  return counts.slice(1).reduce((sum, count) => sum + count, 0);
}

function estimateProcessedCounts(
  counts: number[],
  classifiedByUserCount: number | null | undefined,
) {
  const remainingToAllocate = Math.max(
    0,
    Math.min(classifiedByUserCount ?? 0, sumAllCounts(counts)),
  );

  if (remainingToAllocate === 0) {
    return buildZeroCounts(counts.length);
  }

  const estimated = buildZeroCounts(counts.length);
  let leftToAllocate = remainingToAllocate;

  for (let index = 0; index < counts.length && leftToAllocate > 0; index += 1) {
    const nextCount = Math.min(counts[index] ?? 0, leftToAllocate);
    estimated[index] = nextCount;
    leftToAllocate -= nextCount;
  }

  return estimated;
}

function buildZeroCounts(length: number) {
  return Array.from({ length }, () => 0);
}

function sumRemainingCountsToTarget(
  counts: number[],
  processedByUserCounts: number[],
  targetClassifications: number,
) {
  return Math.max(
    sumCountsToTarget(counts, targetClassifications)
      - sumCountsToTarget(processedByUserCounts, targetClassifications),
    0,
  );
}

function buildAssignmentRows(
  scopeSnapshot: ScopeSnapshot,
  userDirectory: UserDirectoryEntry[],
  targetClassifications: number,
  showEmails: boolean,
) {
  const userDirectoryById = new Map(userDirectory.map((entry) => [entry.userId, entry] as const));
  const rows: AssignmentRow[] = scopeSnapshot.userAssignmentCounts
    .map((entry) => {
      const user = userDirectoryById.get(entry.userId);
      const assignedCount = sumAllCounts(entry.counts);
      const processedByUserCounts = entry.processedByUserCounts
        ?? estimateProcessedCounts(entry.counts, entry.classifiedByUserCount);
      const remainingCount = entry.remainingGalaxyIdsByBucket
        ? sumGalaxyIdBucketsToTarget(entry.remainingGalaxyIdsByBucket, targetClassifications)
        : sumRemainingCountsToTarget(
            entry.counts,
            processedByUserCounts,
            targetClassifications,
          );
      const classifiedCount = entry.classifiedByUserCount
        ?? Math.max(assignedCount - sumCountsToTarget(entry.counts, targetClassifications), 0);
      const identity = getUserIdentity(user, entry.userId, showEmails);
      return {
        key: entry.userId,
        userId: entry.userId,
        label: identity.label,
        labelKind: identity.labelKind,
        secondaryLabel: identity.secondaryLabel,
        secondaryKind: identity.secondaryKind,
        roleLabel: getRoleLabel(user?.role),
        experienceLabel: getExperienceLabel(user?.experience ?? "normal"),
        assignedCount,
        classifiedCount,
        remainingCount,
        remainingGalaxyIdsByBucket: entry.remainingGalaxyIdsByBucket,
        isActive: user?.isActive,
      };
    })
    .filter((entry) => entry.remainingCount > 0)
    .sort((left, right) => right.remainingCount - left.remainingCount || left.label.localeCompare(right.label));

  const unassignedCount = sumCountsToTarget(scopeSnapshot.unassignedCounts, targetClassifications);

  if (unassignedCount > 0) {
    rows.push({
      key: "__unassigned__",
      userId: "__unassigned__",
      label: "Not assigned to any user",
      labelKind: "special",
      secondaryLabel: "No matching sequence owner",
      secondaryKind: "identifier",
      roleLabel: "Pending",
      experienceLabel: "N/A",
      assignedCount: sumAllCounts(scopeSnapshot.unassignedCounts),
      classifiedCount: sumClassifiedCounts(scopeSnapshot.unassignedCounts),
      remainingCount: unassignedCount,
      remainingGalaxyIdsByBucket: scopeSnapshot.unassignedGalaxyIdsByBucket,
      isSpecial: true,
    });
  }

  return rows;
}

function RemainingActionIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function RemainingCountButton({
  count,
  onClick,
  disabled = false,
}: {
  count: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  if (!onClick || disabled) {
    return <span>{count.toLocaleString()}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-end gap-1.5 rounded-md px-1.5 py-1 text-right font-semibold text-amber-800 transition hover:bg-amber-100/80 hover:text-amber-900 dark:text-amber-200 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
      aria-haspopup="dialog"
      aria-label={`Open ${count.toLocaleString()} remaining below-target galaxies`}
      title="Open remaining-galaxy details"
    >
      <span>{count.toLocaleString()}</span>
      <RemainingActionIcon />
    </button>
  );
}

function SmallInfoButton({
  label,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  ariaExpanded,
}: {
  label: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
  ariaExpanded: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={ariaExpanded}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200"
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8h.01" />
        <path d="M11 12h1v4h1" />
      </svg>
    </button>
  );
}

function InfoPopupButton({ message }: { message: string }) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const [popupStyle, setPopupStyle] = useState<{ top: number; left: number; visibility: "hidden" | "visible" }>({
    top: 0,
    left: 0,
    visibility: "hidden",
  });
  const isOpen = isHovered || isPinned || isPopupHovered;

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsPopupHovered(false);
    }, 90);
  };

  useEffect(() => {
    if (!isPinned) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }

      setIsPinned(false);
      setIsHovered(false);
      setIsPopupHovered(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isPinned]);

  useEffect(() => () => clearCloseTimeout(), []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popup = popupRef.current;
      if (!trigger || !popup) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const padding = 12;
      const offset = 8;

      let left = triggerRect.left + triggerRect.width / 2 - popupRect.width / 2;
      left = Math.min(Math.max(padding, left), window.innerWidth - popupRect.width - padding);

      let top = triggerRect.bottom + offset;
      if (top + popupRect.height > window.innerHeight - padding) {
        top = Math.max(padding, triggerRect.top - popupRect.height - offset);
      }

      setPopupStyle({ top, left, visibility: "visible" });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <span ref={triggerRef} className="inline-flex items-center">
      <SmallInfoButton
        label={message}
        ariaExpanded={isOpen}
        onMouseEnter={() => {
          clearCloseTimeout();
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (!isPinned) {
            scheduleHoverClose();
          }
        }}
        onFocus={() => {
          clearCloseTimeout();
          setIsHovered(true);
        }}
        onBlur={() => {
          if (!isPinned) {
            setIsHovered(false);
            setIsPopupHovered(false);
          }
        }}
        onClick={() =>
          setIsPinned((value) => {
            const nextPinned = !value;
            if (!nextPinned) {
              setIsHovered(false);
              setIsPopupHovered(false);
            }
            return nextPinned;
          })
        }
      />
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                top: popupStyle.top,
                left: popupStyle.left,
                visibility: popupStyle.visibility,
              }}
              onMouseEnter={() => {
                clearCloseTimeout();
                setIsHovered(true);
                setIsPopupHovered(true);
              }}
              onMouseLeave={() => {
                setIsPopupHovered(false);
                if (!isPinned) {
                  scheduleHoverClose();
                }
              }}
              className="z-[70] w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] normal-case tracking-normal text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {message}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function UserIdentityCell({
  row,
  mobile = false,
}: {
  row: AssignmentRow;
  mobile?: boolean;
}) {
  const primaryClassName = cn(
    "font-medium text-gray-900 dark:text-white",
    row.labelKind === "identifier" && "text-[11px] tracking-wide text-gray-700 dark:text-gray-200",
    row.labelKind === "email" && "text-sm",
    mobile ? "max-w-full" : "max-w-[15em]"
  );

  const secondaryClassName = cn(
    "mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400",
    row.secondaryKind === "identifier" && "text-[11px] text-gray-400 dark:text-gray-500"
  );

  return (
    <div className={cn("whitespace-normal break-words", mobile ? "max-w-full" : "max-w-[15em]") }>
      <div className={primaryClassName}>{row.label}</div>
      {row.secondaryLabel && <div className={secondaryClassName}>{row.secondaryLabel}</div>}
    </div>
  );
}

function UserAssignmentCard({
  row,
}: {
  row: AssignmentRow;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800",
        row.isSpecial && "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
      )}
    >
      <div className="min-w-0">
          <UserIdentityCell row={row} mobile />
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{row.experienceLabel}</span>
            <span>•</span>
            <span>{row.roleLabel}</span>
          </div>
          {!row.isSpecial && row.isActive === false && (
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Inactive account</div>
          )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-900/50">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Assigned</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-white">{row.assignedCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-900/50">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Classified</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-white">{row.classifiedCount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="text-[11px] uppercase tracking-wide">Remaining below target</div>
          <div className="mt-1 font-semibold">{row.remainingCount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function EmailVisibilityToggle({
  showEmails,
  onToggle,
}: {
  showEmails: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showEmails}
      title={showEmails ? "Hide emails" : "Show emails"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition",
        showEmails
          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      )}
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
        {!showEmails ? <path d="M3 3l18 18" /> : null}
      </svg>
      <span>{showEmails ? "Hide emails" : "Show emails"}</span>
      <span className="sr-only">{showEmails ? "Emails visible" : "Emails hidden"}</span>
    </button>
  );
}

function ClassificationCoverageTableSection({
  selectedPaper,
  scopeSnapshot,
  userDirectory,
  targetClassifications,
}: {
  selectedPaper: string | undefined;
  scopeSnapshot: ScopeSnapshot;
  userDirectory: UserDirectoryEntry[];
  targetClassifications: number;
}) {
  const [showEmails, setShowEmails] = useState(false);
  const [selectedDetailRowKey, setSelectedDetailRowKey] = useState<string | null>(null);
  const canToggleEmails = useMemo(
    () => userDirectory.some((entry) => Boolean(entry.email?.trim())),
    [userDirectory],
  );
  const rows = useMemo(
    () => buildAssignmentRows(scopeSnapshot, userDirectory, targetClassifications, showEmails),
    [scopeSnapshot, showEmails, targetClassifications, userDirectory],
  );
  const selectedDetailRow = useMemo(
    () => rows.find((row) => row.key === selectedDetailRowKey) ?? null,
    [rows, selectedDetailRowKey],
  );
  const selectedDetailGalaxyIds = useMemo(
    () => selectedDetailRow?.remainingGalaxyIdsByBucket
      ? flattenGalaxyIdBucketsToTarget(
          selectedDetailRow.remainingGalaxyIdsByBucket,
          targetClassifications,
        )
      : [],
    [selectedDetailRow, targetClassifications],
  );

  useEffect(() => {
    if (selectedDetailRowKey !== null && !selectedDetailRow) {
      setSelectedDetailRowKey(null);
    }
  }, [selectedDetailRow, selectedDetailRowKey]);

  useEffect(() => {
    if (!canToggleEmails && showEmails) {
      setShowEmails(false);
    }
  }, [canToggleEmails, showEmails]);

  const underTargetGalaxies = sumCountsToTarget(
    scopeSnapshot.classificationBuckets,
    targetClassifications,
  );
  const assignedInfoMessage = "Unique galaxies in this row's current sequence within the selected paper scope, regardless of the current target and regardless of whether the user has already handled them.";
  const classifiedInfoMessage = "The subset of assigned galaxies that this same user classified during the current sequence. Skipped galaxies are not included in this count.";
  const remainingInfoMessage = "Unique galaxies in this row's current sequence that are still below the selected target and have not yet been handled by that same user. A handled galaxy is either classified or skipped by that user.";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Under-target classification coverage
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Current-sequence work that still needs attention from the assigned user for galaxies below
            the selected repeat-classification target, excluding blacklisted galaxies.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedPaper === undefined
              ? `${underTargetGalaxies.toLocaleString()} galaxies are still below ${targetClassifications} classifications across the full effective catalog.`
              : `${paperLabel(selectedPaper, systemSettings.paperMetadata)} has ${underTargetGalaxies.toLocaleString()} galaxies below ${targetClassifications} classifications after blacklist filtering.`}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-right dark:border-blue-800/70 dark:bg-blue-950/20">
          <div className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Current target
          </div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {targetClassifications}x
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          {underTargetGalaxies === 0
            ? `Every galaxy in this scope already reached ${targetClassifications} classifications.`
            : "No current sequence entries still need user action in the under-target subset."}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="w-[15em] max-w-[15em] px-3 py-3">User</th>
                  <th className="px-3 py-3">Experience</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Assigned galaxies</span>
                      <InfoPopupButton message={assignedInfoMessage} />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Classified galaxies</span>
                      <InfoPopupButton message={classifiedInfoMessage} />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right bg-amber-50/70 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Remaining below-target galaxies</span>
                      <InfoPopupButton message={remainingInfoMessage} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(row.isSpecial && "bg-amber-50/60 dark:bg-amber-950/10")}
                  >
                    <td className="w-[15em] max-w-[15em] px-3 py-3 align-top">
                      <UserIdentityCell row={row} />
                      {!row.isSpecial && row.isActive === false && (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Inactive account</div>
                      )}
                      {row.isSpecial && (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Galaxies with no current sequence owner</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 align-top">{row.experienceLabel}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 align-top">{row.roleLabel}</td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white align-top">
                      {row.assignedCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white align-top">
                      {row.classifiedCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-amber-800 bg-amber-50/70 dark:bg-amber-950/20 dark:text-amber-200 align-top">
                      <RemainingCountButton
                        count={row.remainingCount}
                        onClick={
                          row.remainingGalaxyIdsByBucket
                            ? () => setSelectedDetailRowKey(row.key)
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div key={row.key} className="space-y-2">
                <UserAssignmentCard row={row} />
                {row.remainingGalaxyIdsByBucket ? (
                  <div className="flex justify-end">
                    <RemainingCountButton
                      count={row.remainingCount}
                      onClick={() => setSelectedDetailRowKey(row.key)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {canToggleEmails ? (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <EmailVisibilityToggle
                showEmails={showEmails}
                onToggle={() => setShowEmails((value) => !value)}
              />
            </div>
          ) : null}
        </div>
      )}

      <RemainingGalaxyDetailsModal
        isOpen={selectedDetailRow !== null}
        onClose={() => setSelectedDetailRowKey(null)}
        rowLabel={selectedDetailRow?.label ?? ""}
        scopeLabel={selectedPaper === undefined ? "All papers" : paperLabel(selectedPaper, systemSettings.paperMetadata)}
        galaxyExternalIds={selectedDetailGalaxyIds}
        targetClassifications={targetClassifications}
        isSpecial={selectedDetailRow?.isSpecial ?? false}
      />
    </div>
  );
}

function PageIntroCard({
  mode,
  switchTo,
  switchLabel,
  onCompute,
  isComputing = false,
  updatedAt,
}: {
  mode: "cached" | "live";
  switchTo?: string;
  switchLabel?: string;
  onCompute?: () => void;
  isComputing?: boolean;
  updatedAt?: number | null;
}) {
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleString() : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Classification coverage
            </h2>
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
              {mode === "cached" ? "Cached snapshot" : "Live calculation"}
            </span>
          </div>
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            Paper-scoped classification coverage statistics for the effective catalog. All totals exclude blacklisted galaxies,
            and the user table shows who still has current-sequence work left on galaxies that are below
            the selected repeat-classification target.
          </p>
          {updatedLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {updatedLabel}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCompute && (
            <button
              type="button"
              onClick={onCompute}
              disabled={isComputing}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-white transition-colors",
                isComputing ? "cursor-wait bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isComputing ? "Calculating…" : updatedAt ? "Recompute live snapshot" : "Calculate live snapshot"}
            </button>
          )}
          {switchTo && switchLabel ? (
            <Link
              to={switchTo}
              className="rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            >
              {switchLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ClassificationCoverageDashboard({
  mode,
  sharedSnapshot,
  scopeSnapshots,
  defaultPaper,
  alternateModeLink,
  alternateModeLabel,
}: DashboardProps) {
  const loadCurrentUserDirectory = useAction(
    api.statistics.paperAssignmentCoverage.cache.getCurrentUserDirectory,
  );
  const [currentUserDirectory, setCurrentUserDirectory] = useState<UserDirectoryEntry[] | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;

    const fetchCurrentUserDirectory = async () => {
      try {
        const result = await loadCurrentUserDirectory({}) as UserDirectoryEntry[];
        if (!isCancelled) {
          setCurrentUserDirectory(result);
        }
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          setCurrentUserDirectory(undefined);
        }
      }
    };

    void fetchCurrentUserDirectory();

    return () => {
      isCancelled = true;
    };
  }, [loadCurrentUserDirectory]);

  const {
    searchParams,
    selectedPaper,
    targetClassifications,
    handleSelectPaper,
    handleTargetClassificationsChange,
  } = useCoverageFilters(defaultPaper);

  const scopeSnapshotsByKey = useMemo(
    () => new Map(scopeSnapshots.map((snapshot) => [snapshot.scopeKey, snapshot] as const)),
    [scopeSnapshots],
  );
  const currentScopeKey = selectedPaper ?? GLOBAL_SCOPE_KEY;
  const currentScope = scopeSnapshotsByKey.get(currentScopeKey);
  const paperFilter = buildPaperFilter(selectedPaper, sharedSnapshot.catalog.paperCounts);
  const effectiveUserDirectory = currentUserDirectory ?? sharedSnapshot.userDirectory;
  const targetProgress = currentScope
    ? deriveTargetProgressFromBuckets({
        targetClassifications,
        totals: currentScope.totals,
        classificationBuckets: currentScope.classificationBuckets,
      })
    : undefined;

  if (!currentScope) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode={mode}
          switchTo={alternateModeLink}
          switchLabel={alternateModeLabel}
          updatedAt={sharedSnapshot.updatedAt}
        />
        <LoadingPanel>
          {selectedPaper === undefined
            ? "The global classification coverage snapshot is not available yet."
            : `No snapshot is available for ${paperLabel(selectedPaper, systemSettings.paperMetadata)} yet.`}
        </LoadingPanel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PaperCatalogSection
        availablePapers={sharedSnapshot.catalog.availablePapers}
        paperCounts={sharedSnapshot.catalog.paperCounts}
        paperFilter={paperFilter}
        paperMetadata={systemSettings.paperMetadata}
        selectedPaper={selectedPaper}
        onSelectPaper={handleSelectPaper}
        mode={mode}
        updatedAt={sharedSnapshot.updatedAt}
      />

      <SummaryCardsSection
        totals={currentScope.totals}
        selectedPaper={selectedPaper}
        mode={mode}
        updatedAt={currentScope.updatedAt}
      />

      <ProgressSection
        totals={currentScope.totals}
        targetProgress={targetProgress}
        targetClassifications={targetClassifications}
        onTargetClassificationsChange={handleTargetClassificationsChange}
        activeClassifiers={currentScope.activeClassifiers}
        selectedPaper={selectedPaper}
        mode={mode}
        updatedAt={currentScope.updatedAt}
      />

      <ClassificationCoverageTableSection
        selectedPaper={selectedPaper}
        scopeSnapshot={currentScope}
        userDirectory={effectiveUserDirectory}
        targetClassifications={targetClassifications}
      />
    </div>
  );
}

export function CachedClassificationCoverageTab({
  systemSettings,
  canAccessLiveVariant = false,
}: ClassificationCoverageTabProps) {
  const cachedPayload = useQuery(
    api.statistics.paperAssignmentCoverage.cache.getCachedSnapshot,
    {},
  ) as CachedCoveragePayload | undefined;
  const classificationCoverageDefaultPaper =
    systemSettings.classificationCoverageDefaultPaper ?? systemSettings.paperAssignmentCoverageDefaultPaper;
  const { searchParams } = useCoverageFilters(classificationCoverageDefaultPaper);
  const liveLink = canAccessLiveVariant
    ? buildModeLink("/statistics/classification-coverage-live", searchParams)
    : undefined;

  if (cachedPayload === undefined) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode="cached"
          switchTo={liveLink}
          switchLabel={canAccessLiveVariant ? "Open live calculation" : undefined}
        />
        <LoadingPanel>Loading cached classification coverage…</LoadingPanel>
      </div>
    );
  }

  if (!cachedPayload.sharedSnapshot || cachedPayload.scopeSnapshots.length === 0) {
    return (
      <div className="space-y-6">
        <PageIntroCard
          mode="cached"
          switchTo={liveLink}
          switchLabel={canAccessLiveVariant ? "Open live calculation" : undefined}
        />
        <LoadingPanel>
          {canAccessLiveVariant
            ? "Cached classification coverage is not available yet. Open the live calculation page to compute the latest numbers immediately, or wait for the scheduled snapshot refresh."
            : "Cached classification coverage is not available yet. Wait for the scheduled snapshot refresh or ask an administrator to refresh the snapshot."}
        </LoadingPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntroCard
        mode="cached"
        switchTo={liveLink}
        switchLabel={canAccessLiveVariant ? "Open live calculation" : undefined}
        updatedAt={cachedPayload.sharedSnapshot.updatedAt}
      />
      <ClassificationCoverageDashboard
        mode="cached"
        sharedSnapshot={cachedPayload.sharedSnapshot}
        scopeSnapshots={cachedPayload.scopeSnapshots}
        defaultPaper={classificationCoverageDefaultPaper}
        alternateModeLink={liveLink}
        alternateModeLabel={canAccessLiveVariant ? "Open live calculation" : undefined}
      />
    </div>
  );
}

export function LiveClassificationCoverageTab({ systemSettings }: ClassificationCoverageTabProps) {
  const computeLiveSnapshot = useAction(
    api.statistics.paperAssignmentCoverage.cache.computeLiveSnapshot,
  );
  const [snapshot, setSnapshot] = useState<LiveCoveragePayload | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const classificationCoverageDefaultPaper =
    systemSettings.classificationCoverageDefaultPaper ?? systemSettings.paperAssignmentCoverageDefaultPaper;
  const { searchParams } = useCoverageFilters(classificationCoverageDefaultPaper);
  const cachedLink = buildModeLink("/statistics/classification-coverage", searchParams);

  const handleCompute = async () => {
    setIsComputing(true);
    try {
      const nextSnapshot = await computeLiveSnapshot({});
      setSnapshot(nextSnapshot as LiveCoveragePayload);
      toast.success("Live classification coverage updated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to compute live classification coverage.");
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntroCard
        mode="live"
        switchTo={cachedLink}
        switchLabel="Open cached snapshot"
        onCompute={handleCompute}
        isComputing={isComputing}
        updatedAt={snapshot?.sharedSnapshot.updatedAt}
      />

      {!snapshot ? (
        <LoadingPanel>
          Click <span className="font-medium">Calculate live snapshot</span> to scan the current catalog,
          classifications, and active sequences. The resulting view stays fully interactive as you switch papers
          or change the target classifications per galaxy.
        </LoadingPanel>
      ) : (
        <ClassificationCoverageDashboard
          mode="live"
          sharedSnapshot={snapshot.sharedSnapshot}
          scopeSnapshots={snapshot.scopeSnapshots}
          defaultPaper={classificationCoverageDefaultPaper}
          alternateModeLink={cachedLink}
          alternateModeLabel="Open cached snapshot"
        />
      )}
    </div>
  );
}

export { CachedClassificationCoverageTab as CachedPaperAssignmentCoverageTab };
export { LiveClassificationCoverageTab as LivePaperAssignmentCoverageTab };