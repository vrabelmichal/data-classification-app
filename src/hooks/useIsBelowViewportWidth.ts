import { useEffect, useState } from "react";

function getIsBelowViewportWidth(maxWidthExclusive: number) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth < maxWidthExclusive;
}

export function useIsBelowViewportWidth(maxWidthExclusive: number) {
  const [isBelowViewportWidth, setIsBelowViewportWidth] = useState(() =>
    getIsBelowViewportWidth(maxWidthExclusive)
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${maxWidthExclusive - 1}px)`);
    const updateIsBelowViewportWidth = () => {
      setIsBelowViewportWidth(mediaQuery.matches);
    };

    updateIsBelowViewportWidth();
    mediaQuery.addEventListener("change", updateIsBelowViewportWidth);

    return () => {
      mediaQuery.removeEventListener("change", updateIsBelowViewportWidth);
    };
  }, [maxWidthExclusive]);

  return isBelowViewportWidth;
}
