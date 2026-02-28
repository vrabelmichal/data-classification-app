import { useState, useEffect, useRef } from "react";

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CommentsModal({
  isOpen,
  onClose,
  value,
  onChange,
  disabled = false,
}: CommentsModalProps) {
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local value when modal opens or external value changes
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
    }
  }, [isOpen, value]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, localValue]);

  const handleSave = () => {
    onChange(localValue);
    onClose();
  };

  const handleClear = () => {
    setLocalValue("");
  };

  if (!isOpen) return null;

  return (
    /*
      Centering the modal works well on desktop but with the soft keyboard
      on mobile the popup ends up too far down.  Switch to `items-start` for
      small screens so the dialog sits near the top, and add extra top padding
      which is removed on larger viewports.
    */
    /*
      Adjust vertical positioning at various breakpoints:
      - base (<640px): pt-10 keeps the dialog low but above the keyboard.
      - sm/md (640–1023px): increase to pt-16 so tablets get a larger top gap.
      - lg (>=1024px): revert to centered (no extra padding).
    */
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start lg:items-center justify-center z-50 p-4 pt-10 sm:pt-16 lg:pt-0">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Comments
          </h2>
          <button
            onClick={handleSave}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder="Add any observations or comments..."
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={6}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3">
          <button
            onClick={handleClear}
            disabled={disabled || !localValue}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={disabled}
            className="px-6 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
