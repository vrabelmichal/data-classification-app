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
import { mutation, query } from "../_generated/server";
import { galaxyIdsAggregate } from "./aggregates";
import { requireAdmin, requireUserId } from "../lib/auth";


const hasSequenceProgress = (sequence: {
    currentIndex: number;
    numClassified: number;
    numSkipped: number;
}) => {
    return (
        (sequence.currentIndex ?? 0) > 0 ||
        (sequence.numClassified ?? 0) > 0 ||
        (sequence.numSkipped ?? 0) > 0
    );
};

const getSequenceProcessedDetails = async (
    ctx: any,
    userId: string,
    sequenceGalaxyExternalIds: string[],
    fallbackCurrentIndex: number
) => {
    if (sequenceGalaxyExternalIds.length === 0) {
        return {
            processedGalaxyExternalIds: [] as string[],
            remainingGalaxyExternalIds: [] as string[],
            classifiedCount: 0,
            skippedCount: 0,
            processedCount: 0,
        };
    }

    const sequenceIdSet = new Set(sequenceGalaxyExternalIds);

    const [classifiedRecords, skippedRecords] = await Promise.all([
        ctx.db
            .query("classifications")
            .withIndex("by_user", (q: any) => q.eq("userId", userId))
            .collect(),
        ctx.db
            .query("skippedGalaxies")
            .withIndex("by_user", (q: any) => q.eq("userId", userId))
            .collect(),
    ]);

    const processedSet = new Set<string>();

    let classifiedCount = 0;
    for (const record of classifiedRecords) {
        if (!sequenceIdSet.has(record.galaxyExternalId)) continue;
        classifiedCount++;
        processedSet.add(record.galaxyExternalId);
    }

    let skippedCount = 0;
    for (const record of skippedRecords) {
        if (!sequenceIdSet.has(record.galaxyExternalId)) continue;
        skippedCount++;
        processedSet.add(record.galaxyExternalId);
    }

    if (processedSet.size === 0 && fallbackCurrentIndex > 0) {
        const fallbackProcessedCount = Math.min(
            Math.max(0, Math.floor(fallbackCurrentIndex)),
            sequenceGalaxyExternalIds.length
        );

        for (let index = 0; index < fallbackProcessedCount; index++) {
            processedSet.add(sequenceGalaxyExternalIds[index]);
        }
    }

    const remainingGalaxyExternalIds = sequenceGalaxyExternalIds.filter(
        (galaxyExternalId) => !processedSet.has(galaxyExternalId)
    );

    return {
        processedGalaxyExternalIds: Array.from(processedSet),
        remainingGalaxyExternalIds,
        classifiedCount,
        skippedCount,
        processedCount: processedSet.size,
    };
};

const applyClampedDelta = (current: bigint, delta: number) => {
    const candidate = current + BigInt(delta);
    const next = candidate > BigInt(0) ? candidate : BigInt(0);
    return {
        next,
        appliedDelta: next - current,
    };
};



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


export const getSequenceMigrationPreflight = query({
    args: {
        sourceUserId: v.id("users"),
        targetUserId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const sourceUser = await ctx.db.get(args.sourceUserId);
        const targetUser = await ctx.db.get(args.targetUserId);

        const sourceSequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", args.sourceUserId))
            .unique();

        const targetSequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
            .unique();

        const sourceHasSequence = !!sourceSequence;
        const targetHasSequence = !!targetSequence;

        const sourceGalaxyIds = sourceSequence?.galaxyExternalIds ?? [];
        const targetGalaxyIds = targetSequence?.galaxyExternalIds ?? [];

        const sourceProgressDetails = sourceSequence
            ? await getSequenceProcessedDetails(
                ctx,
                args.sourceUserId,
                sourceGalaxyIds,
                sourceSequence.currentIndex ?? 0
            )
            : null;

        const targetProgressDetails = targetSequence
            ? await getSequenceProcessedDetails(
                ctx,
                args.targetUserId,
                targetGalaxyIds,
                targetSequence.currentIndex ?? 0
            )
            : null;

        const sourceHasProgress = sourceSequence
            ? sourceProgressDetails!.processedCount > 0 || hasSequenceProgress(sourceSequence)
            : false;
        const targetHasProgress = targetSequence
            ? targetProgressDetails!.processedCount > 0 || hasSequenceProgress(targetSequence)
            : false;

        const sourceRemainingGalaxyCount = sourceProgressDetails?.remainingGalaxyExternalIds.length ?? 0;
        const sourceProcessedGalaxyCount = sourceProgressDetails?.processedCount ?? 0;

        const baseBlockingReasons: string[] = [];

        if (args.sourceUserId === args.targetUserId) {
            baseBlockingReasons.push("Source and target users must be different.");
        }

        if (!sourceHasSequence) {
            baseBlockingReasons.push("Source user does not have a sequence.");
        }

        if (sourceHasSequence && sourceRemainingGalaxyCount === 0) {
            baseBlockingReasons.push(
                "Source sequence has no remaining galaxies to migrate."
            );
        }

        const noReplaceBlockingReasons = [...baseBlockingReasons];
        if (targetHasSequence) {
            noReplaceBlockingReasons.push("Target user already has a sequence.");
        }

        const replaceBlockingReasons = [...baseBlockingReasons];

        return {
            source: {
                userId: args.sourceUserId,
                name: sourceUser?.name ?? null,
                email: sourceUser?.email ?? null,
                hasSequence: sourceHasSequence,
                sequenceId: sourceSequence?._id ?? null,
                galaxyCount: sourceSequence?.galaxyExternalIds?.length ?? 0,
                currentIndex: sourceSequence?.currentIndex ?? 0,
                numClassified: sourceSequence?.numClassified ?? 0,
                numSkipped: sourceSequence?.numSkipped ?? 0,
                hasProgress: sourceHasProgress,
                processedGalaxyCount: sourceProcessedGalaxyCount,
                remainingGalaxyCount: sourceRemainingGalaxyCount,
            },
            target: {
                userId: args.targetUserId,
                name: targetUser?.name ?? null,
                email: targetUser?.email ?? null,
                hasSequence: targetHasSequence,
                sequenceId: targetSequence?._id ?? null,
                galaxyCount: targetSequence?.galaxyExternalIds?.length ?? 0,
                currentIndex: targetSequence?.currentIndex ?? 0,
                numClassified: targetSequence?.numClassified ?? 0,
                numSkipped: targetSequence?.numSkipped ?? 0,
                hasProgress: targetHasProgress,
                processedGalaxyCount: targetProgressDetails?.processedCount ?? 0,
                remainingGalaxyCount: targetProgressDetails?.remainingGalaxyExternalIds.length ?? 0,
            },
            canMigrateWithoutReplace: noReplaceBlockingReasons.length === 0,
            canMigrateWithReplace: replaceBlockingReasons.length === 0,
            noReplaceBlockingReasons,
            replaceBlockingReasons,
        };
    },
});


export const migrateUserSequenceBatch = mutation({
    args: {
        sourceUserId: v.id("users"),
        targetUserId: v.id("users"),
        replaceTargetSequence: v.optional(v.boolean()),
        batchIndex: v.number(),
        batchSize: v.optional(v.number()),
        sourceSequenceId: v.optional(v.id("galaxySequences")),
        targetSequenceId: v.optional(v.id("galaxySequences")),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const sourceUserId = args.sourceUserId;
        const targetUserId = args.targetUserId;
        const replaceTargetSequence = !!args.replaceTargetSequence;
        const requestedBatchIndex = Math.max(0, Math.floor(args.batchIndex));
        const batchSize = Math.max(1, Math.min(500, Math.floor(args.batchSize ?? 250)));

        const migrationStateKey = `sequence_migration:${sourceUserId}:${targetUserId}`;

        if (sourceUserId === targetUserId) {
            throw new Error("Source and target users must be different");
        }

        const sourceSequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", sourceUserId))
            .unique();

        if (!sourceSequence) {
            throw new Error("Source user does not have a sequence");
        }

        if (args.sourceSequenceId && sourceSequence._id !== args.sourceSequenceId) {
            throw new Error("Source sequence changed. Refresh and retry migration.");
        }

        const sourceGalaxyIds = sourceSequence.galaxyExternalIds ?? [];
        const sourceProgressDetails = await getSequenceProcessedDetails(
            ctx,
            sourceUserId,
            sourceGalaxyIds,
            sourceSequence.currentIndex ?? 0
        );

        const remainingSourceGalaxyIds = sourceProgressDetails.remainingGalaxyExternalIds;
        const sourceProgressToken = [
            sourceSequence.currentIndex ?? 0,
            sourceSequence.numClassified ?? 0,
            sourceSequence.numSkipped ?? 0,
            sourceProgressDetails.processedCount,
        ].join(":");

        if (remainingSourceGalaxyIds.length === 0) {
            throw new Error("Source sequence has no remaining galaxies to migrate.");
        }

        let existingMigrationStateDoc = await ctx.db
            .query("systemSettings")
            .withIndex("by_key", (q) => q.eq("key", migrationStateKey))
            .unique();

        let existingMigrationState = existingMigrationStateDoc?.value as {
            sourceSequenceId?: string;
            targetSequenceId?: string | null;
            replaceTargetSequence?: boolean;
            batchSize?: number;
            nextBatchIndex?: number;
            totalOperations?: number;
            totalBatches?: number;
            sourceGalaxyCount?: number;
            sourceRemainingGalaxyCount?: number;
            removedTargetGalaxyCount?: number;
            sourceProgressToken?: string;
            startedAt?: number;
            updatedAt?: number;
        } | undefined;

        let effectiveBatchIndex = requestedBatchIndex;

        if (existingMigrationStateDoc && existingMigrationState) {
            const stateSourceSequenceId = existingMigrationState.sourceSequenceId ?? null;
            const stateTargetSequenceId = existingMigrationState.targetSequenceId ?? null;
            const stateNextBatchIndex = Math.max(
                0,
                Math.floor(existingMigrationState.nextBatchIndex ?? 0)
            );

            const matchesCurrentRequest =
                stateSourceSequenceId === String(sourceSequence._id) &&
                stateTargetSequenceId === (args.targetSequenceId ? String(args.targetSequenceId) : null) &&
                !!existingMigrationState.replaceTargetSequence === replaceTargetSequence &&
                (existingMigrationState.sourceProgressToken ?? sourceProgressToken) === sourceProgressToken &&
                (existingMigrationState.sourceRemainingGalaxyCount ?? remainingSourceGalaxyIds.length) ===
                    remainingSourceGalaxyIds.length;

            if (!matchesCurrentRequest) {
                if (requestedBatchIndex === 0 && stateNextBatchIndex === 0) {
                    await ctx.db.delete(existingMigrationStateDoc._id);
                    existingMigrationStateDoc = null;
                    existingMigrationState = undefined;
                } else {
                    throw new Error(
                        "Stored migration state does not match current request. Complete or cancel the in-progress migration first."
                    );
                }
            }
        }

        if (existingMigrationStateDoc && existingMigrationState) {
            effectiveBatchIndex = Math.max(0, Math.floor(existingMigrationState.nextBatchIndex ?? 0));
        } else if (requestedBatchIndex > 0) {
            throw new Error("No migration state found. Start migration from batch 0.");
        }

        const targetSequence = await ctx.db
            .query("galaxySequences")
            .withIndex("by_user", (q) => q.eq("userId", targetUserId))
            .unique();

        const expectedTargetSequenceId = args.targetSequenceId ?? null;
        const actualTargetSequenceId = targetSequence?._id ?? null;

        if (effectiveBatchIndex > 0 && expectedTargetSequenceId !== actualTargetSequenceId) {
            throw new Error("Target sequence changed during migration. Refresh and retry.");
        }

        if (targetSequence) {
            if (!replaceTargetSequence) {
                throw new Error("Target user already has a sequence. Enable replace mode to continue.");
            }

            if (args.targetSequenceId && targetSequence._id !== args.targetSequenceId) {
                throw new Error("Target sequence changed. Refresh and retry migration.");
            }
        } else if (args.targetSequenceId) {
            throw new Error("Target sequence changed. Refresh and retry migration.");
        }

        const targetGalaxyIdsToRemove =
            replaceTargetSequence && targetSequence
                ? (targetSequence.galaxyExternalIds ?? [])
                : [];

        const deltasByGalaxy = new Map<string, { sourceDelta: number; targetDelta: number }>();

        for (const galaxyExternalId of sourceGalaxyIds) {
            const existing = deltasByGalaxy.get(galaxyExternalId) ?? { sourceDelta: 0, targetDelta: 0 };
            existing.sourceDelta -= 1;
            deltasByGalaxy.set(galaxyExternalId, existing);
        }

        for (const galaxyExternalId of remainingSourceGalaxyIds) {
            const existing = deltasByGalaxy.get(galaxyExternalId) ?? { sourceDelta: 0, targetDelta: 0 };
            existing.targetDelta += 1;
            deltasByGalaxy.set(galaxyExternalId, existing);
        }

        for (const galaxyExternalId of targetGalaxyIdsToRemove) {
            const existing = deltasByGalaxy.get(galaxyExternalId) ?? { sourceDelta: 0, targetDelta: 0 };
            existing.targetDelta -= 1;
            deltasByGalaxy.set(galaxyExternalId, existing);
        }

        const operations = Array.from(deltasByGalaxy.entries()).map(([galaxyExternalId, delta]) => ({
            galaxyExternalId,
            ...delta,
        }));

        const totalOperations = operations.length;
        const totalBatches = Math.max(1, Math.ceil(totalOperations / batchSize));
        const startIndex = effectiveBatchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalOperations);

        if (totalOperations > 0 && startIndex >= totalOperations) {
            throw new Error("Batch index is out of range for this migration.");
        }

        const batchOperations = operations.slice(startIndex, endIndex);
        const isLastBatch = totalOperations === 0 ? true : endIndex >= totalOperations;

        let processedInBatch = 0;
        let patchedGalaxies = 0;

        if (!existingMigrationStateDoc) {
            await ctx.db.insert("systemSettings", {
                key: migrationStateKey,
                value: {
                    sourceSequenceId: String(sourceSequence._id),
                    targetSequenceId: args.targetSequenceId ? String(args.targetSequenceId) : null,
                    replaceTargetSequence,
                    batchSize,
                    nextBatchIndex: effectiveBatchIndex,
                    totalOperations,
                    totalBatches,
                    sourceGalaxyCount: sourceGalaxyIds.length,
                    sourceRemainingGalaxyCount: remainingSourceGalaxyIds.length,
                    removedTargetGalaxyCount: targetGalaxyIdsToRemove.length,
                    sourceProgressToken,
                    startedAt: Date.now(),
                    updatedAt: Date.now(),
                },
            });
        }

        for (const operation of batchOperations) {
            const galaxy = await ctx.db
                .query("galaxies")
                .withIndex("by_external_id", (q) => q.eq("id", operation.galaxyExternalId))
                .unique();

            if (!galaxy) {
                processedInBatch++;
                continue;
            }

            const perUser = { ...(galaxy.perUser ?? {}) };
            const currentSource = perUser[sourceUserId] ?? BigInt(0);
            const currentTarget = perUser[targetUserId] ?? BigInt(0);

            const nextSourceResult = applyClampedDelta(currentSource, operation.sourceDelta);
            const nextTargetResult = applyClampedDelta(currentTarget, operation.targetDelta);

            if (nextSourceResult.next > BigInt(0)) {
                perUser[sourceUserId] = nextSourceResult.next;
            } else {
                delete perUser[sourceUserId];
            }

            if (nextTargetResult.next > BigInt(0)) {
                perUser[targetUserId] = nextTargetResult.next;
            } else {
                delete perUser[targetUserId];
            }

            const totalAssigned = galaxy.totalAssigned ?? BigInt(0);
            const appliedNetDelta = nextSourceResult.appliedDelta + nextTargetResult.appliedDelta;
            const candidateTotalAssigned = totalAssigned + appliedNetDelta;
            const nextTotalAssigned = candidateTotalAssigned > BigInt(0) ? candidateTotalAssigned : BigInt(0);

            await ctx.db.patch(galaxy._id, {
                totalAssigned: nextTotalAssigned,
                perUser: Object.keys(perUser).length > 0 ? perUser : undefined,
            });

            patchedGalaxies++;
            processedInBatch++;
        }

        let newSequenceId: string | null = null;

        if (isLastBatch) {
            if (replaceTargetSequence && targetSequence) {
                await ctx.db.delete(targetSequence._id);
            }

            await ctx.db.delete(sourceSequence._id);

            const insertedSequenceId = await ctx.db.insert("galaxySequences", {
                userId: targetUserId,
                galaxyExternalIds: remainingSourceGalaxyIds,
                currentIndex: 0,
                numClassified: 0,
                numSkipped: 0,
            });
            newSequenceId = insertedSequenceId;

            const sourceProfile = await ctx.db
                .query("userProfiles")
                .withIndex("by_user", (q) => q.eq("userId", sourceUserId))
                .unique();

            if (sourceProfile) {
                await ctx.db.patch(sourceProfile._id, { sequenceGenerated: false });
            }

            const targetProfile = await ctx.db
                .query("userProfiles")
                .withIndex("by_user", (q) => q.eq("userId", targetUserId))
                .unique();

            if (targetProfile) {
                await ctx.db.patch(targetProfile._id, { sequenceGenerated: true });
            }

            const migrationStateToDelete = await ctx.db
                .query("systemSettings")
                .withIndex("by_key", (q) => q.eq("key", migrationStateKey))
                .unique();

            if (migrationStateToDelete) {
                await ctx.db.delete(migrationStateToDelete._id);
            }
        } else {
            const migrationStateToUpdate = await ctx.db
                .query("systemSettings")
                .withIndex("by_key", (q) => q.eq("key", migrationStateKey))
                .unique();

            if (migrationStateToUpdate) {
                const existingValue = (migrationStateToUpdate.value ?? {}) as Record<string, any>;
                await ctx.db.patch(migrationStateToUpdate._id, {
                    value: {
                        ...existingValue,
                        nextBatchIndex: effectiveBatchIndex + 1,
                        totalOperations,
                        totalBatches,
                        updatedAt: Date.now(),
                    },
                });
            }
        }

        return {
            success: true,
            message: isLastBatch
                ? `Migration completed (${remainingSourceGalaxyIds.length} remaining galaxies moved).`
                : `Processed migration batch ${effectiveBatchIndex + 1}/${totalBatches}.`,
            batchIndex: effectiveBatchIndex,
            batchSize,
            totalBatches,
            processedInBatch,
            patchedGalaxies,
            totalProcessed: endIndex,
            totalOperations,
            sourceGalaxyCount: sourceGalaxyIds.length,
            sourceRemainingGalaxyCount: remainingSourceGalaxyIds.length,
            sourceProcessedGalaxyCount: sourceProgressDetails.processedCount,
            removedTargetGalaxyCount: targetGalaxyIdsToRemove.length,
            isComplete: isLastBatch,
            currentBatch: effectiveBatchIndex + 1,
            migratedGalaxyCount: isLastBatch ? remainingSourceGalaxyIds.length : undefined,
            newSequenceId,
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
