// convex/generateBalancedUserSequence.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  SelectionParams,
  selectFromOrderedStreams,
  validateParams,
} from "./lib/assignmentCore";

type StatsDoc = {
  _id: any; // Id<"galaxyAssignmentStats">
  galaxyExternalId: string; // Id<"galaxyIds"> serialized
  numericId: bigint;
  totalAssigned: number;
  perUser?: Record<string, number>;
  lastAssignedAt?: number;
};

const MAX_SEQUENCE = 200_000;
const BATCH = 1000;

export const generateBalancedUserSequence = mutation({
  args: {
    targetUserId: v.optional(v.id("users")),
    expectedUsers: v.number(), // N
    minAssignmentsPerEntry: v.number(), // K
    maxAssignmentsPerUserPerEntry: v.optional(v.number()), // M default 1
    sequenceSize: v.optional(v.number()), // S default 50
    allowOverAssign: v.optional(v.boolean()), // default false
    dryRun: v.optional(v.boolean()), // default false
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const targetUserId = args.targetUserId ?? userId;
    const expectedUsers = Math.max(1, Math.floor(args.expectedUsers));
    const K = Math.max(1, Math.floor(args.minAssignmentsPerEntry));
    const M = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
    const requestedSize = Math.max(1, Math.floor(args.sequenceSize ?? 50));
    const S = Math.min(requestedSize, MAX_SEQUENCE);
    const allowOverAssign = !!args.allowOverAssign;
    const dryRun = !!args.dryRun;

    // Admin check if generating for another user
    if (targetUserId !== userId) {
      const currentProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!currentProfile || currentProfile.role !== "admin") {
        throw new Error("Admin access required");
      }
    }

    const warnings = validateParams({
      expectedUsers,
      minAssignmentsK: K,
      perUserCapM: M,
      sequenceSize: S,
    }).map((w) => w.message);

    // Build async streams from Convex index, batched.
    async function* underKStream(): AsyncIterable<StatsDoc> {
      const base = ctx.db
        .query("galaxyAssignmentStats")
        .withIndex("by_total_numeric", (q) => q.lt("totalAssigned", K));
      let cursor: string | null = null;
      while (true) {
        const { page, isDone, continueCursor } = await base.paginate({
          numItems: BATCH,
          cursor,
        });
        for (const doc of page) yield doc as StatsDoc;
        if (isDone) break;
        cursor = continueCursor;
      }
    }

    async function* overKStream(): AsyncIterable<StatsDoc> {
      const base = ctx.db
        .query("galaxyAssignmentStats")
        .withIndex("by_total_numeric", (q) => q.gte("totalAssigned", K));
      let cursor: string | null = null;
      while (true) {
        const { page, isDone, continueCursor } = await base.paginate({
          numItems: BATCH,
          cursor,
        });
        for (const doc of page) yield doc as StatsDoc;
        if (isDone) break;
        cursor = continueCursor;
      }
    }

    const selectionParams: SelectionParams = {
      targetUserId,
      minAssignmentsK: K,
      perUserCapM: M,
      allowOverAssign,
      sequenceSize: S,
    };

    const {
      selectedIds,
      selectedDocs,
      overAssignedCount,
      exhaustedUnderK,
      exhaustedAll,
    } = await selectFromOrderedStreams(
      selectionParams,
      underKStream(),
      allowOverAssign ? overKStream() : undefined
    );

    if (overAssignedCount > 0) {
      warnings.push(
        `Warning: ${overAssignedCount} entries were assigned with ` +
          `totalAssigned >= K=${K} (allowOverAssign=true).`
      );
    }

    if (selectedIds.length < S) {
      warnings.push(
        `Note: Only generated ${selectedIds.length} of ${S} requested. ` +
          `${exhaustedUnderK ? "Under-K pool exhausted." : ""} ` +
          `${allowOverAssign ? (exhaustedAll ? "All pools exhausted." : "") : "Over-assign disabled."}`
      );
    }

    // Replace user's sequence (unless dryRun)
    let success = false;
    if (!dryRun) {
      const existingSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .unique();
      if (existingSequence) {
        await ctx.db.delete(existingSequence._id);
      }

      if (selectedIds.length > 0) {
        await ctx.db.insert("galaxySequences", {
          userId: targetUserId,
          galaxyExternalIds: selectedIds,
          currentIndex: 0,
          numClassified: 0,
          numSkipped: 0,
        });
        success = true;
      }
    }

    // Update stats counters for each chosen galaxy (unless dryRun)
    if (!dryRun) {
      const now = Date.now();
      for (const doc of selectedDocs) {
        const latest = await ctx.db.get(doc._id as any);
        if (!latest) continue;
        // Type assertion since we know this is a galaxyAssignmentStats document
        const statsDoc = latest as any;
        const perUser = { ...(statsDoc.perUser ?? {}) };
        const prev = perUser[targetUserId] ?? 0;
        if (prev >= M) {
          // Race-safety check: skip if cap reached since selection time.
          continue;
        }
        perUser[targetUserId] = prev + 1;
        await ctx.db.patch(statsDoc._id, {
          totalAssigned: statsDoc.totalAssigned + 1,
          perUser,
          lastAssignedAt: now,
        });
      }

      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .unique();
      if (userProfile) {
        await ctx.db.patch(userProfile._id, { sequenceGenerated: true });
      }
    }

    return {
      success: dryRun ? true : success,
      requested: S,
      generated: selectedIds.length,
      minAssignmentsPerEntry: K,
      perUserCap: M,
      expectedUsers,
      allowOverAssign,
      dryRun,
      warnings: warnings.length ? warnings : undefined,
    };
  },
});