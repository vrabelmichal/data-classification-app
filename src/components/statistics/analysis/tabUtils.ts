export function getScrollParents(element: HTMLElement | null) {
  const scrollParents: Array<HTMLElement | Window> = [];
  let current: HTMLElement | null = element?.parentElement ?? null;

  while (current) {
    const computedStyle = window.getComputedStyle(current);
    const overflowY = computedStyle.overflowY;
    const isScrollableContainer =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

    if (isScrollableContainer) {
      scrollParents.push(current);
    }

    current = current.parentElement;
  }

  scrollParents.push(window);

  return scrollParents;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to load the analysis dataset.";
}

export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`;
}

export function formatLoadedAt(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}