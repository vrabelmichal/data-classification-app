import { cn } from "../../lib/utils";

type EmailVisibilityToggleProps = {
  showEmails: boolean;
  onToggle: () => void;
  className?: string;
  visibleLabel?: string;
  hiddenLabel?: string;
  variant?: "full" | "compact" | "icon";
};

export function EmailVisibilityToggle({
  showEmails,
  onToggle,
  className,
  visibleLabel = "Show emails",
  hiddenLabel = "Hide emails",
  variant = "full",
}: EmailVisibilityToggleProps) {
  const label = showEmails ? hiddenLabel : visibleLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showEmails}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border transition",
        variant === "full" &&
          cn(
            "w-[9rem] px-2.5 py-1.5 text-sm font-medium",
            showEmails
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
          ),
        variant === "compact" &&
          cn(
            "px-2.5 py-1.5 text-xs font-medium",
            showEmails
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
          ),
        variant === "icon" &&
          cn(
            "h-8 w-8 shrink-0 p-0",
            showEmails
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
          ),
        className,
      )}
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
        {!showEmails ? <path d="M3 3l18 18" /> : null}
      </svg>
      {variant !== "icon" ? <span>{label}</span> : null}
    </button>
  );
}
