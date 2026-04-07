export type RuntimeIssueKind = "network" | "stalled-request";

export interface RuntimeIssue {
  kind: RuntimeIssueKind;
  title: string;
  message: string;
}

interface RuntimeRecoveryBannerProps {
  issue: RuntimeIssue;
  onDismiss: () => void;
  onRefresh: () => void;
}

interface VersionUpdateBannerProps {
  onDismiss: () => void;
  onRefresh: () => void;
}

interface BaseBannerProps {
  children: React.ReactNode;
  colorScheme: "amber" | "blue";
  onDismiss: () => void;
  onRefresh: () => void;
  role: "alert" | "status";
}

function BaseBanner({ children, colorScheme, onDismiss, onRefresh, role }: BaseBannerProps) {
  const styles = {
    amber: {
      background: "bg-amber-600",
      detailText: "text-amber-100",
      dismissText: "text-amber-100 hover:text-white",
      refreshText: "text-amber-700",
      refreshHover: "hover:bg-amber-50",
    },
    blue: {
      background: "bg-blue-600",
      detailText: "text-blue-100",
      dismissText: "text-blue-200 hover:text-white",
      refreshText: "text-blue-600",
      refreshHover: "hover:bg-blue-50",
    },
  }[colorScheme];

  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={`${styles.background} flex items-center justify-between gap-3 px-4 py-2 text-white shadow-lg`}
    >
      <div className={`min-w-0 ${styles.detailText}`}>{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onDismiss}
          className={`${styles.dismissText} text-sm underline`}
        >
          Dismiss
        </button>
        <button
          onClick={onRefresh}
          className={`rounded-md bg-white px-3 py-1 text-sm font-medium ${styles.refreshText} transition-colors ${styles.refreshHover}`}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export function RuntimeRecoveryBanner({
  issue,
  onDismiss,
  onRefresh,
}: RuntimeRecoveryBannerProps) {
  return (
    <BaseBanner colorScheme="amber" onDismiss={onDismiss} onRefresh={onRefresh} role="alert">
      <p className="text-sm font-medium text-white">{issue.title}</p>
      <p className="text-xs">{issue.message}</p>
    </BaseBanner>
  );
}

export function VersionUpdateBanner({ onDismiss, onRefresh }: VersionUpdateBannerProps) {
  return (
    <BaseBanner colorScheme="blue" onDismiss={onDismiss} onRefresh={onRefresh} role="status">
      <div className="min-w-0">
        <span className="text-sm font-medium text-white">
          A new version of the app is available. Please refresh to update.
        </span>
      </div>
    </BaseBanner>
  );
}