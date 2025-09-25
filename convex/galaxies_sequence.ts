/*
Note for the future: 
how to select a random sample from all rows of a table when table has million rows and many columns?
You can do this efficiently with the Aggregate component, which lets you pick documents by offset in O(log n) time without scanning the whole table. Set up a TableAggregate without a sort key to get a randomized-by-id ordering, then use count() to get N and at(ctx, i) to fetch specific random offsets.

Example approach:

Create a TableAggregate for your table with sortKey: () => null (no sort), which orders by _id (effectively random). [Example use-cases]
Get the total count via aggregate.count(ctx).
Generate K random offsets in [0, count).
For each offset, use aggregate.at(ctx, offset) to get the document id, then ctx.db.get(id) to fetch the doc. This avoids reading all rows and works at million-row scale. [More examples]
This pattern is also recommended in support threads for fetching random subsets without collect() and for randomization at scale. [Random subset thread; Support thread cont.]

Maintenance / Backfill:
This mutation relies on galaxiesAggregate containing every document in the galaxies table.
Ensure that every insert/update/delete of a galaxy also calls galaxiesAggregate.insert/replace/delete
(or a trigger) so counts and offsets stay correct. If the aggregate was added after data import,
run a one-off backfill mutation that paginates through galaxies and calls
await galaxiesAggregate.insertIfDoesNotExist(ctx, doc) for each. If desynchronized,
you can clear and rebuild with galaxiesAggregate.clear(ctx) followed by backfill.
*/
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { galaxyIdsAggregate } from "./galaxies_aggregates";



export const generateRandomUserSequence = mutation({
    args: {
        targetUserId: v.optional(v.id("users")),
        sequenceSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const targetUserId = args.targetUserId || userId;
        const requestedSize = args.sequenceSize || 50;
        const MAX_SEQUENCE = 500000;
        const sequenceSize = Math.min(Math.max(1, requestedSize), MAX_SEQUENCE);

        if (targetUserId !== userId) {
            const currentProfile = await ctx.db
                .query("userProfiles")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .unique();
            if (!currentProfile || currentProfile.role !== "admin") {
                throw new Error("Admin access required");
            }
        }
        
        // Obtain total count via aggregate (O(log n)). If zero, bail.
        const totalGalaxies = await galaxyIdsAggregate.count(ctx);
        if (totalGalaxies === 0) throw new Error("No galaxies available");
        
        // Cap fetch window for performance.
        const OVERSAMPLE_FACTOR = 5;
        const MAX_FETCH = 50000;
        const fetchLimit = Math.min(sequenceSize * OVERSAMPLE_FACTOR, MAX_FETCH);
        // Pick random start offset so that we have at most fetchLimit docs ahead.
        const maxStart = Math.max(0, totalGalaxies - fetchLimit);
        const startOffset = Math.floor(Math.random() * (maxStart + 1));

        console.log(`Total galaxies: ${totalGalaxies}, Fetch limit: ${fetchLimit}, Start offset: ${startOffset}`);

        // Aggregate is defined with Key = _id (string ordering). Use at() to get starting document id.
        const galaxyIdAtOffsetAggregate = await galaxyIdsAggregate.at(ctx, startOffset);

        console.log(`Starting document ID at offset ${startOffset}: ${galaxyIdAtOffsetAggregate.id}, numericId: ${galaxyIdAtOffsetAggregate.key}`);

        // pull ids using the aggregate, then sort using numericId (bigint)
        const galaxyExternalIds = (
            await ctx.db
            .query("galaxyIds")
            .withIndex("by_numeric_id", (q) => q.gte("numericId", galaxyIdAtOffsetAggregate.key))
            .take(fetchLimit)
        ).map((r) => r.id);

        console.log(`Fetched ${galaxyExternalIds.length} candidate galaxy external IDs from offset ${startOffset}`);
        // log first 10 ids
        console.log("First 10 candidate external IDs:", galaxyExternalIds.slice(0, 10));

        // Shuffle candidate external IDs (Fisher-Yates)
        for (let i = galaxyExternalIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [galaxyExternalIds[i], galaxyExternalIds[j]] = [galaxyExternalIds[j], galaxyExternalIds[i]];
        }
        const chosenGalaxyExternalIds = galaxyExternalIds.slice(0, Math.min(sequenceSize, galaxyExternalIds.length));

        console.log(`Chosen ${chosenGalaxyExternalIds.length} galaxy external IDs for the sequence`);
        console.log("First 10 chosen external IDs:", chosenGalaxyExternalIds.slice(0, 10));


        let success = false;

        if (chosenGalaxyExternalIds.length > 0) {
            // Remove existing sequence
            const existingSequence = await ctx.db
                .query("galaxySequences")
                .withIndex("by_user", (q) => q.eq("userId", targetUserId))
                .unique();
            if (existingSequence) await ctx.db.delete(existingSequence._id);

            await ctx.db.insert("galaxySequences", {
                userId: targetUserId,
                galaxyExternalIds: chosenGalaxyExternalIds,
                currentIndex: 0,
                numClassified: 0,
                numSkipped: 0,
            });

            const userProfile = await ctx.db
                .query("userProfiles")
                .withIndex("by_user", (q) => q.eq("userId", targetUserId))
                .unique();
            if (userProfile) 
                await ctx.db.patch(userProfile._id, { sequenceGenerated: true });
            success = true;
        }

        return {
            success: success,
            message: success
            ? `Generated sequence of ${chosenGalaxyExternalIds.length} galaxy external IDs (requested ${sequenceSize})`
            : "No galaxy external IDs generated",
            requested: sequenceSize,
            generated: chosenGalaxyExternalIds.length,
            fetchLimitUsed: fetchLimit,
            startOffset,
            totalGalaxies,
            windowEndExclusive: startOffset + fetchLimit,
            aggregateUsed: true,
            keyUsed: galaxyIdAtOffsetAggregate.id,
            note: totalGalaxies > fetchLimit
            ? "Random contiguous window sampled; for fully uniform sample consider multi-offset strategy or reservoir sampling over multiple invocations."
            : undefined,
        };
  },
});

