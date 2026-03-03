import { query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { getTopClassifiers } from "./shared";

export const get = query({
  args: {},
  returns: v.object({
    topClassifiers: v.array(v.object({
      userId: v.string(),
      profileId: v.string(),
      name: v.optional(v.union(v.string(), v.null())),
      email: v.optional(v.union(v.string(), v.null())),
      classifications: v.number(),
      lastActiveAt: v.optional(v.number()),
    })),
    timestamp: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Not authorized" });
    const topClassifiers = await getTopClassifiers(ctx, 5);
    return {
      topClassifiers,
      timestamp: Date.now(),
    };
  },
});
