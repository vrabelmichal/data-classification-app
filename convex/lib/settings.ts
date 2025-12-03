import type { QueryCtx, MutationCtx } from "../_generated/server";

type SettingsContext = QueryCtx | MutationCtx;

/**
 * Get the default image quality from system settings.
 * Falls back to "high" if not configured.
 */
export async function getDefaultImageQuality(
  ctx: SettingsContext
): Promise<"high" | "medium" | "low"> {
  const setting = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q) => q.eq("key", "defaultImageQuality"))
    .unique();

  // Return the system setting value, or "high" as the hardcoded fallback
  return (setting?.value as "high" | "low") || "high";
}
