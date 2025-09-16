import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";


// Generate mock galaxies (admin only)

export const generateMockGalaxies = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Generate 100 mock galaxies (minimal nested structures matching schema)
    const mockGalaxies = [] as any[];
    for (let i = 1; i <= 100; i++) {
      mockGalaxies.push({
        id: `mock_galaxy_${i.toString().padStart(3, '0')}`,
        ra: Number((Math.random() * 360).toFixed(5)),
        dec: Number(((Math.random() - 0.5) * 180).toFixed(5)),
        reff: Number((Math.random() * 10 + 1).toFixed(3)),
        q: Number((Math.random() * 0.8 + 0.2).toFixed(3)),
        pa: Number((Math.random() * 180).toFixed(2)),
        nucleus: Math.random() > 0.5,
        photometry: {
          g: { sersic: {}, source_extractor: {} },
          r: { sersic: {}, source_extractor: {} },
          i: { sersic: {}, source_extractor: {} },
        },
        misc: {},
        thuruthipilly: {},
      });
    }

    // Insert all mock galaxies safely (skip existing ids)
    for (const galaxy of mockGalaxies) {
      const existing = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
        .unique();
      if (!existing) {
        await ctx.db.insert("galaxies", galaxy);
      }
    }

    return {
      success: true,
      message: `Generated ${mockGalaxies.length} mock galaxies`
    };
  },
});
