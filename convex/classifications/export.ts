import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

const classificationExportRowValidator = v.object({
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
  sky_bkg: v.optional(v.number()),
  timeSpent: v.number(),
});

export const getAdminExportBatch = query({
  args: {
    userId: v.optional(v.id("users")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(classificationExportRowValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, {
      notAdminMessage: "Only admins can export classification data",
    });

    const paginationResult = args.userId
      ? await ctx.db
          .query("classifications")
          .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", args.userId!))
          .paginate(args.paginationOpts)
      : await ctx.db.query("classifications").paginate(args.paginationOpts);

    return {
      page: paginationResult.page.map((classification) => ({
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
        sky_bkg: classification.sky_bkg,
        timeSpent: classification.timeSpent,
      })),
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.isDone ? null : paginationResult.continueCursor,
    };
  },
});