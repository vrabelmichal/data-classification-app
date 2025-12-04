import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type Theme = "light" | "dark" | "auto";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function applyTheme(theme: Theme) {
  const effectiveTheme = theme === "auto" ? getSystemTheme() : theme;
  
  if (effectiveTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme() {
  const userPrefs = useQuery(api.users.getUserPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);
  
  // Local state for immediate UI updates
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage for faster initial render
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored && ["light", "dark", "auto"].includes(stored)) {
        return stored;
      }
    }
    return "auto";
  });

  // Sync with user preferences from database
  useEffect(() => {
    if (userPrefs?.theme) {
      setThemeState(userPrefs.theme);
      localStorage.setItem("theme", userPrefs.theme);
    }
  }, [userPrefs?.theme]);

  // Apply theme to document whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when using auto mode
  useEffect(() => {
    if (theme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("auto");
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply theme on initial mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = useCallback(async (newTheme: Theme) => {
    // Update local state immediately for responsive UI
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);

    // Persist to database (only if user is authenticated)
    try {
      await updatePreferences({
        theme: newTheme,
      });
    } catch (error) {
      // Silently fail if not authenticated - local state still works
      console.debug("Could not save theme preference:", error);
    }
  }, [updatePreferences]);

  const toggleTheme = useCallback(() => {
    // Cycle through: light -> dark -> auto -> light
    const nextTheme: Theme = theme === "light" ? "dark" : theme === "dark" ? "auto" : "light";
    setTheme(nextTheme);
  }, [theme, setTheme]);

  const effectiveTheme = theme === "auto" ? getSystemTheme() : theme;

  return {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    isDark: effectiveTheme === "dark",
  };
}
