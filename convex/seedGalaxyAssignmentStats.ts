// convex/seedGalaxyAssignmentStats.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

const SEED_BATCH = 500;

export const seedGalaxyAssignmentStats = mutation({
  args: {
    // Optional: limit seeding run size to avoid long transactions
    maxToSeed: v.optional(v.number()),
    // Optional: cursor to resume from previous run
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Admin only
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    const limit = args.maxToSeed ? Math.max(1, Math.floor(args.maxToSeed)) : SEED_BATCH;
    let seeded = 0;
    let cursor = args.cursor || null;

    const { page, isDone, continueCursor } = await ctx.db
      .query("galaxyIds")
      .withIndex("by_numeric_id")
      .paginate({
        numItems: limit,
        cursor,
      });

    for (const g of page) {
      // Check if stats exist
      const existing = await ctx.db
        .query("galaxyAssignmentStats")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", g.id))
        .unique();
      if (!existing) {
        await ctx.db.insert("galaxyAssignmentStats", {
          galaxyExternalId: g.id,
          numericId: g.numericId, // adjust to your actual type
          totalAssigned: 0,
          perUser: {},
          lastAssignedAt: undefined,
        });
        seeded += 1;
      }
    }

    return {
      seeded,
      limit,
      cursor: continueCursor,
      isDone,
      message:
        seeded > 0
          ? `Seeded ${seeded} galaxyAssignmentStats docs`
          : "No new stats were seeded",
    };
  },
});