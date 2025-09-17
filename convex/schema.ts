import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";


// Core galaxy schema (after splitting large nested photometry & thuruthipilly tables)
export const galaxySchemaDefinition = {
  id: v.string(),
  ra: v.number(),
  dec: v.number(),
  reff: v.number(),
  q: v.number(),
  pa: v.number(),
  nucleus: v.boolean(),
  // Legacy / misc fields that remain
  isActive: v.optional(v.boolean()),
  redshift_x: v.optional(v.number()),
  redshift_y: v.optional(v.number()),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  misc: v.object({
    is_detr: v.optional(v.boolean()),
    is_vit: v.optional(v.boolean()),
    paper: v.optional(v.string()),
    dataset: v.optional(v.string()),
    tilename: v.optional(v.string()),
    thur_cls: v.optional(v.string()),
    thur_cls_n: v.optional(v.number()),
  }),
};

// Photometry per band (g, r, i) – Sersic parameters only
export const photometryBandSchema = {
  galaxyRef: v.id("galaxies"),
  band: v.literal("g"), // For specific table we fix band, but keep field for clarity / debugging
  sersic: v.object({
    mag: v.optional(v.number()),
    mag_error: v.optional(v.number()),
    mag_rel_error: v.optional(v.number()),
    mean_mue: v.optional(v.number()),
    mue: v.optional(v.number()),
    x_error: v.optional(v.number()),
    psf: v.optional(
      v.object({
        mag: v.optional(v.number()),
        mag_error: v.optional(v.number()),
        mag_rel_error: v.optional(v.number()),
        x: v.optional(v.number()),
        x_error: v.optional(v.number()),
        x_rel_error: v.optional(v.number()),
      })
    ),
  }),
};

// Define separate schemas for r and i bands (slightly fewer fields historically)
export const photometryBandSchemaR = {
  galaxyRef: v.id("galaxies"),
  band: v.literal("r"),
  sersic: v.optional(v.object({
    mean_mue: v.optional(v.number()),
    mue: v.optional(v.number()),
    mag: v.optional(v.number()),
    mag_error: v.optional(v.number()),
    mag_rel_error: v.optional(v.number()),
    x_error: v.optional(v.number()),
    psf: v.optional(
      v.object({
        mag: v.optional(v.number()),
        mag_error: v.optional(v.number()),
      })
    ),
  })),
};

export const photometryBandSchemaI = {
  galaxyRef: v.id("galaxies"),
  band: v.literal("i"),
  sersic: v.optional(v.object({
    mean_mue: v.optional(v.number()),
    mue: v.optional(v.number()),
    mag: v.optional(v.number()),
    mag_error: v.optional(v.number()),
    mag_rel_error: v.optional(v.number()),
    x_error: v.optional(v.number()),
    psf: v.optional(
      v.object({
        mag: v.optional(v.number()),
        mag_error: v.optional(v.number()),
      })
    ),
  })),
};

// Unified source extractor table for all bands (g,r,i,y,z)
export const sourceExtractorSchema = {
  galaxyRef: v.id("galaxies"),
  // Flatten bands inside single doc: source_extractor.g.mag_auto, etc.
  g: v.object({
    mag_auto: v.optional(v.number()),
    mu_mean_model: v.optional(v.number()),
    flux_radius: v.optional(v.number()),
  }),
  r: v.object({
    mag_auto: v.optional(v.number()),
    mu_mean_model: v.optional(v.number()),
    flux_radius: v.optional(v.number()),
  }),
  i: v.object({
    mag_auto: v.optional(v.number()),
    mu_mean_model: v.optional(v.number()),
    flux_radius: v.optional(v.number()),
  }),
  y: v.optional(v.object({
    mag_auto: v.optional(v.number()),
    mu_mean_model: v.optional(v.number()),
    flux_radius: v.optional(v.number()),
  })),
  z: v.optional(v.object({
    mag_auto: v.optional(v.number()),
    mu_mean_model: v.optional(v.number()),
    flux_radius: v.optional(v.number()),
  })),
};

// Thuruthipilly table
export const thuruthipillySchema = {
  galaxyRef: v.id("galaxies"),
  n: v.optional(v.number()),
  q: v.optional(v.number()),
  reff_g: v.optional(v.number()),
  reff_i: v.optional(v.number()),
  mag_g_cor: v.optional(v.number()),
  mag_g_gf: v.optional(v.number()),
  mag_i_cor: v.optional(v.number()),
  mag_i_gf: v.optional(v.number()),
  mue_mean_g_gf: v.optional(v.number()),
  mu_mean_g_cor: v.optional(v.number()),
  mue_mean_i_gf: v.optional(v.number()),
  mu_mean_i_cor: v.optional(v.number()),
};


const applicationTables = {
  // Galaxy data
  // galaxies: defineTable({
  //   id: v.string(), // External galaxy ID
  //   ra: v.number(), // Right ascension
  //   dec: v.number(), // Declination
  //   reff: v.number(), // Effective radius
  //   q: v.number(), // Axis ratio
  //   pa: v.number(), // Position angle
  //   nucleus: v.boolean(), // Has nucleus
  //   // imageUrl: v.optional(v.string()), // URL to galaxy image
  //   // Legacy fields for existing data
  //   isActive: v.optional(v.boolean()),
  //   redshift_x: v.optional(v.number()),
  //   redshift_y: v.optional(v.number()),
  //   x: v.optional(v.number()),
  //   y: v.optional(v.number()),
  // }).index("by_external_id", ["id"]),
  galaxies: defineTable(galaxySchemaDefinition)
    .index("by_external_id", ["id"])
    // Indexes to support ordering/filtering in paginated browser
    .index("by_ra", ["ra"]) // right ascension
    .index("by_dec", ["dec"]) // declination
    .index("by_reff", ["reff"]) // effective radius
    .index("by_q", ["q"]) // axis ratio
    .index("by_pa", ["pa"]) // position angle
    .index("by_nucleus", ["nucleus"]), // nucleus boolean for grouping

  // Split photometry tables (one doc per galaxy per band)
  galaxies_photometry_g: defineTable(photometryBandSchema).index("by_galaxy", ["galaxyRef"]),
  galaxies_photometry_r: defineTable(photometryBandSchemaR).index("by_galaxy", ["galaxyRef"]),
  galaxies_photometry_i: defineTable(photometryBandSchemaI).index("by_galaxy", ["galaxyRef"]),

  // Unified source extractor measurements
  galaxies_source_extractor: defineTable(sourceExtractorSchema).index("by_galaxy", ["galaxyRef"]),

  // Thuruthipilly derived parameters
  galaxies_thuruthipilly: defineTable(thuruthipillySchema).index("by_galaxy", ["galaxyRef"]),

  galaxyIds: defineTable({
    id: v.string(), // Just a table of galaxy IDs for aggregation
    galaxyRef: v.id("galaxies"),
    numericId: v.int64(),
  }).index("by_external_id", ["id"]).index("by_numeric_id", ["numericId"]),

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
    galaxyExternalId: v.string(), // References galaxies.id (external ID)
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
    .index("by_galaxy", ["galaxyExternalId"])
    .index("by_user_and_galaxy", ["userId", "galaxyExternalId"]),

  // Skipped galaxies
  skippedGalaxies: defineTable({
    userId: v.id("users"),
    galaxyExternalId: v.string(), // References galaxies.id (external ID)
    comments: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_galaxy", ["galaxyExternalId"])
    .index("by_user_and_galaxy", ["userId", "galaxyExternalId"]),

  // Galaxy sequences for users
  galaxySequences: defineTable({
    userId: v.id("users"),
    galaxyExternalIds: v.optional(v.array(v.string())), // Ordered list of galaxy external IDs
    currentIndex: v.number(), // Current position in the sequence
    numClassified: v.number(), // Number of galaxies classified in this sequence
    numSkipped: v.number(), // Number of galaxies skipped in this sequence
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
