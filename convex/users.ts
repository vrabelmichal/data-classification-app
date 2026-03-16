import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireAdmin, requireUserId, requireUserProfile } from "./lib/auth";
import { getDefaultImageQuality } from "./lib/settings";
import { sendPasswordResetEmail } from "./ResendOTPPasswordReset";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  classificationsByCreated,
  classificationsByAwesomeFlag,
  classificationsByVisibleNucleus,
  classificationsByFailedFitting,
  classificationsByValidRedshift,
  classificationsByLsbClass,
  classificationsByMorphology,
  userProfilesByClassificationsCount,
  userProfilesByLastActive,
} from "./galaxies/aggregates";
import {
  buildUserClassificationCounterPatch,
  createEmptyUserClassificationCounterSnapshot,
  getUserClassificationCounterSnapshotFromProfile,
  userClassificationCounterSnapshotValidator,
  type UserClassificationCounterSnapshot,
} from "./classifications/userCounterStats";

async function insertUserProfileAggregates(ctx: any, profile: any) {
  await userProfilesByClassificationsCount.insertIfDoesNotExist(ctx, profile);
  await userProfilesByLastActive.insertIfDoesNotExist(ctx, profile);
}

async function replaceUserProfileAggregates(ctx: any, oldProfile: any, newProfile: any) {
  // Use safe replace that handles DELETE_MISSING_KEY errors
  // This can happen if the aggregate was added after the profile was created
  for (const aggregate of [userProfilesByClassificationsCount, userProfilesByLastActive]) {
    try {
      await aggregate.replace(ctx, oldProfile, newProfile);
    } catch (error: any) {
      const code = error?.data?.code;
      const message = error?.message ?? "";
      if (code === "DELETE_MISSING_KEY" || message.includes("DELETE_MISSING_KEY")) {
        await aggregate.insert(ctx, newProfile);
      } else {
        throw error;
      }
    }
  }
}

type UserStatisticsSnapshotData = {
  total: number;
  thisWeek: number;
  byLsbClass: {
    nonLSB: number;
    LSB: number;
  };
  byMorphology: {
    featureless: number;
    irregular: number;
    spiral: number;
    elliptical: number;
  };
  averageTime: number;
  awesomeCount: number;
  validRedshiftCount: number;
  visibleNucleusCount: number;
  failedFittingCount: number;
};

type UserStatisticsDisplayData = {
  total: number;
  thisWeek: number | null;
  byLsbClass: {
    nonLSB: number;
    LSB: number;
  };
  byMorphology: {
    featureless: number;
    irregular: number;
    spiral: number;
    elliptical: number;
  };
  averageTime: number | null;
  awesomeCount: number;
  validRedshiftCount: number;
  visibleNucleusCount: number;
  failedFittingCount: number;
  _source: "cache" | "profile_fallback";
};

type UserStatisticsQueryResult = {
  data: UserStatisticsDisplayData | null;
  cache: {
    status: "cached" | "stale" | "missing";
    updatedAt: number | null;
    dirtySince: number | null;
  };
};

const USER_STATS_REFRESH_PAGE_SIZE = 500;
const USER_STATS_CRON_BATCH_SIZE = 50;
const USER_STATS_BACKFILL_CURSOR_KEY = "userStatsSnapshotBackfillCursor";

const userStatisticsSnapshotDataValidator = v.object({
  total: v.number(),
  thisWeek: v.number(),
  byLsbClass: v.object({
    nonLSB: v.number(),
    LSB: v.number(),
  }),
  byMorphology: v.object({
    featureless: v.number(),
    irregular: v.number(),
    spiral: v.number(),
    elliptical: v.number(),
  }),
  averageTime: v.number(),
  awesomeCount: v.number(),
  validRedshiftCount: v.number(),
  visibleNucleusCount: v.number(),
  failedFittingCount: v.number(),
});

const userStatisticsDisplayDataValidator = v.object({
  total: v.number(),
  thisWeek: v.union(v.number(), v.null()),
  byLsbClass: v.object({
    nonLSB: v.number(),
    LSB: v.number(),
  }),
  byMorphology: v.object({
    featureless: v.number(),
    irregular: v.number(),
    spiral: v.number(),
    elliptical: v.number(),
  }),
  averageTime: v.union(v.number(), v.null()),
  awesomeCount: v.number(),
  validRedshiftCount: v.number(),
  visibleNucleusCount: v.number(),
  failedFittingCount: v.number(),
  _source: v.union(v.literal("cache"), v.literal("profile_fallback")),
});

const userStatisticsQueryResultValidator = v.object({
  data: v.union(userStatisticsDisplayDataValidator, v.null()),
  cache: v.object({
    status: v.union(v.literal("cached"), v.literal("stale"), v.literal("missing")),
    updatedAt: v.union(v.number(), v.null()),
    dirtySince: v.union(v.number(), v.null()),
  }),
});

const userStatsRefreshPageValidator = v.object({
  page: v.array(v.object({
    createdAt: v.number(),
    timeSpent: v.number(),
    awesome_flag: v.boolean(),
    valid_redshift: v.boolean(),
    visible_nucleus: v.optional(v.boolean()),
    failed_fitting: v.optional(v.boolean()),
    lsb_class: v.number(),
    morphology: v.number(),
  })),
  continueCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

const dirtyUserStatsRefreshPageValidator = v.object({
  userIds: v.array(v.id("users")),
  continueCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

function buildUserStatisticsSnapshotData(
  counters: UserClassificationCounterSnapshot,
  thisWeek: number,
  averageTime: number
): UserStatisticsSnapshotData {
  return {
    total: counters.classificationsCount,
    thisWeek,
    byLsbClass: {
      nonLSB: counters.lsb0Count + counters.lsbNeg1Count,
      LSB: counters.lsb1Count,
    },
    byMorphology: {
      featureless: counters.morphNeg1Count,
      irregular: counters.morph0Count,
      spiral: counters.morph1Count,
      elliptical: counters.morph2Count,
    },
    averageTime,
    awesomeCount: counters.awesomeCount,
    validRedshiftCount: counters.validRedshiftCount,
    visibleNucleusCount: counters.visibleNucleusCount,
    failedFittingCount: counters.failedFittingCount,
  };
}

function buildUserStatisticsDisplayData(
  data: UserStatisticsSnapshotData,
  source: UserStatisticsDisplayData["_source"]
): UserStatisticsDisplayData {
  return {
    ...data,
    _source: source,
  };
}

function buildUserStatisticsFallbackFromProfile(
  profile: Partial<Doc<"userProfiles">>
): UserStatisticsDisplayData {
  const counters = getUserClassificationCounterSnapshotFromProfile(profile);
  const snapshot = buildUserStatisticsSnapshotData(counters, 0, 0);

  return {
    ...snapshot,
    thisWeek: null,
    averageTime: null,
    _source: "profile_fallback",
  };
}

async function insertEmptyUserStatsSnapshotIfMissing(
  ctx: any,
  profile: Pick<Doc<"userProfiles">, "userId" | "classificationsCount">
) {
  if (profile.classificationsCount !== 0) {
    return;
  }

  const existing = await ctx.db
    .query("userStatsSnapshots")
    .withIndex("by_user", (q: any) => q.eq("userId", profile.userId))
    .unique();

  if (existing) {
    return;
  }

  await ctx.db.insert("userStatsSnapshots", {
    userId: profile.userId,
    data: buildUserStatisticsSnapshotData(createEmptyUserClassificationCounterSnapshot(), 0, 0),
    updatedAt: Date.now(),
    dirty: false,
  });
}

async function resolveUserStatsTargetUserId(
  ctx: any,
  targetUserId?: Id<"users"> | null
): Promise<Id<"users"> | null> {
  const currentUserId = await getOptionalUserId(ctx);
  if (!currentUserId) {
    return null;
  }

  if (targetUserId && targetUserId !== currentUserId) {
    await requireAdmin(ctx, { notAdminMessage: "Only admins can view other users' statistics" });
    return targetUserId;
  }

  return currentUserId;
}
// adminSetUserPassword removed: we now only support email-based reset flow.

// Get user preferences
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    const defaultQuality = await getDefaultImageQuality(ctx);

    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // console.log("[convex:getUserPreferences]", {
    //   userId,
    //   hasPrefs: !!prefs,
    //   prefsImageQuality: prefs?.imageQuality,
    //   defaultQuality,
    // });

    return prefs || {
      imageQuality: defaultQuality,
      theme: "auto" as const,
      contrast: 1.0,
      ellipseSettings: undefined,
    };
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    imageQuality: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("auto"))),
    contrast: v.optional(v.number()),
    ellipseSettings: v.optional(v.record(v.string(), v.boolean())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const defaultQuality = await getDefaultImageQuality(ctx);

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // console.log("[convex:updatePreferences]", {
    //   userId,
    //   args,
    //   hasExisting: !!existing,
    //   defaultQuality,
    // });

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        imageQuality: args.imageQuality || defaultQuality,
        theme: args.theme || "auto",
        contrast: args.contrast || 1.0,
        ellipseSettings: args.ellipseSettings,
      });
    }

    // console.log("[convex:updatePreferences] success");
    return { success: true };
  },
});

// Initialize user profile
export const initializeUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await insertUserProfileAggregates(ctx, existing);
      await insertEmptyUserStatsSnapshotIfMissing(ctx, existing);
      return existing;
    }

    // Check if anonymous users are allowed
    const anonymousAllowed = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowAnonymous"))
      .unique();

    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      role: "user",
      isActive: true,
      isConfirmed: anonymousAllowed?.value === true || false, // Auto-confirm if anonymous allowed
      classificationsCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      sequenceGenerated: false,
    });
    const createdProfile = await ctx.db.get(profileId);
    if (createdProfile) {
      await insertUserProfileAggregates(ctx, createdProfile);
      await insertEmptyUserStatsSnapshotIfMissing(ctx, createdProfile);
    }

    return createdProfile;
  },
});

// Get user profile
export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    return {
      user,
      ...profile,
    };
  },
});

export const resolveUserStatsTargetUserIdInternal = internalQuery({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    return await resolveUserStatsTargetUserId(ctx, args.targetUserId ?? null);
  },
});

export const getUserStatsRefreshPageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: userStatsRefreshPageValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .paginate({ numItems: USER_STATS_REFRESH_PAGE_SIZE, cursor: args.cursor });

    return {
      page: page.page.map((classification) => ({
        createdAt: classification._creationTime,
        timeSpent: classification.timeSpent,
        awesome_flag: classification.awesome_flag,
        valid_redshift: classification.valid_redshift,
        visible_nucleus: classification.visible_nucleus,
        failed_fitting: classification.failed_fitting,
        lsb_class: classification.lsb_class,
        morphology: classification.morphology,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getDirtyUserStatsRefreshPageInternal = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: dirtyUserStatsRefreshPageValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("userStatsSnapshots")
      .withIndex("by_dirty_and_updated_at", (q) => q.eq("dirty", true))
      .paginate({ numItems: USER_STATS_CRON_BATCH_SIZE, cursor: args.cursor });

    return {
      userIds: page.page.map((snapshot) => snapshot.userId),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getUserStatsBackfillCursorInternal = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const cursorSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", USER_STATS_BACKFILL_CURSOR_KEY))
      .unique();

    return typeof cursorSetting?.value === "string" ? cursorSetting.value : null;
  },
});

export const setUserStatsBackfillCursorInternal = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", USER_STATS_BACKFILL_CURSOR_KEY))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.cursor });
    } else {
      await ctx.db.insert("systemSettings", {
        key: USER_STATS_BACKFILL_CURSOR_KEY,
        value: args.cursor,
      });
    }

    return null;
  },
});

export const getMissingUserStatsRefreshPageInternal = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  returns: dirtyUserStatsRefreshPageValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("userProfiles")
      .paginate({ numItems: Math.max(1, Math.min(args.limit, USER_STATS_CRON_BATCH_SIZE)), cursor: args.cursor });

    const userIds: Id<"users">[] = [];

    for (const profile of page.page) {
      const snapshot = await ctx.db
        .query("userStatsSnapshots")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .unique();

      if (!snapshot?.data) {
        userIds.push(profile.userId);
      }
    }

    return {
      userIds,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const persistUserStatsSnapshotInternal = internalMutation({
  args: {
    userId: v.id("users"),
    data: userStatisticsSnapshotDataValidator,
    counters: userClassificationCounterSnapshotValidator,
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile) {
      const profilePatch = buildUserClassificationCounterPatch(profile, args.counters);
      if (Object.keys(profilePatch).length > 0) {
        await ctx.db.patch(profile._id, profilePatch);
        const refreshedProfile = await ctx.db.get(profile._id);
        if (refreshedProfile && profilePatch.classificationsCount !== undefined) {
          await replaceUserProfileAggregates(ctx, profile, refreshedProfile);
        }
      }
    }

    const updatedAt = Date.now();
    const existingSnapshot = await ctx.db
      .query("userStatsSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existingSnapshot) {
      await ctx.db.patch(existingSnapshot._id, {
        data: args.data,
        updatedAt,
        dirty: false,
      });
    } else {
      await ctx.db.insert("userStatsSnapshots", {
        userId: args.userId,
        data: args.data,
        updatedAt,
        dirty: false,
      });
    }

    return { updatedAt };
  },
});

async function recomputeAndPersistUserStatsSnapshot(
  ctx: any,
  userId: Id<"users">
): Promise<{ updatedAt: number }> {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counters = createEmptyUserClassificationCounterSnapshot();
  let totalTimeSpentMs = 0;
  let thisWeek = 0;
  let cursor: string | null = null;

  while (true) {
    const page: {
      page: Array<{
        createdAt: number;
        timeSpent: number;
        awesome_flag: boolean;
        valid_redshift: boolean;
        visible_nucleus?: boolean;
        failed_fitting?: boolean;
        lsb_class: number;
        morphology: number;
      }>;
      continueCursor: string | null;
      isDone: boolean;
    } = await ctx.runQuery(internal.users.getUserStatsRefreshPageInternal, {
      userId,
      cursor,
    });

    for (const classification of page.page) {
      counters.classificationsCount += 1;
      if (classification.createdAt >= oneWeekAgo) {
        thisWeek += 1;
      }
      totalTimeSpentMs += classification.timeSpent;

      if (classification.awesome_flag) counters.awesomeCount += 1;
      if (classification.visible_nucleus) counters.visibleNucleusCount += 1;
      if (classification.failed_fitting) counters.failedFittingCount += 1;
      if (classification.valid_redshift) counters.validRedshiftCount += 1;

      switch (classification.lsb_class) {
        case -1:
          counters.lsbNeg1Count += 1;
          break;
        case 0:
          counters.lsb0Count += 1;
          break;
        case 1:
          counters.lsb1Count += 1;
          break;
      }

      switch (classification.morphology) {
        case -1:
          counters.morphNeg1Count += 1;
          break;
        case 0:
          counters.morph0Count += 1;
          break;
        case 1:
          counters.morph1Count += 1;
          break;
        case 2:
          counters.morph2Count += 1;
          break;
      }
    }

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  const averageTime = counters.classificationsCount > 0
    ? Math.round(totalTimeSpentMs / counters.classificationsCount / 1000)
    : 0;

  return await ctx.runMutation(internal.users.persistUserStatsSnapshotInternal, {
    userId,
    data: buildUserStatisticsSnapshotData(counters, thisWeek, averageTime),
    counters,
  });
}

export const refreshUserStatsSnapshot = action({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args): Promise<{ updatedAt: number }> => {
    const userId: Id<"users"> | null = await ctx.runQuery(internal.users.resolveUserStatsTargetUserIdInternal, {
      targetUserId: args.targetUserId,
    });

    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await recomputeAndPersistUserStatsSnapshot(ctx, userId);
  },
});

export const refreshDirtyUserStatsSnapshots = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let cursor: string | null = null;
    let processed = 0;

    while (processed < USER_STATS_CRON_BATCH_SIZE) {
      const page: {
        userIds: Id<"users">[];
        continueCursor: string | null;
        isDone: boolean;
      } = await ctx.runQuery(internal.users.getDirtyUserStatsRefreshPageInternal, { cursor });

      for (const userId of page.userIds) {
        try {
          await recomputeAndPersistUserStatsSnapshot(ctx, userId);
        } catch (error) {
          console.error("[users:refreshDirtyUserStatsSnapshots] failed to refresh snapshot", {
            userId,
            error,
          });
        }

        processed += 1;
        if (processed >= USER_STATS_CRON_BATCH_SIZE) {
          break;
        }
      }

      if (page.isDone || processed >= USER_STATS_CRON_BATCH_SIZE) {
        break;
      }

      cursor = page.continueCursor;
    }

    const remaining = USER_STATS_CRON_BATCH_SIZE - processed;
    if (remaining > 0) {
      const backfillCursor: string | null = await ctx.runQuery(
        internal.users.getUserStatsBackfillCursorInternal,
        {}
      );
      const backfillPage: {
        userIds: Id<"users">[];
        continueCursor: string | null;
        isDone: boolean;
      } = await ctx.runQuery(internal.users.getMissingUserStatsRefreshPageInternal, {
        cursor: backfillCursor,
        limit: remaining,
      });

      for (const userId of backfillPage.userIds) {
        try {
          await recomputeAndPersistUserStatsSnapshot(ctx, userId);
        } catch (error) {
          console.error("[users:refreshDirtyUserStatsSnapshots] failed to backfill snapshot", {
            userId,
            error,
          });
        }
      }

      await ctx.runMutation(internal.users.setUserStatsBackfillCursorInternal, {
        cursor: backfillPage.isDone ? null : backfillPage.continueCursor,
      });
    }

    return null;
  },
});

// Get user statistics
// If targetUserId is provided, requires admin access to view other users' stats
export const getUserStats = query({
  args: {
    targetUserId: v.optional(v.id("users")),
  },
  returns: v.union(userStatisticsQueryResultValidator, v.null()),
  handler: async (ctx, args): Promise<UserStatisticsQueryResult | null> => {
    const userId = await resolveUserStatsTargetUserId(ctx, args.targetUserId ?? null);
    if (!userId) {
      return null;
    }

    const [profile, snapshotDoc] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db
        .query("userStatsSnapshots")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    ]);

    if (snapshotDoc?.data) {
      return {
        data: buildUserStatisticsDisplayData(snapshotDoc.data, "cache"),
        cache: {
          status: snapshotDoc.dirty ? "stale" : "cached",
          updatedAt: snapshotDoc.updatedAt > 0 ? snapshotDoc.updatedAt : null,
          dirtySince: snapshotDoc.dirty ? snapshotDoc.dirtySince ?? null : null,
        },
      };
    }

    return {
      data: profile ? buildUserStatisticsFallbackFromProfile(profile) : null,
      cache: {
        status: "missing",
        updatedAt: null,
        dirtySince: snapshotDoc?.dirtySince ?? null,
      },
    };
  },
});

// Admin: Get list of users for dropdown selection (lightweight version)
export const getUsersForSelection = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Only admins can access user list" });

    const allUsers = await ctx.db.query("users").collect();

    const usersWithProfiles = await Promise.all(
      allUsers.map(async (user) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();

        return {
          userId: user._id,
          email: (user as any).email ?? null,
          name: (user as any).name ?? null,
          classificationsCount: profile?.classificationsCount ?? 0,
          role: profile?.role ?? "user",
        };
      })
    );

    // Sort by classifications count descending, then by name/email
    return usersWithProfiles.sort((a, b) => {
      if (b.classificationsCount !== a.classificationsCount) {
        return b.classificationsCount - a.classificationsCount;
      }
      const aName = a.name || a.email || "";
      const bName = b.name || b.email || "";
      return aName.localeCompare(bName);
    });
  },
});

// Admin: Lightweight per-user statistics overview for table views
export const getUsersStatisticsOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, { notAdminMessage: "Only admins can access per-user statistics" });

    const [allUsers, allProfiles, allSequences] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("galaxySequences").collect(),
    ]);

    const profilesByUserId = new Map(allProfiles.map((profile) => [profile.userId, profile]));

    const latestSequenceByUserId = new Map<Id<"users">, Doc<"galaxySequences">>();
    for (const sequence of allSequences) {
      const existing = latestSequenceByUserId.get(sequence.userId);
      if (!existing || sequence._creationTime > existing._creationTime) {
        latestSequenceByUserId.set(sequence.userId, sequence);
      }
    }

    const rows = allUsers.map((user) => {
      const profile = profilesByUserId.get(user._id);
      const sequence = latestSequenceByUserId.get(user._id);

      const assignedGalaxies = sequence?.galaxyExternalIds?.length ?? 0;
      const classifiedInSequence = sequence?.numClassified ?? 0;
      const skippedInSequence = sequence?.numSkipped ?? 0;
      const completedInSequence = classifiedInSequence + skippedInSequence;
      const remainingInSequence = Math.max(assignedGalaxies - completedInSequence, 0);
      const completionPercent =
        assignedGalaxies > 0 ? (completedInSequence / assignedGalaxies) * 100 : 0;

      return {
        userId: user._id,
        name: (user as any).name ?? null,
        email: (user as any).email ?? null,
        role: profile?.role ?? "user",
        isActive: profile?.isActive ?? false,
        isConfirmed: profile?.isConfirmed ?? null,
        joinedAt: profile?.joinedAt ?? user._creationTime,
        lastActiveAt: profile?.lastActiveAt ?? null,

        classificationsCount: profile?.classificationsCount ?? 0,
        awesomeCount: profile?.awesomeCount ?? 0,
        visibleNucleusCount: profile?.visibleNucleusCount ?? 0,
        validRedshiftCount: profile?.validRedshiftCount ?? 0,
        failedFittingCount: profile?.failedFittingCount ?? 0,

        assignedGalaxies,
        classifiedInSequence,
        skippedInSequence,
        completedInSequence,
        remainingInSequence,
        completionPercent,
      };
    });

    rows.sort((a, b) => {
      if (b.classificationsCount !== a.classificationsCount) {
        return b.classificationsCount - a.classificationsCount;
      }
      if ((b.lastActiveAt ?? 0) !== (a.lastActiveAt ?? 0)) {
        return (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0);
      }
      const aName = a.name || a.email || "";
      const bName = b.name || b.email || "";
      return aName.localeCompare(bName);
    });

    return rows;
  },
});

// Admin: Get user by ID
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db.get(args.userId);
  },
});

// Admin: Get user profile by userId
export const getUserProfileById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return profile;
  },
});

// Admin: Get basic user info (name/email) by userId
export const getUserBasicInfo = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args
  ): Promise<{
    userId: Id<"users">;
    name: string | null;
    email: string | null;
    profile: Doc<"userProfiles"> | null;
  } | null> => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      userId: args.userId,
      name: user.name ?? null,
      email: user.email ?? null,
      profile: profile ?? null,
    };
  },
});

// Admin: Get all users
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get all users from the users table
    const allUsers = await ctx.db.query("users").collect();

    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        // Try to find existing profile
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();

        // Fetch galaxy sequence to get assigned count
        const sequence = await ctx.db
          .query("galaxySequences")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();
        const assignedGalaxiesCount = sequence?.galaxyExternalIds?.length ?? 0;

        // If no profile exists, create a temporary one for display
        if (!profile) {
          return {
            _id: `temp_${user._id}` as any,
            userId: user._id,
            role: "user" as const,
            isActive: false,
            isConfirmed: false,
            classificationsCount: 0,
            assignedGalaxiesCount,
            joinedAt: user._creationTime,
            lastActiveAt: user._creationTime,
            sequenceGenerated: false,
            user,
          };
        }

        return {
          ...profile,
          assignedGalaxiesCount,
          user,
        };
      })
    );

    return usersWithDetails;
  },
});

// Admin: Update user status
export const updateUserStatus = mutation({
  args: {
    targetUserId: v.id("users"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: args.isActive,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) {
        await insertUserProfileAggregates(ctx, newProfile);
        await insertEmptyUserStatsSnapshotIfMissing(ctx, newProfile);
      }
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isActive: args.isActive,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

    return { success: true };
  },
});

// Admin: Confirm user account
export const confirmUser = mutation({
  args: {
    targetUserId: v.id("users"),
    isConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: "user",
        isActive: true,
        isConfirmed: args.isConfirmed,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) {
        await insertUserProfileAggregates(ctx, newProfile);
        await insertEmptyUserStatsSnapshotIfMissing(ctx, newProfile);
      }
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      isConfirmed: args.isConfirmed,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

    return { success: true };
  },
});

// Admin: Update user role
export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    // Create profile if it doesn't exist
    if (!targetProfile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId: args.targetUserId,
        role: args.role,
        isActive: true,
        isConfirmed: true,
        classificationsCount: 0,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        sequenceGenerated: false,
      });
      const newProfile = await ctx.db.get(profileId);
      if (newProfile) {
        await insertUserProfileAggregates(ctx, newProfile);
        await insertEmptyUserStatsSnapshotIfMissing(ctx, newProfile);
      }
      return { success: true };
    }

    await ctx.db.patch(targetProfile._id, {
      role: args.role,
    });

    const updatedProfile = await ctx.db.get(targetProfile._id);
    if (updatedProfile) await replaceUserProfileAggregates(ctx, targetProfile, updatedProfile);

    return { success: true };
  },
});

// Admin: Delete user
export const deleteUser = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Avoid hard failures when aggregate entries are missing for older data
    const safeAggregateDelete = async (label: string, op: () => Promise<void>) => {
      try {
        await op();
      } catch (error: any) {
        const message: string | undefined = error?.message;
        const code: string | undefined = error?.data?.code;
        if (code === "DELETE_MISSING_KEY" || message?.includes("DELETE_MISSING_KEY")) {
          console.warn(`[users:deleteUser] missing aggregate entry for ${label}, skipping delete`);
          return;
        }
        throw error;
      }
    };

    // Delete user profile
    const targetProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (targetProfile) {
      await safeAggregateDelete("userProfilesByClassificationsCount", () =>
        userProfilesByClassificationsCount.delete(ctx, targetProfile)
      );
      await safeAggregateDelete("userProfilesByLastActive", () =>
        userProfilesByLastActive.delete(ctx, targetProfile)
      );
      await ctx.db.delete(targetProfile._id);
    }

    // Delete user preferences
    const userPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (userPrefs) {
      await ctx.db.delete(userPrefs._id);
    }

    const userStatsSnapshot = await ctx.db
      .query("userStatsSnapshots")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (userStatsSnapshot) {
      await ctx.db.delete(userStatsSnapshot._id);
    }

    // Delete user classifications
    const classifications = await ctx.db
      .query("classifications")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const classification of classifications) {
      await safeAggregateDelete("classificationsByCreated", () =>
        classificationsByCreated.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByAwesomeFlag", () =>
        classificationsByAwesomeFlag.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByVisibleNucleus", () =>
        classificationsByVisibleNucleus.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByFailedFitting", () =>
        classificationsByFailedFitting.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByValidRedshift", () =>
        classificationsByValidRedshift.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByLsbClass", () =>
        classificationsByLsbClass.delete(ctx, classification)
      );
      await safeAggregateDelete("classificationsByMorphology", () =>
        classificationsByMorphology.delete(ctx, classification)
      );
      await ctx.db.delete(classification._id);
    }

    // Delete user skipped galaxies
    const skipped = await ctx.db
      .query("skippedGalaxies")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const skip of skipped) {
      await ctx.db.delete(skip._id);
    }

    // Delete user galaxy sequences
    const sequences = await ctx.db
      .query("galaxySequences")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    for (const sequence of sequences) {
      await ctx.db.delete(sequence._id);
    }

    // Delete the user from the users table
    await ctx.db.delete(args.targetUserId);

    return { success: true };
  },
});

// Admin: Reset user password (send reset email)
// export const resetUserPassword = action({
//   args: { targetUserId: v.id("users") },
//   handler: async (ctx, args) => {
//     const adminUserId = await getAuthUserId(ctx);
//     if (!adminUserId) throw new Error("Not authenticated");

//     // Check admin permissions using runQuery
//     const adminProfile = await ctx.runQuery(api.users.getUserProfileById, { userId: adminUserId });
//     if (!adminProfile || adminProfile.role !== "admin") {
//       throw new Error("Admin access required");
//     }

//     // Get target user data using runQuery
//     const targetUser = await ctx.runQuery(api.users.getUserById, { userId: args.targetUserId });
//     if (!targetUser?.email) {
//       throw new Error("Target user has no email to send reset");
//     }

//     // Get settings using runQuery
//     const settings = await ctx.runQuery(api.system_settings.getSystemSettings);
//     const emailFrom = settings.emailFrom || "noreply@galaxies.michalvrabel.sk";
//     const appName = settings.appName || "Galaxy Classification App";

//     // Send password reset email
//     await sendPasswordResetEmail(targetUser.email, `${appName} <${emailFrom}>`);

//     return {
//       success: true,
//       message: "Password reset email sent successfully.",
//     };
//   },
// });

// Debug: Allow user to become admin (for debugging purposes)
export const becomeAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireUserProfile(ctx, {
      missingProfileMessage: "User profile not found",
    });

    // Check if debug admin mode is enabled
    const settings = await ctx.db.query("systemSettings").collect();
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    if (!settingsMap.debugAdminMode) {
      throw new Error("Debug admin mode is not enabled");
    }

    // Update user role to admin
    await ctx.db.patch(profile._id, { role: "admin" });

    return { success: true };
  },
});

// Update user name
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    await ctx.db.patch(userId, { name: args.name });

    return { success: true };
  },
});
