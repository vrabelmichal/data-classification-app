// convex/seedGalaxyAssignmentStats.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

const SEED_BATCH = 500;

export const seedGalaxyAssignmentStats = mutation({
  args: {
    // Optional: limit seeding run size to avoid long transactions
    maxToSeed: v.optional(v.number()),
    // Optional: cursor to resume from previous run
    cursor: v.optional(v.string()),
    // Optional: reset totalAssigned to 0 (useful after sequences are removed)
    resetTotalAssigned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.maxToSeed ? Math.max(1, Math.floor(args.maxToSeed)) : SEED_BATCH;
    let seeded = 0;
    let cursor = args.cursor || null;
    const resetTotalAssigned = !!args.resetTotalAssigned;

    // Log for first batch
    if (!args.cursor) {
      console.log(`Starting galaxy assignment stats seeding: processing first batch of up to ${limit} galaxies${resetTotalAssigned ? ' (resetting totalAssigned)' : ''}`);
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxies")
      .withIndex("by_numeric_id")
      .paginate({
        numItems: limit,
        cursor,
      });

    for (const galaxy of page) {
      // Check if we need to seed stats
      const needsSeeding = galaxy.totalAssigned === undefined ||
                          galaxy.perUser === undefined ||
                          resetTotalAssigned;

      if (needsSeeding) {
        await ctx.db.patch(galaxy._id, {
          totalAssigned: resetTotalAssigned ? BigInt(0) : (galaxy.totalAssigned ?? BigInt(0)),
          perUser: resetTotalAssigned ? {} : (galaxy.perUser ?? {}),
          lastAssignedAt: resetTotalAssigned ? undefined : (galaxy.lastAssignedAt ?? undefined),
        });
        seeded += 1;
      }
    }

    // Log for intermediate batches (not first, not last)
    if (args.cursor && !isDone) {
      console.log(`Processed intermediate batch: ${resetTotalAssigned ? 'reset' : 'seeded'} ${seeded} galaxies (${page.length} total in batch), continuing with cursor ${continueCursor}`);
    }

    // Log for last batch
    if (isDone) {
      console.log(`Completed galaxy assignment stats seeding: processed final batch, ${resetTotalAssigned ? 'reset' : 'seeded'} ${seeded} galaxies (${page.length} total in batch), no more data to process`);
    }

    return {
      seeded,
      limit,
      cursor: continueCursor,
      isDone,
      message:
        seeded > 0
          ? resetTotalAssigned
            ? `Reset ${seeded} galaxy assignment stats`
            : `Seeded ${seeded} galaxy stats`
          : resetTotalAssigned
            ? "No galaxy assignment stats were reset"
            : "No new stats were seeded",
    };
  },
});