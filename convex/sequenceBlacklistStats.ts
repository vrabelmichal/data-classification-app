import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./lib/auth";
import {
  buildSequenceBlacklistStatsPatch,
  computeSequenceBlacklistStats,
  getSequenceBlacklistStatsBackfillCursor,
  getSequenceBlacklistStatsVersion,
  listBlacklistedGalaxyExternalIds,
  setSequenceBlacklistStatsBackfillCursor,
} from "./lib/sequenceBlacklistStats";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

export const getRebuildSequenceBlacklistStatsState = query({
  args: {},
  returns: v.object({
    hasCursor: v.boolean(),
    cursor: v.union(v.string(), v.null()),
    currentVersion: v.number(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can inspect sequence blacklist stats rebuild state",
    });

    const [cursor, currentVersion] = await Promise.all([
      getSequenceBlacklistStatsBackfillCursor(ctx),
      getSequenceBlacklistStatsVersion(ctx),
    ]);

    return {
      hasCursor: cursor !== null,
      cursor,
      currentVersion,
    };
  },
});

export const rebuildSequenceBlacklistStatsBatch = mutation({
  args: {
    batchSize: v.optional(v.number()),
    reset: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    processed: v.number(),
    isComplete: v.boolean(),
    nextCursor: v.union(v.string(), v.null()),
    currentVersion: v.number(),
    batchSize: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can rebuild sequence blacklist stats",
    });

    const batchSize = Math.min(
      Math.max(Math.floor(args.batchSize ?? DEFAULT_BATCH_SIZE), 1),
      MAX_BATCH_SIZE
    );

    if (args.reset) {
      await setSequenceBlacklistStatsBackfillCursor(ctx, null);
    }

    const [cursor, currentVersion, blacklistedIds] = await Promise.all([
      getSequenceBlacklistStatsBackfillCursor(ctx),
      getSequenceBlacklistStatsVersion(ctx),
      listBlacklistedGalaxyExternalIds(ctx),
    ]);

    const blacklistedExternalIds = new Set(blacklistedIds);
    const page = await ctx.db.query("galaxySequences").paginate({
      cursor,
      numItems: batchSize,
    });

    let processed = 0;

    for (const sequence of page.page) {
      const [classifiedRecords, skippedRecords] = await Promise.all([
        ctx.db.query("classifications").withIndex("by_user", (q) => q.eq("userId", sequence.userId)).collect(),
        ctx.db.query("skippedGalaxies").withIndex("by_user", (q) => q.eq("userId", sequence.userId)).collect(),
      ]);

      const stats = computeSequenceBlacklistStats(sequence, {
        blacklistedExternalIds,
        classifiedExternalIds: new Set(
          classifiedRecords.map((record) => record.galaxyExternalId)
        ),
        skippedExternalIds: new Set(skippedRecords.map((record) => record.galaxyExternalId)),
      });

      await ctx.db.patch(sequence._id, buildSequenceBlacklistStatsPatch(stats, currentVersion));
      processed += 1;
    }

    const nextCursor = page.isDone ? null : page.continueCursor;
    await setSequenceBlacklistStatsBackfillCursor(ctx, nextCursor);

    return {
      success: true,
      processed,
      isComplete: page.isDone,
      nextCursor,
      currentVersion,
      batchSize,
    };
  },
});