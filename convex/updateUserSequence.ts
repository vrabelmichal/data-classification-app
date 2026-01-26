// convex/updateUserSequence.ts
// Mutations for updating existing user sequences (shorten or extend)
import { requireAdmin, requireUserId } from "./lib/auth";
import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import {
  SelectionParams,
  selectFromOrderedStreams,
  validateParams,
} from "./lib/assignmentCore";
import { DEFAULT_SYSTEM_SETTINGS } from "./lib/defaults";

type StatsDoc = {
  _id: any;
  galaxyExternalId: string;
  numericId: bigint;
  totalAssigned: bigint;
  perUser?: Record<string, bigint>;
  lastAssignedAt?: number;
};

const MAX_SEQUENCE = 8192;

/**
 * Get information about a user's current sequence for the update UI
 */
export const getUserSequenceInfo = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { targetUserId } = args;

    // Admin check if viewing another user's sequence
    if (targetUserId !== userId) {
      await requireAdmin(ctx);
    }

    const sequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    if (!sequence) {
      return null;
    }

    return {
      totalGalaxies: sequence.galaxyExternalIds?.length || 0,
      currentIndex: sequence.currentIndex,
      numClassified: sequence.numClassified,
      numSkipped: sequence.numSkipped,
      // Calculate remaining (not yet classified/skipped)
      remaining: Math.max(0, (sequence.galaxyExternalIds?.length || 0) - sequence.currentIndex),
    };
  },
});

/**
 * Shorten a user's sequence by removing galaxies from the end.
 * This decrements assignment counters for removed galaxies.
 * 
 * This mutation processes one batch at a time. Call repeatedly until isComplete=true.
 */
export const shortenUserSequence = mutation({
  args: {
    targetUserId: v.id("users"),
    newSize: v.number(), // Target size (must be >= currentIndex to preserve progress)
    batchIndex: v.number(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { targetUserId, newSize, batchIndex, batchSize = 500 } = args;

    // Admin check
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

    const galaxyIds = sequence.galaxyExternalIds || [];
    const currentSize = galaxyIds.length;
    const currentIndex = sequence.currentIndex;

    // Validate newSize
    if (newSize < 0) {
      throw new Error("New size cannot be negative");
    }
    if (newSize >= currentSize) {
      return {
        success: true,
        message: "Sequence is already at or below target size",
        isComplete: true,
        galaxiesRemoved: 0,
        newSequenceSize: currentSize,
      };
    }
    if (newSize < currentIndex) {
      throw new Error(
        `Cannot shorten to ${newSize}: user has already processed ${currentIndex} galaxies. ` +
        `Minimum allowed size is ${currentIndex}.`
      );
    }

    // Calculate which galaxies need stats decremented (those being removed)
    const galaxiesToRemove = galaxyIds.slice(newSize);
    const totalToRemove = galaxiesToRemove.length;
    const totalBatches = Math.ceil(totalToRemove / batchSize);

    // Calculate this batch's range
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalToRemove);
    const batchGalaxies = galaxiesToRemove.slice(startIdx, endIdx);
    const isLastBatch = endIdx >= totalToRemove;

    console.log(
      `Shortening sequence: batch ${batchIndex + 1}/${totalBatches}, ` +
      `processing ${batchGalaxies.length} galaxies (${startIdx}-${endIdx - 1})`
    );

    // Decrement stats for this batch
    let processed = 0;
    for (const galaxyExternalId of batchGalaxies) {
      const galaxy = await ctx.db
        .query("galaxies")
        .withIndex("by_external_id", (q) => q.eq("id", galaxyExternalId))
        .unique();

      if (galaxy) {
        const perUser = { ...(galaxy.perUser ?? {}) };
        const prevUserCount = perUser[targetUserId] ?? BigInt(0);

        if (prevUserCount > BigInt(0)) {
          // Decrement by 1 (not delete entirely, in case multiple assignments)
          const newUserCount = prevUserCount - BigInt(1);
          if (newUserCount <= BigInt(0)) {
            delete perUser[targetUserId];
          } else {
            perUser[targetUserId] = newUserCount;
          }

          // Decrement totalAssigned by 1
          const currentTotal = galaxy.totalAssigned ?? BigInt(0);
          const newTotalAssigned = currentTotal > BigInt(0) ? currentTotal - BigInt(1) : BigInt(0);

          await ctx.db.patch(galaxy._id, {
            totalAssigned: newTotalAssigned,
            perUser: Object.keys(perUser).length > 0 ? perUser : undefined,
          });
        }
      }
      processed++;
    }

    // If this is the last batch, update the sequence
    if (isLastBatch) {
      const newGalaxyIds = galaxyIds.slice(0, newSize);
      await ctx.db.patch(sequence._id, {
        galaxyExternalIds: newGalaxyIds,
      });
      console.log(`Sequence shortened from ${currentSize} to ${newSize} galaxies`);
    }

    return {
      success: true,
      message: isLastBatch
        ? `Shortened sequence from ${currentSize} to ${newSize} galaxies`
        : `Processed batch ${batchIndex + 1}/${totalBatches}`,
      batchIndex,
      totalBatches,
      processedInBatch: processed,
      totalProcessed: endIdx,
      totalToRemove,
      isComplete: isLastBatch,
      galaxiesRemoved: isLastBatch ? totalToRemove : undefined,
      newSequenceSize: isLastBatch ? newSize : undefined,
    };
  },
});

/**
 * Extend a user's sequence by adding more galaxies using balanced selection.
 * This uses the same selection logic as generateBalancedUserSequence.
 * 
 * Phase 1: Select and add galaxies to sequence (call once)
 * Phase 2: Update stats in batches (call repeatedly until isComplete=true)
 */
export const extendUserSequence = mutation({
  args: {
    targetUserId: v.id("users"),
    additionalSize: v.number(), // How many galaxies to add
    expectedUsers: v.number(),
    minAssignmentsPerEntry: v.number(), // K
    maxAssignmentsPerUserPerEntry: v.optional(v.number()), // M
    allowOverAssign: v.optional(v.boolean()),
    paperFilter: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const targetUserId = args.targetUserId;
    const expectedUsers = Math.max(1, Math.floor(args.expectedUsers));
    const K = Math.max(1, Math.floor(args.minAssignmentsPerEntry));
    const M = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
    const requestedAdd = Math.max(1, Math.floor(args.additionalSize));
    const allowOverAssign = !!args.allowOverAssign;
    const paperFilter = args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null;

    // Helper to format paper filter for logging (handles empty strings)
    const formatPaperFilter = (papers: string[] | null): string => {
      if (!papers) return "all";
      return papers.map(p => p === "" ? '(empty)' : p).join(", ");
    };

    // Admin check
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

    const existingIds = new Set(sequence.galaxyExternalIds || []);
    const currentSize = existingIds.size;

    // Cap total sequence size
    const maxAddAllowed = MAX_SEQUENCE - currentSize;
    if (maxAddAllowed <= 0) {
      return {
        success: false,
        message: `Sequence is already at maximum size (${MAX_SEQUENCE})`,
        generated: 0,
        requested: requestedAdd,
        warnings: [`Cannot extend: sequence already at maximum size of ${MAX_SEQUENCE}`],
      };
    }

    const S = Math.min(requestedAdd, maxAddAllowed);
    if (S < requestedAdd) {
      console.log(`Capped extension from ${requestedAdd} to ${S} (max sequence size: ${MAX_SEQUENCE})`);
    }

    const warnings = validateParams({
      expectedUsers,
      minAssignmentsK: K,
      perUserCapM: M,
      sequenceSize: S,
    }).map((w: { message: string }) => w.message);
    const errors: string[] = [];

    console.log(
      `Extending sequence: adding up to ${S} galaxies, K=${K}, M=${M}, ` +
      `allowOverAssign=${allowOverAssign}, paperFilter=${formatPaperFilter(paperFilter)}`
    );

    // Get blacklisted galaxies
    const blacklistedGalaxies = await ctx.db.query("galaxyBlacklist").collect();
    const blacklistedIds = new Set(blacklistedGalaxies.map((b) => b.galaxyExternalId));

    // Stream functions that exclude already-assigned galaxies
    async function* underKStream(): AsyncIterable<StatsDoc> {
      const iterator = ctx.db
        .query("galaxies")
        .withIndex("by_totalAssigned_numericId", (q) => q.lt("totalAssigned", BigInt(K)))
        [Symbol.asyncIterator]();

      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        const doc = result.value;

        // Skip if already in sequence, blacklisted, or filtered by paper
        if (existingIds.has(doc.id)) continue;
        if (blacklistedIds.has(doc.id)) continue;
        if (paperFilter !== null) {
          const docPaper = doc.misc?.paper ?? "";
          if (!paperFilter.includes(docPaper)) continue;
        }

        yield {
          _id: doc._id,
          galaxyExternalId: doc.id,
          numericId: doc.numericId!,
          totalAssigned: doc.totalAssigned!,
          perUser: doc.perUser,
          lastAssignedAt: doc.lastAssignedAt,
        };
      }
    }

    async function* overKStream(): AsyncIterable<StatsDoc> {
      if (!allowOverAssign) return;

      const iterator = ctx.db
        .query("galaxies")
        .withIndex("by_totalAssigned_numericId", (q) => q.gte("totalAssigned", BigInt(K)))
        [Symbol.asyncIterator]();

      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        const doc = result.value;

        if (existingIds.has(doc.id)) continue;
        if (blacklistedIds.has(doc.id)) continue;
        if (paperFilter !== null) {
          const docPaper = doc.misc?.paper ?? "";
          if (!paperFilter.includes(docPaper)) continue;
        }

        yield {
          _id: doc._id,
          galaxyExternalId: doc.id,
          numericId: doc.numericId!,
          totalAssigned: doc.totalAssigned!,
          perUser: doc.perUser,
          lastAssignedAt: doc.lastAssignedAt,
        };
      }
    }

    const selectionParams: SelectionParams = {
      targetUserId,
      minAssignmentsK: K,
      perUserCapM: M,
      allowOverAssign,
      sequenceSize: S,
    };

    const {
      selectedIds,
      overAssignedCount,
      exhaustedUnderK,
      exhaustedAll,
    } = await selectFromOrderedStreams(
      selectionParams,
      underKStream(),
      allowOverAssign ? overKStream() : undefined
    );

    console.log(
      `Selection completed: selected ${selectedIds.length} new galaxies, ` +
      `overAssignedCount=${overAssignedCount}, exhaustedUnderK=${exhaustedUnderK}`
    );

    if (overAssignedCount > 0) {
      warnings.push(
        `${overAssignedCount} entries were assigned with totalAssigned >= K=${K} (allowOverAssign=true).`
      );
    }

    if (selectedIds.length === 0) {
      warnings.push(
        paperFilter && paperFilter.length > 0
          ? `No new galaxies matched filters. Check paper filter: [${formatPaperFilter(paperFilter)}] and thresholds (K=${K}, M=${M}).`
          : `No new galaxies matched filters. Check thresholds (K=${K}, M=${M}) or enable over-assign.`
      );
      errors.push("No galaxies available to add to sequence");
    }

    if (selectedIds.length < S) {
      warnings.push(
        `Only found ${selectedIds.length} of ${S} requested. ` +
        `${exhaustedUnderK ? "Under-K pool exhausted." : ""} ` +
        `${allowOverAssign ? (exhaustedAll ? "All pools exhausted." : "") : "Over-assign disabled."}`
      );
    }

    // Append new galaxies to sequence
    if (selectedIds.length > 0) {
      const newGalaxyIds = [...(sequence.galaxyExternalIds || []), ...selectedIds];
      await ctx.db.patch(sequence._id, {
        galaxyExternalIds: newGalaxyIds,
      });
      console.log(`Extended sequence from ${currentSize} to ${newGalaxyIds.length} galaxies`);
    }

    // Calculate batches needed for stats update
    const STATS_BATCH_SIZE = 500;
    const statsBatchesNeeded = Math.ceil(selectedIds.length / STATS_BATCH_SIZE);

    return {
      success: selectedIds.length > 0,
      requested: requestedAdd,
      generated: selectedIds.length,
      newSequenceSize: currentSize + selectedIds.length,
      previousSize: currentSize,
      statsBatchesNeeded,
      statsBatchSize: STATS_BATCH_SIZE,
      minAssignmentsPerEntry: K,
      perUserCap: M,
      expectedUsers,
      allowOverAssign,
      paperFilter: paperFilter ?? undefined,
      warnings: warnings.length ? warnings : undefined,
      errors: errors.length ? errors : undefined,
    };
  },
});

/**
 * Update galaxy assignment stats for extended sequence (called in batches).
 * This is similar to updateGalaxyAssignmentStats in generateBalancedUserSequence.
 */
export const updateExtendedSequenceStats = mutation({
  args: {
    targetUserId: v.id("users"),
    startIndex: v.number(), // Index in sequence where new galaxies start
    batchIndex: v.number(),
    batchSize: v.optional(v.number()),
    perUserCapM: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { targetUserId, startIndex, batchIndex, batchSize = 500, perUserCapM: M } = args;

    // Admin check
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

    // Get only the newly added galaxies (from startIndex onwards)
    const allGalaxyIds = sequence.galaxyExternalIds || [];
    const newGalaxyIds = allGalaxyIds.slice(startIndex);
    const totalNewGalaxies = newGalaxyIds.length;

    if (totalNewGalaxies === 0) {
      return {
        success: true,
        message: "No new galaxies to update",
        isComplete: true,
        totalProcessed: 0,
        totalGalaxies: 0,
      };
    }

    const totalBatches = Math.ceil(totalNewGalaxies / batchSize);
    const batchStartIdx = batchIndex * batchSize;
    const batchEndIdx = Math.min(batchStartIdx + batchSize, totalNewGalaxies);
    const batchGalaxyIds = newGalaxyIds.slice(batchStartIdx, batchEndIdx);
    const isLastBatch = batchEndIdx >= totalNewGalaxies;

    console.log(
      `Updating stats for extended sequence: batch ${batchIndex + 1}/${totalBatches}, ` +
      `galaxies ${batchStartIdx}-${batchEndIdx - 1} (${batchGalaxyIds.length} galaxies)`
    );

    // Update stats for this batch
    let processed = 0;
    const now = Date.now();
    for (const galaxyExternalId of batchGalaxyIds) {
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

    console.log(
      `Completed stats update batch ${batchIndex + 1}/${totalBatches}, ` +
      `processed ${processed} galaxies`
    );

    return {
      success: true,
      batchIndex,
      totalBatches,
      processedInBatch: processed,
      totalProcessed: batchEndIdx,
      totalGalaxies: totalNewGalaxies,
      isComplete: isLastBatch,
    };
  },
});

type SequenceEmailResult = {
  success: boolean;
  message: string;
  details?: string;
  to?: string;
  id?: string;
};

/**
 * Send email notification after sequence extension
 */
export const sendSequenceExtendedEmail = action({
  args: {
    targetUserId: v.id("users"),
    previousSize: v.number(),
    newSize: v.number(),
    galaxiesAdded: v.number(),
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

    const subject = `${appName} - Your sequence has been extended`;
    const textBody = [
      `Hello${target.name ? ` ${target.name}` : ""},`,
      "",
      `Your classification sequence has been extended with ${args.galaxiesAdded} new galaxies.`,
      `Previous size: ${args.previousSize} galaxies`,
      `New size: ${args.newSize} galaxies`,
      "",
      classificationUrl ? `Continue classifying: ${classificationUrl}` : "Open the app to continue classifying.",
      "",
      "Thank you for contributing!",
    ].join("\n");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">Hi${target.name ? ` ${target.name}` : ""}, your sequence has been extended!</h2>
        <p style="margin: 0 0 12px 0;">We added more galaxies to your classification sequence.</p>
        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
          <p style="margin: 4px 0; font-weight: 600; color: #16a34a;">Added: ${args.galaxiesAdded} galaxies</p>
          <p style="margin: 4px 0; color: #475569;">Previous size: ${args.previousSize}</p>
          <p style="margin: 4px 0; color: #475569;">New size: ${args.newSize}</p>
        </div>
        ${classificationUrl ? `<p style="margin: 0 0 12px 0;"><a href="${classificationUrl}" style="background: #16a34a; color: white; padding: 10px 14px; border-radius: 6px; text-decoration: none; display: inline-block;">Continue classifying</a></p>` : ""}
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

/**
 * Send email notification after sequence shortening
 */
export const sendSequenceShortenedEmail = action({
  args: {
    targetUserId: v.id("users"),
    previousSize: v.number(),
    newSize: v.number(),
    galaxiesRemoved: v.number(),
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

    const subject = `${appName} - Your sequence has been shortened`;
    const textBody = [
      `Hello${target.name ? ` ${target.name}` : ""},`,
      "",
      `Your classification sequence has been shortened.`,
      `Previous size: ${args.previousSize} galaxies`,
      `New size: ${args.newSize} galaxies`,
      `Removed: ${args.galaxiesRemoved} galaxies from the end`,
      "",
      classificationUrl ? `Continue classifying: ${classificationUrl}` : "Open the app to continue classifying.",
      "",
      "Thank you for contributing!",
    ].join("\n");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">Hi${target.name ? ` ${target.name}` : ""}, your sequence has been updated</h2>
        <p style="margin: 0 0 12px 0;">Your classification sequence has been shortened.</p>
        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
          <p style="margin: 4px 0; font-weight: 600; color: #f97316;">Removed: ${args.galaxiesRemoved} galaxies</p>
          <p style="margin: 4px 0; color: #475569;">Previous size: ${args.previousSize}</p>
          <p style="margin: 4px 0; color: #475569;">New size: ${args.newSize}</p>
        </div>
        ${classificationUrl ? `<p style="margin: 0 0 12px 0;"><a href="${classificationUrl}" style="background: #16a34a; color: white; padding: 10px 14px; border-radius: 6px; text-decoration: none; display: inline-block;">Continue classifying</a></p>` : ""}
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
