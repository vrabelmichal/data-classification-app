import { cn } from "../../lib/utils";
import type { NavigationStateOrNull } from "./types";

interface ActionButtonsProps {
  canSubmit: boolean;
  formLocked: boolean;
  navigation: NavigationStateOrNull;
  onSubmit: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function ActionButtons({
  canSubmit,
  formLocked,
  navigation,
  onSubmit,
  onSkip,
  onPrevious,
  onNext,
}: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onSubmit}
        disabled={!canSubmit || formLocked}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          canSubmit && !formLocked
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Submit
      </button>
      <button
        onClick={onSkip}
        disabled={formLocked}
        className="py-3 px-4 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
      >
        Skip
      </button>
      <button
        onClick={onPrevious}
        disabled={!navigation?.hasPrevious}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasPrevious
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!navigation?.hasNext}
        className={cn(
          "py-3 px-4 rounded-lg font-semibold transition-colors",
          navigation?.hasNext
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        )}
      >
        Next
      </button>
    </div>
  );
}
