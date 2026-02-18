import { RefObject, useState } from "react";

interface QuickInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  showAwesomeFlag?: boolean;
  showValidRedshift?: boolean;
  showVisibleNucleus?: boolean;
  failedFittingMode?: "legacy" | "checkbox";
}

export function QuickInput({ 
  value, 
  onChange, 
  onKeyDown, 
  inputRef, 
  disabled,
  showAwesomeFlag = true,
  showValidRedshift = true,
  showVisibleNucleus = true,
  failedFittingMode = "checkbox"
}: QuickInputProps) {
  // Build allowed characters string based on visibility settings
  const allowedFlags: string[] = [];
  if (showAwesomeFlag) allowedFlags.push("a");
  if (showValidRedshift) allowedFlags.push("r");
  if (showVisibleNucleus) allowedFlags.push("n");
  if (failedFittingMode === "checkbox") allowedFlags.push("f");
  
  const flagsString = allowedFlags.length > 0 ? ` (add "${allowedFlags.join('", "')}" for ${
    allowedFlags.map((f) => {
      if (f === 'a') return 'awesome';
      if (f === 'r') return 'redshift';
      if (f === 'n') return 'nucleus';
      if (f === 'f') return 'failed fitting';
      return '';
    }).join(', ')
  })` : '';

  // Build realistic examples based on enabled flags
  const examples: string[] = [];
  if (failedFittingMode === "legacy") {
    examples.push("-1"); // Failed fitting, Featureless (legacy mode)
  }
  examples.push("0-"); // Non-LSB, Featureless
  examples.push("1-"); // LSB, Featureless
  
  // Build an example with all enabled flags
  let exampleWithFlags = "12"; // LSB, ETG
  if (showValidRedshift) exampleWithFlags += "r";
  if (showAwesomeFlag) exampleWithFlags += "a";
  if (showVisibleNucleus) exampleWithFlags += "n";
  if (failedFittingMode === "checkbox") exampleWithFlags += "f";
  
  if (exampleWithFlags !== "12") {
    examples.push(exampleWithFlags);
  }

  const [showFormatDetails, setShowFormatDetails] = useState(false);

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            name="quick-input"
            id="quick-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Type a code, e.g., ${examples.join(' or ')}; press Enter to submit.`}
            disabled={disabled}
            aria-label="Quick input classification code"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder:text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {showFormatDetails && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-3 text-xs text-gray-700 dark:text-gray-300">
              <div className="flex items-start justify-between gap-2">
                <p className="leading-snug">
                  Format: [LSB: -/0/1] [Morph: -/0/1/2]{flagsString}. Press Enter to submit.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFormatDetails(false)}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-base font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 px-3"
                  aria-label="Close format details"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFormatDetails(true)}
          title={`Format: [LSB: -/0/1] [Morph: -/0/1/2${flagsString}]`}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Show format help"
        >
          ?
        </button>
      </div>
    </div>
  );
}
