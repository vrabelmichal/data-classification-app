import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUserId } from "./lib/auth";

// Submit a new issue report
export const submitReport = mutation({
  args: {
    description: v.string(),
  },
  async handler(ctx, args) {
    const userId = await requireUserId(ctx);

    const reportId = await ctx.db.insert("issueReports", {
      userId,
      description: args.description.trim(),
      status: "open",
      createdAt: Date.now(),
    });

    return reportId;
  },
});

// Get all issue reports (admin only)
export const getAllReports = query({
  async handler(ctx) {
    await requireAdmin(ctx);

    const reports = await ctx.db.query("issueReports").collect();

    // Enrich with user information
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const reportUser = await ctx.db.get(report.userId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", report.userId))
          .unique();
        return {
          ...report,
          userEmail: reportUser?.email || "Unknown",
          userName: reportUser?.name || reportUser?.email || "Unknown",
        };
      })
    );

    // Sort by created date descending (newest first)
    return enrichedReports.sort((a, b) => b.createdAt - a.createdAt);
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
