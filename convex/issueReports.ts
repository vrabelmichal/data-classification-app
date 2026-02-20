import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUserId } from "./lib/auth";

// Submit a new issue report
export const submitReport = mutation({
  args: {
    description: v.string(),
    url: v.optional(v.string()),
    galaxyExternalId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const userId = await requireUserId(ctx);

    const reportId = await ctx.db.insert("issueReports", {
      userId,
      description: args.description.trim(),
      url: args.url?.trim(),
      status: "open",
      category: "general",
      galaxyExternalId: args.galaxyExternalId?.trim() || undefined,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

// Submit a quick-tap report (4-tap gesture on a galaxy)
export const submitQuickTapReport = mutation({
  args: {
    galaxyExternalId: v.string(),
    url: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const userId = await requireUserId(ctx);

    const reportId = await ctx.db.insert("issueReports", {
      userId,
      description: "",
      url: args.url?.trim(),
      status: "open",
      category: "quick_tap",
      galaxyExternalId: args.galaxyExternalId,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

// Get the galaxy external IDs of all quick-tap reports (public, paginated)
export const getIssueIds = query({
  args: {
    category: v.optional(v.union(v.literal("general"), v.literal("quick_tap"))),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = Math.min(args.limit ?? 500, 1000);

    const page = args.category
      ? await ctx.db
          .query("issueReports")
          .withIndex("by_category", (q) => q.eq("category", args.category))
          .paginate({ cursor: args.cursor ?? null, numItems: limit })
      : await ctx.db
          .query("issueReports")
          .paginate({ cursor: args.cursor ?? null, numItems: limit });

    return {
      ids: page.page.map((r) => r._id as string),
      galaxyIds: page.page.map((r) => r.galaxyExternalId ?? null),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

// Get all issue reports (admin only)
export const getAllReports = query({
  args: {
    filterCategory: v.optional(v.union(v.literal("general"), v.literal("quick_tap"), v.literal("all"))),
  },
  async handler(ctx, args) {
    await requireAdmin(ctx);

    const reports = await ctx.db.query("issueReports").collect();

    // Enrich with user information
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const reportUser = await ctx.db.get(report.userId);
        return {
          ...report,
          userEmail: reportUser?.email || "Unknown",
          userName: reportUser?.name || reportUser?.email || "Unknown",
        };
      })
    );

    // Sort by created date descending (newest first)
    const sorted = enrichedReports.sort((a, b) => b.createdAt - a.createdAt);

    // Filter by category if requested
    const filterCategory = args.filterCategory ?? "all";
    if (filterCategory === "all") return sorted;
    return sorted.filter((r) => (r.category ?? "general") === filterCategory);
  },
});

// Get reports for current user
export const getUserReports = query({
  async handler(ctx) {
    const userId = await requireUserId(ctx);

    const reports = await ctx.db
      .query("issueReports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return reports.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Update report status
export const updateReportStatus = mutation({
  args: {
    reportId: v.id("issueReports"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    adminNotes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await requireAdmin(ctx);

    const updateData: any = {
      status: args.status,
    };

    if (args.adminNotes !== undefined) {
      updateData.adminNotes = args.adminNotes;
    }

    if (args.status === "resolved" || args.status === "closed") {
      updateData.resolvedAt = Date.now();
    }

    await ctx.db.patch(args.reportId, updateData);
  },
});

// Delete report
export const deleteReport = mutation({
  args: {
    reportId: v.id("issueReports"),
  },
  async handler(ctx, args) {
    await requireAdmin(ctx);

    await ctx.db.delete(args.reportId);
  },
});
