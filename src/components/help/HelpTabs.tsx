import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { HelpTab } from "./types";

const tabs: Array<{ key: HelpTab; label: string; path: string }> = [
  { key: "getting-started", label: "Getting Started", path: "/help" },
  { key: "app-guide", label: "App Guide", path: "/help/app-guide" },
  { key: "classification", label: "Categories & Flags", path: "/help/classification" },
  { key: "shortcuts", label: "Keyboard", path: "/help/shortcuts" },
  { key: "image-docs", label: "Image Documentation", path: "/help/image-docs" },
];

interface FixedBarMetrics {
  isPinned: boolean;
  left: number;
  top: number;
  width: number;
}

function getNearestScrollContainer(element: HTMLElement | null): HTMLElement | null {
  if (!element || typeof window === "undefined") return null;
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return current;
    current = current.parentElement;
  }
  return null;
}

export function HelpTabs() {
  const location = useLocation();
  const navBarRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState<FixedBarMetrics>({ isPinned: false, left: 0, top: 0, width: 0 });

  useEffect(() => {
    const navBarElement = navBarRef.current;
    if (!navBarElement || typeof window === "undefined") return;

    const scrollContainer = getNearestScrollContainer(navBarElement);
    scrollContainerRef.current = scrollContainer;

    const update = () => {
      const el = navBarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const containerRect = scrollContainerRef.current?.getBoundingClientRect() ?? null;
      const topAnchor = Math.max(containerRect?.top ?? 0, 0);
      const next = { isPinned: rect.top <= topAnchor, left: rect.left, top: topAnchor, width: rect.width };
      setMetrics((cur) =>
        cur.isPinned === next.isPinned && cur.left === next.left && cur.top === next.top && cur.width === next.width
          ? cur
          : next
      );
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(navBarElement);
    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", update, { passive: true });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      resizeObserver.disconnect();
      scrollContainer?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [location.pathname]);

  const renderNav = (hidden = false) => (
    <div
      className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700${hidden ? " invisible pointer-events-none" : ""}`}
      aria-hidden={hidden}
    >
      <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Help sections">
        {tabs.map((tab) => {
          const selected = location.pathname === tab.path;
          return (
            <Link
              key={tab.key}
              to={tab.path}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <div ref={navBarRef}>
        {renderNav(metrics.isPinned)}
      </div>

      {metrics.isPinned && metrics.width > 0 && (
        <div
          className="fixed z-40"
          style={{ left: metrics.left, top: metrics.top, width: metrics.width }}
        >
          {renderNav()}
        </div>
      )}
    </>
  );
}
