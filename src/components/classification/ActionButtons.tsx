import { cn } from "../../lib/utils";
import type { NavigationStateOrNull } from "./types";

interface ActionButtonsProps {
  canSubmit: boolean;
  formLocked: boolean;
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
  navigation,
  isOnline,
  isSkipped,
  isMaintenanceMode = false,
  onSubmit,
  onSkip,
  onPrevious,
  onNext,
}: ActionButtonsProps) {
  const submitDisabled = !canSubmit || formLocked || !isOnline || isMaintenanceMode;
  const submitActive = canSubmit && !formLocked && isOnline && !isMaintenanceMode;

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onSubmit}
        disabled={submitDisabled}
        title={isMaintenanceMode ? "New classifications are temporarily disabled for maintenance" : undefined}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          submitActive
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Submit
      </button>
      <button
        onClick={onSkip}
        disabled={formLocked || !isOnline}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          !formLocked && isOnline
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
        disabled={!navigation?.hasPrevious || !isOnline}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasPrevious && isOnline
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!navigation?.hasNext || !isOnline}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasNext && isOnline
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Next
      </button>
    </div>
  );
}
