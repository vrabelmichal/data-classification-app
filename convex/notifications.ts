import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUserId, getOptionalUserId } from "./lib/auth";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToSimpleHtml(content: string): string {
  const escaped = escapeHtml(content);
  const withBreaks = escaped.replace(/\n/g, "<br>");
  return `<div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">${withBreaks}</div>`;
}

async function sendNotificationEmails(ctx: any, args: {
  title: string;
  content: string;
  recipientUserIds?: Id<"users">[];
}) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    throw new Error("Resend API key (AUTH_RESEND_KEY) is not configured");
  }

  // Get system settings (app name + from address)
  const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
  const appName = settings.appName || "Galaxy Classification App";
  const emailFrom = settings.emailFrom || "noreply@galaxies.michalvrabel.sk";
  const fromWithName = `${appName} <${emailFrom}>`;

  // Fetch eligible users (active + confirmed) and pick recipients
  const selectableUsers = await ctx.runQuery(api.notifications.getUsersForSelection);
  const recipients = args.recipientUserIds?.length
    ? selectableUsers.filter((u: { id: Id<"users"> }) => args.recipientUserIds!.some((id) => id === u.id))
    : selectableUsers;

  const toEmails = Array.from(new Set(recipients.map((r: any) => r.email).filter(Boolean)));
  if (toEmails.length === 0) {
    throw new Error("No recipients with valid email addresses found");
  }

  const htmlBody = markdownToSimpleHtml(args.content);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromWithName,
      to: toEmails,
      subject: `${appName} - ${args.title}`,
      text: args.content,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="color: #0f172a;">${escapeHtml(args.title)}</h2>
          ${htmlBody}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px; margin: 0;">Sent by ${escapeHtml(appName)}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Resend API returned ${res.status}: ${errorText}`);
  }
}

// Get all notifications for the current user (sorted by newest first)
export const getUserNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return [];

    // Get all notifications
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    // Filter to notifications that are either:
    // 1. For all users (recipientUserIds is undefined or empty)
    // 2. Specifically for this user
    const userNotifications = allNotifications.filter((n) => {
      if (!n.recipientUserIds || n.recipientUserIds.length === 0) {
        return true; // For all users
      }
      return n.recipientUserIds.includes(userId);
    });

    // Get read status for each notification
    const readRecords = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const readNotificationIds = new Set(
      readRecords.map((r) => r.notificationId)
    );

    // Enrich with read status and creator info
    const enrichedNotifications = await Promise.all(
      userNotifications.map(async (notification) => {
        const creator = await ctx.db.get(notification.createdBy);
        return {
          ...notification,
          isRead: readNotificationIds.has(notification._id),
          creatorName: creator?.name || creator?.email || "Admin",
        };
      })
    );

    return enrichedNotifications;
  },
});

// Get count of unread notifications for the current user
export const getUnreadNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return 0;

    // Get all notifications
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_created_at")
      .collect();

    // Filter to notifications for this user
    const userNotifications = allNotifications.filter((n) => {
      if (!n.recipientUserIds || n.recipientUserIds.length === 0) {
        return true;
      }
      return n.recipientUserIds.includes(userId);
    });

    // Get read notifications for this user
    const readRecords = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const readNotificationIds = new Set(
      readRecords.map((r) => r.notificationId)
    );

    // Count unread
    const unreadCount = userNotifications.filter(
      (n) => !readNotificationIds.has(n._id)
    ).length;

    return unreadCount;
  },
});

// Mark a notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Check if already read
    const existing = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_user_notification", (q) =>
        q.eq("userId", userId).eq("notificationId", args.notificationId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("userNotificationReads", {
        userId,
        notificationId: args.notificationId,
        readAt: Date.now(),
      });
    }
  },
});

// Mark a notification as unread (remove read record)
export const markAsUnread = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_user_notification", (q) =>
        q.eq("userId", userId).eq("notificationId", args.notificationId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Mark all notifications as read
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    // Get all notifications for this user
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_created_at")
      .collect();

    const userNotifications = allNotifications.filter((n) => {
      if (!n.recipientUserIds || n.recipientUserIds.length === 0) {
        return true;
      }
      return n.recipientUserIds.includes(userId);
    });

    // Get already read notifications
    const readRecords = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const readNotificationIds = new Set(
      readRecords.map((r) => r.notificationId)
    );

    // Mark unread ones as read
    const now = Date.now();
    for (const notification of userNotifications) {
      if (!readNotificationIds.has(notification._id)) {
        await ctx.db.insert("userNotificationReads", {
          userId,
          notificationId: notification._id,
          readAt: now,
        });
      }
    }
  },
});

// ============ Admin functions ============

// Get all notifications (admin only)
export const getAllNotifications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    // Enrich with creator info and recipient count
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        const creator = await ctx.db.get(notification.createdBy);
        
        // Count how many users have read this notification
        const readRecords = await ctx.db
          .query("userNotificationReads")
          .withIndex("by_notification", (q) => q.eq("notificationId", notification._id))
          .collect();

        return {
          ...notification,
          creatorName: creator?.name || creator?.email || "Unknown",
          creatorEmail: creator?.email || "Unknown",
          readCount: readRecords.length,
          recipientCount: notification.recipientUserIds?.length || "All users",
        };
      })
    );

    return enrichedNotifications;
  },
});

// Insert notification (admin only) - used internally by the action
export const insertNotification = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    sendEmail: v.optional(v.boolean()),
    recipientUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    return await ctx.db.insert("notifications", {
      title: args.title.trim(),
      content: args.content.trim(),
      createdBy: userId,
      createdAt: Date.now(),
      sendEmail: args.sendEmail ?? false,
      recipientUserIds: args.recipientUserIds,
    });
  },
});

// Create a new notification and optionally send emails (admin only)
export const createNotification = action({
  args: {
    title: v.string(),
    content: v.string(),
    sendEmail: v.optional(v.boolean()),
    recipientUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ notificationId: Id<"notifications">; emailSent: boolean; emailError?: string }> => {
    const profile = await ctx.runQuery(api.users.getUserProfile);
    if (!profile || profile.role !== "admin") {
      throw new Error("Admin access required");
    }

    const notificationId = await ctx.runMutation(api.notifications.insertNotification, args);

    let emailError: string | undefined;
    let emailSent = false;

    if (args.sendEmail) {
      try {
        await sendNotificationEmails(ctx, {
          title: args.title.trim(),
          content: args.content.trim(),
          recipientUserIds: args.recipientUserIds,
        });
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : String(error);
        console.error("Failed to send notification emails:", error);
      }
    }

    return { notificationId, emailSent, emailError };
  },
});

// Delete a notification (admin only)
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Delete all read records for this notification
    const readRecords = await ctx.db
      .query("userNotificationReads")
      .withIndex("by_notification", (q) => q.eq("notificationId", args.notificationId))
      .collect();

    for (const record of readRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete the notification
    await ctx.db.delete(args.notificationId);
  },
});

// Get all users for recipient selection (admin only)
export const getUsersForSelection = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const userProfiles = await ctx.db.query("userProfiles").collect();

    const users = await Promise.all(
      userProfiles
        .filter((p) => p.isConfirmed && p.isActive)
        .map(async (profile) => {
          const user = await ctx.db.get(profile.userId);
          return {
            id: profile.userId,
            name: user?.name || user?.email || "Unknown",
            email: user?.email || "Unknown",
          };
        })
    );

    return users.sort((a, b) => a.name.localeCompare(b.name));
  },
});
