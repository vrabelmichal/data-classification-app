import { createPortal } from "react-dom";

import type { RefObject } from "react";

import type { AnalysisQueryConfig, AnalysisQueryResult } from "./helpers";
import type { PinnedNavigatorStyle } from "./tabTypes";

type DataAnalysisNavigatorProps = {
  queries: AnalysisQueryConfig[];
  queryResults: Map<string, AnalysisQueryResult>;
  activeQueryId: string | null;
  hasDataset: boolean;
  isNavigatorPinned: boolean;
  navigatorHeight: number;
  pinnedNavigatorStyle: PinnedNavigatorStyle | null;
  navigatorAnchorRef: RefObject<HTMLDivElement | null>;
  navigatorRef: RefObject<HTMLDivElement | null>;
};

function NavigatorContent({
  queries,
  queryResults,
  activeQueryId,
  hasDataset,
  isPinnedOverlay,
}: {
  queries: AnalysisQueryConfig[];
  queryResults: Map<string, AnalysisQueryResult>;
  activeQueryId: string | null;
  hasDataset: boolean;
  isPinnedOverlay: boolean;
}) {
  return (
    <div
      className={
        isPinnedOverlay
          ? "rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
          : "rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {queries.map((query) => {
          const result = queryResults.get(query.id);
          const isActive = activeQueryId === query.id;

          return (
            <a
              key={`nav-${query.id}`}
              href={`#analysis-query-${query.id}`}
              className={
                isActive
                  ? "inline-flex items-center gap-2 rounded-full border-2 border-blue-500 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300"
                  : "inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              }
            >
              <span>{query.name || "Untitled query"}</span>
              {hasDataset && result ? (
                <span
                  className={
                    isActive
                      ? "rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                      : "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  }
                >
                  {result.matchedCount.toLocaleString()}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function DataAnalysisNavigator({
  queries,
  queryResults,
  activeQueryId,
  hasDataset,
  isNavigatorPinned,
  navigatorHeight,
  pinnedNavigatorStyle,
  navigatorAnchorRef,
  navigatorRef,
}: DataAnalysisNavigatorProps) {
  return (
    <>
      <div
        ref={navigatorAnchorRef}
        style={{ minHeight: navigatorHeight > 0 ? `${navigatorHeight}px` : undefined }}
        className="relative z-20"
      >
        <div
          ref={navigatorRef}
          className={isNavigatorPinned ? "pointer-events-none opacity-0" : undefined}
          aria-hidden={isNavigatorPinned}
        >
          <NavigatorContent
            queries={queries}
            queryResults={queryResults}
            activeQueryId={activeQueryId}
            hasDataset={hasDataset}
            isPinnedOverlay={false}
          />
        </div>
      </div>

      {isNavigatorPinned && pinnedNavigatorStyle
        ? createPortal(
            <div
              className="z-40"
              style={{
                position: "fixed",
                left: pinnedNavigatorStyle.left,
                top: pinnedNavigatorStyle.top,
                width: pinnedNavigatorStyle.width,
              }}
            >
              <NavigatorContent
                queries={queries}
                queryResults={queryResults}
                activeQueryId={activeQueryId}
                hasDataset={hasDataset}
                isPinnedOverlay
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}