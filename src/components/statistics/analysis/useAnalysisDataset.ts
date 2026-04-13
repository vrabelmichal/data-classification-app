import { startTransition, useCallback, useRef, useState } from "react";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import {
  accumulateClassificationVote,
  buildAnalysisRecord,
  createEmptyAggregate,
  type AnalysisAggregate,
  type AnalysisClassificationVote,
  type AnalysisGalaxy,
  type AnalysisRecord,
} from "./helpers";
import type { DataLoadState, PreparedDataset } from "./tabTypes";
import { formatLoadedAt, getErrorMessage } from "./tabUtils";

const GALAXY_PAGE_SIZE = 2500;
const CLASSIFICATION_PAGE_SIZE = 2500;
const EMPTY_RECORDS: AnalysisRecord[] = [];

export function useAnalysisDataset() {
  const convex = useConvex();
  const [dataset, setDataset] = useState<PreparedDataset | null>(null);
  const [loadState, setLoadState] = useState<DataLoadState>({
    status: "idle",
    phase: "idle",
    galaxiesLoaded: 0,
    classificationRowsLoaded: 0,
    error: null,
    cancelled: false,
  });
  const cancelLoadRef = useRef(false);

  const handleLoadDataset = useCallback(async () => {
    cancelLoadRef.current = false;
    setLoadState({
      status: "loading",
      phase: "galaxies",
      galaxiesLoaded: 0,
      classificationRowsLoaded: 0,
      error: null,
      cancelled: false,
    });

    try {
      const galaxyMap = new Map<string, AnalysisGalaxy>();
      let galaxyCursor: string | undefined;
      let galaxiesLoaded = 0;

      while (true) {
        if (cancelLoadRef.current) {
          setLoadState((currentState) => ({
            ...currentState,
            status: "idle",
            phase: "idle",
            cancelled: true,
          }));
          return;
        }

        const page = await convex.query(
          api.statistics.classificationAnalysis.getGalaxyPage,
          {
            cursor: galaxyCursor,
            limit: GALAXY_PAGE_SIZE,
          }
        );

        for (const galaxy of page.page) {
          galaxyMap.set(galaxy.id, galaxy as AnalysisGalaxy);
        }

        galaxiesLoaded += page.page.length;
        setLoadState((currentState) => ({
          ...currentState,
          phase: "galaxies",
          galaxiesLoaded,
        }));

        if (page.isDone || !page.continueCursor) {
          break;
        }

        galaxyCursor = page.continueCursor;
      }

      const aggregateMap = new Map<string, AnalysisAggregate>();
      const votesByGalaxy = new Map<string, AnalysisClassificationVote[]>();
      let classificationCursor: string | undefined;
      let classificationRowsLoaded = 0;

      setLoadState((currentState) => ({
        ...currentState,
        phase: "classifications",
      }));

      while (true) {
        if (cancelLoadRef.current) {
          setLoadState((currentState) => ({
            ...currentState,
            status: "idle",
            phase: "idle",
            cancelled: true,
          }));
          return;
        }

        const page = await convex.query(
          api.statistics.classificationAnalysis.getClassificationPage,
          {
            cursor: classificationCursor,
            limit: CLASSIFICATION_PAGE_SIZE,
          }
        );

        for (const rawVote of page.page) {
          const vote = rawVote as AnalysisClassificationVote;
          const aggregate =
            aggregateMap.get(vote.galaxyExternalId) ?? createEmptyAggregate();
          accumulateClassificationVote(aggregate, vote);
          aggregateMap.set(vote.galaxyExternalId, aggregate);

          const voteList = votesByGalaxy.get(vote.galaxyExternalId) ?? [];
          voteList.push(vote);
          votesByGalaxy.set(vote.galaxyExternalId, voteList);
        }

        classificationRowsLoaded += page.page.length;
        setLoadState((currentState) => ({
          ...currentState,
          phase: "classifications",
          classificationRowsLoaded,
        }));

        if (page.isDone || !page.continueCursor) {
          break;
        }

        classificationCursor = page.continueCursor;
      }

      setLoadState((currentState) => ({
        ...currentState,
        phase: "combining",
      }));

      const sortedGalaxies = Array.from(galaxyMap.values()).sort((left, right) => {
        const leftNumericId = left.numericId ?? Number.MAX_SAFE_INTEGER;
        const rightNumericId = right.numericId ?? Number.MAX_SAFE_INTEGER;
        if (leftNumericId !== rightNumericId) {
          return leftNumericId - rightNumericId;
        }
        return left.id.localeCompare(right.id);
      });

      const records: AnalysisRecord[] = [];
      let classifiedGalaxyCount = 0;
      let totalAwesomeVotes = 0;
      let totalVisibleNucleusVotes = 0;
      let totalFailedFittingVotes = 0;

      for (const galaxy of sortedGalaxies) {
        const aggregate = aggregateMap.get(galaxy.id) ?? createEmptyAggregate();
        if (aggregate.totalClassifications > 0) {
          classifiedGalaxyCount += 1;
        }
        totalAwesomeVotes += aggregate.awesomeVotes;
        totalVisibleNucleusVotes += aggregate.visibleNucleusVotes;
        totalFailedFittingVotes += aggregate.failedFittingVotes;
        records.push(
          buildAnalysisRecord(galaxy, aggregate, votesByGalaxy.get(galaxy.id) ?? [])
        );
      }

      let orphanedGalaxyCount = 0;
      let orphanedClassificationCount = 0;
      for (const [galaxyId, aggregate] of aggregateMap.entries()) {
        if (!galaxyMap.has(galaxyId)) {
          orphanedGalaxyCount += 1;
          orphanedClassificationCount += aggregate.totalClassifications;
        }
      }

      startTransition(() => {
        setDataset({
          records,
          loadedAt: Date.now(),
          classifiedGalaxyCount,
          totalAwesomeVotes,
          totalVisibleNucleusVotes,
          totalFailedFittingVotes,
          orphanedGalaxyCount,
          orphanedClassificationCount,
        });
        setLoadState({
          status: "ready",
          phase: "ready",
          galaxiesLoaded,
          classificationRowsLoaded,
          error: null,
          cancelled: false,
        });
      });
    } catch (error) {
      setLoadState((currentState) => ({
        ...currentState,
        status: "error",
        phase: "idle",
        error: getErrorMessage(error),
        cancelled: false,
      }));
    }
  }, [convex]);

  const handleCancelLoad = useCallback(() => {
    cancelLoadRef.current = true;
  }, []);

  return {
    dataset,
    loadState,
    hasDataset: dataset !== null,
    loadedAtLabel: formatLoadedAt(dataset?.loadedAt ?? null),
    loadedRecords: dataset?.records ?? EMPTY_RECORDS,
    handleLoadDataset,
    handleCancelLoad,
  };
}