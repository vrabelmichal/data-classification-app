import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ClassificationBreakdownsSection,
  PaperCatalogSection,
  ProgressSection,
  SummaryCardsSection,
  ThroughputSection,
  TopClassifiersSection,
} from "./OverviewSections";
import {
  ClassificationStatsPayload,
  RecencyPayload,
  Totals,
  TopClassifiersPayload,
  TotalsAndPapersPayload,
} from "./types";
import { usePaperClassificationStats } from "../../../hooks/usePaperClassificationStats";

export function OverviewTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);

  const defaultOverviewPaper: string | null =
    systemSettings !== undefined
      ? ((systemSettings as any)?.overviewDefaultPaper ?? null)
      : null;

  const hasParamInUrl = searchParams.has("paper");
  const rawParam = searchParams.get("paper");
  const selectedPaper: string | undefined = !hasParamInUrl
    ? (defaultOverviewPaper !== null ? defaultOverviewPaper : undefined)
    : rawParam === "__all__" ? undefined
    : rawParam!;

  const handleSelectPaper = (p: string | undefined) => {
    if (p === undefined) {
      if (defaultOverviewPaper !== null) {
        setSearchParams((prev) => { prev.set("paper", "__all__"); return prev; }, { replace: true });
      } else {
        setSearchParams((prev) => { prev.delete("paper"); return prev; }, { replace: true });
      }
    } else {
      setSearchParams((prev) => { prev.set("paper", p); return prev; }, { replace: true });
    }
  };

  const totalsAndPapers = useQuery(api.statistics.labelingOverview.totalsAndPapers.get, { paper: selectedPaper }) as TotalsAndPapersPayload | undefined;
  const recencyData = useQuery(api.statistics.labelingOverview.recency.get) as RecencyPayload | undefined;
  const topClassifiersData = useQuery(api.statistics.labelingOverview.topClassifiers.get) as TopClassifiersPayload | undefined;
  const classificationStatsData = useQuery(api.statistics.labelingOverview.classificationStats.get) as ClassificationStatsPayload | undefined;

  // When a paper is selected the `get` query returns 0 for classification stats
  // (to avoid a full-table scan that would time out).  The hook below paginates
  // through the paper's galaxies incrementally and accumulates the real values.
  const paperClassStats = usePaperClassificationStats(selectedPaper);

  // Merge base totals (galaxies count is correct) with accumulated paper stats.
  const totals: Totals | undefined = useMemo(() => {
    const base = totalsAndPapers?.totals;
    if (!base) return undefined;
    if (selectedPaper === undefined) return base;

    // For paper-scoped view, replace the classification stats with the
    // incrementally-accumulated values from the paginated hook.
    const classifiedGalaxies = paperClassStats.classifiedGalaxies;
    const totalClassifications = paperClassStats.totalClassifications;
    const unclassifiedGalaxies = Math.max(base.galaxies - classifiedGalaxies, 0);
    const progress = base.galaxies > 0 ? (classifiedGalaxies / base.galaxies) * 100 : 0;
    const avgClassificationsPerGalaxy =
      base.galaxies > 0 ? totalClassifications / base.galaxies : 0;
    return {
      galaxies: base.galaxies,
      classifiedGalaxies,
      unclassifiedGalaxies,
      totalClassifications,
      progress,
      avgClassificationsPerGalaxy,
    };
  }, [totalsAndPapers?.totals, selectedPaper, paperClassStats]);

  const dailySeries = useMemo(() => {
    if (!recencyData?.recency.dailyCounts) return [];
    return recencyData.recency.dailyCounts.map((entry) => ({
      label: new Date(entry.start).toLocaleDateString(),
      count: entry.count,
    }));
  }, [recencyData]);

  const recency = recencyData?.recency;
  const classificationStats = classificationStatsData?.classificationStats;
  const topClassifiers = topClassifiersData?.topClassifiers;

  const availablePapers = totalsAndPapers?.availablePapers ?? [];
  const paperCounts = totalsAndPapers?.paperCounts ?? {};
  const paperFilter = totalsAndPapers?.paperFilter ?? null;

  const showAwesomeFlag = systemSettings?.showAwesomeFlag ?? true;
  const showValidRedshift = systemSettings?.showValidRedshift ?? true;
  const showVisibleNucleus = systemSettings?.showVisibleNucleus ?? true;
  const failedFittingMode = systemSettings?.failedFittingMode ?? "checkbox";
  const showFailedFitting = failedFittingMode === "checkbox";

  const flagItems: Array<{ label: string; value: number; color: string; icon: string }> = [];
  if (showAwesomeFlag && classificationStats?.flags) {
    flagItems.push({ label: "Awesome", value: classificationStats.flags.awesome || 0, color: "bg-yellow-500", icon: "⭐" });
  }
  if (showVisibleNucleus && classificationStats?.flags) {
    flagItems.push({ label: "Visible Nucleus", value: classificationStats.flags.visibleNucleus || 0, color: "bg-orange-500", icon: "🎯" });
  }
  if (showValidRedshift && classificationStats?.flags) {
    flagItems.push({ label: "Valid Redshift", value: classificationStats.flags.validRedshift || 0, color: "bg-red-500", icon: "🔴" });
  }
  if (showFailedFitting && classificationStats?.flags) {
    flagItems.push({ label: "Failed Fitting", value: classificationStats.flags.failedFitting || 0, color: "bg-rose-500", icon: "❌" });
  }

  const lsbItems = classificationStats?.lsbClass ? [
    { label: "Non-LSB", value: classificationStats.lsbClass.nonLSB || 0, color: "bg-gray-500", icon: "⚪" },
    { label: "LSB", value: classificationStats.lsbClass.LSB || 0, color: "bg-green-500", icon: "🟢" },
  ] : [];

  const morphologyItems = classificationStats?.morphology ? [
    { label: "Featureless", value: classificationStats.morphology.featureless || 0, color: "bg-gray-500", icon: "⚫" },
    { label: "Irregular", value: classificationStats.morphology.irregular || 0, color: "bg-yellow-500", icon: "⚡" },
    { label: "Spiral", value: classificationStats.morphology.spiral || 0, color: "bg-blue-500", icon: "🌀" },
    { label: "Elliptical", value: classificationStats.morphology.elliptical || 0, color: "bg-purple-500", icon: "⭕" },
  ] : [];

  // Use the sum of lsbClass counts from classificationStats as the breakdown bar
  // denominator so it stays aligned with the (always-global) classification stats data,
  // even when totals.totalClassifications is scoped to the selected paper.
  const totalClassificationsForBreakdowns = classificationStats?.lsbClass
    ? (classificationStats.lsbClass.nonLSB + classificationStats.lsbClass.LSB)
    : (totals?.totalClassifications || 0);

  return (
    <div className="space-y-8">
      <PaperCatalogSection
        availablePapers={availablePapers}
        paperCounts={paperCounts}
        paperFilter={paperFilter}
        selectedPaper={selectedPaper}
        totals={totals}
        onSelectPaper={handleSelectPaper}
      />

      <SummaryCardsSection totals={totals} selectedPaper={selectedPaper} />

      <ProgressSection totals={totals} activeClassifiers={recency?.activeClassifiers} selectedPaper={selectedPaper} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThroughputSection
          recency={recency ? {
            classificationsLast24h: recency.classificationsLast24h,
            classificationsLast7d: recency.classificationsLast7d,
          } : undefined}
          dailySeries={dailySeries}
          selectedPaper={selectedPaper}
        />
        <TopClassifiersSection topClassifiers={topClassifiers} selectedPaper={selectedPaper} />
      </div>

      <ClassificationBreakdownsSection
        lsbItems={lsbItems}
        morphologyItems={morphologyItems}
        flagItems={flagItems}
        totalClassifications={totalClassificationsForBreakdowns}
        loading={classificationStats === undefined}
        selectedPaper={selectedPaper}
      />
    </div>
  );
}
