/**
 * usePaperClassificationStats
 *
 * Drives the paginated `getPaperClassificationStats` Convex query in a loop,
 * accumulating `classifiedGalaxies` and `totalClassifications` across all pages.
 *
 * Each page reads at most 1000 galaxy documents server-side, keeping every
 * individual query call well within Convex's 1 s deadline.  The hook advances
 * the cursor automatically after each page arrives and reports `isLoading: true`
 * until the final page has been processed.
 *
 * When `paper` is `undefined` the hook is a no-op and returns zeros immediately.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface PaperClassificationStats {
  classifiedGalaxies: number;
  totalClassifications: number;
  /** True while not all pages have been fetched / processed yet. */
  isLoading: boolean;
}

export function usePaperClassificationStats(
  paper: string | undefined
): PaperClassificationStats {
  // Active cursor for the query.  `undefined` → first page (null cursor).
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  // Accumulated totals.
  const [classifiedGalaxies, setClassifiedGalaxies] = useState(0);
  const [totalClassifications, setTotalClassifications] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // Track which (paper, cursor) pairs we have already incorporated so that
  // later Convex subscription deliveries of the same page don't double-count.
  // Includes the paper in the key so stale deliveries from a previous paper
  // selection are ignored.
  const processedKeys = useRef(new Set<string>());

  // Reset accumulated state whenever the selected paper changes.
  const prevPaper = useRef(paper);
  if (prevPaper.current !== paper) {
    prevPaper.current = paper;
    // Synchronous state resets are safe during render in React 18.
    setCursor(undefined);
    setClassifiedGalaxies(0);
    setTotalClassifications(0);
    setIsDone(false);
    // Keep the processedKeys set alive but clear it for the new paper.
    processedKeys.current = new Set<string>();
  }

  const pageResult = useQuery(
    api.statistics.labelingOverview.totalsAndPapers.getPaperClassificationStats,
    paper !== undefined && !isDone
      ? { paper, cursor }
      : "skip"
  );

  useEffect(() => {
    if (!pageResult || paper === undefined) return;

    // Build a stable key that uniquely identifies this page.
    const pageKey = `${paper}:${cursor ?? "__first__"}`;
    if (processedKeys.current.has(pageKey)) return;
    processedKeys.current.add(pageKey);

    setClassifiedGalaxies((prev) => prev + pageResult.classifiedGalaxies);
    setTotalClassifications((prev) => prev + pageResult.totalClassifications);

    if (pageResult.isDone) {
      setIsDone(true);
    } else if (pageResult.continueCursor !== null) {
      setCursor(pageResult.continueCursor);
    }
    // We intentionally omit `cursor` from deps: we only want to run this
    // effect when `pageResult` itself changes (i.e. new data arrived), not
    // when the cursor state is updated as a side-effect of this very flush.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResult, paper]);

  if (paper === undefined) {
    return { classifiedGalaxies: 0, totalClassifications: 0, isLoading: false };
  }

  return {
    classifiedGalaxies,
    totalClassifications,
    isLoading: !isDone,
  };
}
