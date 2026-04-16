import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import {
  GALAXY_BLACKLIST_AGGREGATE_READY_KEY,
  galaxyBlacklistByExternalId,
} from "./galaxies/aggregates";

const BLACKLIST_COUNT_PAGE_SIZE = 500;

async function countBlacklistRowsPaginated(ctx: any): Promise<number> {
  let cursor: string | null = null;
  let totalRows = 0;

  while (true) {
    const result: { page: unknown[]; isDone: boolean; continueCursor: string } = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_added_at")
      .paginate({
        cursor,
        numItems: BLACKLIST_COUNT_PAGE_SIZE,
      });

    totalRows += result.page.length;

    if (result.isDone) {
      return totalRows;
    }

    cursor = result.continueCursor;
  }
}

async function isGalaxyBlacklistAggregateReady(ctx: any): Promise<boolean> {
  const row = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", GALAXY_BLACKLIST_AGGREGATE_READY_KEY))
    .unique();

  return Boolean((row?.value as { ready?: boolean } | undefined)?.ready);
}

async function getReliableBlacklistCountValue(ctx: any): Promise<number> {
  if (await isGalaxyBlacklistAggregateReady(ctx)) {
    return await galaxyBlacklistByExternalId.count(ctx);
  }

  return await countBlacklistRowsPaginated(ctx);
}

async function insertGalaxyBlacklistEntry(
  ctx: any,
  entry: {
    galaxyExternalId: string;
    reason?: string;
    addedAt: number;
    addedBy: Doc<"galaxyBlacklist">["addedBy"];
  }
) {
  const entryId = await ctx.db.insert("galaxyBlacklist", entry);
  const insertedEntry = await ctx.db.get(entryId);

  if (!insertedEntry) {
    throw new Error(`Failed to load inserted blacklist entry (${entryId})`);
  }

  await galaxyBlacklistByExternalId.insert(ctx, insertedEntry);
}

async function safeDeleteGalaxyBlacklistAggregate(ctx: any, entry: Doc<"galaxyBlacklist">) {
  try {
    await galaxyBlacklistByExternalId.delete(ctx, entry);
  } catch (error: any) {
    const message: string | undefined = error?.message;
    const code: string | undefined = error?.data?.code;
    if (code === "DELETE_MISSING_KEY" || message?.includes("DELETE_MISSING_KEY")) {
      return;
    }
    throw error;
  }
}

export const getReliableBlacklistCount = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    return await getReliableBlacklistCountValue(ctx);
  },
});

// Get all blacklisted galaxies (admin only)
export const getAllBlacklistedGalaxies = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can view blacklist entries",
    });

    const limit = args.limit ?? 100;

    let query = ctx.db.query("galaxyBlacklist").withIndex("by_added_at").order("desc");

    const results = await query.take(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    // Enrich with user information
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const addedByUser = await ctx.db.get(item.addedBy);
        return {
          ...item,
          addedByEmail: addedByUser?.email || "Unknown",
          addedByName: addedByUser?.name || addedByUser?.email || "Unknown",
        };
      })
    );

    return {
      items: enrichedItems,
      hasMore,
    };
  },
});

// Search blacklisted galaxies by external ID (admin only)
export const searchBlacklistedGalaxies = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can search blacklist entries",
    });

    const searchTerm = args.searchTerm.trim().toLowerCase();
    const limit = args.limit ?? 50;

    if (!searchTerm) {
      return { items: [], hasMore: false };
    }

    // Get all blacklisted galaxies and filter by search term
    // For more efficiency with large datasets, consider adding a search index
    const allBlacklisted = await ctx.db.query("galaxyBlacklist").collect();

    const filtered = allBlacklisted
      .filter((item) => item.galaxyExternalId.toLowerCase().includes(searchTerm))
      .slice(0, limit + 1);

    const hasMore = filtered.length > limit;
    const items = hasMore ? filtered.slice(0, limit) : filtered;

    // Enrich with user information
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const addedByUser = await ctx.db.get(item.addedBy);
        return {
          ...item,
          addedByEmail: addedByUser?.email || "Unknown",
          addedByName: addedByUser?.name || addedByUser?.email || "Unknown",
        };
      })
    );

    return {
      items: enrichedItems,
      hasMore,
    };
  },
});

// Check if a galaxy is blacklisted
export const isGalaxyBlacklisted = query({
  args: {
    galaxyExternalId: v.string(),
  },
  async handler(ctx, args) {
    const blacklistEntry = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", args.galaxyExternalId))
      .unique();

    return blacklistEntry !== null;
  },
});

// Get all blacklisted galaxy IDs as a Set (for efficient filtering)
export const getBlacklistedGalaxyIds = query({
  args: {},
  async handler(ctx) {
    const blacklisted = await ctx.db.query("galaxyBlacklist").collect();
    return blacklisted.map((item) => item.galaxyExternalId);
  },
});

// Get blacklist count
export const getBlacklistCount = query({
  args: {},
  async handler(ctx) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can view blacklist counts",
    });
    return await getReliableBlacklistCountValue(ctx);
  },
});

// Add a single galaxy to the blacklist (admin only)
export const addToBlacklist = mutation({
  args: {
    galaxyExternalId: v.string(),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { userId } = await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can add blacklist entries",
    });

    const galaxyExternalId = args.galaxyExternalId.trim();

    if (!galaxyExternalId) {
      throw new Error("Galaxy ID cannot be empty");
    }

    // Check if already blacklisted
    const existing = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
      .unique();

    if (existing) {
      return { success: false, message: "Galaxy is already blacklisted", alreadyExists: true };
    }

    // Optionally verify the galaxy exists in the database
    const galaxy = await ctx.db
      .query("galaxies")
      .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
      .unique();

    if (!galaxy) {
      return { success: false, message: "Galaxy not found in database", notFound: true };
    }

    await insertGalaxyBlacklistEntry(ctx, {
      galaxyExternalId,
      reason: args.reason?.trim() || undefined,
      addedAt: Date.now(),
      addedBy: userId,
    });

    return { success: true, message: "Galaxy added to blacklist" };
  },
});

// Remove a galaxy from the blacklist (admin only)
export const removeFromBlacklist = mutation({
  args: {
    galaxyExternalId: v.string(),
  },
  async handler(ctx, args) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can remove blacklist entries",
    });

    const galaxyExternalId = args.galaxyExternalId.trim();

    const existing = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
      .unique();

    if (!existing) {
      return { success: false, message: "Galaxy is not in the blacklist" };
    }

    await safeDeleteGalaxyBlacklistAggregate(ctx, existing);
    await ctx.db.delete(existing._id);

    return { success: true, message: "Galaxy removed from blacklist" };
  },
});

// Bulk add galaxies to blacklist (admin only)
export const bulkAddToBlacklist = mutation({
  args: {
    galaxyExternalIds: v.array(v.string()),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { userId } = await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can bulk-add blacklist entries",
    });

    const reason = args.reason?.trim() || undefined;
    const now = Date.now();

    let added = 0;
    let skipped = 0;
    let notFound = 0;
    const errors: string[] = [];

    for (const rawId of args.galaxyExternalIds) {
      const galaxyExternalId = rawId.trim();

      if (!galaxyExternalId) {
        skipped++;
        continue;
      }

      // Check if already blacklisted
      const existing = await ctx.db
        .query("galaxyBlacklist")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      // Optionally verify the galaxy exists
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) {
        notFound++;
        errors.push(`Galaxy "${galaxyExternalId}" not found`);
        continue;
      }

      await insertGalaxyBlacklistEntry(ctx, {
        galaxyExternalId,
        reason,
        addedAt: now,
        addedBy: userId,
      });

      added++;
    }

    return {
      success: true,
      added,
      skipped,
      notFound,
      total: args.galaxyExternalIds.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error messages
    };
  },
});

// Bulk remove galaxies from blacklist (admin only)
export const bulkRemoveFromBlacklist = mutation({
  args: {
    galaxyExternalIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can bulk-remove blacklist entries",
    });

    let removed = 0;
    let notFound = 0;

    for (const rawId of args.galaxyExternalIds) {
      const galaxyExternalId = rawId.trim();

      if (!galaxyExternalId) continue;

      const existing = await ctx.db
        .query("galaxyBlacklist")
        .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
        .unique();

      if (!existing) {
        notFound++;
        continue;
      }

      await safeDeleteGalaxyBlacklistAggregate(ctx, existing);
      await ctx.db.delete(existing._id);
      removed++;
    }

    return {
      success: true,
      removed,
      notFound,
      total: args.galaxyExternalIds.length,
    };
  },
});

// Clear entire blacklist (admin only) - use with caution
export const clearBlacklist = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  async handler(ctx, args) {
    await requirePermission(ctx, "manageGalaxyAssignments", {
      notAuthorizedMessage: "Only users with galaxy-assignment access can clear the blacklist",
    });

    const rawBatchSize = args.batchSize ?? 250;
    const batchSize = Math.min(Math.max(Math.floor(rawBatchSize), 1), 1000);

    const results = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_added_at")
      .order("asc")
      .take(batchSize + 1);

    const items = results.slice(0, batchSize);

    for (const item of items) {
      await safeDeleteGalaxyBlacklistAggregate(ctx, item);
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      removed: items.length,
      hasMore: results.length > batchSize,
    };
  },
});
