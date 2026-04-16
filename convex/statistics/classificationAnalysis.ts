import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  classificationsByCreated,
  galaxyIdsAggregate,
  galaxiesByNucleus,
} from "../galaxies/aggregates";
import { requireUserProfile } from "../lib/auth";
import { hasPermissionForRole } from "../lib/permissions";
import { loadMergedSystemSettings } from "../lib/systemSettings";

const DEFAULT_GALAXY_PAGE_SIZE = 2500;
const DEFAULT_CLASSIFICATION_PAGE_SIZE = 2500;
const MAX_GALAXY_PAGE_SIZE = 2500;
const MAX_CLASSIFICATION_PAGE_SIZE = 2500;

const analysisGalaxyValidator = v.object({
  _id: v.id("galaxies"),
  id: v.string(),
  numericId: v.union(v.number(), v.null()),
  ra: v.number(),
  dec: v.number(),
  reff: v.number(),
  q: v.number(),
  nucleus: v.boolean(),
  mag: v.union(v.number(), v.null()),
  mean_mue: v.union(v.number(), v.null()),
  paper: v.union(v.string(), v.null()),
  totalClassifications: v.number(),
  numVisibleNucleus: v.number(),
  numAwesomeFlag: v.number(),
  numFailedFitting: v.number(),
});

const analysisClassificationValidator = v.object({
  _id: v.id("classifications"),
  _creationTime: v.number(),
  userId: v.id("users"),
  galaxyExternalId: v.string(),
  lsb_class: v.number(),
  morphology: v.number(),
  awesome_flag: v.boolean(),
  valid_redshift: v.boolean(),
  visible_nucleus: v.optional(v.boolean()),
  failed_fitting: v.optional(v.boolean()),
  comments: v.optional(v.string()),
});

const analysisUserDirectoryEntryValidator = v.object({
  userId: v.id("users"),
  displayName: v.string(),
});

async function requireClassificationAnalysisAccess(
  ctx: Parameters<typeof loadMergedSystemSettings>[0]
) {
  const { userId, profile } = await requireUserProfile(ctx, {
    authMessage: "Not authenticated",
    missingProfileMessage: "User profile not found",
  });

  const settings = await loadMergedSystemSettings(ctx);
  if (hasPermissionForRole(profile.role, settings, "viewDataAnalysis")) {
    return { userId, profile };
  }

  if (!settings.allowPublicDataAnalysis) {
    throw new Error("This account does not have access to the data analysis page");
  }

  return { userId, profile };
}

export const getDatasetSummary = query({
  args: {},
  returns: v.object({
    totalGalaxies: v.number(),
    totalClassifications: v.number(),
    catalogNucleusGalaxies: v.number(),
    availablePapers: v.array(v.string()),
  }),
  handler: async (ctx) => {
    await requireClassificationAnalysisAccess(ctx);

    const settings = await loadMergedSystemSettings(ctx);
    const [totalGalaxies, totalClassifications, catalogNucleusGalaxies] =
      await Promise.all([
        galaxyIdsAggregate.count(ctx),
        classificationsByCreated.count(ctx),
        galaxiesByNucleus.count(ctx, {
          bounds: {
            lower: { key: true, inclusive: true },
            upper: { key: true, inclusive: true },
          },
        }),
      ]);

    return {
      totalGalaxies,
      totalClassifications,
      catalogNucleusGalaxies,
      availablePapers: settings.availablePapers,
    };
  },
});

export const getUserDirectory = query({
  args: {},
  returns: v.array(analysisUserDirectoryEntryValidator),
  handler: async (ctx) => {
    await requireClassificationAnalysisAccess(ctx);

    const users = await ctx.db.query("users").collect();

    return users
      .map((user) => {
        const rawName = typeof user.name === "string" ? user.name.trim() : "";
        return {
          userId: user._id,
          displayName:
            rawName.length > 0 ? rawName : `User ${String(user._id).slice(-6)}`,
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  },
});

export const getGalaxyPage = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(analysisGalaxyValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireClassificationAnalysisAccess(ctx);

    const limit = Math.max(
      1,
      Math.min(args.limit ?? DEFAULT_GALAXY_PAGE_SIZE, MAX_GALAXY_PAGE_SIZE)
    );

    const page = await ctx.db.query("galaxies").paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    });

    return {
      page: page.page.map((galaxy) => ({
        _id: galaxy._id,
        id: galaxy.id,
        numericId:
          galaxy.numericId === undefined || galaxy.numericId === null
            ? null
            : Number(galaxy.numericId),
        ra: galaxy.ra,
        dec: galaxy.dec,
        reff: galaxy.reff,
        q: galaxy.q,
        nucleus: galaxy.nucleus,
        mag: galaxy.mag ?? null,
        mean_mue: galaxy.mean_mue ?? null,
        paper: galaxy.misc?.paper ?? null,
        totalClassifications: Number(galaxy.totalClassifications ?? 0),
        numVisibleNucleus: Number(galaxy.numVisibleNucleus ?? 0),
        numAwesomeFlag: Number(galaxy.numAwesomeFlag ?? 0),
        numFailedFitting: Number(galaxy.numFailedFitting ?? 0),
      })),
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

export const getClassificationPage = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(analysisClassificationValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireClassificationAnalysisAccess(ctx);

    const limit = Math.max(
      1,
      Math.min(
        args.limit ?? DEFAULT_CLASSIFICATION_PAGE_SIZE,
        MAX_CLASSIFICATION_PAGE_SIZE
      )
    );

    const page = await ctx.db
      .query("classifications")
      .withIndex("by_galaxy")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });

    return {
      page: page.page.map((classification) => ({
        _id: classification._id,
        _creationTime: classification._creationTime,
        userId: classification.userId,
        galaxyExternalId: classification.galaxyExternalId,
        lsb_class: classification.lsb_class,
        morphology: classification.morphology,
        awesome_flag: classification.awesome_flag,
        valid_redshift: classification.valid_redshift,
        visible_nucleus: classification.visible_nucleus,
        failed_fitting: classification.failed_fitting,
        comments: classification.comments,
      })),
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});