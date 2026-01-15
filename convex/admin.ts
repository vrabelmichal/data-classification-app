import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

export const createUserProfile = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.insert("userProfiles", {
      userId: args.targetUserId,
      role: "user",
      isActive: true,
      isConfirmed: true,
      classificationsCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      sequenceGenerated: false,
    });

    return { success: true };
  },
});

// Backfill userGalaxyClassifications table from existing classifications
// This is needed for efficient "classified by me" / "unclassified by me" queries
export const backfillUserGalaxyClassifications = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const batchSize = args.batchSize ?? 100;
    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let cursor: string | null = null;

    // Process in batches to avoid timeout
    while (true) {
      const result = await ctx.db
        .query("classifications")
        .paginate({ numItems: batchSize, cursor });

      for (const classification of result.page) {
        processed++;

        // Check if already exists
        const existing = await ctx.db
          .query("userGalaxyClassifications")
          .withIndex("by_user_galaxy", (q) =>
            q.eq("userId", classification.userId).eq("galaxyExternalId", classification.galaxyExternalId)
          )
          .unique();

        if (existing) {
          skipped++;
          continue;
        }

        // Get galaxy to get numericId
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q) => q.eq("id", classification.galaxyExternalId))
          .unique();

        if (!galaxy) {
          skipped++;
          continue;
        }

        // Insert the tracking record
        await ctx.db.insert("userGalaxyClassifications", {
          userId: classification.userId,
          galaxyExternalId: classification.galaxyExternalId,
          galaxyNumericId: galaxy.numericId ?? BigInt(0),
          classificationId: classification._id,
          classifiedAt: classification._creationTime,
        });

        inserted++;
      }

      if (result.isDone) {
        break;
      }

      cursor = result.continueCursor;

      // Return early if we've processed enough to avoid timeout
      // The admin can call this function multiple times
      if (processed >= batchSize * 5) {
        return {
          processed,
          inserted,
          skipped,
          isDone: false,
          message: `Processed ${processed} classifications. Run again to continue.`,
        };
      }
    }

    return {
      processed,
      inserted,
      skipped,
      isDone: true,
      message: `Backfill complete. Processed ${processed} classifications.`,
    };
  },
});

// Check backfill status
export const getBackfillStatus = query({
  args: {},
  handler: async (ctx) => {
    // Count total classifications (approximate using a simple query)
    const classifications = await ctx.db.query("classifications").take(10001);
    const totalClassifications = classifications.length;
    const classificationsApproximate = totalClassifications >= 10001;

    // Count existing userGalaxyClassifications
    const tracking = await ctx.db.query("userGalaxyClassifications").take(10001);
    const totalTracking = tracking.length;
    const trackingApproximate = totalTracking >= 10001;

    return {
      totalClassifications: classificationsApproximate ? "10000+" : totalClassifications,
      totalTracking: trackingApproximate ? "10000+" : totalTracking,
      isComplete: !classificationsApproximate && !trackingApproximate && totalClassifications <= totalTracking,
      message: totalClassifications <= totalTracking 
        ? "Backfill complete"
        : `${totalClassifications - totalTracking} classifications need backfilling`,
    };
  },
});
