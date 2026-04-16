import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requireAdmin, requireConfirmedUser } from "../../lib/auth";
import { hasPermissionForRole } from "../../lib/permissions";
import { loadMergedSystemSettings } from "../../lib/systemSettings";
import { getPaperCountsPayload, getAvailablePapers, getTopClassifiers } from "./shared";
import {
  buildClassificationBucketsFromHistogram,
  loadGlobalClassificationBuckets,
  loadGlobalTotals,
} from "./totalsAndPapers";
import { loadRecencyStats } from "./recency";
import { loadClassificationStats } from "./classificationStats";
import {
  cachedOverviewResponseValidator,
  classificationStatsValidator,
  overviewCatalogValidator,
  OVERVIEW_BUCKET_COUNT,
  OVERVIEW_GLOBAL_SCOPE_KEY,
  OVERVIEW_SHARED_SNAPSHOT_KEY,
  recencyStatsValidator,
  topClassifierValidator,
  totalsValidator,
} from "./cacheValidators";

type CatalogPayload = {
  availablePapers: string[];
  paperCounts: Record<string, { total: number; blacklisted: number; adjusted: number }>;
};

type Totals = {
  galaxies: number;
  classifiedGalaxies: number;
  unclassifiedGalaxies: number;
  totalClassifications: number;
  progress: number;
  avgClassificationsPerGalaxy: number;
};

type SharedSnapshotWriteArgs = {
  catalog?: CatalogPayload;
  recency?: {
    classificationsLast7d: number;
    classificationsLast24h: number;
    activeClassifiers: number;
    activePast7d: number;
    dailyCounts: Array<{ start: number; end: number; count: number }>;
  };
  topClassifiers?: Array<{
    userId: string;
    profileId: string;
    name?: string | null;
    classifications: number;
    lastActiveAt?: number;
  }>;
  classificationStats?: {
    flags: {
      awesome: number;
      visibleNucleus: number;
      failedFitting: number;
      validRedshift: number;
    };
    lsbClass: {
      nonLSB: number;
      LSB: number;
    };
    morphology: {
      featureless: number;
      irregular: number;
      spiral: number;
      elliptical: number;
    };
  };
};

type ScopeSnapshotWriteArgs = {
  paper: string | null;
  totals: Totals;
  classificationBuckets: number[];
};

type PaperClassificationPage = {
  classifiedGalaxies: number;
  totalClassifications: number;
  processedGalaxies: number;
  classificationHistogram: Record<string, number>;
  isDone: boolean;
  continueCursor: string | null;
};

function scopeKeyFromPaper(paper: string | null) {
  return paper ?? OVERVIEW_GLOBAL_SCOPE_KEY;
}

function normalizeClassificationBuckets(rawBuckets: number[]) {
  const buckets = Array.from({ length: OVERVIEW_BUCKET_COUNT }, (_, index) => {
    const value = rawBuckets[index] ?? 0;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });

  if (rawBuckets.length > OVERVIEW_BUCKET_COUNT) {
    for (let index = OVERVIEW_BUCKET_COUNT; index < rawBuckets.length; index += 1) {
      const value = rawBuckets[index] ?? 0;
      if (Number.isFinite(value) && value > 0) {
        buckets[OVERVIEW_BUCKET_COUNT - 1] += Math.floor(value);
      }
    }
  }

  return buckets;
}

async function upsertSharedSnapshot(
  ctx: MutationCtx,
  args: SharedSnapshotWriteArgs
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("overviewSharedSnapshots")
    .withIndex("by_key", (q) => q.eq("key", OVERVIEW_SHARED_SNAPSHOT_KEY))
    .unique();

  const patch: Record<string, unknown> = { updatedAt: now };
  if (args.catalog !== undefined) {
    patch.catalog = args.catalog;
    patch.catalogUpdatedAt = now;
  }
  if (args.recency !== undefined) {
    patch.recency = args.recency;
    patch.recencyUpdatedAt = now;
  }
  if (args.topClassifiers !== undefined) {
    patch.topClassifiers = args.topClassifiers;
    patch.topClassifiersUpdatedAt = now;
  }
  if (args.classificationStats !== undefined) {
    patch.classificationStats = args.classificationStats;
    patch.classificationStatsUpdatedAt = now;
  }

  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("overviewSharedSnapshots", {
      key: OVERVIEW_SHARED_SNAPSHOT_KEY,
      updatedAt: now,
      ...(args.catalog !== undefined
        ? { catalog: args.catalog, catalogUpdatedAt: now }
        : {}),
      ...(args.recency !== undefined
        ? { recency: args.recency, recencyUpdatedAt: now }
        : {}),
      ...(args.topClassifiers !== undefined
        ? { topClassifiers: args.topClassifiers, topClassifiersUpdatedAt: now }
        : {}),
      ...(args.classificationStats !== undefined
        ? {
            classificationStats: args.classificationStats,
            classificationStatsUpdatedAt: now,
          }
        : {}),
    });
  }

  return { updatedAt: now };
}

async function upsertScopeSnapshot(
  ctx: MutationCtx,
  args: ScopeSnapshotWriteArgs
) {
  const now = Date.now();
  const scopeKey = scopeKeyFromPaper(args.paper);
  const normalizedBuckets = normalizeClassificationBuckets(args.classificationBuckets);
  const existing = await ctx.db
    .query("overviewScopeSnapshots")
    .withIndex("by_scope_key", (q) => q.eq("scopeKey", scopeKey))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      paper: args.paper,
      totals: args.totals,
      classificationBuckets: normalizedBuckets,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("overviewScopeSnapshots", {
      scopeKey,
      paper: args.paper,
      totals: args.totals,
      classificationBuckets: normalizedBuckets,
      updatedAt: now,
    });
  }

  return { updatedAt: now };
}

async function ensureCanAccessCachedOverview(ctx: QueryCtx) {
  const settings = await loadMergedSystemSettings(ctx);
  const { profile } = await requireConfirmedUser(ctx);

  if (
    !hasPermissionForRole(profile.role, settings, "viewOverviewStatistics") &&
    !settings.allowPublicOverview
  ) {
    throw new Error("Cached overview is only available to administrators");
  }
}

async function buildPaperScopeSnapshot(
  ctx: ActionCtx,
  paper: string
): Promise<ScopeSnapshotWriteArgs> {
  let cursor: string | undefined;
  let classifiedGalaxies = 0;
  let totalClassifications = 0;
  let totalGalaxies = 0;
  const classificationHistogram: Record<string, number> = {};

  while (true) {
    const page: PaperClassificationPage = await ctx.runQuery(
      internal.statistics.labelingOverview.totalsAndPapers.getPaperClassificationStatsPageInternal,
      { paper, cursor }
    );

    classifiedGalaxies += page.classifiedGalaxies;
    totalClassifications += page.totalClassifications;
    totalGalaxies += page.processedGalaxies;

    for (const [key, value] of Object.entries(page.classificationHistogram)) {
      classificationHistogram[key] = (classificationHistogram[key] ?? 0) + value;
    }

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor ?? undefined;
  }

  const totals: Totals = {
    galaxies: totalGalaxies,
    classifiedGalaxies,
    unclassifiedGalaxies: Math.max(totalGalaxies - classifiedGalaxies, 0),
    totalClassifications,
    progress: totalGalaxies > 0 ? (classifiedGalaxies / totalGalaxies) * 100 : 0,
    avgClassificationsPerGalaxy:
      totalGalaxies > 0 ? totalClassifications / totalGalaxies : 0,
  };

  return {
    paper,
    totals,
    classificationBuckets: buildClassificationBucketsFromHistogram(classificationHistogram),
  };
}

export const getAvailablePapersForCache = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    return await getAvailablePapers(ctx);
  },
});

export const computeSharedSnapshot = internalQuery({
  args: {},
  returns: v.object({
    catalog: v.optional(overviewCatalogValidator),
    recency: v.optional(recencyStatsValidator),
    topClassifiers: v.optional(v.array(topClassifierValidator)),
    classificationStats: v.optional(classificationStatsValidator),
  }),
  handler: async (ctx) => {
    const [catalogPayload, recency, topClassifiers, classificationStats] = await Promise.all([
      getPaperCountsPayload(ctx, undefined),
      loadRecencyStats(ctx),
      getTopClassifiers(ctx, 5),
      loadClassificationStats(ctx),
    ]);

    return {
      catalog: {
        availablePapers: catalogPayload.availablePapers,
        paperCounts: catalogPayload.paperCounts,
      },
      recency,
      topClassifiers,
      classificationStats,
    };
  },
});

export const computeGlobalScopeSnapshot = internalQuery({
  args: {},
  returns: v.object({
    paper: v.union(v.string(), v.null()),
    totals: totalsValidator,
    classificationBuckets: v.array(v.number()),
  }),
  handler: async (ctx) => {
    const [totals, classificationBuckets] = await Promise.all([
      loadGlobalTotals(ctx),
      loadGlobalClassificationBuckets(ctx),
    ]);

    return {
      paper: null,
      totals,
      classificationBuckets,
    };
  },
});

export const saveSharedSnapshotInternal = internalMutation({
  args: {
    catalog: v.optional(overviewCatalogValidator),
    recency: v.optional(recencyStatsValidator),
    topClassifiers: v.optional(v.array(topClassifierValidator)),
    classificationStats: v.optional(classificationStatsValidator),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    return await upsertSharedSnapshot(ctx, args);
  },
});

export const saveScopeSnapshotInternal = internalMutation({
  args: {
    paper: v.union(v.string(), v.null()),
    totals: totalsValidator,
    classificationBuckets: v.array(v.number()),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    return await upsertScopeSnapshot(ctx, args);
  },
});

export const saveSharedSnapshotFromLive = mutation({
  args: {
    catalog: v.optional(overviewCatalogValidator),
    recency: v.optional(recencyStatsValidator),
    topClassifiers: v.optional(v.array(topClassifierValidator)),
    classificationStats: v.optional(classificationStatsValidator),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await upsertSharedSnapshot(ctx, args);
  },
});

export const saveScopeSnapshotFromLive = mutation({
  args: {
    paper: v.union(v.string(), v.null()),
    totals: totalsValidator,
    classificationBuckets: v.array(v.number()),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await upsertScopeSnapshot(ctx, args);
  },
});

export const refreshAllSnapshots = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const sharedSnapshot: SharedSnapshotWriteArgs = await ctx.runQuery(
      internal.statistics.labelingOverview.cache.computeSharedSnapshot,
      {}
    );
    await ctx.runMutation(
      internal.statistics.labelingOverview.cache.saveSharedSnapshotInternal,
      sharedSnapshot
    );

    const globalScopeSnapshot: ScopeSnapshotWriteArgs = await ctx.runQuery(
      internal.statistics.labelingOverview.cache.computeGlobalScopeSnapshot,
      {}
    );
    await ctx.runMutation(
      internal.statistics.labelingOverview.cache.saveScopeSnapshotInternal,
      globalScopeSnapshot
    );

    const availablePapers = Array.from(
      new Set(sharedSnapshot.catalog?.availablePapers ?? [])
    );

    for (const paper of availablePapers) {
      const paperScopeSnapshot = await buildPaperScopeSnapshot(ctx, paper);
      await ctx.runMutation(
        internal.statistics.labelingOverview.cache.saveScopeSnapshotInternal,
        paperScopeSnapshot
      );
    }

    return null;
  },
});

export const get = query({
  args: {
    paper: v.optional(v.string()),
  },
  returns: cachedOverviewResponseValidator,
  handler: async (ctx, args) => {
    await ensureCanAccessCachedOverview(ctx);

    const scopeKey = scopeKeyFromPaper(args.paper ?? null);
    const [sharedSnapshotDoc, scopeSnapshotDoc] = await Promise.all([
      ctx.db
        .query("overviewSharedSnapshots")
        .withIndex("by_key", (q) => q.eq("key", OVERVIEW_SHARED_SNAPSHOT_KEY))
        .unique(),
      ctx.db
        .query("overviewScopeSnapshots")
        .withIndex("by_scope_key", (q) => q.eq("scopeKey", scopeKey))
        .unique(),
    ]);

    const catalog = sharedSnapshotDoc?.catalog;
    const selectedCounts = args.paper !== undefined ? catalog?.paperCounts[args.paper] : undefined;
    const paperFilter =
      args.paper !== undefined && selectedCounts
        ? {
            paper: args.paper,
            galaxies: selectedCounts.total,
            blacklisted: selectedCounts.blacklisted,
            adjusted: selectedCounts.adjusted,
          }
        : null;

    return {
      sharedSnapshot: sharedSnapshotDoc
        ? {
            catalog: sharedSnapshotDoc.catalog,
            catalogUpdatedAt: sharedSnapshotDoc.catalogUpdatedAt,
            recency: sharedSnapshotDoc.recency,
            recencyUpdatedAt: sharedSnapshotDoc.recencyUpdatedAt,
            topClassifiers: sharedSnapshotDoc.topClassifiers,
            topClassifiersUpdatedAt: sharedSnapshotDoc.topClassifiersUpdatedAt,
            classificationStats: sharedSnapshotDoc.classificationStats,
            classificationStatsUpdatedAt: sharedSnapshotDoc.classificationStatsUpdatedAt,
            updatedAt: sharedSnapshotDoc.updatedAt,
          }
        : null,
      scopeSnapshot: scopeSnapshotDoc
        ? {
            scopeKey: scopeSnapshotDoc.scopeKey,
            paper: scopeSnapshotDoc.paper,
            totals: scopeSnapshotDoc.totals,
            classificationBuckets: normalizeClassificationBuckets(
              scopeSnapshotDoc.classificationBuckets
            ),
            updatedAt: scopeSnapshotDoc.updatedAt,
          }
        : null,
      paperFilter,
    };
  },
});