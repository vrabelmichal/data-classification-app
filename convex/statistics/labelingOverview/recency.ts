import { query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { requirePermission } from "../../lib/auth";
import { classificationsByCreated, userProfilesByClassificationsCount, userProfilesByLastActive } from "../../galaxies/aggregates";
import { DAY_MS } from "./shared";

export async function loadRecencyStats(ctx: Parameters<typeof classificationsByCreated.count>[0]) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;
  const oneDayAgo = now - DAY_MS;

  const [
    classificationsLast7d,
    classificationsLast24h,
    activeClassifiers,
    activePast7d,
    dailyCounts,
  ] = await Promise.all([
    classificationsByCreated.count(ctx, {
      bounds: {
        lower: { key: sevenDaysAgo, inclusive: true },
        upper: { key: now, inclusive: true },
      },
    }),
    classificationsByCreated.count(ctx, {
      bounds: {
        lower: { key: oneDayAgo, inclusive: true },
        upper: { key: now, inclusive: true },
      },
    }),
    userProfilesByClassificationsCount.count(ctx, {
      bounds: { lower: { key: 1, inclusive: true } },
    }),
    userProfilesByLastActive.count(ctx, {
      bounds: { lower: { key: sevenDaysAgo, inclusive: true } },
    }),
    Promise.all(
      Array.from({ length: 7 }, (_, idx) => {
        const start = now - (idx + 1) * DAY_MS;
        const end = now - idx * DAY_MS;
        return classificationsByCreated.count(ctx, {
          bounds: {
            lower: { key: start, inclusive: true },
            upper: { key: end, inclusive: false },
          },
        }).then((count) => ({ start, end, count }));
      })
    ),
  ]);

  return {
    classificationsLast7d,
    classificationsLast24h,
    activeClassifiers,
    activePast7d,
    dailyCounts: dailyCounts.reverse(),
  };
}

export const get = query({
  args: {},
  returns: v.object({
    recency: v.object({
      classificationsLast7d: v.number(),
      classificationsLast24h: v.number(),
      activeClassifiers: v.number(),
      activePast7d: v.number(),
      dailyCounts: v.array(v.object({
        start: v.number(),
        end: v.number(),
        count: v.number(),
      })),
    }),
    timestamp: v.number(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "viewLiveOverviewStatistics", {
      notAuthorizedMessage: "Not authorized",
    });
    const now = Date.now();
    const recency = await loadRecencyStats(ctx);

    return {
      recency,
      timestamp: now,
    };
  },
});
