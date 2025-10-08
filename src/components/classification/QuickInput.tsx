import { RefObject } from "react";

interface QuickInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}

export function QuickInput({ value, onChange, onKeyDown, inputRef, disabled }: QuickInputProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
        Input by typing
      </h4>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Example: -1 or 1- or 0r (with a for awesome)"
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Format: [LSB: -/0/1] [Morph: -/0/1/2] (add "r" for redshift, "a" for awesome). Press Enter to submit.
      </p>
    </div>
  );
}
