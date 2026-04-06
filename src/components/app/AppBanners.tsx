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

export function RuntimeRecoveryBanner({
  issue,
  onDismiss,
  onRefresh,
}: RuntimeRecoveryBannerProps) {
  return (
    <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
      <div className="min-w-0">
        <p className="text-sm font-medium">{issue.title}</p>
        <p className="text-xs text-amber-100">{issue.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-amber-100 hover:text-white text-sm underline"
        >
          Dismiss
        </button>
        <button
          onClick={onRefresh}
          className="bg-white text-amber-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export function VersionUpdateBanner({ onDismiss, onRefresh }: VersionUpdateBannerProps) {
  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm font-medium">
          A new version of the app is available. Please refresh to update.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-blue-200 hover:text-white text-sm underline"
        >
          Dismiss
        </button>
        <button
          onClick={onRefresh}
          className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}