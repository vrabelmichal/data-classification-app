// convex/generateBalancedUserSequence.ts
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

type SequenceEmailResult = {
  success: boolean;
  message: string;
  details?: string;
  to?: string;
  id?: string;
};

type StatsDoc = {
  _id: any; // Id<"galaxies">
  galaxyExternalId: string; // galaxy id
  numericId: bigint;
  totalAssigned: bigint;
  perUser?: Record<string, bigint>;
  lastAssignedAt?: number;
};

const MAX_SEQUENCE = 8192;
const BATCH = 1000;

export const generateBalancedUserSequence = mutation({
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
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const targetUserId = args.targetUserId ?? userId;
    const expectedUsers = Math.max(1, Math.floor(args.expectedUsers));
    const K = Math.max(1, Math.floor(args.minAssignmentsPerEntry));
    const M = Math.max(1, Math.floor(args.maxAssignmentsPerUserPerEntry ?? 1));
    const requestedSize = Math.max(1, Math.floor(args.sequenceSize ?? 50));
    const S = Math.min(requestedSize, MAX_SEQUENCE);
    const allowOverAssign = !!args.allowOverAssign;
    const dryRun = !!args.dryRun;
    // paperFilter: undefined or empty array means all papers, otherwise filter to specified papers
    const paperFilter = args.paperFilter && args.paperFilter.length > 0 ? args.paperFilter : null;

    // Admin check if generating for another user
    if (targetUserId !== userId) {
        await requireAdmin(ctx);
    }

    // Check if user already has a sequence assigned
    const existingSequence = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();
    if (existingSequence) {
      throw new Error("User already has a sequence assigned");
    }

    const warnings = validateParams({
      expectedUsers,
      minAssignmentsK: K,
      perUserCapM: M,
      sequenceSize: S,
    }).map((w: { message: string }) => w.message);
    const errors: string[] = [];

    console.log(`Starting balanced sequence generation: N=${expectedUsers}, K=${K}, M=${M}, S=${S}, allowOverAssign=${allowOverAssign}, dryRun=${dryRun}, paperFilter=${paperFilter ? paperFilter.join(',') : 'all'}`);

    // Check if there are any galaxies available before proceeding
    const galaxiesExist = (await ctx.db.query("galaxies").take(1)).length > 0;
    if (!galaxiesExist) {
      throw new Error("No galaxies available for sequence generation");
    }

    // Get blacklisted galaxy IDs to exclude from assignment
    const blacklistedGalaxies = await ctx.db.query("galaxyBlacklist").collect();
    const blacklistedIds = new Set(blacklistedGalaxies.map((b) => b.galaxyExternalId));
    console.log(`Loaded ${blacklistedIds.size} blacklisted galaxies to exclude`);

    // Get galaxies, ordered by totalAssigned and numericId
    console.log(`Fetching galaxies for processing...`);

    // Separate iterators for under-K and over-K to avoid reusing a closed query iterator
    async function* underKStream(): AsyncIterable<StatsDoc> {
      const iterator = ctx.db
        .query("galaxies")
        .withIndex("by_totalAssigned_numericId", (q) => q.lt("totalAssigned", BigInt(K)))
        [Symbol.asyncIterator]();

      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        const doc = result.value;

        // Skip blacklisted galaxies
        if (blacklistedIds.has(doc.id)) continue;

        if (paperFilter !== null) {
          const docPaper = doc.misc?.paper ?? "";
          if (!paperFilter.includes(docPaper)) continue; // allow empty string as a valid paper value
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

        // Skip blacklisted galaxies
        if (blacklistedIds.has(doc.id)) continue;

        if (paperFilter !== null) {
          const docPaper = doc.misc?.paper ?? "";
          if (!paperFilter.includes(docPaper)) continue; // allow empty string as a valid paper value
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

    // Note: We can't easily count total galaxies without consuming the streams
    // So we'll log counts after selection if needed

    const selectionParams: SelectionParams = {
      targetUserId,
      minAssignmentsK: K,
      perUserCapM: M,
      allowOverAssign,
      sequenceSize: S,
    };

    const {
      selectedIds,
      selectedDocs,
      overAssignedCount,
      exhaustedUnderK,
      exhaustedAll,
    } = await selectFromOrderedStreams(
      selectionParams,
      underKStream(),
      allowOverAssign ? overKStream() : undefined
    );

    console.log(`Selection completed: selected ${selectedIds.length} galaxies, overAssignedCount=${overAssignedCount}, exhaustedUnderK=${exhaustedUnderK}, exhaustedAll=${exhaustedAll}`);
    console.log(`Selected galaxy IDs: ${selectedIds.slice(0, 10).join(', ')}${selectedIds.length > 10 ? '...' : ''}`);

    if (overAssignedCount > 0) {
      warnings.push(
        `Warning: ${overAssignedCount} entries were assigned with ` +
          `totalAssigned >= K=${K} (allowOverAssign=true).`
      );
    }

    if (selectedIds.length === 0) {
      warnings.push(
        paperFilter && paperFilter.length > 0
          ? `No galaxies matched the current selection filters. Check paper filter values: [${paperFilter.join(", ")}] and assignment thresholds (K=${K}, M=${M}).`
          : `No galaxies matched the current selection filters. Check assignment thresholds (K=${K}, M=${M}) or enable over-assign if appropriate.`
      );
    }

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
          ? `No galaxies matched filters. Check paper filter (${paperFilter ? paperFilter.join(", ") : "all"}), K=${K}, M=${M}. Under-K exhausted=${exhaustedUnderK}, all exhausted=${exhaustedAll}.`
          : `No galaxies matched filters with over-assign disabled. Check paper filter (${paperFilter ? paperFilter.join(", ") : "all"}), K=${K}, M=${M}, or enable over-assign.`
      );
    }

    // Replace user's sequence (unless dryRun)
    let success = false;
    if (!dryRun) {
      console.log(`Creating sequence for user ${targetUserId} with ${selectedIds.length} galaxies`);
      if (selectedIds.length > 0) {
        const newSequence = await ctx.db.insert("galaxySequences", {
          userId: targetUserId,
          galaxyExternalIds: selectedIds,
          currentIndex: 0,
          numClassified: 0,
          numSkipped: 0,
        });
        console.log(`Created new sequence ${newSequence}`);
        success = true;
      }
    }

    // Note: Stats updates are now handled separately in batches via updateGalaxyAssignmentStats
    // User profile update will happen after all stats updates are complete

    // Calculate batches needed for stats update (batch size 500)
    const STATS_BATCH_SIZE = 500;
    const statsBatchesNeeded = Math.ceil(selectedIds.length / STATS_BATCH_SIZE);

    console.log(`Completed balanced sequence generation: success=${dryRun ? true : success}, generated=${selectedIds.length}/${S}, stats batches needed=${statsBatchesNeeded}`);
    return {
      success: dryRun ? true : success,
      requested: S,
      generated: selectedIds.length,
      selectedIds: dryRun ? undefined : selectedIds, // Only return IDs for non-dry-run to enable stats updates
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