import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Galaxy data
  galaxies: defineTable({
    id: v.string(), // External galaxy ID
    ra: v.number(), // Right ascension
    dec: v.number(), // Declination
    reff: v.number(), // Effective radius
    q: v.number(), // Axis ratio
    pa: v.number(), // Position angle
    nucleus: v.boolean(), // Has nucleus
    imageUrl: v.optional(v.string()), // URL to galaxy image
    // Legacy fields for existing data
    isActive: v.optional(v.boolean()),
    redshift_x: v.optional(v.number()),
    redshift_y: v.optional(v.number()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  }).index("by_external_id", ["id"]),

  // User profiles
  userProfiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
    isActive: v.boolean(),
    isConfirmed: v.optional(v.boolean()), // Legacy field
    classificationsCount: v.number(),
    joinedAt: v.number(),
    lastActiveAt: v.number(),
    sequenceGenerated: v.optional(v.boolean()), // Legacy field
  }).index("by_user", ["userId"]),

  // User preferences
  userPreferences: defineTable({
    userId: v.id("users"),
    imageQuality: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    showKeyboardHints: v.optional(v.boolean()),  // should be removed, keeping just to prevent the error
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
    contrast: v.number(),
    brightness: v.optional(v.number()), // Legacy field
  }).index("by_user", ["userId"]),

  // Galaxy classifications
  classifications: defineTable({
    userId: v.id("users"),
    galaxyId: v.union(v.id("galaxies"), v.string()), // Support both old and new formats
    lsb_class: v.number(), // -1, 0, 1
    morphology: v.number(), // -1, 0, 1, 2
    awesome_flag: v.boolean(),
    valid_redshift: v.boolean(),
    visible_nucleus: v.optional(v.boolean()), // User confirmation of visible nucleus
    comments: v.optional(v.string()),
    sky_bkg: v.optional(v.number()),
    timeSpent: v.number(), // milliseconds
  })
    .index("by_user", ["userId"])
    .index("by_galaxy", ["galaxyId"])
    .index("by_user_and_galaxy", ["userId", "galaxyId"]),

  // Skipped galaxies
  skippedGalaxies: defineTable({
    userId: v.id("users"),
    galaxyId: v.id("galaxies"),
    comments: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_galaxy", ["galaxyId"])
    .index("by_user_and_galaxy", ["userId", "galaxyId"]),

  // Galaxy sequences for users
  galaxySequences: defineTable({
    userId: v.id("users"),
    galaxyIds: v.optional(v.array(v.id("galaxies"))), // Ordered list of galaxy IDs
    // Legacy fields for existing data
    // galaxyId: v.optional(v.string()),
    // nextGalaxyId: v.optional(v.string()),
    // previousGalaxyId: v.optional(v.string()),
    // sequenceOrder: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // System settings
  systemSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
