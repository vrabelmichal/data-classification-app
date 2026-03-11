import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import { DEFAULT_AVAILABLE_PAPERS } from "./lib/defaults";
import { Doc, Id } from "./_generated/dataModel";
import { galaxiesByPaper, galaxyIdsAggregate } from "./galaxies/aggregates";

const imageAuditStatusValidator = v.union(
  v.literal("paused"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

const checkModeValidator = v.union(v.literal("class_a"), v.literal("class_b"), v.literal("url"));
const requestMethodValidator = v.union(v.literal("head"), v.literal("get"));
const requestAuthModeValidator = v.union(v.literal("none"), v.literal("bearer"), v.literal("r2_keys"));
const providerValidator = v.union(v.literal("local"), v.literal("r2"));

const selectedImageValidator = v.object({
  imageKey: v.string(),
  label: v.string(),
});

const imageStatDeltaValidator = v.object({
  imageKey: v.string(),
  availableCount: v.number(),
  missingCount: v.number(),
  errorCount: v.number(),
});

const missingIdsChunkValidator = v.object({
  imageKey: v.string(),
  label: v.string(),
  externalIds: v.array(v.string()),
});

type SelectedImageInput = {
  imageKey: string;
  label: string;
};

type ScanPageItem = {
  externalId: string;
  paper: string;
};

type ScanPageResult = {
  items: ScanPageItem[];
  nextCursor: string | null;
  isDone: boolean;
  scannedCount: number;
};

type FetchImageAuditBatchResult = {
  previousCursor: string | null;
  nextCursor: string | null;
  isDone: boolean;
  candidates: string[];
  totalGalaxies: number;
  processedGalaxies: number;
  batchSize: number;
};

type MissingIdsPageResult = {
  externalIds: string[];
  continueCursor: string | null;
  isDone: boolean;
};

type DeleteImageAuditRunResult = {
  deleted: boolean;
  deletedChunkCount: number;
};

type ImageAuditRunWithCreator = Doc<"imageAuditRuns"> & {
  creatorName: string;
  creatorEmail: string;
};

type ImageAuditOverviewResult = {
  availablePapers: string[];
  totalGalaxies: number | null;
  blacklistedCount: number;
  recentRuns: ImageAuditRunWithCreator[];
};

const IMAGE_AUDIT_COUNT_SCAN_BATCH_SIZE = 5000;
const IMAGE_AUDIT_MAX_COUNT_SCAN_PAGES = 200;

const scanPageItemValidator = v.object({
  externalId: v.string(),
  paper: v.string(),
});

const scanPageResultValidator = v.object({
  items: v.array(scanPageItemValidator),
  nextCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
  scannedCount: v.number(),
});

const imageAuditImageStatValidator = v.object({
  imageKey: v.string(),
  label: v.string(),
  availableCount: v.number(),
  missingCount: v.number(),
  errorCount: v.number(),
});

const imageAuditRunRecordFields = {
  _id: v.id("imageAuditRuns"),
  _creationTime: v.number(),
  createdBy: v.id("users"),
  status: imageAuditStatusValidator,
  checkMode: checkModeValidator,
  paperFilter: v.array(v.string()),
  includeBlacklisted: v.boolean(),
  batchSize: v.number(),
  totalGalaxies: v.number(),
  processedGalaxies: v.number(),
  nextCursor: v.optional(v.string()),
  selectedImageKeys: v.array(v.string()),
  tokenHash: v.string(),
  requestMethod: requestMethodValidator,
  requestAuthMode: requestAuthModeValidator,
  provider: providerValidator,
  imageBaseUrl: v.string(),
  r2Endpoint: v.optional(v.string()),
  r2Bucket: v.optional(v.string()),
  r2Prefix: v.optional(v.string()),
  r2Region: v.optional(v.string()),
  imageStats: v.array(imageAuditImageStatValidator),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  lastProcessedGalaxyId: v.optional(v.string()),
  processedBatchCount: v.number(),
};

const imageAuditRunRecordValidator = v.object(imageAuditRunRecordFields);

const imageAuditRunWithCreatorValidator = v.object({
  ...imageAuditRunRecordFields,
  creatorName: v.string(),
  creatorEmail: v.string(),
});

const imageAuditOverviewValidator = v.object({
  availablePapers: v.array(v.string()),
  totalGalaxies: v.union(v.number(), v.null()),
  blacklistedCount: v.number(),
  recentRuns: v.array(imageAuditRunWithCreatorValidator),
});

const createImageAuditRunResultValidator = v.object({
  runId: v.id("imageAuditRuns"),
  totalGalaxies: v.number(),
  status: v.union(v.literal("completed"), v.literal("paused")),
});

const fetchImageAuditBatchResultValidator = v.object({
  previousCursor: v.union(v.string(), v.null()),
  nextCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
  candidates: v.array(v.string()),
  totalGalaxies: v.number(),
  processedGalaxies: v.number(),
  batchSize: v.number(),
});

const appendImageAuditBatchResultValidator = v.object({
  success: v.boolean(),
  processedGalaxies: v.number(),
  status: v.union(v.literal("completed"), v.literal("running")),
});

const deletedCountResultValidator = v.object({
  deletedCount: v.number(),
});

const successResultValidator = v.object({
  success: v.boolean(),
});

const missingIdsPageResultValidator = v.object({
  externalIds: v.array(v.string()),
  continueCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

const deleteImageAuditRunResultValidator = v.object({
  deleted: v.boolean(),
  deletedChunkCount: v.number(),
});

function normalizePaperFilter(paperFilter?: string[]) {
  return Array.from(
    new Set(
      (paperFilter ?? [])
        .filter((paper): paper is string => typeof paper === "string")
        .map((paper) => paper.trim())
    )
  ).sort();
}

function normalizeSelectedImages(images: SelectedImageInput[]) {
  const byKey = new Map<string, SelectedImageInput>();

  for (const image of images) {
    const imageKey = image.imageKey.trim();
    if (!imageKey) continue;
    if (!byKey.has(imageKey)) {
      byKey.set(imageKey, {
        imageKey,
        label: image.label.trim() || imageKey,
      });
    }
  }

  return Array.from(byKey.values());
}

function buildInitialImageStats(images: SelectedImageInput[]) {
  return images.map((image) => ({
    imageKey: image.imageKey,
    label: image.label,
    availableCount: 0,
    missingCount: 0,
    errorCount: 0,
  }));
}

function shouldUseSinglePaperIndex(paperFilter: string[]) {
  return paperFilter.length === 1 && paperFilter[0] !== "";
}

function filterCandidates(
  items: ScanPageItem[],
  paperFilter: string[],
  blacklistedIds: string[] | undefined
) {
  const paperSet = paperFilter.length > 0 ? new Set(paperFilter) : null;
  const blacklistSet = blacklistedIds && blacklistedIds.length > 0 ? new Set(blacklistedIds) : null;

  return items.filter((item) => {
    if (blacklistSet && blacklistSet.has(item.externalId)) {
      return false;
    }
    if (paperSet && !paperSet.has(item.paper)) {
      return false;
    }
    return true;
  });
}

async function getAvailablePapers(ctx: any): Promise<string[]> {
  const availablePapersSetting = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "availablePapers"))
    .unique();

  const configured = Array.isArray((availablePapersSetting as any)?.value)
    ? (((availablePapersSetting as any).value as unknown[]).filter(
        (paper): paper is string => typeof paper === "string"
      ))
    : DEFAULT_AVAILABLE_PAPERS;

  return configured.includes("") ? configured : ["", ...configured];
}

async function getCreatorInfo(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return {
    creatorName: user?.name || user?.email || "Unknown",
    creatorEmail: user?.email || "Unknown",
  };
}

async function getTotalGalaxyCount(ctx: any): Promise<number | null> {
  try {
    return await galaxyIdsAggregate.count(ctx);
  } catch {
    return null;
  }
}

function exactStringBounds(key: string) {
  return {
    lower: { key, inclusive: true },
    upper: { key, inclusive: true },
  } as const;
}

async function getAuditGalaxyCountFromAggregates(
  ctx: any,
  paperFilter: string[]
): Promise<number | null> {
  try {
    if (paperFilter.length === 0) {
      return await galaxyIdsAggregate.count(ctx);
    }

    const counts = await Promise.all(
      paperFilter.map((paper) =>
        galaxiesByPaper.count(ctx, {
          bounds: exactStringBounds(paper),
        })
      )
    );

    return counts.reduce((total, count) => total + count, 0);
  } catch {
    return null;
  }
}

export const scanAuditGalaxiesPage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.number(),
    paperFilter: v.optional(v.array(v.string())),
  },
  returns: scanPageResultValidator,
  handler: async (ctx, args): Promise<ScanPageResult> => {
    const normalizedPaperFilter = normalizePaperFilter(args.paperFilter);
    const batchSize = Math.min(Math.max(args.batchSize, 1), 5000);

    let queryBuilder;
    if (shouldUseSinglePaperIndex(normalizedPaperFilter)) {
      queryBuilder = ctx.db
        .query("galaxies")
        .withIndex("by_misc_paper", (q) => q.eq("misc.paper", normalizedPaperFilter[0]));
    } else {
      queryBuilder = ctx.db.query("galaxies");
    }

    const page = await queryBuilder.paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    return {
      items: page.page.map((doc) => ({
        externalId: doc.id,
        paper: doc.misc?.paper ?? "",
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      scannedCount: page.page.length,
    };
  },
});

export const getImageAuditRunRecord = internalQuery({
  args: {
    runId: v.id("imageAuditRuns"),
  },
  returns: v.union(imageAuditRunRecordValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const getImageAuditMissingIdsPageInternal = internalQuery({
  args: {
    runId: v.id("imageAuditRuns"),
    imageKey: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: missingIdsPageResultValidator,
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const page = await ctx.db
      .query("imageAuditMissingChunks")
      .withIndex("by_run_image_batch", (q) => q.eq("runId", args.runId).eq("imageKey", args.imageKey))
      .paginate({ cursor: args.cursor ?? null, numItems: limit });

    return {
      externalIds: page.page.flatMap((chunk) => chunk.externalIds),
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getImageAuditMissingChunkIdsBatchInternal = internalQuery({
  args: {
    runId: v.id("imageAuditRuns"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.id("imageAuditMissingChunks")),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const chunks = await ctx.db
      .query("imageAuditMissingChunks")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(limit);

    return chunks.map((chunk) => chunk._id);
  },
});

export const createImageAuditRunInternal = internalMutation({
  args: {
    createdBy: v.id("users"),
    status: imageAuditStatusValidator,
    checkMode: checkModeValidator,
    paperFilter: v.array(v.string()),
    includeBlacklisted: v.boolean(),
    batchSize: v.number(),
    totalGalaxies: v.number(),
    processedGalaxies: v.number(),
    nextCursor: v.optional(v.string()),
    selectedImages: v.array(selectedImageValidator),
    tokenHash: v.string(),
    requestMethod: requestMethodValidator,
    requestAuthMode: requestAuthModeValidator,
    provider: providerValidator,
    imageBaseUrl: v.string(),
    r2Endpoint: v.optional(v.string()),
    r2Bucket: v.optional(v.string()),
    r2Prefix: v.optional(v.string()),
    r2Region: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  returns: v.id("imageAuditRuns"),
  handler: async (ctx, args): Promise<Id<"imageAuditRuns">> => {
    return await ctx.db.insert("imageAuditRuns", {
      createdBy: args.createdBy,
      status: args.status,
      checkMode: args.checkMode,
      paperFilter: args.paperFilter,
      includeBlacklisted: args.includeBlacklisted,
      batchSize: args.batchSize,
      totalGalaxies: args.totalGalaxies,
      processedGalaxies: args.processedGalaxies,
      nextCursor: args.nextCursor,
      selectedImageKeys: args.selectedImages.map((image) => image.imageKey),
      tokenHash: args.tokenHash,
      requestMethod: args.requestMethod,
      requestAuthMode: args.requestAuthMode,
      provider: args.provider,
      imageBaseUrl: args.imageBaseUrl,
      r2Endpoint: args.r2Endpoint,
      r2Bucket: args.r2Bucket,
      r2Prefix: args.r2Prefix,
      r2Region: args.r2Region,
      imageStats: buildInitialImageStats(args.selectedImages),
      startedAt: args.startedAt,
      updatedAt: args.updatedAt,
      completedAt: args.completedAt,
      processedBatchCount: 0,
    });
  },
});

export const deleteImageAuditMissingChunksInternal = internalMutation({
  args: {
    chunkIds: v.array(v.id("imageAuditMissingChunks")),
  },
  returns: deletedCountResultValidator,
  handler: async (ctx, args) => {
    for (const chunkId of args.chunkIds) {
      await ctx.db.delete(chunkId);
    }

    return { deletedCount: args.chunkIds.length };
  },
});

export const deleteImageAuditRunInternal = internalMutation({
  args: {
    runId: v.id("imageAuditRuns"),
  },
  returns: successResultValidator,
  handler: async (ctx, args) => {
    await ctx.db.delete(args.runId);
    return { success: true };
  },
});

export const getImageAuditOverview = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: imageAuditOverviewValidator,
  handler: async (ctx, args): Promise<ImageAuditOverviewResult> => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const [availablePapers, totalGalaxies, blacklistedCount, recentRuns]: [
      string[],
      number | null,
      number,
      Doc<"imageAuditRuns">[]
    ] = await Promise.all([
      getAvailablePapers(ctx),
      getTotalGalaxyCount(ctx),
      ctx.runQuery(internal.galaxyBlacklist.getReliableBlacklistCount, {}),
      ctx.db.query("imageAuditRuns").withIndex("by_updated_at").order("desc").take(limit),
    ]);

    const enrichedRuns: ImageAuditRunWithCreator[] = await Promise.all(
      recentRuns.map(async (run: Doc<"imageAuditRuns">) => ({
        ...run,
        ...(await getCreatorInfo(ctx, run.createdBy)),
      }))
    );

    return {
      availablePapers,
      totalGalaxies,
      blacklistedCount,
      recentRuns: enrichedRuns,
    };
  },
});

export const getImageAuditRun = query({
  args: {
    runId: v.id("imageAuditRuns"),
  },
  returns: v.union(imageAuditRunWithCreatorValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) {
      return null;
    }

    return {
      ...run,
      ...(await getCreatorInfo(ctx, run.createdBy)),
    };
  },
});

export const createImageAuditRun = action({
  args: {
    checkMode: checkModeValidator,
    paperFilter: v.optional(v.array(v.string())),
    includeBlacklisted: v.boolean(),
    batchSize: v.optional(v.number()),
    selectedImages: v.array(selectedImageValidator),
    tokenHash: v.string(),
    requestMethod: requestMethodValidator,
    requestAuthMode: requestAuthModeValidator,
    provider: providerValidator,
    imageBaseUrl: v.string(),
    r2Endpoint: v.optional(v.string()),
    r2Bucket: v.optional(v.string()),
    r2Prefix: v.optional(v.string()),
    r2Region: v.optional(v.string()),
  },
  returns: createImageAuditRunResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<{ runId: Id<"imageAuditRuns">; totalGalaxies: number; status: "completed" | "paused" }> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    const paperFilter = normalizePaperFilter(args.paperFilter);
    const selectedImages = normalizeSelectedImages(args.selectedImages);
    const batchSize = Math.min(Math.max(args.batchSize ?? 50, 1), 500);

    if (selectedImages.length === 0) {
      throw new Error("Select at least one image to audit.");
    }

    let blacklistedIds: string[] | undefined;
    if (!args.includeBlacklisted) {
      blacklistedIds = await ctx.runQuery(internal.galaxies.paperStats.loadBlacklistedIds, {});
    }

    let totalGalaxies = args.includeBlacklisted
      ? await getAuditGalaxyCountFromAggregates(ctx, paperFilter)
      : null;

    if (totalGalaxies === null) {
      let countScanCursor: string | undefined;
      let countScanComplete = false;
      let scannedTotalGalaxies = 0;

      for (let pageCount = 0; pageCount < IMAGE_AUDIT_MAX_COUNT_SCAN_PAGES; pageCount += 1) {
        const page: ScanPageResult = await ctx.runQuery(internal.imageAudit.scanAuditGalaxiesPage, {
          cursor: countScanCursor,
          batchSize: IMAGE_AUDIT_COUNT_SCAN_BATCH_SIZE,
          paperFilter,
        });

        scannedTotalGalaxies += filterCandidates(page.items, paperFilter, blacklistedIds).length;

        if (page.isDone || !page.nextCursor) {
          countScanComplete = true;
          break;
        }

        countScanCursor = page.nextCursor;
      }

      if (!countScanComplete) {
        throw new Error(
          "Audit run is too large to count exactly in one request. Narrow the paper filter or split the audit into smaller runs."
        );
      }

      totalGalaxies = scannedTotalGalaxies;
    }

    const startedAt = Date.now();
    const runId: Id<"imageAuditRuns"> = await ctx.runMutation(internal.imageAudit.createImageAuditRunInternal, {
      createdBy: callerProfile.userId,
      status: totalGalaxies === 0 ? "completed" : "paused",
      checkMode: args.checkMode,
      paperFilter,
      includeBlacklisted: args.includeBlacklisted,
      batchSize,
      totalGalaxies,
      processedGalaxies: 0,
      nextCursor: undefined,
      selectedImages,
      tokenHash: args.tokenHash,
      requestMethod: args.requestMethod,
      requestAuthMode: args.requestAuthMode,
      provider: args.provider,
      imageBaseUrl: args.imageBaseUrl,
      r2Endpoint: args.r2Endpoint,
      r2Bucket: args.r2Bucket,
      r2Prefix: args.r2Prefix,
      r2Region: args.r2Region,
      startedAt,
      updatedAt: startedAt,
      completedAt: totalGalaxies === 0 ? startedAt : undefined,
    });

    return {
      runId,
      totalGalaxies,
      status: totalGalaxies === 0 ? "completed" : "paused",
    };
  },
});

export const fetchImageAuditBatch = action({
  args: {
    runId: v.id("imageAuditRuns"),
  },
  returns: fetchImageAuditBatchResultValidator,
  handler: async (ctx, args): Promise<FetchImageAuditBatchResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    const run: Doc<"imageAuditRuns"> | null = await ctx.runQuery(internal.imageAudit.getImageAuditRunRecord, {
      runId: args.runId,
    });

    if (!run) {
      throw new Error("Audit run not found.");
    }

    if (run.status === "completed") {
      return {
        previousCursor: run.nextCursor ?? null,
        nextCursor: null,
        isDone: true,
        candidates: [] as string[],
        totalGalaxies: run.totalGalaxies,
        processedGalaxies: run.processedGalaxies,
        batchSize: run.batchSize,
      };
    }

    let blacklistedIds: string[] | undefined;
    if (!run.includeBlacklisted) {
      blacklistedIds = await ctx.runQuery(internal.galaxies.paperStats.loadBlacklistedIds, {});
    }

    const candidates: string[] = [];
    const previousCursor = run.nextCursor ?? null;
    let scanCursor = run.nextCursor;
    let exhausted = false;

    while (candidates.length < run.batchSize && !exhausted) {
      const page: ScanPageResult = await ctx.runQuery(internal.imageAudit.scanAuditGalaxiesPage, {
        cursor: scanCursor,
        batchSize: Math.min(Math.max(run.batchSize * 6, 250), 5000),
        paperFilter: run.paperFilter,
      });

      const accepted = filterCandidates(page.items, run.paperFilter, blacklistedIds);
      for (const item of accepted) {
        candidates.push(item.externalId);
        if (candidates.length >= run.batchSize) {
          break;
        }
      }

      exhausted = page.isDone || !page.nextCursor;
      scanCursor = page.nextCursor ?? undefined;
    }

    return {
      previousCursor,
      nextCursor: exhausted ? null : scanCursor ?? null,
      isDone: exhausted,
      candidates,
      totalGalaxies: run.totalGalaxies,
      processedGalaxies: run.processedGalaxies,
      batchSize: run.batchSize,
    };
  },
});

export const appendImageAuditBatch = mutation({
  args: {
    runId: v.id("imageAuditRuns"),
    expectedPreviousCursor: v.optional(v.string()),
    nextCursor: v.optional(v.string()),
    isDone: v.boolean(),
    processedGalaxies: v.number(),
    lastProcessedGalaxyId: v.optional(v.string()),
    imageStatsDelta: v.array(imageStatDeltaValidator),
    missingIdsByImage: v.array(missingIdsChunkValidator),
    lastErrorSample: v.optional(v.string()),
  },
  returns: appendImageAuditBatchResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; processedGalaxies: number; status: "completed" | "running" }> => {
    await requireAdmin(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error("Audit run not found.");
    }

    if (run.status === "completed") {
      throw new Error("Audit run is already completed.");
    }

    const currentCursor = run.nextCursor ?? undefined;
    if (currentCursor !== args.expectedPreviousCursor) {
      throw new Error("Audit run cursor mismatch. Refresh the run before resuming.");
    }

    if (!args.isDone && args.processedGalaxies <= 0) {
      throw new Error("Non-final audit batches must include at least one processed galaxy.");
    }

    const imageStatsByKey = new Map(
      run.imageStats.map((stat) => [stat.imageKey, { ...stat }])
    );

    for (const delta of args.imageStatsDelta) {
      const existing = imageStatsByKey.get(delta.imageKey);
      if (!existing) {
        throw new Error(`Unknown image key in batch delta: ${delta.imageKey}`);
      }
      existing.availableCount += delta.availableCount;
      existing.missingCount += delta.missingCount;
      existing.errorCount += delta.errorCount;
    }

    const nextBatchNumber = run.processedBatchCount + 1;
    const updatedAt = Date.now();
    const nextProcessedGalaxies = Math.min(
      run.totalGalaxies,
      run.processedGalaxies + args.processedGalaxies
    );

    for (const missingChunk of args.missingIdsByImage) {
      if (missingChunk.externalIds.length === 0) {
        continue;
      }
      await ctx.db.insert("imageAuditMissingChunks", {
        runId: args.runId,
        imageKey: missingChunk.imageKey,
        label: missingChunk.label,
        externalIds: missingChunk.externalIds,
        batchNumber: nextBatchNumber,
        createdAt: updatedAt,
      });
    }

    await ctx.db.patch(args.runId, {
      status: args.isDone ? "completed" : "running",
      processedGalaxies: nextProcessedGalaxies,
      nextCursor: args.isDone ? undefined : args.nextCursor,
      imageStats: run.imageStats.map((stat) => imageStatsByKey.get(stat.imageKey) ?? stat),
      updatedAt,
      completedAt: args.isDone ? updatedAt : run.completedAt,
      lastProcessedGalaxyId: args.lastProcessedGalaxyId,
      lastError: args.lastErrorSample ?? run.lastError,
      processedBatchCount: nextBatchNumber,
    });

    return {
      success: true,
      processedGalaxies: nextProcessedGalaxies,
      status: args.isDone ? "completed" : "running",
    };
  },
});

export const setImageAuditRunStatus = mutation({
  args: {
    runId: v.id("imageAuditRuns"),
    status: v.union(v.literal("paused"), v.literal("running"), v.literal("failed")),
    lastError: v.optional(v.string()),
    clearLastError: v.optional(v.boolean()),
  },
  returns: successResultValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error("Audit run not found.");
    }

    if (run.status === "completed" && args.status !== "failed") {
      return { success: true };
    }

    await ctx.db.patch(args.runId, {
      status: args.status,
      updatedAt: Date.now(),
      lastError: args.clearLastError ? undefined : args.lastError ?? run.lastError,
    });

    return { success: true };
  },
});

export const getImageAuditMissingIdsPage = action({
  args: {
    runId: v.id("imageAuditRuns"),
    imageKey: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: missingIdsPageResultValidator,
  handler: async (ctx, args): Promise<MissingIdsPageResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    return await ctx.runQuery(internal.imageAudit.getImageAuditMissingIdsPageInternal, args);
  },
});

export const deleteImageAuditRun = action({
  args: {
    runId: v.id("imageAuditRuns"),
    forceRunning: v.optional(v.boolean()),
  },
  returns: deleteImageAuditRunResultValidator,
  handler: async (ctx, args): Promise<DeleteImageAuditRunResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Not authorized");
    }

    const run: Doc<"imageAuditRuns"> | null = await ctx.runQuery(internal.imageAudit.getImageAuditRunRecord, {
      runId: args.runId,
    });

    if (!run) {
      return {
        deleted: false,
        deletedChunkCount: 0,
      };
    }

    if (run.status === "running" && !args.forceRunning) {
      throw new Error("This audit run is still marked running. Resume it or confirm force deletion.");
    }

    let deletedChunkCount = 0;

    while (true) {
      const chunkIds: Id<"imageAuditMissingChunks">[] = await ctx.runQuery(
        internal.imageAudit.getImageAuditMissingChunkIdsBatchInternal,
        {
          runId: args.runId,
          limit: 200,
        }
      );

      if (chunkIds.length === 0) {
        break;
      }

      await ctx.runMutation(internal.imageAudit.deleteImageAuditMissingChunksInternal, {
        chunkIds,
      });
      deletedChunkCount += chunkIds.length;
    }

    await ctx.runMutation(internal.imageAudit.deleteImageAuditRunInternal, {
      runId: args.runId,
    });

    return {
      deleted: true,
      deletedChunkCount,
    };
  },
});