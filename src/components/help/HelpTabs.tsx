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
  const [mobileNavOpen, setMobileNavOpen] = useState(true);

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

  const activeTab = tabs.find((t) => t.path === location.pathname) ?? tabs[0];

  const renderDesktopNav = (hidden = false) => (
    <div
      className={`bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700${hidden ? " invisible pointer-events-none" : ""}`}
      aria-hidden={hidden}
    >
      {/* Desktop/tablet/landscape: horizontal scrollable tabs */}
      <nav className="hidden sm:flex -mb-px space-x-8 overflow-x-auto" aria-label="Help sections">
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

      {/* Mobile portrait: collapsible vertical nav */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3 px-1 py-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Collapse navigation" : "Expand navigation"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shadow-sm transition-colors hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            <svg
              className={`h-4 w-4 transition-transform ${mobileNavOpen ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="min-w-0 flex-1 text-sm font-medium text-blue-600 dark:text-blue-400">
            {activeTab.label}
          </span>
        </div>
        {mobileNavOpen && (
          <nav className="border-t border-gray-200 dark:border-gray-700" aria-label="Help sections">
            {tabs.map((tab) => {
              const selected = location.pathname === tab.path;
              return (
                <Link
                  key={tab.key}
                  to={tab.path}
                  className={`flex items-center border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div ref={navBarRef}>
        {renderDesktopNav(metrics.isPinned)}
      </div>

      {metrics.isPinned && metrics.width > 0 && (
        <div
          className="fixed z-40"
          style={{ left: metrics.left, top: metrics.top, width: metrics.width }}
        >
          {renderDesktopNav()}
        </div>
      )}
    </>
  );
}
