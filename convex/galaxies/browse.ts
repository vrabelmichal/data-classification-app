import { v } from "convex/values";
import { query } from "../_generated/server";
import { galaxySchemaDefinition } from "../schema";
import { browseGalaxiesArgs } from "./browser/args";
import {
  browseGalaxiesHandler,
  getClassificationSearchOptionsHandler,
  getGalaxySearchBoundsHandler,
} from "./browser/handlers";

const lsbClassValueValidator = v.union(v.literal(-1), v.literal(0), v.literal(1));
const morphologyValueValidator = v.union(v.literal(-1), v.literal(0), v.literal(1), v.literal(2));

const nullableNumberRangeValidator = v.object({
  min: v.union(v.number(), v.null()),
  max: v.union(v.number(), v.null()),
});

const galaxyCurrentBoundsValidator = v.object({
  ra: nullableNumberRangeValidator,
  dec: nullableNumberRangeValidator,
  reff: nullableNumberRangeValidator,
  q: nullableNumberRangeValidator,
  pa: nullableNumberRangeValidator,
  mag: nullableNumberRangeValidator,
  mean_mue: nullableNumberRangeValidator,
  nucleus: v.object({
    hasNucleus: v.boolean(),
    totalCount: v.number(),
  }),
});

const galaxySearchBoundsValidator = v.object({
  ra: nullableNumberRangeValidator,
  dec: nullableNumberRangeValidator,
  reff: nullableNumberRangeValidator,
  q: nullableNumberRangeValidator,
  pa: nullableNumberRangeValidator,
  mag: nullableNumberRangeValidator,
  mean_mue: nullableNumberRangeValidator,
  nucleus: v.object({
    hasNucleus: v.boolean(),
    totalCount: v.number(),
  }),
  totalClassifications: nullableNumberRangeValidator,
  numVisibleNucleus: nullableNumberRangeValidator,
  numAwesomeFlag: nullableNumberRangeValidator,
  totalAssigned: nullableNumberRangeValidator,
});

const browseGalaxyValidator = v.object({
  _id: v.id("galaxies"),
  _creationTime: v.number(),
  ...galaxySchemaDefinition,
  classificationId: v.optional(v.id("classifications")),
  classifiedAt: v.optional(v.number()),
  skippedRecordId: v.optional(v.id("skippedGalaxies")),
  skippedAt: v.optional(v.number()),
  skippedComments: v.optional(v.union(v.string(), v.null())),
});

const browseGalaxiesResultValidator = v.object({
  galaxies: v.array(browseGalaxyValidator),
  total: v.optional(v.number()),
  hasNext: v.boolean(),
  hasPrevious: v.boolean(),
  totalPages: v.optional(v.number()),
  aggregatesPopulated: v.boolean(),
  currentBounds: galaxyCurrentBoundsValidator,
  cursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

const classificationSearchOptionsValidator = v.object({
  lsbClasses: v.array(lsbClassValueValidator),
  morphologies: v.array(morphologyValueValidator),
});

export const browseGalaxies = query({
  args: browseGalaxiesArgs,
  returns: browseGalaxiesResultValidator,
  handler: browseGalaxiesHandler,
});

export const getGalaxySearchBounds = query({
  args: {},
  returns: galaxySearchBoundsValidator,
  handler: getGalaxySearchBoundsHandler,
});

export const getClassificationSearchOptions = query({
  args: {},
  returns: classificationSearchOptionsValidator,
  handler: getClassificationSearchOptionsHandler,
});
