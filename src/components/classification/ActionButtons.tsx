import { cn } from "../../lib/utils";
import type { NavigationStateOrNull } from "./types";

interface ActionButtonsProps {
  canSubmit: boolean;
  formLocked: boolean;
  isSubmitting?: boolean;
  navigation: NavigationStateOrNull;
  isOnline: boolean;
  isSkipped?: boolean;
  isMaintenanceMode?: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function ActionButtons({
  canSubmit,
  formLocked,
  isSubmitting = false,
  navigation,
  isOnline,
  isSkipped,
  isMaintenanceMode = false,
  onSubmit,
  onSkip,
  onPrevious,
  onNext,
}: ActionButtonsProps) {
  const maintenanceMessageId = "submit-maintenance-message";
  const submitDisabled = !canSubmit || formLocked || !isOnline || isSubmitting;
  const submitBlockedByMaintenance = isMaintenanceMode;
  const submitUnavailable = submitDisabled || submitBlockedByMaintenance;
  const submitPending = isSubmitting;
  const submitActive = canSubmit && !formLocked && isOnline && !isMaintenanceMode && !isSubmitting;

  return (
    <div className="flex flex-col gap-2">
      {isMaintenanceMode && (
        <p
          id={maintenanceMessageId}
          className="text-sm text-amber-700 dark:text-amber-300"
        >
          New classifications are temporarily disabled for maintenance.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            if (!submitUnavailable) {
              onSubmit();
            }
          }}
          disabled={submitDisabled}
          aria-disabled={submitUnavailable}
          aria-busy={submitPending}
          aria-describedby={isMaintenanceMode ? maintenanceMessageId : undefined}
          className={cn(
            "py-3 px-4 rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2",
            submitPending
              ? "bg-green-600 text-white cursor-wait"
              : submitActive
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          )}
        >
          {submitPending && (
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"
            />
          )}
          <span>{submitPending ? "Submitting..." : "Submit"}</span>
        </button>
      <button
        onClick={onSkip}
        disabled={formLocked || !isOnline || isSubmitting}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          !formLocked && isOnline && !isSubmitting
            ? isSkipped
              ? "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white"
              : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        {isSkipped ? "Unskip" : "Skip"}
      </button>
      <button
        onClick={onPrevious}
        disabled={!navigation?.hasPrevious || !isOnline || isSubmitting}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasPrevious && isOnline && !isSubmitting
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!navigation?.hasNext || !isOnline || isSubmitting}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasNext && isOnline && !isSubmitting
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Next
      </button>
      </div>
    </div>
  );
}
