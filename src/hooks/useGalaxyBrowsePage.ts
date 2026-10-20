import { useEffect, useMemo, useState } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { convexToJson } from "convex/values";
import { api } from "../../convex/_generated/api";
import { computeBounds } from "../../convex/galaxies/browser/shared";
import { useQueryResult } from "./useQueryResult";

type Args = FunctionArgs<typeof api.galaxies.browse.browseGalaxies>;
type Result = FunctionReturnType<typeof api.galaxies.browse.browseGalaxies>;
type Progress = { key: string; cursor: string; galaxies: Result["galaxies"] };

// Assemble one requested page from bounded server scans. Every returned galaxy
// has already matched all filters on the server; no candidate filtering happens
// here. The buffer is limited to the requested page and resets with the search.
export function useGalaxyBrowsePage(args: Args | "skip") {
  const [progress, setProgress] = useState<Progress>();
  const baseArgs = args === "skip" ? undefined : args;
  const key = args === "skip" ? "skip" : JSON.stringify(convexToJson(args));
  const current = progress?.key === key ? progress : undefined;
  const classificationSearch = !!(baseArgs?.searchLsbClass?.trim() || baseArgs?.searchMorphology?.trim());
  const targetSize = (baseArgs?.numItems ?? 0) + (classificationSearch ? 1 : 0);
  const queryCursor = current?.cursor ?? baseArgs?.cursor;
  const { data, error } = useQueryResult(api.galaxies.browse.browseGalaxies, baseArgs ? {
    ...baseArgs,
    cursor: queryCursor,
    numItems: targetSize - (current?.galaxies.length ?? 0),
  } : "skip");
  const initialCursor = baseArgs?.cursor;

  useEffect(() => {
    setProgress((previous) => previous?.key === key ? previous : undefined);
  }, [key]);

  useEffect(() => {
    if (!data || !("scanIncomplete" in data) || !data.scanIncomplete || !data.cursor) return;
    const nextCursor = data.cursor;
    setProgress((previous) => {
      const active = previous?.key === key ? previous : undefined;
      // Ignore a batch already consumed, including StrictMode effect replays.
      if ((active?.cursor ?? initialCursor) !== queryCursor) return previous;
      return { key, cursor: nextCursor, galaxies: [...(active?.galaxies ?? []), ...data.galaxies] };
    });
  }, [data, key, initialCursor, queryCursor]);

  const page = useMemo(() => {
    if (!data || ("scanIncomplete" in data && data.scanIncomplete)) return undefined;
    const galaxies = current ? [...current.galaxies, ...data.galaxies] : data.galaxies;
    const hasExtra = classificationSearch && galaxies.length > (baseArgs?.numItems ?? 0);
    const displayed = hasExtra ? galaxies.slice(0, baseArgs?.numItems) : galaxies;
    return {
      ...data,
      galaxies: displayed,
      hasNext: classificationSearch ? hasExtra : data.hasNext,
      isDone: classificationSearch ? !hasExtra : data.isDone,
      // Revisit the lookahead match on the next page rather than skipping it.
      cursor: hasExtra && "cursorBeforeLastMatch" in data ? data.cursorBeforeLastMatch ?? null : data.cursor,
      hasPrevious: (baseArgs?.offset ?? 0) > 0 || !!initialCursor,
      currentBounds: current || hasExtra ? computeBounds(displayed) : data.currentBounds,
    };
  }, [data, current, baseArgs?.offset, baseArgs?.numItems, initialCursor, classificationSearch]);

  return { data: page, error };
}
