import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";


// Core galaxy schema (after splitting large nested photometry & thuruthipilly tables)
export const galaxySchemaDefinition = {
  id: v.string(),
  numericId: v.optional(v.int64()), // Added later for easier sorting
  ra: v.number(),
  dec: v.number(),
  reff: v.number(),
  reff_pixels: v.number(),
  q: v.number(),
  pa: v.number(),
  nucleus: v.boolean(),

  // Optional fields from fitting, for easier searching / filtering
  mag: v.optional(v.number()),
  mean_mue: v.optional(v.number()),

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

  // galaxyAssignmentStats
  totalClassifications: v.optional(v.int64()),

  numVisibleNucleus: v.optional(v.int64()),
  numAwesomeFlag: v.optional(v.int64()),
  numFailedFitting: v.optional(v.int64()),

  totalAssigned: v.optional(v.int64()),
  perUser: v.optional(v.record(v.string(), v.int64())),
  lastAssignedAt: v.optional(v.number()),

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
    x_rel_error: v.optional(v.number()),
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
    x_rel_error: v.optional(v.number()),
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
    x_rel_error: v.optional(v.number()),
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
  galaxies: defineTable(galaxySchemaDefinition)
    .index("by_external_id", ["id"])
    .index("by_numeric_id", ["numericId"]) // primary numeric cursor/sort
    // Indexes to support ordering/filtering in paginated browser
    .index("by_ra", ["ra"]) // right ascension
    .index("by_dec", ["dec"]) // declination
    .index("by_reff", ["reff"]) // effective radius
    .index("by_q", ["q"]) // axis ratio
    .index("by_pa", ["pa"]) // position angle
    .index("by_nucleus", ["nucleus"]) // nucleus boolean for grouping
    .index("by_mag", ["mag"]) // optional magnitude for grouping
    .index("by_mean_mue", ["mean_mue"]) // optional mean surface brightness for grouping
    // Compound indexes (staged) to accelerate common filter+sort combos
    .index("by_ra_dec", ["ra", "dec"]) // range on ra, eq on dec
    .index("by_nucleus_mag", ["nucleus", "mag"]) // eq nucleus, range/order on mag
    .index("by_nucleus_mean_mue", ["nucleus", "mean_mue"]) // eq nucleus, range/order on mean_mue
    .index("by_nucleus_q", ["nucleus", "q"]) // eq on nucleus, range/order on q
    .index("by_reff_mean_mue", ["reff", "mean_mue"]) // range/order on reff, then eq on mean_mue
    .index("by_reff_mag", ["reff", "mag"]) // range/order on reff, then eq on mag
    // .index("by_nucleus_reff_mean_mue", ["nucleus", "reff", "mean_mue"]) // eq nucleus, then range/order on reff
    // Indexes starting with numericId for stable default ordering plus filters
    .index("by_numericId_nucleus", ["numericId", "nucleus"])
    .index("by_numericId_mag", ["numericId", "mag"])
    .index("by_numericId_mean_mue", ["numericId", "mean_mue"])
    .index("by_numericId_q", ["numericId", "q"])
    .index("by_numericId_reff", ["numericId", "reff"])
    // Additional starters for magnitude/mean_mue and structural params
    .index("by_mean_mue_reff", ["mean_mue", "reff"])
    .index("by_mag_reff", ["mag", "reff"])
    .index("by_q_reff", ["q", "reff"])

    .index("by_misc_paper", ["misc.paper"])

    .index("by_totalAssigned_numericId", ["totalAssigned", "numericId"])

    // Indexes for aggregate fields
    .index("by_totalClassifications", ["totalClassifications"])
    .index("by_numVisibleNucleus", ["numVisibleNucleus"])
    .index("by_numAwesomeFlag", ["numAwesomeFlag"])
    .index("by_numFailedFitting", ["numFailedFitting"]),

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
    awesomeCount: v.optional(v.number()),
    visibleNucleusCount: v.optional(v.number()),
    failedFittingCount: v.optional(v.number()),
    validRedshiftCount: v.optional(v.number()),
    lsbNeg1Count: v.optional(v.number()),
    lsb0Count: v.optional(v.number()),
    lsb1Count: v.optional(v.number()),
    morphNeg1Count: v.optional(v.number()),
    morph0Count: v.optional(v.number()),
    morph1Count: v.optional(v.number()),
    morph2Count: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // User preferences
  userPreferences: defineTable({
    userId: v.id("users"),
    imageQuality: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    showKeyboardHints: v.optional(v.boolean()),  // should be removed, keeping just to prevent the error
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
    contrast: v.number(),
    brightness: v.optional(v.number()), // Legacy field
    ellipseSettings: v.optional(v.record(v.string(), v.boolean())), // Map of imageKey -> showEllipse
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
    failed_fitting: v.optional(v.boolean()), // Indicates fitting failed (replaces lsb_class=-1 in new mode)
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

  // Sequence generation jobs - tracks in-progress generation for progress/cancellation
  sequenceGenerationJobs: defineTable({
    userId: v.id("users"), // Target user
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed")
    ),
    cancelRequested: v.boolean(),
    // Progress tracking
    phase: v.union(v.literal("underK"), v.literal("overK"), v.literal("creating"), v.literal("done")),
    selectedCount: v.number(),
    targetCount: v.number(),
    totalScanned: v.number(),
    message: v.string(),
    // Timestamps
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Error info if failed
    error: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_status", ["status"]),

  // System settings
  systemSettings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  // Issue reports from users
  issueReports: defineTable({
    userId: v.id("users"),
    description: v.string(),
    url: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    // "general" = normal report, "quick_tap" = created by 4-tap gesture on galaxy
    category: v.optional(v.union(v.literal("general"), v.literal("quick_tap"))),
    // Galaxy external ID associated with the report (used for quick_tap events)
    galaxyExternalId: v.optional(v.string()),
    createdAt: v.number(), // timestamp
    resolvedAt: v.optional(v.number()), // timestamp when marked as resolved
    adminNotes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_category", ["category"]),

  // User-Galaxy classification status for efficient "classified by me" / "unclassified by me" queries
  // This table enables indexed pagination without loading all galaxies into memory
  userGalaxyClassifications: defineTable({
    userId: v.id("users"),
    galaxyExternalId: v.string(),
    galaxyNumericId: v.int64(), // Denormalized for efficient sorting
    classificationId: v.id("classifications"),
    classifiedAt: v.number(), // _creationTime of the classification
  })
    .index("by_user", ["userId"])
    .index("by_user_numericId", ["userId", "galaxyNumericId"])
    .index("by_user_galaxy", ["userId", "galaxyExternalId"])
    .index("by_classification", ["classificationId"]),

  // Galaxy blacklist - galaxies on this list are excluded from assignment and classification
  galaxyBlacklist: defineTable({
    galaxyExternalId: v.string(), // References galaxies.id (external ID)
    reason: v.optional(v.string()), // Optional reason for blacklisting
    addedAt: v.number(), // Timestamp when added
    addedBy: v.id("users"), // User who added it (admin)
  })
    .index("by_galaxy", ["galaxyExternalId"])
    .index("by_added_at", ["addedAt"]),

  // Persisted results of admin galaxy count diagnostics scans
  galaxyCountDiagnosticsHistory: defineTable({
    createdAt: v.number(), // Timestamp when the diagnostics snapshot was stored
    runDate: v.string(), // UTC date key YYYY-MM-DD for efficient date filtering
    createdBy: v.id("users"), // Admin who triggered/saved the run
    tableScanCounts: v.record(v.string(), v.number()),
    missingNumericIdInGalaxies: v.number(),
    aggregateCounts: v.record(v.string(), v.union(v.number(), v.null())),
    blacklistDetails: v.object({
      totalRows: v.number(),
      uniqueExternalIds: v.number(),
      presentInGalaxies: v.number(),
      missingFromGalaxies: v.number(),
    }),
    derivedCounts: v.record(v.string(), v.union(v.number(), v.null())),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_run_date_created_at", ["runDate", "createdAt"]),

  // Notifications - messages sent from admins to users
  notifications: defineTable({
    title: v.string(),
    content: v.string(), // Markdown content
    createdBy: v.id("users"), // Admin who created the notification
    createdAt: v.number(),
    sendEmail: v.boolean(), // Whether to also send as email
    // Recipients: if empty array, means sent to all users
    recipientUserIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_created_at", ["createdAt"]),

  // User notification read status - tracks which notifications each user has read
  userNotificationReads: defineTable({
    userId: v.id("users"),
    notificationId: v.id("notifications"),
    readAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_notification", ["notificationId"])
    .index("by_user_notification", ["userId", "notificationId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
