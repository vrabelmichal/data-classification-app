import { useEffect, useRef } from "react";

/**
 * Small hook to set document.title. Automatically prefixes with the app name.
 * Accepts either a string or a function returning a string (lazy evaluation).
 */
export function usePageTitle(title: string | (() => string)) {
  const lastSet = useRef<string | null>(null);
  useEffect(() => {
    const base = typeof title === "function" ? title() : title;
    const full = base ? `${base} | Galaxy Classifier` : "Galaxy Classifier";
    if (lastSet.current !== full) {
      document.title = full;
      lastSet.current = full;
    }
  }, [title]);
}
