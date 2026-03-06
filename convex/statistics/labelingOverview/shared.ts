import { Id } from "../../_generated/dataModel";
import { DEFAULT_AVAILABLE_PAPERS } from "../../lib/defaults";
import { galaxiesByPaper, userProfilesByClassificationsCount } from "../../galaxies/aggregates";

const BLACKLIST_LOOKUP_BATCH_SIZE = 200;
export const DAY_MS = 24 * 60 * 60 * 1000;

export async function mapBlacklistedIdsToPaper(
  ctx: any,
  externalIds: string[]
): Promise<Record<string, string>> {
  const paperByExternalId: Record<string, string> = {};

  for (let i = 0; i < externalIds.length; i += BLACKLIST_LOOKUP_BATCH_SIZE) {
    const batch = externalIds.slice(i, i + BLACKLIST_LOOKUP_BATCH_SIZE);
    const resolved = await Promise.all(
      batch.map(async (externalId) => {
        const galaxy = await ctx.db
          .query("galaxies")
          .withIndex("by_external_id", (q: any) => q.eq("id", externalId))
          .unique();
        return {
          externalId,
          paper: galaxy ? (galaxy.misc?.paper ?? "") : "",
        };
      })
    );

    for (const entry of resolved) {
      paperByExternalId[entry.externalId] = entry.paper;
    }
  }

  return paperByExternalId;
}

export async function getTopClassifiers(ctx: any, limit: number) {
  const totalProfiles = await userProfilesByClassificationsCount.count(ctx);
  const take = Math.min(limit, totalProfiles);
  if (take <= 0) {
    return [];
  }

  const profileSlots = await Promise.all(
    Array.from({ length: take }, (_, idx) =>
      userProfilesByClassificationsCount.at(ctx, totalProfiles - 1 - idx)
    )
  );

  const profiles = await Promise.all(
    profileSlots.map((item) => ctx.db.get(item.id as Id<"userProfiles">))
  );

  const users = await Promise.all(
    profiles.map((profile) => (profile ? ctx.db.get(profile.userId) : null))
  );

  const results: Array<{
    userId: Id<"users">;
    profileId: Id<"userProfiles">;
    name?: string | null;
    classifications: number;
    lastActiveAt?: number;
  }> = [];

  for (let i = 0; i < take; i++) {
    const profile = profiles[i];
    if (!profile) continue;
    const user = users[i];
    results.push({
      userId: profile.userId,
      profileId: profile._id,
      name: (user as any)?.name ?? null,
      classifications: profile.classificationsCount,
      lastActiveAt: profile.lastActiveAt,
    });
  }

  return results;
}

export async function getAvailablePapers(ctx: any): Promise<string[]> {
  const availablePapersSetting = await ctx.db
    .query("systemSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "availablePapers"))
    .unique();

  const availablePapers: string[] = Array.isArray((availablePapersSetting as any)?.value)
    ? (((availablePapersSetting as any).value as unknown[]).filter((p): p is string => typeof p === "string"))
    : DEFAULT_AVAILABLE_PAPERS;

  return availablePapers.includes("") ? availablePapers : ["", ...availablePapers];
}

export async function getPaperCountsPayload(ctx: any, selectedPaper: string | undefined) {
  const [allPapers, rawBlacklistRows] = await Promise.all([
    getAvailablePapers(ctx),
    ctx.db.query("galaxyBlacklist").collect(),
  ]);

  const blacklistRows: Array<{ galaxyExternalId: string }> =
    rawBlacklistRows as Array<{ galaxyExternalId: string }>;

  const uniqueBlacklistedExternalIds = Array.from(
    new Set(blacklistRows.map((row) => row.galaxyExternalId))
  );
  const paperByBlacklistedExternalId = await mapBlacklistedIdsToPaper(
    ctx,
    uniqueBlacklistedExternalIds
  );

  const blacklistedPerPaper: Record<string, number> = {};
  for (const row of blacklistRows) {
    const paper = paperByBlacklistedExternalId[row.galaxyExternalId] ?? "";
    blacklistedPerPaper[paper] = (blacklistedPerPaper[paper] ?? 0) + 1;
  }

  const paperCountsRaw = await Promise.all(
    allPapers.map(async (paper) => {
      const total = await galaxiesByPaper.count(ctx, {
        bounds: {
          lower: { key: paper, inclusive: true },
          upper: { key: paper, inclusive: true },
        },
      });
      const blacklisted = blacklistedPerPaper[paper] ?? 0;
      return { paper, total, blacklisted, adjusted: Math.max(total - blacklisted, 0) };
    })
  );

  const paperCounts: Record<string, { total: number; blacklisted: number; adjusted: number }> = {};
  for (const entry of paperCountsRaw) {
    paperCounts[entry.paper] = {
      total: entry.total,
      blacklisted: entry.blacklisted,
      adjusted: entry.adjusted,
    };
  }

  let paperFilter: {
    paper: string;
    galaxies: number;
    blacklisted: number;
    adjusted: number;
  } | null = null;

  if (selectedPaper !== undefined) {
    const cached = paperCounts[selectedPaper];
    if (cached) {
      paperFilter = {
        paper: selectedPaper,
        galaxies: cached.total,
        blacklisted: cached.blacklisted,
        adjusted: cached.adjusted,
      };
    } else {
      const count = await galaxiesByPaper.count(ctx, {
        bounds: {
          lower: { key: selectedPaper, inclusive: true },
          upper: { key: selectedPaper, inclusive: true },
        },
      });
      const bl = blacklistedPerPaper[selectedPaper] ?? 0;
      paperFilter = {
        paper: selectedPaper,
        galaxies: count,
        blacklisted: bl,
        adjusted: Math.max(count - bl, 0),
      };
    }
  }

  return {
    availablePapers: allPapers,
    paperCounts,
    paperFilter,
  };
}
