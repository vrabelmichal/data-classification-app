import { CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router";
import { cn } from "../../../lib/utils";
import { BreakdownBar, CompositionBreakdown, LoadingBadge, LoadingPanel, ProgressBar, StatCard } from "./shared";
import { PaperCount, PaperFilter, TargetProgressMetrics, Totals } from "./types";

type OverviewMode = "live" | "cached";

function formatTimestampBadgeLabel(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return includeYear ? `${day}.${month}.${year} ${hours}:${minutes}` : `${day}.${month} ${hours}:${minutes}`;
}

function TimestampBadge({
  timestamp,
}: {
  timestamp?: number | null;
}) {
  if (!timestamp) {
    return null;
  }

  return (
    <span
      title={formatTimestampLabel(timestamp)}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200/80 bg-gray-100/70 px-2 py-0.5 text-[11px] font-medium text-gray-500 whitespace-nowrap dark:border-gray-700/80 dark:bg-gray-900/60 dark:text-gray-400"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {formatTimestampBadgeLabel(timestamp)}
    </span>
  );
}

const PAPER_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#ea580c",
  "#db2777",
  "#65a30d",
  "#dc2626",
  "#4f46e5",
  "#0f766e",
];

const UNASSIGNED_PAPER_COLOR = "#64748b";
const ALL_PAPERS_COLOR = "#1d4ed8";

function paperLabel(p: string) {
  return p === "" ? "Unassigned" : p;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (expanded.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function paperColor(paper: string, index: number) {
  if (paper === "") {
    return UNASSIGNED_PAPER_COLOR;
  }

  return PAPER_COLORS[index % PAPER_COLORS.length];
}

function formatPercentLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  if (value < 0.1) {
    return "<0.1%";
  }

  if (value < 10) {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toFixed(0)}%`;
}

function metricToneClasses(tone: "default" | "positive" | "negative" = "default") {
  switch (tone) {
    case "positive":
      return {
        wrapper: "bg-emerald-50/80 dark:bg-emerald-950/20",
        value: "text-emerald-700 dark:text-emerald-300",
      };
    case "negative":
      return {
        wrapper: "bg-rose-50/80 dark:bg-rose-950/20",
        value: "text-rose-700 dark:text-rose-300",
      };
    default:
      return {
        wrapper: "bg-gray-50 dark:bg-gray-900/50",
        value: "text-gray-900 dark:text-white",
      };
  }
}

function PaperMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClasses = metricToneClasses(tone);

  return (
    <div className={cn("rounded-xl px-3 py-2", toneClasses.wrapper)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold", toneClasses.value)}>{value}</div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
  hidden = false,
}: {
  label: string;
  tone: "loading" | "ready" | "info" | "warning" | "error";
  hidden?: boolean;
}) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
        tone === "loading" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/20 dark:text-blue-200",
        tone === "ready" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:text-emerald-300",
        tone === "info" &&
          "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400",
        tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-300",
        tone === "error" &&
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/20 dark:text-rose-300",
        hidden && "invisible"
      )}
    >
      {tone === "loading" && <span className="h-2 w-2 rounded-full bg-current animate-pulse" aria-hidden="true" />}
      {label}
    </span>
  );
}

function formatTimestampLabel(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "Not available yet";
  }

  return new Date(timestamp).toLocaleString();
}

function formatLastActiveSummary(timestamp: number | undefined) {
  if (timestamp === undefined) {
    return "Last active n/a";
  }

  return `Last active ${formatTimestampBadgeLabel(timestamp)}`;
}

export function OverviewStatusSection({
  title,
  description,
  badges,
  timestamps,
  adminSwitchTo,
  adminSwitchLabel,
}: {
  title: string;
  description: string;
  badges: Array<{
    label: string;
    tone: "loading" | "ready" | "info" | "warning" | "error";
  }>;
  timestamps: Array<{ label: string; timestamp: number | null | undefined }>;
  adminSwitchTo?: string;
  adminSwitchLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            {badges.map((badge) => (
              <StatusPill key={`${badge.label}-${badge.tone}`} label={badge.label} tone={badge.tone} />
            ))}
          </div>
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </div>

        {adminSwitchTo && adminSwitchLabel && (
          <Link
            to={adminSwitchTo}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
          >
            {adminSwitchLabel}
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {timestamps.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {item.label}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {formatTimestampLabel(item.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperCard({
  label,
  share,
  counts,
  accentColor,
  isSelected,
  onClick,
  isLoading = false,
  helper,
}: {
  label: string;
  share: number;
  counts: PaperCount;
  accentColor: string;
  isSelected: boolean;
  onClick: () => void;
  isLoading?: boolean;
  helper?: string;
}) {
  const selectedStyle: CSSProperties | undefined = isSelected
    ? {
        borderColor: hexToRgba(accentColor, 0.45),
        background: `linear-gradient(180deg, ${hexToRgba(accentColor, 0.16)} 0%, ${hexToRgba(
          accentColor,
          0.06
        )} 100%)`,
        boxShadow: `0 0 0 1px ${hexToRgba(accentColor, 0.14)}`,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "h-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:focus-visible:ring-offset-gray-900",
        isSelected && "-translate-y-0.5"
      )}
      style={selectedStyle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
            <span className="break-words text-sm font-semibold leading-5 text-gray-900 dark:text-white">{label}</span>
          </div>
          <div
            aria-hidden={!helper || undefined}
            className={cn(
              "mt-1 min-h-[2rem] text-xs text-gray-500 dark:text-gray-400",
              !helper && "invisible"
            )}
          >
            {helper ?? "\u00A0"}
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
            isSelected
              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/70 dark:bg-blue-950/30 dark:text-blue-200"
              : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400"
          )}
        >
          {isSelected ? "Selected" : "Filter"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {isSelected ? (
          <StatusPill label={isLoading ? "Counting" : "Ready"} tone={isLoading ? "loading" : "ready"} />
        ) : (
          <StatusPill label="Ready" tone="ready" hidden />
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">{formatPercentLabel(share)} of catalog</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <PaperMetric label="Total" value={counts.total.toLocaleString()} />
        </div>
        <PaperMetric label="Effective" value={counts.adjusted.toLocaleString()} tone="positive" />
        <PaperMetric label="Blacklisted" value={counts.blacklisted.toLocaleString()} tone="negative" />
      </div>

      <div className="mt-4 flex min-h-[1.25rem] items-start text-xs">
        <span
          className={cn(
            "font-medium",
            isSelected ? "text-gray-700 dark:text-gray-200" : "text-gray-600 dark:text-gray-300"
          )}
          style={isSelected ? undefined : { color: accentColor }}
        >
          {isSelected ? "Click to clear" : "Click to filter"}
        </span>
      </div>
    </button>
  );
}

function ProgressDetail({
  title,
  value,
  loading = false,
  helper,
  loadingLabel,
}: {
  title: string;
  value: string;
  loading?: boolean;
  helper?: string;
  loadingLabel?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3",
        loading ? "bg-blue-50/80 dark:bg-blue-950/20" : "bg-gray-50 dark:bg-gray-900/50"
      )}
    >
      <div className="font-medium text-gray-900 dark:text-white">{title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span className={cn(loading && "text-blue-700 dark:text-blue-200")}>{value}</span>
        {loading && <LoadingBadge label={loadingLabel ?? "Counting"} className="px-2 py-1 text-[11px]" />}
      </div>
      <div
        aria-hidden={!helper || undefined}
        className={cn(
          "mt-1 min-h-[1rem] text-xs text-gray-500 dark:text-gray-400",
          !helper && "invisible"
        )}
      >
        {helper ?? "\u00A0"}
      </div>
    </div>
  );
}

const MAX_TARGET_CLASSIFICATIONS = 25;

function clampTargetClassifications(targetClassifications: number) {
  if (!Number.isFinite(targetClassifications)) {
    return 1;
  }

  return Math.min(MAX_TARGET_CLASSIFICATIONS, Math.max(1, Math.floor(targetClassifications)));
}

function TargetCountControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (nextValue: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commitDraftValue = () => {
    const parsed = Number(draftValue);
    const nextValue = Number.isFinite(parsed)
      ? clampTargetClassifications(parsed)
      : value;

    setDraftValue(String(nextValue));
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clampTargetClassifications(value - 1))}
        disabled={value <= 1}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
        aria-label="Decrease target classifications per galaxy"
      >
        -
      </button>

      <label className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm dark:border-gray-600 dark:bg-gray-800">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Target per galaxy
        </div>
        <input
          type="number"
          min={1}
          max={MAX_TARGET_CLASSIFICATIONS}
          step={1}
          inputMode="numeric"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitDraftValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setDraftValue(String(value));
              event.currentTarget.blur();
            }
          }}
          className="mt-1 w-24 border-none bg-transparent p-0 text-lg font-semibold text-gray-900 outline-none focus:ring-0 dark:text-white"
          aria-label="Target classifications per galaxy"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(clampTargetClassifications(value + 1))}
        disabled={value >= MAX_TARGET_CLASSIFICATIONS}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
        aria-label="Increase target classifications per galaxy"
      >
        +
      </button>
    </div>
  );
}

/** Blue pill shown on sections whose data is scoped to the selected paper. */
function FilteredBadge({ paper }: { paper: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 whitespace-nowrap dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M1.5 2A.5.5 0 0 1 2 1.5h12a.5.5 0 0 1 .354.854L9.5 7.207V13.5a.5.5 0 0 1-.276.447l-3 1.5A.5.5 0 0 1 5.5 15V7.207L1.646 2.354A.5.5 0 0 1 1.5 2z" />
      </svg>
      {paperLabel(paper)}
    </span>
  );
}

/** Gray pill shown on sections whose data is always global, when a paper filter is active. */
function GlobalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 whitespace-nowrap dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z" />
      </svg>
      All papers
    </span>
  );
}

export function PaperCatalogSection({
  availablePapers,
  paperCounts,
  paperFilter,
  selectedPaper,
  onSelectPaper,
  isLoading = false,
  isPaperStatsLoading = false,
  mode = "live",
  updatedAt,
}: {
  availablePapers: string[];
  paperCounts: Record<string, PaperCount>;
  paperFilter: PaperFilter;
  selectedPaper: string | undefined;
  onSelectPaper: (paper: string | undefined) => void;
  isLoading?: boolean;
  isPaperStatsLoading?: boolean;
  mode?: OverviewMode;
  updatedAt?: number | null;
}) {
  const paperKeys = Array.from(
    new Set(
      paperFilter && !availablePapers.includes(paperFilter.paper)
        ? [...availablePapers, paperFilter.paper]
        : availablePapers
    )
  );

  if (paperKeys.length === 0) {
    return isLoading ? <LoadingPanel>Loading galaxy catalog by paper…</LoadingPanel> : null;
  }

  const entries = paperKeys.map((paper, index) => {
    const fallbackCounts =
      paperFilter && paperFilter.paper === paper
        ? {
            total: paperFilter.galaxies,
            blacklisted: paperFilter.blacklisted,
            adjusted: paperFilter.adjusted,
          }
        : undefined;

    const counts = paperCounts[paper] ?? fallbackCounts ?? { total: 0, blacklisted: 0, adjusted: 0 };

    return {
      paper,
      counts,
      color: paperColor(paper, index),
      isSelected: selectedPaper === paper,
    };
  });

  const totalGalaxies = entries.reduce((sum, entry) => sum + entry.counts.total, 0);
  const totalBlacklisted = entries.reduce((sum, entry) => sum + entry.counts.blacklisted, 0);
  const totalEffective = entries.reduce((sum, entry) => sum + entry.counts.adjusted, 0);
  const entriesWithShare = entries.map((entry) => ({
    ...entry,
    share: totalGalaxies > 0 ? (entry.counts.total / totalGalaxies) * 100 : 0,
  }));
  const selectedEntry = entriesWithShare.find((entry) => entry.isSelected);
  const catalogStatusText = selectedPaper === undefined
    ? "Select a paper card below to filter the paper-scoped overview metrics."
    : isPaperStatsLoading
      ? mode === "cached"
        ? "Paper-specific cached snapshot is loading."
        : "Paper-specific classification totals are updating live."
      : "Paper filter is applied to the paper-scoped overview metrics.";
  const loadingStatusLabel = mode === "cached" ? "Loading snapshot" : "Live count";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Galaxy catalog by paper</h3>
            {selectedPaper !== undefined && <FilteredBadge paper={selectedPaper} />}
            <TimestampBadge timestamp={updatedAt} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {mode === "cached"
              ? "One stacked bar shows each paper's share of the full catalog. Use the cards below to filter the rest of the overview. Timestamps on each panel show when that section's cached snapshot was last refreshed."
              : "One stacked bar shows each paper's share of the full catalog. Use the cards below to filter the rest of the overview."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedPaper !== undefined && (
            <button
              type="button"
              onClick={() => onSelectPaper(undefined)}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-200"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Share of all galaxies in the catalog</span>
          <span>{totalGalaxies.toLocaleString()} total galaxies</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950/40">
          <div className="flex h-5 w-full">
            {entriesWithShare.map((entry) => (
              <button
                type="button"
                key={entry.paper === "" ? "__empty__" : entry.paper}
                onClick={() => onSelectPaper(entry.isSelected ? undefined : entry.paper)}
                title={`${paperLabel(entry.paper)} — ${entry.counts.total.toLocaleString()} galaxies (${formatPercentLabel(entry.share)})`}
                className={cn(
                  "relative h-full transition-opacity duration-200 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
                  selectedPaper !== undefined && !entry.isSelected ? "opacity-40 hover:opacity-70" : "opacity-100"
                )}
                style={{
                  width: `${entry.share}%`,
                  backgroundColor: entry.color,
                  boxShadow: entry.isSelected ? "inset 0 0 0 2px rgba(255, 255, 255, 0.85)" : undefined,
                }}
                aria-label={`Filter by ${paperLabel(entry.paper)}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {totalEffective.toLocaleString()} effective after excluding {totalBlacklisted.toLocaleString()} blacklisted galaxies
          </span>
          {selectedEntry && (
            <span className="text-gray-600 dark:text-gray-300">
              {paperLabel(selectedEntry.paper)}: {selectedEntry.counts.total.toLocaleString()} galaxies · {formatPercentLabel(selectedEntry.share)} of catalog
            </span>
          )}
        </div>

        <div className="mt-3 flex min-h-[1.75rem] flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                selectedPaper === undefined
                  ? "bg-gray-300 dark:bg-gray-600"
                  : isPaperStatsLoading
                    ? "bg-blue-500 animate-pulse"
                    : "bg-emerald-500"
              )}
              aria-hidden="true"
            />
            <span
              title={catalogStatusText}
              className={cn(
                "truncate text-gray-500 dark:text-gray-400",
                selectedPaper !== undefined && isPaperStatsLoading && "text-blue-700 dark:text-blue-200"
              )}
            >
              {catalogStatusText}
            </span>
          </div>
          <StatusPill
            label={selectedPaper === undefined ? "Browse" : isPaperStatsLoading ? loadingStatusLabel : "Ready"}
            tone={selectedPaper === undefined ? "info" : isPaperStatsLoading ? "loading" : "ready"}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <PaperCard
          label="All papers"
          share={100}
          counts={{ total: totalGalaxies, blacklisted: totalBlacklisted, adjusted: totalEffective }}
          accentColor={ALL_PAPERS_COLOR}
          isSelected={selectedPaper === undefined}
          onClick={() => onSelectPaper(undefined)}
          helper="Entire catalog"
        />

        {entriesWithShare.map((entry) => (
          <PaperCard
            key={entry.paper === "" ? "__empty__" : entry.paper}
            label={paperLabel(entry.paper)}
            share={entry.share}
            counts={entry.counts}
            accentColor={entry.color}
            isSelected={entry.isSelected}
            onClick={() => onSelectPaper(entry.isSelected ? undefined : entry.paper)}
            isLoading={entry.isSelected && isPaperStatsLoading}
            helper="Dataset counts"
          />
        ))}
      </div>
    </div>
  );
}

export function SummaryCardsSection({
  totals,
  selectedPaper,
  isPaperStatsLoading = false,
  mode = "live",
  updatedAt,
}: {
  totals?: Totals;
  selectedPaper: string | undefined;
  isPaperStatsLoading?: boolean;
  mode?: OverviewMode;
  updatedAt?: number | null;
}) {
  if (!totals) return <LoadingPanel>Loading summary statistics…</LoadingPanel>;

  const isCountingSelectedPaper = selectedPaper !== undefined && isPaperStatsLoading;
  const loadingStatusLabel = mode === "cached" ? "Loading snapshot" : "Live count";
  const statLoadingLabel = mode === "cached" ? "Loading" : "Counting";

  return (
    <div className="space-y-3">
      <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Showing stats for</span>
        {selectedPaper !== undefined ? <FilteredBadge paper={selectedPaper} /> : <GlobalBadge />}
        <TimestampBadge timestamp={updatedAt} />
        {selectedPaper !== undefined && (
          <StatusPill label={isCountingSelectedPaper ? loadingStatusLabel : "Ready"} tone={isCountingSelectedPaper ? "loading" : "ready"} />
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Galaxies"
          value={totals.galaxies.toLocaleString()}
          helper={selectedPaper !== undefined ? "Galaxies in the selected paper" : "Total in catalog"}
          loadingLabel={statLoadingLabel}
          reserveLoadingLayout
        />
        <StatCard
          label="Classified"
          value={totals.classifiedGalaxies.toLocaleString()}
          helper={isCountingSelectedPaper
            ? mode === "cached"
              ? "Waiting for the selected paper snapshot"
              : "Counted so far for this paper"
            : "Have at least one label"}
          isLoading={isCountingSelectedPaper}
          loadingLabel={statLoadingLabel}
          reserveLoadingLayout
        />
        <StatCard
          label="Unclassified"
          value={totals.unclassifiedGalaxies.toLocaleString()}
          helper={isCountingSelectedPaper
            ? mode === "cached"
              ? "Will update when the selected paper snapshot loads"
              : "Derived while the classified count is still updating"
            : "Still waiting"}
          isLoading={isCountingSelectedPaper}
          loadingLabel={statLoadingLabel}
          reserveLoadingLayout
        />
        <StatCard
          label="Completion"
          value={`${totals.progress.toFixed(1)}%`}
          helper={isCountingSelectedPaper
            ? mode === "cached"
              ? "Will update when the selected paper snapshot loads"
              : "Will settle when counting finishes"
            : "Overall progress"}
          isLoading={isCountingSelectedPaper}
          loadingLabel={statLoadingLabel}
          reserveLoadingLayout
        />
      </div>
    </div>
  );
}

export function ProgressSection({
  totals,
  targetProgress,
  targetClassifications,
  onTargetClassificationsChange,
  activeClassifiers,
  selectedPaper,
  isPaperStatsLoading = false,
  mode = "live",
  updatedAt,
}: {
  totals?: Totals;
  targetProgress?: TargetProgressMetrics;
  targetClassifications: number;
  onTargetClassificationsChange: (nextValue: number) => void;
  activeClassifiers?: number;
  selectedPaper: string | undefined;
  isPaperStatsLoading?: boolean;
  mode?: OverviewMode;
  updatedAt?: number | null;
}) {
  const avgPerActive = totals && activeClassifiers && activeClassifiers > 0
    ? totals.totalClassifications / activeClassifiers
    : 0;
  const isCountingSelectedPaper = selectedPaper !== undefined && isPaperStatsLoading;
  const isGlobalTargetLoading = selectedPaper === undefined && targetProgress === undefined;
  const isTargetProgressLoading = isCountingSelectedPaper || isGlobalTargetLoading;
  const loadingAccent = isCountingSelectedPaper || isGlobalTargetLoading;
  const targetGoal = targetProgress?.targetClassificationsTotal
    ?? (totals ? totals.galaxies * targetClassifications : 0);
  const galaxiesAtTargetPercent = totals && targetProgress && totals.galaxies > 0
    ? (targetProgress.galaxiesAtTarget / totals.galaxies) * 100
    : 0;
  const reachedTargetSummary = targetProgress && totals
    ? `${targetProgress.galaxiesAtTarget.toLocaleString()} / ${totals.galaxies.toLocaleString()} galaxies`
    : "Loading target attainment…";
  const anyCoverageSummary = totals
    ? `${totals.classifiedGalaxies.toLocaleString()} / ${totals.galaxies.toLocaleString()} galaxies`
    : "Loading overall counts…";
  const labelVolumeSummary = targetProgress && totals
    ? `${totals.totalClassifications.toLocaleString()} / ${targetGoal.toLocaleString()} classifications`
    : "Loading label volume…";
  const progressStatusText = selectedPaper === undefined
    ? isGlobalTargetLoading
      ? "Loading catalog progress against the repeat-classification target."
      : `Showing how many galaxies have reached ${targetClassifications} classifications, plus the raw label volume collected.`
    : isCountingSelectedPaper
      ? mode === "cached"
        ? "Paper-specific target attainment and label volume are loading from the cached snapshot."
        : "Paper-specific target attainment and label volume are updating live."
      : `Paper-specific target attainment and label volume are up to date.`;
  const loadingStatusLabel = mode === "cached" ? "Loading snapshot" : "Live count";
  const detailLoadingLabel = mode === "cached" ? "Loading" : "Counting";

  return (
    <div
      className={cn(
        "rounded-xl border p-6 shadow-sm transition-colors",
        loadingAccent
          ? "border-blue-200 bg-blue-50/40 dark:border-blue-800/70 dark:bg-blue-950/10"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">Target progress</div>
            {selectedPaper !== undefined ? <FilteredBadge paper={selectedPaper} /> : <GlobalBadge />}
            <TimestampBadge timestamp={updatedAt} />
          </div>
          <div
            className={cn(
              "text-3xl font-semibold text-gray-900 dark:text-white",
              loadingAccent && "text-blue-700 dark:text-blue-100"
            )}
          >
            {targetProgress ? formatPercentLabel(galaxiesAtTargetPercent) : "—"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {targetProgress && totals
              ? `${targetProgress.galaxiesAtTarget.toLocaleString()} / ${totals.galaxies.toLocaleString()} galaxies reached ${targetProgress.targetClassifications}x coverage`
              : "Loading target-aware counts…"}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <TargetCountControl
            value={targetClassifications}
            onChange={onTargetClassificationsChange}
          />
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            {totals
              ? `${totals.classifiedGalaxies.toLocaleString()} / ${totals.galaxies.toLocaleString()} galaxies have at least one classification`
              : "Loading overall counts…"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Reached target</span>
            <span>{reachedTargetSummary}</span>
          </div>
          <ProgressBar
            percent={galaxiesAtTargetPercent}
            isLoading={isTargetProgressLoading}
            ariaLabel="Reached target"
          />
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>At least one classification</span>
            <span>{anyCoverageSummary}</span>
          </div>
          <ProgressBar
            percent={totals?.progress ?? 0}
            isLoading={isCountingSelectedPaper}
            ariaLabel="At least one classification"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2 xl:grid-cols-3">
        <ProgressDetail
          title="Label volume"
          value={labelVolumeSummary}
          loading={isTargetProgressLoading}
          loadingLabel={detailLoadingLabel}
          helper={targetProgress
            ? "Counts every classification, so repeats on already-covered galaxies also contribute."
            : undefined}
        />
        <ProgressDetail
          title="Per galaxy"
          value={totals ? `${totals.avgClassificationsPerGalaxy.toFixed(2)} avg classifications/galaxy` : "Loading…"}
          loading={isCountingSelectedPaper}
          loadingLabel={detailLoadingLabel}
          helper={isCountingSelectedPaper
            ? mode === "cached"
              ? "This ratio updates when the selected paper snapshot loads."
              : "This ratio updates as the paper scan completes."
            : undefined}
        />
        <ProgressDetail
          title="Repeat labels"
          value={targetProgress ? `${targetProgress.repeatClassifications.toLocaleString()} extra classifications` : "Loading…"}
          loading={isTargetProgressLoading}
          loadingLabel={detailLoadingLabel}
          helper={targetProgress
            ? `${targetProgress.galaxiesWithMultipleClassifications.toLocaleString()} galaxies have 2+ classifications`
            : undefined}
        />
        <ProgressDetail
          title="Remaining to target"
          value={targetProgress ? `${targetProgress.remainingClassificationsToTarget.toLocaleString()} classifications` : "Loading…"}
          loading={isTargetProgressLoading}
          loadingLabel={detailLoadingLabel}
          helper={targetProgress
            ? `${targetProgress.galaxiesBelowTarget.toLocaleString()} galaxies are still below ${targetClassifications}x`
            : undefined}
        />
        <ProgressDetail
          title="Active users"
          value={activeClassifiers !== undefined ? `${activeClassifiers.toLocaleString()} with >=1 classification` : "Loading…"}
          helper={selectedPaper !== undefined ? "Global activity metric" : "Catalog-wide activity metric"}
        />
        <ProgressDetail
          title="Avg per active user"
          value={totals && activeClassifiers !== undefined ? `${avgPerActive.toFixed(2)} classifications` : "Loading…"}
          loading={isCountingSelectedPaper}
          loadingLabel={detailLoadingLabel}
          helper={isCountingSelectedPaper
            ? mode === "cached"
              ? "Uses the selected paper snapshot once it finishes loading."
              : "Uses the selected paper's running classification total."
            : undefined}
        />
      </div>

      <div className="mt-4 flex min-h-[1.75rem] flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              selectedPaper === undefined
                ? isGlobalTargetLoading
                  ? "bg-blue-500 animate-pulse"
                  : "bg-gray-300 dark:bg-gray-600"
                : isCountingSelectedPaper
                  ? "bg-blue-500 animate-pulse"
                  : "bg-emerald-500"
            )}
            aria-hidden="true"
          />
          <span
            title={progressStatusText}
            className={cn(
              "truncate",
              isCountingSelectedPaper ? "text-blue-700 dark:text-blue-200" : "text-gray-500 dark:text-gray-400"
            )}
          >
            {progressStatusText}
          </span>
        </div>
        <StatusPill
          label={selectedPaper === undefined ? isGlobalTargetLoading ? "Calculating" : "Catalog" : isCountingSelectedPaper ? loadingStatusLabel : "Ready"}
          tone={selectedPaper === undefined ? isGlobalTargetLoading ? "loading" : "info" : isCountingSelectedPaper ? "loading" : "ready"}
        />
      </div>
    </div>
  );
}

export function ThroughputSection({
  recency,
  dailySeries,
  selectedPaper,
  updatedAt,
}: {
  recency?: { classificationsLast24h: number; classificationsLast7d: number };
  dailySeries: Array<{ label: string; count: number }>;
  selectedPaper: string | undefined;
  updatedAt?: number | null;
}) {
  const maxDailyCount = dailySeries.reduce((max, day) => Math.max(max, day.count), 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Recent throughput</div>
          {selectedPaper !== undefined && <GlobalBadge />}
          <TimestampBadge timestamp={updatedAt} />
        </div>
        <div className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
          {recency ? "Labels collected over the last 24h and 7d" : "Loading recent throughput…"}
        </div>
      </div>

      {recency ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 shadow-sm dark:border-cyan-900/60 dark:bg-cyan-950/15">
              <div className="text-[11px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Past 24h
              </div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {recency.classificationsLast24h.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/15">
              <div className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Past 7d
              </div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {recency.classificationsLast7d.toLocaleString()}
              </div>
            </div>
          </div>

          {dailySeries.length > 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Daily activity
              </div>
              <div className="space-y-3">
                {dailySeries.map((day) => {
                  const barPercent = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;

                  return (
                    <div key={day.label} className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{day.label}</span>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {day.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Daily activity series is not available yet.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading daily activity…</div>
      )}
    </div>
  );
}

export function TopClassifiersSection({
  topClassifiers,
  selectedPaper,
  updatedAt,
}: {
  topClassifiers:
    | Array<{
        profileId: string;
        name?: string | null;
        userId: string;
        lastActiveAt?: number;
        classifications: number;
      }>
    | undefined;
  selectedPaper: string | undefined;
  updatedAt?: number | null;
}) {
  const leader = topClassifiers?.[0];
  const remainingTopClassifiers = topClassifiers?.slice(1) ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Top classifiers</div>
          {selectedPaper !== undefined && <GlobalBadge />}
          <TimestampBadge timestamp={updatedAt} />
        </div>
        <div className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">Most cumulative labels</div>
      </div>

      {topClassifiers === undefined ? (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading classifier data…</div>
      ) : leader ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/15">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="inline-flex rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/70 dark:bg-gray-900/40 dark:text-amber-300">
                  Current leader
                </div>
                <div className="mt-3 truncate text-lg font-semibold text-gray-900 dark:text-white">
                  {leader.name || leader.userId}
                </div>
                <div
                  title={leader.lastActiveAt !== undefined ? formatTimestampLabel(leader.lastActiveAt) : undefined}
                  className="mt-1 text-xs text-gray-500 dark:text-gray-400"
                >
                  {formatLastActiveSummary(leader.lastActiveAt)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  #1
                </div>
                <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                  {leader.classifications.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">labels</div>
              </div>
            </div>
          </div>

          {remainingTopClassifiers.length > 0 && (
            <div className="space-y-2">
              {remainingTopClassifiers.map((entry, index) => (
                <div
                  key={entry.profileId}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white text-xs font-semibold text-amber-700 dark:border-amber-800/70 dark:bg-gray-900/50 dark:text-amber-300">
                      {index + 2}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900 dark:text-white">
                        {entry.name || entry.userId}
                      </div>
                      <div
                        title={entry.lastActiveAt !== undefined ? formatTimestampLabel(entry.lastActiveAt) : undefined}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        {formatLastActiveSummary(entry.lastActiveAt)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {entry.classifications.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">labels</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">No classifier data yet.</div>
      )}
    </div>
  );
}

export function ClassificationBreakdownsSection({
  lsbItems,
  morphologyItems,
  flagItems,
  totalClassifications,
  loading,
  selectedPaper,
  updatedAt,
}: {
  lsbItems: Array<{ label: string; value: number; color: string; icon: string }>;
  morphologyItems: Array<{ label: string; value: number; color: string; icon: string }>;
  flagItems: Array<{ label: string; value: number; color: string; icon: string }>;
  totalClassifications: number;
  loading: boolean;
  selectedPaper: string | undefined;
  updatedAt?: number | null;
}) {
  const lsbTotal = lsbItems.reduce((sum, item) => sum + item.value, 0);
  const morphologyTotal = morphologyItems.reduce((sum, item) => sum + item.value, 0);
  const hasCompositionPanels = lsbItems.length > 0 || morphologyItems.length > 0;
  const hasMismatchWarning =
    lsbItems.length > 0 && morphologyItems.length > 0 && lsbTotal !== morphologyTotal;

  return (
    <div className="space-y-6">
      {loading && lsbItems.length === 0 && morphologyItems.length === 0 && flagItems.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Loading classification breakdowns…
        </div>
      )}

      {hasMismatchWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200">
          LSB total ({lsbTotal.toLocaleString()}) and morphology total ({morphologyTotal.toLocaleString()}) do not match. This points to legacy or invalid stored classification values.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        {hasCompositionPanels && lsbItems.length > 0 && (
          <div className="xl:col-span-3">
            <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 space-y-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">LSB Classification</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPaper !== undefined && <GlobalBadge />}
                  <TimestampBadge timestamp={updatedAt} />
                </div>
              </div>

              {totalClassifications === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No classifications yet</div>
              ) : (
                <CompositionBreakdown items={lsbItems} />
              )}
            </div>
          </div>
        )}

        {hasCompositionPanels && morphologyItems.length > 0 && (
          <div className="xl:col-span-5">
            <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 space-y-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Morphology Classification</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPaper !== undefined && <GlobalBadge />}
                  <TimestampBadge timestamp={updatedAt} />
                </div>
              </div>

              {totalClassifications === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No classifications yet</div>
              ) : (
                <CompositionBreakdown items={morphologyItems} />
              )}
            </div>
          </div>
        )}

        {flagItems.length > 0 && (
          <div className="lg:col-span-2 xl:col-span-4">
            <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 space-y-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Classification Flags</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPaper !== undefined && <GlobalBadge />}
                  <TimestampBadge timestamp={updatedAt} />
                </div>
              </div>

              {totalClassifications === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No classifications yet</div>
              ) : (
                <BreakdownBar items={flagItems} total={totalClassifications} />
              )}

              {totalClassifications > 0 && (
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Count of classifications where each flag was marked true. Flags can overlap, so totals do not add up to 100%.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
