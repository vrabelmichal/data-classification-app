import { ReactNode } from "react";
import { cn } from "../../../lib/utils";

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
}: {
  label: string;
  value: string;
  helper?: string;
  isLoading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-colors",
        isLoading
          ? "border-blue-200 bg-blue-50/80 dark:border-blue-800/70 dark:bg-blue-950/20"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
        {isLoading && <LoadingBadge {...(loadingLabel != null ? { label: loadingLabel } : {})} className="shrink-0" />}
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
}: {
  percent: number;
  isLoading?: boolean;
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
      ></div>
    </div>
  );
}

export function BreakdownBar({
  items,
  total,
}: {
  items: Array<{ label: string; value: number; color: string; icon: string }>;
  total: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percentage = total > 0 ? Math.min((item.value / total) * 100, 100) : 0;
        return (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium text-gray-900 dark:text-white text-sm">{item.label}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-16 text-right">
                {item.value.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
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
