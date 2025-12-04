import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";

interface DarkModeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function DarkModeToggle({ className, showLabel = false, size = "md" }: DarkModeToggleProps) {
  const { theme, effectiveTheme, toggleTheme } = useTheme();

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const buttonPadding = size === "sm" ? "p-1.5" : "p-2";

  // Get the appropriate icon based on current theme setting
  const getIcon = () => {
    if (theme === "auto") {
      // System/auto icon
      return (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
          />
        </svg>
      );
    }
    if (effectiveTheme === "dark") {
      // Moon icon for dark mode
      return (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" 
          />
        </svg>
      );
    }
    // Sun icon for light mode
    return (
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" 
        />
      </svg>
    );
  };

  const getLabel = () => {
    if (theme === "auto") return "Auto";
    if (theme === "dark") return "Dark";
    return "Light";
  };

  const getTooltip = () => {
    if (theme === "light") return "Click to use dark theme";
    if (theme === "dark") return "Click to use system preference";
    return "Click to use light theme";
  };

  return (
    <button
      onClick={toggleTheme}
      title={getTooltip()}
      className={cn(
        "flex items-center rounded-lg transition-colors",
        "text-gray-600 dark:text-gray-300",
        "hover:bg-gray-100 dark:hover:bg-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
        buttonPadding,
        className
      )}
      aria-label={`Theme: ${getLabel()}. ${getTooltip()}`}
    >
      {getIcon()}
      {showLabel && (
        <span className="ml-2 text-sm font-medium">{getLabel()}</span>
      )}
    </button>
  );
}
