import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";


type AuthContext = QueryCtx | MutationCtx;

type RequireUserProfileOptions = {
  authMessage?: string;
  missingProfileMessage?: string;
};

type RequireConfirmedOptions = RequireUserProfileOptions & {
  notConfirmedMessage?: string;
};

type RequireAdminOptions = RequireUserProfileOptions & {
  notAdminMessage?: string;
};

async function fetchUserProfile(
  ctx: AuthContext,
  userId: Id<"users">
): Promise<Doc<"userProfiles"> | null> {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function getOptionalUserId(ctx: AuthContext) {
  return await getAuthUserId(ctx);
}

export async function requireUserId(
  ctx: AuthContext,
  message = "Not authenticated"
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error(message);
  }
  return userId;
}

export async function requireUserProfile(
  ctx: AuthContext,
  options: RequireUserProfileOptions = {}
) {
  const userId = await requireUserId(ctx, options.authMessage);
  const profile = await fetchUserProfile(ctx, userId);
  if (!profile) {
    throw new Error(options.missingProfileMessage ?? "User profile not found");
  }
  return { userId, profile };
}

export async function requireConfirmedUser(
  ctx: AuthContext,
  options: RequireConfirmedOptions = {}
) {
  const { userId, profile } = await requireUserProfile(ctx, options);
  if (!profile.isConfirmed) {
    throw new Error(options.notConfirmedMessage ?? "Account not confirmed");
  }
  return { userId, profile };
}

export async function requireAdmin(
  ctx: AuthContext,
  options: RequireAdminOptions = {}
) {
  const { userId, profile } = await requireUserProfile(ctx, options);
  if (profile.role !== "admin") {
    throw new Error(options.notAdminMessage ?? "Admin access required");
  }
  return { userId, profile };
}
