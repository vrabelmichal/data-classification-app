// convex/generateBalancedUserSequence.ts
import { requireAdmin, requireUserId } from "./lib/auth";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  validateParams,
} from "./lib/assignmentCore";
import { DEFAULT_SYSTEM_SETTINGS } from "./lib/defaults";
import { Id } from "./_generated/dataModel";

type SequenceEmailResult = {
  success: boolean;
  message: string;
  details?: string;
  to?: string;
  id?: string;
};

const MAX_SEQUENCE = 8192;
// Batch size for reading galaxies - can be larger for underK since most galaxies pass
// Stay under 32k limit but use larger batches for efficiency
const SELECTION_BATCH_SIZE = 15000;

// Helper to format paper filter for logging (handles empty strings)
const formatPaperFilter = (papers: string[] | null | undefined): string => {
  if (!papers) return "all";
  return papers.map(p => p === "" ? '(empty)' : p).join(", ");
};

// ============================================================================
// Job tracking for progress and cancellation support
// ============================================================================

// Query to get current job status for a user (for UI progress display)
export const getSequenceGenerationJob = query({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sequenceGenerationJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .order("desc")
      .first();
  },
});

// Internal mutation to create/update job progress
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("sequenceGenerationJobs"),
    phase: v.union(v.literal("underK"), v.literal("overK"), v.literal("creating"), v.literal("done")),
    selectedCount: v.number(),
    totalScanned: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      phase: args.phase,
      selectedCount: args.selectedCount,
      totalScanned: args.totalScanned,
      message: args.message,
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to create a new job
export const createJob = internalMutation({
  args: {
    userId: v.id("users"),
    targetCount: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"sequenceGenerationJobs">> => {
    // Clean up any old completed/failed/cancelled jobs for this user
    const oldJobs = await ctx.db
      .query("sequenceGenerationJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const job of oldJobs) {
      if (job.status !== "running") {
        await ctx.db.delete(job._id);
      }
    }

    return await ctx.db.insert("sequenceGenerationJobs", {
      userId: args.userId,
      status: "running",
      cancelRequested: false,
      phase: "underK",
      selectedCount: 0,
      targetCount: args.targetCount,
      totalScanned: 0,
      message: "Starting sequence generation...",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Internal query to check if cancellation was requested
export const checkJobCancellation = internalQuery({
  args: {
    jobId: v.id("sequenceGenerationJobs"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const job = await ctx.db.get(args.jobId);
    return job?.cancelRequested ?? false;
  },
});

// Internal mutation to complete a job
export const completeJob = internalMutation({
  args: {
    jobId: v.id("sequenceGenerationJobs"),
    status: v.union(v.literal("completed"), v.literal("cancelled"), v.literal("failed")),
    message: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      phase: "done",
      message: args.message,
      updatedAt: Date.now(),
      completedAt: Date.now(),
      error: args.error,
    });
  },
});

// Mutation to request cancellation of a running job
export const cancelSequenceGeneration = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Admin check if cancelling for another user
    if (args.targetUserId !== userId) {
      await requireAdmin(ctx);
    }

    // Find running job for this user
    const job = await ctx.db
      .query("sequenceGenerationJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();

    if (!job) {
      return { success: false, message: "No running job found" };
    }

    // Request cancellation
    await ctx.db.patch(job._id, {
      cancelRequested: true,
      message: "Cancellation requested...",
      updatedAt: Date.now(),
    });

    return { success: true, message: "Cancellation requested" };
  },
});

// Mutation to rollback/delete a sequence that was created
export const rollbackSequence = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Admin check if rolling back for another user
    if (args.targetUserId !== userId) {
      await requireAdmin(ctx);
    }

    // Find and delete the sequence
    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!sequence) {
      return { success: false, message: "No sequence found to rollback" };
    }

    // Only allow rollback if user hasn't started classifying
    if (sequence.numClassified > 0) {
      return { success: false, message: "Cannot rollback: user has already classified some galaxies" };
    }

    await ctx.db.delete(sequence._id);

    // Also clean up any job records
    const jobs = await ctx.db
      .query("sequenceGenerationJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();
    
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    return { success: true, message: "Sequence rolled back successfully" };
  },
});

// ============================================================================
// Precondition checks
// ============================================================================

// Internal query to check preconditions before starting sequence generation
export const checkSequenceGenerationPreconditions = internalQuery({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ canProceed: boolean; error?: string; blacklistedIds?: string[] }> => {
    // Check if user already has a sequence assigned
    const existingSequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();
    
    if (existingSequence) {
      return { canProceed: false, error: "User already has a sequence assigned" };
    }

    // Check if there's already a running job
    const runningJob = await ctx.db
      .query("sequenceGenerationJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();
    
    if (runningJob) {
      return { canProceed: false, error: "Sequence generation already in progress" };
    }

    // Check if there are any galaxies available
    const galaxiesExist = (await ctx.db.query("galaxies").take(1)).length > 0;
    if (!galaxiesExist) {
      return { canProceed: false, error: "No galaxies available for sequence generation" };
    }

    // Get blacklisted galaxy IDs
    const blacklistedGalaxies = await ctx.db.query("galaxyBlacklist").collect();
    const blacklistedIds = blacklistedGalaxies.map((b) => b.galaxyExternalId);

    return { canProceed: true, blacklistedIds };
  },
});

// ============================================================================
// Batch selection query
// ============================================================================

// Type for batch selection result
type SelectGalaxiesBatchResult = {
  selectedIds: string[];
  cursor: { totalAssigned: string; numericId: string } | null;
  exhausted: boolean;
  scannedCount: number;
};

// Paginated query to select galaxies in batches
// Returns candidates that pass the filter, plus a cursor for the next batch
export const selectGalaxiesBatch = internalQuery({
  args: {
    targetUserId: v.id("users"),
    minAssignmentsK: v.number(),
    maxAssignmentsPerUserM: v.number(),
    paperFilter: v.optional(v.array(v.string())),
    blacklistedIds: v.array(v.string()),
    alreadySelectedIds: v.array(v.string()),
    // Cursor for pagination: [totalAssigned, numericId] as strings for the index position
    cursor: v.optional(v.object({
      totalAssigned: v.string(), // BigInt as string
      numericId: v.string(), // BigInt as string
    })),
    // Phase: "underK" or "overK"
    phase: v.union(v.literal("underK"), v.literal("overK")),
    limit: v.number(),
    neededCount: v.number(), // How many more galaxies we need
  },
  handler: async (ctx, args): Promise<SelectGalaxiesBatchResult> => {
    const { 
      targetUserId, 
      minAssignmentsK: K, 
      maxAssignmentsPerUserM: M,
      paperFilter,
      blacklistedIds,
      alreadySelectedIds,
      cursor,
      phase,
      limit,
      neededCount,
    } = args;

    const blacklistedSet = new Set(blacklistedIds);
    const alreadySelectedSet = new Set(alreadySelectedIds);
    const effectivePaperFilter = paperFilter && paperFilter.length > 0 ? paperFilter : null;

    const selected: string[] = [];
    let newCursor: { totalAssigned: string; numericId: string } | null = null;
    let exhausted = false;
    let scannedCount = 0;

    // Build the query based on phase
    let query;
    if (phase === "underK") {
      query = ctx.db
        .query("galaxies")
        .withIndex("by_totalAssigned_numericId", (q) => {
          if (cursor) {
            // Continue from cursor position - we need to start after the cursor
            return q.lt("totalAssigned", BigInt(K));
          }
          return q.lt("totalAssigned", BigInt(K));
        });
    } else {
      query = ctx.db
        .query("galaxies")
        .withIndex("by_totalAssigned_numericId", (q) => {
          if (cursor) {
            return q.gte("totalAssigned", BigInt(K));
          }
          return q.gte("totalAssigned", BigInt(K));
        });
    }

    // Iterate through results
    let foundCursorPosition = cursor === undefined;
    
    for await (const doc of query) {
      scannedCount++;

      // If we have a cursor, skip until we pass it
      if (!foundCursorPosition) {
        const docTotalAssigned = doc.totalAssigned?.toString() ?? "0";
        const docNumericId = doc.numericId?.toString() ?? "0";
        
        // Compare to find if we've passed the cursor position
        const cursorTotal = BigInt(cursor!.totalAssigned);
        const cursorNumeric = BigInt(cursor!.numericId);
        const docTotal = doc.totalAssigned ?? BigInt(0);
        const docNumeric = doc.numericId ?? BigInt(0);

        // Skip if we haven't passed the cursor yet
        if (docTotal < cursorTotal || (docTotal === cursorTotal && docNumeric <= cursorNumeric)) {
          continue;
        }
        foundCursorPosition = true;
      }

      // Check if we've hit our scan limit
      if (scannedCount >= limit) {
        // Save cursor for next batch
        newCursor = {
          totalAssigned: (doc.totalAssigned ?? BigInt(0)).toString(),
          numericId: (doc.numericId ?? BigInt(0)).toString(),
        };
        break;
      }

      // Skip blacklisted galaxies
      if (blacklistedSet.has(doc.id)) continue;

      // Skip already selected galaxies
      if (alreadySelectedSet.has(doc.id)) continue;

      // Apply paper filter
      if (effectivePaperFilter !== null) {
        const docPaper = doc.misc?.paper ?? "";
        if (!effectivePaperFilter.includes(docPaper)) continue;
      }

      // Check per-user cap
      const perUserCount = (doc.perUser ?? {})[targetUserId] ?? BigInt(0);
      if (perUserCount >= BigInt(M)) continue;

      // This galaxy is valid - add it
      selected.push(doc.id);

      // Check if we have enough
      if (selected.length >= neededCount) {
        // We don't need to set a cursor if we found enough
        break;
      }
    }

    // If we didn't break due to limit, we exhausted this phase
    if (newCursor === null && scannedCount < limit) {
      exhausted = true;
    }

    return {
      selectedIds: selected,
      cursor: newCursor,
      exhausted,
      scannedCount,
    };
  },
});

// Mutation to create the sequence after all selection is done
export const createUserSequence = internalMutation({
  args: {
    targetUserId: v.id("users"),
    galaxyExternalIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; sequenceId: Id<"galaxySequences"> | null }> => {
    // Double-check user doesn't already have a sequence
    const existingSequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();
    
    if (existingSequence) {
      throw new Error("User already has a sequence assigned");
    }

    if (args.galaxyExternalIds.length === 0) {
      return { success: false, sequenceId: null };
    }

    const sequenceId = await ctx.db.insert("galaxySequences", {
      userId: args.targetUserId,
      galaxyExternalIds: args.galaxyExternalIds,
      currentIndex: 0,
      numClassified: 0,
      numSkipped: 0,
    });

    console.log(`Created new sequence ${sequenceId} for user ${args.targetUserId} with ${args.galaxyExternalIds.length} galaxies`);

    return { success: true, sequenceId };
  },
});

// Type for the generate sequence result
type GenerateSequenceResult = {
  success: boolean;
  cancelled?: boolean;
  requested: number;
  generated: number;
  selectedIds?: string[];
  statsBatchesNeeded: number;
  statsBatchSize: number;
  minAssignmentsPerEntry: number;
  perUserCap: number;
  expectedUsers: number;
  allowOverAssign: boolean;
  dryRun: boolean;
  paperFilter?: string[];
  warnings?: string[];
  errors?: string[];
};

// Main action that orchestrates the paginated selection process
export const generateBalancedUserSequence = action({
  args: {
    targetUserId: v.optional(v.id("users")),
    expectedUsers: v.number(), // N
    minAssignmentsPerEntry: v.number(), // K
    maxAssignmentsPerUserPerEntry: v.optional(v.number()), // M default 1
    sequenceSize: v.optional(v.number()), // S default 50
    allowOverAssign: v.optional(v.boolean()), // default false
    dryRun: v.optional(v.boolean()), // default false
    paperFilter: v.optional(v.array(v.string())), // Filter by misc.paper values (empty = all papers)
  },
  handler: async (ctx, args): Promise<GenerateSequenceResult> => {
    // Get caller info
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile) {
      throw new Error("Authentication required");
    }
    const callerId = callerProfile.userId as Id<"users">;

    const targetUserId = args.targetUserId ?? callerId;
    const expectedUsers = Math.max(1, Math.floor(args.expectedUsers));
    const K = Math.max(1, Math.floor(args.minAssignmentsPerEntry));
    const M = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
    const requestedSize = Math.max(1, Math.floor(args.sequenceSize ?? 50));
    const S = Math.min(requestedSize, MAX_SEQUENCE);
    const allowOverAssign = !!args.allowOverAssign;
    const dryRun = !!args.dryRun;
    const paperFilter = args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null;

    // Admin check if generating for another user
    if (targetUserId !== callerId && callerProfile.role !== "admin") {
      throw new Error("Admin access required to generate sequence for another user");
    }

    const warnings = validateParams({
      expectedUsers,
      minAssignmentsK: K,
      perUserCapM: M,
      sequenceSize: S,
    }).map((w: { message: string }) => w.message);
    const errors: string[] = [];

    console.log(`[SeqGen] Starting: N=${expectedUsers}, K=${K}, M=${M}, S=${S}, overAssign=${allowOverAssign}, dryRun=${dryRun}`);

    // Check preconditions
    const preconditions = await ctx.runQuery(internal.generateBalancedUserSequence.checkSequenceGenerationPreconditions, {
      targetUserId,
    });

    if (!preconditions.canProceed) {
      throw new Error(preconditions.error);
    }

    const blacklistedIds = preconditions.blacklistedIds ?? [];

    // Create job for progress tracking (unless dry run)
    let jobId: Id<"sequenceGenerationJobs"> | null = null;
    if (!dryRun) {
      jobId = await ctx.runMutation(internal.generateBalancedUserSequence.createJob, {
        userId: targetUserId,
        targetCount: S,
      });
    }

    // Helper to update job progress
    const updateProgress = async (phase: "underK" | "overK" | "creating" | "done", message: string, selectedCount: number, scanned: number) => {
      if (jobId) {
        await ctx.runMutation(internal.generateBalancedUserSequence.updateJobProgress, {
          jobId,
          phase,
          selectedCount,
          totalScanned: scanned,
          message,
        });
      }
    };

    // Helper to check cancellation
    const checkCancelled = async (): Promise<boolean> => {
      if (!jobId) return false;
      return await ctx.runQuery(internal.generateBalancedUserSequence.checkJobCancellation, { jobId });
    };

    // Paginated selection - underK phase first
    const selectedIds: string[] = [];
    let cursor: { totalAssigned: string; numericId: string } | undefined = undefined;
    let exhaustedUnderK = false;
    let exhaustedOverK = false;
    let totalScanned = 0;
    let batchCount = 0;
    let cancelled = false;

    // Phase 1: Under-K galaxies
    await updateProgress("underK", "Scanning under-K galaxies...", 0, 0);
    
    while (selectedIds.length < S && !exhaustedUnderK) {
      // Check for cancellation between batches
      if (await checkCancelled()) {
        cancelled = true;
        console.log(`[SeqGen] Cancelled during underK phase`);
        break;
      }

      batchCount++;
      const neededCount = S - selectedIds.length;
      
      const batchResult: SelectGalaxiesBatchResult = await ctx.runQuery(internal.generateBalancedUserSequence.selectGalaxiesBatch, {
        targetUserId,
        minAssignmentsK: K,
        maxAssignmentsPerUserM: M,
        paperFilter: paperFilter ?? undefined,
        blacklistedIds,
        alreadySelectedIds: selectedIds,
        cursor,
        phase: "underK",
        limit: SELECTION_BATCH_SIZE,
        neededCount,
      });

      selectedIds.push(...batchResult.selectedIds);
      totalScanned += batchResult.scannedCount;
      cursor = batchResult.cursor ?? undefined;
      exhaustedUnderK = batchResult.exhausted;

      // Update progress
      await updateProgress(
        "underK",
        `Found ${selectedIds.length}/${S} galaxies (scanned ${totalScanned})`,
        selectedIds.length,
        totalScanned
      );
    }

    // Phase 2: Over-K galaxies (if allowed and still need more)
    let overAssignedCount = 0;
    if (!cancelled && selectedIds.length < S && allowOverAssign) {
      await updateProgress("overK", "Scanning over-K galaxies...", selectedIds.length, totalScanned);
      cursor = undefined; // Reset cursor for new phase
      batchCount = 0;

      while (selectedIds.length < S && !exhaustedOverK) {
        // Check for cancellation between batches
        if (await checkCancelled()) {
          cancelled = true;
          console.log(`[SeqGen] Cancelled during overK phase`);
          break;
        }

        batchCount++;
        const neededCount = S - selectedIds.length;

        const batchResult: SelectGalaxiesBatchResult = await ctx.runQuery(internal.generateBalancedUserSequence.selectGalaxiesBatch, {
          targetUserId,
          minAssignmentsK: K,
          maxAssignmentsPerUserM: M,
          paperFilter: paperFilter ?? undefined,
          blacklistedIds,
          alreadySelectedIds: selectedIds,
          cursor,
          phase: "overK",
          limit: SELECTION_BATCH_SIZE,
          neededCount,
        });

        selectedIds.push(...batchResult.selectedIds);
        overAssignedCount += batchResult.selectedIds.length;
        totalScanned += batchResult.scannedCount;
        cursor = batchResult.cursor ?? undefined;
        exhaustedOverK = batchResult.exhausted;

        // Update progress
        await updateProgress(
          "overK",
          `Found ${selectedIds.length}/${S} galaxies (scanned ${totalScanned}, over-K: ${overAssignedCount})`,
          selectedIds.length,
          totalScanned
        );
      }
    }

    // Handle cancellation
    if (cancelled) {
      if (jobId) {
        await ctx.runMutation(internal.generateBalancedUserSequence.completeJob, {
          jobId,
          status: "cancelled",
          message: "Operation cancelled by user",
        });
      }
      return {
        success: false,
        cancelled: true,
        requested: S,
        generated: 0,
        statsBatchesNeeded: 0,
        statsBatchSize: 500,
        minAssignmentsPerEntry: K,
        perUserCap: M,
        expectedUsers,
        allowOverAssign,
        dryRun,
        paperFilter: paperFilter ?? undefined,
        warnings: ["Operation cancelled by user"],
      };
    }

    console.log(`[SeqGen] Selection done: ${selectedIds.length}/${S} galaxies, scanned ${totalScanned}`);

    // Generate warnings
    if (overAssignedCount > 0) {
      warnings.push(
        `Warning: ${overAssignedCount} entries were assigned with totalAssigned >= K=${K} (allowOverAssign=true).`
      );
    }

    if (selectedIds.length === 0) {
      warnings.push(
        paperFilter && paperFilter.length > 0
          ? `No galaxies matched the current selection filters. Check paper filter values: [${formatPaperFilter(paperFilter)}] and assignment thresholds (K=${K}, M=${M}).`
          : `No galaxies matched the current selection filters. Check assignment thresholds (K=${K}, M=${M}) or enable over-assign if appropriate.`
      );
    }

    const exhaustedAll = exhaustedUnderK && (allowOverAssign ? exhaustedOverK : true);

    if (selectedIds.length < S) {
      warnings.push(
        `Note: Only generated ${selectedIds.length} of ${S} requested. ` +
          `${exhaustedUnderK ? "Under-K pool exhausted." : ""} ` +
          `${allowOverAssign ? (exhaustedAll ? "All pools exhausted." : "") : "Over-assign disabled."}`
      );
    }

    if (selectedIds.length === 0) {
      errors.push(
        allowOverAssign
          ? `No galaxies matched filters. Check paper filter (${formatPaperFilter(paperFilter)}), K=${K}, M=${M}. Under-K exhausted=${exhaustedUnderK}, all exhausted=${exhaustedAll}.`
          : `No galaxies matched filters with over-assign disabled. Check paper filter (${formatPaperFilter(paperFilter)}), K=${K}, M=${M}, or enable over-assign.`
      );
    }

    // Create the sequence (unless dryRun)
    let success = false;
    if (!dryRun && selectedIds.length > 0) {
      await updateProgress("creating", "Creating sequence...", selectedIds.length, totalScanned);
      
      const createResult: { success: boolean; sequenceId: Id<"galaxySequences"> | null } = await ctx.runMutation(internal.generateBalancedUserSequence.createUserSequence, {
        targetUserId,
        galaxyExternalIds: selectedIds,
      });
      success = createResult.success;
    }

    // Complete the job
    if (jobId) {
      await ctx.runMutation(internal.generateBalancedUserSequence.completeJob, {
        jobId,
        status: success || dryRun ? "completed" : "failed",
        message: success || dryRun 
          ? `Completed: ${selectedIds.length}/${S} galaxies` 
          : `Failed: ${errors.join("; ") || "Unknown error"}`,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      });
    }

    // Calculate batches needed for stats update (batch size 500)
    const STATS_BATCH_SIZE = 500;
    const statsBatchesNeeded = Math.ceil(selectedIds.length / STATS_BATCH_SIZE);

    console.log(`[SeqGen] Done: success=${dryRun ? true : success}, generated=${selectedIds.length}/${S}`);
    
    return {
      success: dryRun ? true : success,
      requested: S,
      generated: selectedIds.length,
      selectedIds: dryRun ? undefined : selectedIds,
      statsBatchesNeeded: dryRun ? 0 : statsBatchesNeeded,
      statsBatchSize: STATS_BATCH_SIZE,
      minAssignmentsPerEntry: K,
      perUserCap: M,
      expectedUsers,
      allowOverAssign,
      dryRun,
      paperFilter: paperFilter ?? undefined,
      warnings: warnings.length ? warnings : undefined,
      errors: errors.length ? errors : undefined,
    };
  },
});

export const updateGalaxyAssignmentStats = mutation({
  args: {
    targetUserId: v.id("users"),
    batchIndex: v.number(),
    batchSize: v.optional(v.number()),
    perUserCapM: v.number(), // Need this for race-safety check
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const { targetUserId, batchIndex, batchSize = 500, perUserCapM: M } = args;

    // Admin check if updating for another user
    if (targetUserId !== userId) {
      await requireAdmin(ctx);
    }

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
    const batchGalaxyIds = sequence.galaxyExternalIds?.slice(startIndex, endIndex) || [];
    const totalBatches = Math.ceil(totalGalaxies / batchSize);
    const isLastBatch = endIndex >= totalGalaxies;

    console.log(`Processing stats update batch ${batchIndex + 1} of ${totalBatches}, galaxies ${startIndex}-${endIndex - 1} (${batchGalaxyIds.length} galaxies)`);

    // Update stats for this batch
    let processed = 0;
    const now = Date.now();
    for (const galaxyExternalId of batchGalaxyIds) {
      // Find the galaxy by external ID
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (!galaxy) {
        console.log(`Galaxy ${galaxyExternalId} not found, skipping`);
        continue;
      }

      // Update totalAssigned and perUser counters
      const perUser = { ...(galaxy.perUser ?? {}) };
      const prev = perUser[targetUserId] ?? BigInt(0);

      if (prev >= BigInt(M)) {
        // Race-safety check: skip if cap reached
        console.log(`Skipping galaxy ${galaxyExternalId}: user cap M=${M} reached`);
        continue;
      }

      perUser[targetUserId] = prev + BigInt(1);
      const newTotalAssigned = (galaxy.totalAssigned ?? BigInt(0)) + BigInt(1);

      await ctx.db.patch(galaxy._id, {
        totalAssigned: newTotalAssigned,
        perUser,
        lastAssignedAt: now,
      });

      processed++;
    }

    console.log(`Completed stats update batch ${batchIndex + 1} of ${totalBatches}, processed ${processed} galaxies`);

    // If this is the last batch, update the user profile
    if (isLastBatch) {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .unique();
      if (userProfile) {
        console.log(`Marking user profile ${userProfile._id} as sequenceGenerated=true after completing all stats updates`);
        await ctx.db.patch(userProfile._id, { sequenceGenerated: true });
      }
    }

    return {
      success: true,
      batchIndex,
      totalBatches,
      processedInBatch: processed,
      totalProcessed: endIndex,
      totalGalaxies,
      isLastBatch,
    };
  },
});

// Action: send email notification after sequence generation
export const sendSequenceGeneratedEmail = action({
  args: {
    targetUserId: v.id("users"),
    generated: v.number(),
    requested: v.number(),
  },
  handler: async (ctx, args): Promise<SequenceEmailResult> => {
    const callerProfile = await ctx.runQuery(api.users.getUserProfile);
    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Admin access required");
    }

    const target = await ctx.runQuery(api.users.getUserBasicInfo, {
      userId: args.targetUserId,
    });

    if (!target) {
      return { success: false, message: "Target user not found" };
    }

    if (!target.email) {
      return { success: false, message: "User has no email address" };
    }

    const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
    const appName: typeof DEFAULT_SYSTEM_SETTINGS.appName = settings.appName ?? DEFAULT_SYSTEM_SETTINGS.appName;
    const emailFrom: typeof DEFAULT_SYSTEM_SETTINGS.emailFrom = settings.emailFrom ?? DEFAULT_SYSTEM_SETTINGS.emailFrom;
    const fromWithName = `${appName} <${emailFrom}>`;
    const apiKey = process.env.AUTH_RESEND_KEY;

    if (!apiKey) {
      return {
        success: false,
        message: "Email provider not configured",
        details: "AUTH_RESEND_KEY is missing",
      };
    }

    const appUrlEnv = process.env.SITE_URL || process.env.VERCEL_URL;
    const appUrl = appUrlEnv ? (appUrlEnv.startsWith("http") ? appUrlEnv : `https://${appUrlEnv}`) : "";
    const classificationUrl = appUrl ? `${appUrl}/classify` : undefined;

    const subject = `${appName} - Your galaxy sequence is ready`;
    const textBody = [
      `Hello${target.name ? ` ${target.name}` : ""},`,
      "",
      `A new classification sequence has been generated for you with ${args.generated} galaxies (requested ${args.requested}).`,
      classificationUrl ? `Open the app to start classifying: ${classificationUrl}` : "Open the app to start classifying your new sequence.",
      "",
      "Thank you for contributing!",
    ].join("\n");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">Hi${target.name ? ` ${target.name}` : ""}, your sequence is ready!</h2>
        <p style="margin: 0 0 12px 0;">We generated a new classification sequence for you.</p>
        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
          <p style="margin: 4px 0; font-weight: 600;">Assigned galaxies: ${args.generated}</p>
          <p style="margin: 4px 0; color: #475569;">Requested: ${args.requested}</p>
        </div>
        ${classificationUrl ? `<p style="margin: 0 0 12px 0;"><a href="${classificationUrl}" style="background: #16a34a; color: white; padding: 10px 14px; border-radius: 6px; text-decoration: none; display: inline-block;">Start classifying</a></p>` : ""}
        <p style="margin: 0 0 12px 0; color: #475569;">Thank you for contributing to the project.</p>
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">Sent by ${appName}</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromWithName,
          to: [target.email],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          message: "Failed to send notification email",
          details: errorText,
        };
      }

      const data = await res.json();
      return {
        success: true,
        message: "Notification email sent",
        to: target.email,
        id: data.id ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: "Error sending notification email",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
});