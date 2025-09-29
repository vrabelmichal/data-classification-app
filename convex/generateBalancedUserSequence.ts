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
  _id: any; // Id<"galaxies">
  galaxyExternalId: string; // galaxy id
  numericId: bigint;
  totalAssigned: bigint;
  perUser?: Record<string, bigint>;
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

    console.log(`Starting balanced sequence generation: N=${expectedUsers}, K=${K}, M=${M}, S=${S}, allowOverAssign=${allowOverAssign}, dryRun=${dryRun}`);

    // Get galaxies, ordered by totalAssigned and numericId
    console.log(`Fetching galaxies for processing...`);

    let iterator: AsyncIterator<any> | undefined;

    // Create lazy streams that yield StatsDoc on demand
    async function* createStream(fromOverK = false): AsyncIterable<StatsDoc> {
      if (!iterator) {
        const query = allowOverAssign
          ? ctx.db.query("galaxies").withIndex("by_totalAssigned_numericId")
          : ctx.db.query("galaxies").withIndex("by_totalAssigned_numericId", (q) =>
              q.lt("totalAssigned", BigInt(K))
            );
        iterator = query[Symbol.asyncIterator]();
      }

      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        const doc = result.value;

        const statsDoc: StatsDoc = {
          _id: doc._id,
          galaxyExternalId: doc.id,
          numericId: doc.numericId!,
          totalAssigned: doc.totalAssigned!,
          perUser: doc.perUser,
          lastAssignedAt: doc.lastAssignedAt,
        };

        const isOverK = statsDoc.totalAssigned >= BigInt(K);
        if (fromOverK) {
          if (!isOverK) continue; // Shouldn't happen in ordered query
          yield statsDoc;
        } else {
          if (isOverK) break;
          yield statsDoc;
        }
      }
    }

    async function* underKStream(): AsyncIterable<StatsDoc> {
      yield* createStream(false);
    }

    async function* overKStream(): AsyncIterable<StatsDoc> {
      if (!allowOverAssign) return;
      yield* createStream(true);
    }

    // Note: We can't easily count total galaxies without consuming the streams
    // So we'll log counts after selection if needed

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

    console.log(`Selection completed: selected ${selectedIds.length} galaxies, overAssignedCount=${overAssignedCount}, exhaustedUnderK=${exhaustedUnderK}, exhaustedAll=${exhaustedAll}`);
    console.log(`Selected galaxy IDs: ${selectedIds.slice(0, 10).join(', ')}${selectedIds.length > 10 ? '...' : ''}`);

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
      console.log(`Creating sequence for user ${targetUserId} with ${selectedIds.length} galaxies`);
      const existingSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .unique();
      if (existingSequence) {
        console.log(`Deleting existing sequence ${existingSequence._id}`);
        await ctx.db.delete(existingSequence._id);
      }

      if (selectedIds.length > 0) {
        const newSequence = await ctx.db.insert("galaxySequences", {
          userId: targetUserId,
          galaxyExternalIds: selectedIds,
          currentIndex: 0,
          numClassified: 0,
          numSkipped: 0,
        });
        console.log(`Created new sequence ${newSequence}`);
        success = true;
      }
    }

    // Update stats counters for each chosen galaxy (unless dryRun)
    if (!dryRun) {
      console.log(`Updating stats for ${selectedDocs.length} galaxies`);
      const now = Date.now();
      for (const doc of selectedDocs) {
        // console.log(`Processing galaxy ${doc.galaxyExternalId} (${doc._id}): current totalAssigned=${doc.totalAssigned}`);
        const latest = await ctx.db.get(doc._id as any);
        if (!latest) {
          console.log(`Galaxy ${doc.galaxyExternalId} not found, skipping`);
          continue;
        }
        // Type assertion since we know this is a galaxies document
        const statsDoc = latest as any;
        // console.log(`Latest galaxy data: totalAssigned=${statsDoc.totalAssigned}, perUser=${JSON.stringify(statsDoc.perUser)}`);
        const perUser = { ...(statsDoc.perUser ?? {}) };
        const prev = perUser[targetUserId] ?? BigInt(0);
        // console.log(`User ${targetUserId} previous count: ${prev}, cap M=${M}`);
        if (prev >= BigInt(M)) {
          // Race-safety check: skip if cap reached since selection time.
          // console.log(`Skipping galaxy ${doc.galaxyExternalId}: user cap reached`);
          continue;
        }
        perUser[targetUserId] = prev + BigInt(1);
        const newTotalAssigned = (statsDoc.totalAssigned ?? BigInt(0)) + BigInt(1);
        // console.log(`Updating galaxy ${doc.galaxyExternalId}: totalAssigned ${statsDoc.totalAssigned ?? BigInt(0)} -> ${newTotalAssigned}, perUser[${targetUserId}] ${prev} -> ${prev + BigInt(1)}`);
        await ctx.db.patch(statsDoc._id, {
          totalAssigned: newTotalAssigned,
          perUser,
          lastAssignedAt: now,
        });
        // console.log(`Successfully updated galaxy ${doc.galaxyExternalId}`);
      }

      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .unique();
      if (userProfile) {
        console.log(`Marking user profile ${userProfile._id} as sequenceGenerated=true`);
        await ctx.db.patch(userProfile._id, { sequenceGenerated: true });
      }
    }

    console.log(`Completed balanced sequence generation: success=${dryRun ? true : success}, generated=${selectedIds.length}/${S}`);
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