import { useEffect, useRef, useState } from "react";

import type { AnalysisQueryConfig } from "./helpers";
import type { PinnedNavigatorStyle } from "./tabTypes";
import { getScrollParents } from "./tabUtils";

const PINNED_NAVIGATOR_MARGIN = 16;

export function usePinnedQueryNavigator(
  queries: AnalysisQueryConfig[],
  hasDataset: boolean
) {
  const [isNavigatorPinned, setIsNavigatorPinned] = useState(false);
  const [navigatorHeight, setNavigatorHeight] = useState(0);
  const [pinnedNavigatorStyle, setPinnedNavigatorStyle] =
    useState<PinnedNavigatorStyle | null>(null);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [isSectionVisible, setIsSectionVisible] = useState(true);
  const navigatorAnchorRef = useRef<HTMLDivElement | null>(null);
  const navigatorRef = useRef<HTMLDivElement | null>(null);
  const queriesSectionEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (queries.length === 0) {
      return undefined;
    }

    const updateActiveQuery = () => {
      let closestQueryId: string | null = null;
      let closestDistance = Infinity;

      for (const query of queries) {
        const element = document.getElementById(`analysis-query-${query.id}`);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const distanceFromTop = Math.abs(rect.top);

        if (rect.top < window.innerHeight && rect.bottom > 0) {
          if (distanceFromTop < closestDistance) {
            closestDistance = distanceFromTop;
            closestQueryId = query.id;
          }
        }
      }

      if (closestQueryId) {
        setActiveQueryId(closestQueryId);
      }
    };

    const scrollParents = getScrollParents(navigatorAnchorRef.current);
    updateActiveQuery();

    for (const scrollParent of scrollParents) {
      scrollParent.addEventListener("scroll", updateActiveQuery, { passive: true });
    }

    return () => {
      for (const scrollParent of scrollParents) {
        scrollParent.removeEventListener("scroll", updateActiveQuery);
      }
    };
  }, [hasDataset, queries]);

  useEffect(() => {
    const anchorElement = navigatorAnchorRef.current;
    const navigatorElement = navigatorRef.current;

    if (!anchorElement || !navigatorElement) {
      return undefined;
    }

    const scrollParents = getScrollParents(anchorElement);
    const resizeObserver = new ResizeObserver(() => {
      const nextHeight = navigatorElement.getBoundingClientRect().height;
      setNavigatorHeight(nextHeight);
    });

    let rafId = 0;

    const updatePinnedNavigator = () => {
      rafId = 0;
      const nextHeight = navigatorElement.getBoundingClientRect().height;
      setNavigatorHeight(nextHeight);

      const anchorRect = anchorElement.getBoundingClientRect();
      const sectionEndElement = queriesSectionEndRef.current;
      
      // Check if the section end is visible in the viewport
      let isSectionStillVisible = true;
      if (sectionEndElement) {
        const sectionEndRect = sectionEndElement.getBoundingClientRect();
        // Section is considered invisible when the end of it is above the viewport
        isSectionStillVisible = sectionEndRect.bottom > 0;
      }

      setIsSectionVisible(isSectionStillVisible);

      const shouldPin = anchorRect.top <= PINNED_NAVIGATOR_MARGIN && isSectionStillVisible;

      if (!shouldPin) {
        setIsNavigatorPinned(false);
        setPinnedNavigatorStyle(null);
        return;
      }

      setIsNavigatorPinned(true);
      setPinnedNavigatorStyle({
        left: anchorRect.left,
        top: PINNED_NAVIGATOR_MARGIN,
        width: anchorRect.width,
      });
    };

    const scheduleUpdatePinnedNavigator = () => {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(updatePinnedNavigator);
    };

    updatePinnedNavigator();
    resizeObserver.observe(navigatorElement);
    resizeObserver.observe(anchorElement);

    for (const scrollParent of scrollParents) {
      scrollParent.addEventListener("scroll", scheduleUpdatePinnedNavigator, {
        passive: true,
      });
    }
    window.addEventListener("resize", scheduleUpdatePinnedNavigator, { passive: true });

    return () => {
      resizeObserver.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }

      for (const scrollParent of scrollParents) {
        scrollParent.removeEventListener("scroll", scheduleUpdatePinnedNavigator);
      }
      window.removeEventListener("resize", scheduleUpdatePinnedNavigator);
    };
  }, [hasDataset, queries.length]);

  return {
    activeQueryId,
    isNavigatorPinned,
    isSectionVisible,
    navigatorHeight,
    navigatorAnchorRef,
    navigatorRef,
    queriesSectionEndRef,
    pinnedNavigatorStyle,
  };
}