import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUserId } from "./lib/auth";

// Get all blacklisted galaxies (admin only)
export const getAllBlacklistedGalaxies = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);
    const blacklisted = await ctx.db.query("galaxyBlacklist").collect();
    return blacklisted.length;
  },
});

// Add a single galaxy to the blacklist (admin only)
export const addToBlacklist = mutation({
  args: {
    galaxyExternalId: v.string(),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { userId } = await requireAdmin(ctx);

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

    await ctx.db.insert("galaxyBlacklist", {
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
    await requireAdmin(ctx);

    const galaxyExternalId = args.galaxyExternalId.trim();

    const existing = await ctx.db
      .query("galaxyBlacklist")
      .withIndex("by_galaxy", (q) => q.eq("galaxyExternalId", galaxyExternalId))
      .unique();

    if (!existing) {
      return { success: false, message: "Galaxy is not in the blacklist" };
    }

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
    const { userId } = await requireAdmin(ctx);

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

      await ctx.db.insert("galaxyBlacklist", {
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
    await requireAdmin(ctx);

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
  args: {},
  async handler(ctx) {
    await requireAdmin(ctx);

    const allBlacklisted = await ctx.db.query("galaxyBlacklist").collect();

    for (const item of allBlacklisted) {
      await ctx.db.delete(item._id);
    }

    return {
      success: true,
      removed: allBlacklisted.length,
    };
  },
});
