import { ReactNode } from "react";
import { cn } from "../../../lib/utils";

type BreakdownItem = {
  label: string;
  value: number;
  accentColor: string;
  icon: ReactNode;
};

export function LoadingBadge({
  label = "Counting",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-200",
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  helper,
  isLoading = false,
  loadingLabel,
  reserveLoadingLayout = false,
}: {
  label: string;
  value: string;
  helper?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  reserveLoadingLayout?: boolean;
}) {
  const effectiveLoadingLabel = loadingLabel ?? "Counting";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-colors",
        isLoading
          ? "border-blue-200 bg-blue-50/80 dark:border-blue-800/70 dark:bg-blue-950/20"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          reserveLoadingLayout && "min-h-[1.75rem]"
        )}
      >
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
        {(isLoading || reserveLoadingLayout) && (
          <LoadingBadge
            label={effectiveLoadingLabel}
            className={cn("shrink-0", !isLoading && "invisible")}
          />
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold text-gray-900 dark:text-white",
          isLoading && "text-blue-700 dark:text-blue-100"
        )}
      >
        {value}
      </div>
      {helper && (
        <div
          className={cn(
            "mt-1 text-xs text-gray-500 dark:text-gray-400",
            reserveLoadingLayout && "min-h-[2rem] leading-4",
            isLoading && "text-blue-700/80 dark:text-blue-200/80"
          )}
        >
          {helper}
        </div>
      )}
    </div>
  );
}

export function ProgressBar({
  percent,
  isLoading = false,
  ariaLabel = "Progress",
}: {
  percent: number;
  isLoading?: boolean;
  ariaLabel?: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
      <div
        className={cn(
          "h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 transition-all",
          isLoading && "animate-pulse"
        )}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-busy={isLoading}
        aria-label={ariaLabel}
      ></div>
    </div>
  );
}

export function BreakdownBar({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  const formatPercent = (value: number) => {
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
  };

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;
        return (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center justify-center text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
              </div>

              <div className="flex shrink-0 items-baseline gap-3 text-right">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {item.value.toLocaleString()}
                </span>
                <span className="w-14 text-xs text-gray-500 dark:text-gray-400">
                  {formatPercent(percentage)}
                </span>
              </div>
            </div>

            <div className="mt-3 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: item.accentColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompositionBreakdown({
  items,
}: {
  items: BreakdownItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  const formatPercent = (value: number) => {
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
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900/60">
        <div className="flex h-4 w-full">
          {items.map((item) => {
            const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;
            return (
              <div
                key={item.label}
                title={`${item.label}: ${item.value.toLocaleString()} (${formatPercent(percentage)})`}
                className="h-full transition-[width] duration-300"
                style={{ width: `${percentage}%`, backgroundColor: item.accentColor }}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;

          return (
            <div
              key={item.label}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center justify-center text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
              </div>

              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {item.value.toLocaleString()}
              </span>
              <span className="w-14 text-right text-xs text-gray-500 dark:text-gray-400">
                {formatPercent(percentage)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LoadingPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm text-sm text-gray-500 dark:text-gray-400">
      {children}
    </div>
  );
}
