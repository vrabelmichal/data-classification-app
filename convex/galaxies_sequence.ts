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
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { galaxyIdsAggregate } from "./galaxies_aggregates";
import { requireAdmin, requireUserId } from "./lib/auth";



export const generateRandomUserSequence = mutation({
    args: {
        targetUserId: v.optional(v.id("users")),
        sequenceSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await requireUserId(ctx);

        const targetUserId = args.targetUserId || userId;
        const requestedSize = args.sequenceSize || 50;
        const MAX_SEQUENCE = 500000;
        const sequenceSize = Math.min(Math.max(1, requestedSize), MAX_SEQUENCE);

        if (targetUserId !== userId) {
            await requireAdmin(ctx);
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


export const userHasSequence = query({
    args: {
        userId: v.optional(v.id("users")),
    },
    handler: async (ctx, args) => {
        const currentUserId = await requireUserId(ctx);

        const targetUserId = args.userId || currentUserId;

        // Admin check if checking another user
        if (targetUserId !== currentUserId) {
            await requireAdmin(ctx);
        }

        const sequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", targetUserId))
            .unique();

        return !!sequence;
    },
});


export const removeUserSequence = mutation({
    args: {
        targetUserId: v.id("users"),
        batchSize: v.optional(v.number()),
        batchIndex: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await requireUserId(ctx);

        const targetUserId = args.targetUserId;
        const batchSize = args.batchSize || 500;
        const batchIndex = args.batchIndex || 0;

        // Admin check - only admins can remove sequences
        await requireAdmin(ctx);

        // Get the user's sequence
        const sequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", targetUserId))
            .unique();

        if (!sequence) {
            throw new Error("User does not have a sequence");
        }

        const totalGalaxies = sequence.galaxyExternalIds?.length || 0;
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalGalaxies);
        const batchGalaxies = sequence.galaxyExternalIds?.slice(startIndex, endIndex) || [];
        const totalBatches = Math.ceil(totalGalaxies / batchSize);
        const isLastBatch = endIndex >= totalGalaxies;

        console.log(`Processing batch ${batchIndex + 1} of ${totalBatches}, galaxies ${startIndex}-${endIndex - 1} (${batchGalaxies.length} galaxies)`);

        // Process this batch
        let processed = 0;
        for (const galaxyExternalId of batchGalaxies) {
            // Find the galaxy by external ID
            const galaxy = await ctx.db
                .query("galaxies")
                .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
                .unique();

            if (galaxy) {
                // Update totalAssigned and perUser counters
                const perUser = { ...(galaxy.perUser ?? {}) };
                const prevUserCount = perUser[targetUserId] ?? BigInt(0);

                if (prevUserCount > BigInt(0)) {
                    // Remove this user from perUser
                    delete perUser[targetUserId];

                    // Decrement totalAssigned
                    const newTotalAssigned = (galaxy.totalAssigned ?? BigInt(0)) - prevUserCount;

                    await ctx.db.patch(galaxy._id, {
                        totalAssigned: newTotalAssigned,
                        perUser: Object.keys(perUser).length > 0 ? perUser : undefined,
                    });
                }
            } else {
                console.log(`Galaxy ${galaxyExternalId} not found, skipping`);
            }
            processed++;
        }

        console.log(`Completed batch ${batchIndex + 1} of ${totalBatches}, processed ${processed} galaxies`);

        // If this is the last batch, clean up
        if (isLastBatch) {
            // Delete the sequence
            await ctx.db.delete(sequence._id);

            // Update user profile if needed
            const userProfile = await ctx.db
                .query("userProfiles")
                .withIndex("by_user", (q) => q.eq("userId", targetUserId))
                .unique();
            if (userProfile && userProfile.sequenceGenerated) {
                await ctx.db.patch(userProfile._id, { sequenceGenerated: false });
            }

            console.log(`Successfully removed sequence for user ${targetUserId} with ${totalGalaxies} galaxies`);
        }

        return {
            success: true,
            message: isLastBatch
                ? `Removed sequence with ${totalGalaxies} galaxies`
                : `Processed batch ${batchIndex + 1}/${totalBatches} (${processed} galaxies)`,
            batchIndex,
            totalBatches,
            processedInBatch: processed,
            totalProcessed: endIndex,
            totalGalaxies,
            isLastBatch,
            galaxiesRemoved: isLastBatch ? totalGalaxies : undefined,
        };
    },
});


export const getUsersWithSequences = query({
    handler: async (ctx) => {
        await requireAdmin(ctx);

        // Get all sequences
        const sequences = await ctx.db.query("galaxySequences").collect();

        // Get user profiles for users with sequences
        const usersWithSequences = await Promise.all(
            sequences.map(async (sequence) => {
                const userProfile = await ctx.db
                    .query("userProfiles")
                    .withIndex("by_user", (q) => q.eq("userId", sequence.userId))
                    .unique();

                if (userProfile) {
                    // Get user information
                    const user = await ctx.db.get(sequence.userId);
                    
                    return {
                        ...userProfile,
                        user: user ? {
                            name: user.name,
                            email: user.email,
                        } : null,
                        sequenceInfo: {
                            galaxyCount: sequence.galaxyExternalIds?.length || 0,
                            currentIndex: sequence.currentIndex,
                            numClassified: sequence.numClassified,
                            numSkipped: sequence.numSkipped,
                        }
                    };
                }
                return null;
            })
        );

        return usersWithSequences.filter(user => user !== null);
    },
});


export const getUsersWithoutSequences = query({
    handler: async (ctx) => {
        await requireAdmin(ctx);

        // Get all user profiles
        const allUserProfiles = await ctx.db.query("userProfiles").collect();

        // Get all users with sequences
        const sequences = await ctx.db.query("galaxySequences").collect();
        const usersWithSequences = new Set(sequences.map(seq => seq.userId));

        // Filter to users without sequences
        const usersWithoutSequences = await Promise.all(
            allUserProfiles
                .filter(profile => !usersWithSequences.has(profile.userId))
                .map(async (profile) => {
                    // Get user information
                    const user = await ctx.db.get(profile.userId);
                    
                    return {
                        ...profile,
                        user: user ? {
                            name: user.name,
                            email: user.email,
                        } : null,
                    };
                })
        );

        return usersWithoutSequences;
    },
});

