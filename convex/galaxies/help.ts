import { query } from "../_generated/server";
import { loadMergedSystemSettings } from "../system_settings";

export const getDocumentationExampleGalaxy = query({
  args: {},
  handler: async (ctx) => {
    const mergedSettings = await loadMergedSystemSettings(ctx);
    const configuredExternalId = String(mergedSettings.helpExamplesGalaxyExternalId ?? "").trim();

    if (configuredExternalId.length > 0) {
      const configuredGalaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", configuredExternalId))
        .unique();

      if (configuredGalaxy) {
        return {
          galaxy: configuredGalaxy,
          source: "configured",
          configuredExternalId,
        } as const;
      }
    }

    const blacklistedRows = await ctx.db.query("galaxyBlacklist").collect();
    const blacklistedIds = new Set(blacklistedRows.map((row) => row.galaxyExternalId));

    const numericIterator = ctx.db
      .query("galaxies")
      .withIndex("by_numeric_id")
      [Symbol.asyncIterator]();

    while (true) {
      const next = await numericIterator.next();
      if (next.done) {
        break;
      }

      const galaxy = next.value;
      if (!blacklistedIds.has(galaxy.id)) {
        return {
          galaxy,
          source: configuredExternalId.length > 0 ? "fallback_after_missing_configured" : "automatic",
          configuredExternalId: configuredExternalId || null,
        } as const;
      }
    }

    const fallbackBatch = await ctx.db.query("galaxies").take(100);
    const firstNonBlacklisted = fallbackBatch.find((galaxy) => !blacklistedIds.has(galaxy.id)) ?? null;

    if (firstNonBlacklisted) {
      return {
        galaxy: firstNonBlacklisted,
        source: configuredExternalId.length > 0 ? "fallback_after_missing_configured" : "automatic",
        configuredExternalId: configuredExternalId || null,
      } as const;
    }

    return {
      galaxy: null,
      source: configuredExternalId.length > 0 ? "configured_missing" : "none_available",
      configuredExternalId: configuredExternalId || null,
    } as const;
  },
});