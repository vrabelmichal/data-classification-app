import { RefObject } from "react";

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
  
  const placeholderText = `Example: ${examples.join(' or ')}`;

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
        placeholder={placeholderText}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Format: [LSB: -/0/1] [Morph: -/0/1/2]{flagsString}. Press Enter to submit.
      </p>
    </div>
  );
}
