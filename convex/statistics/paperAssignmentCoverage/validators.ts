import { v } from "convex/values";
import {
  classificationStatsValidator,
  paperCountValidator,
  totalsValidator,
} from "../labelingOverview/cacheValidators";
import { userExperienceValidator } from "../../lib/permissions";

export const PAPER_ASSIGNMENT_COVERAGE_MAX_TARGET_CLASSIFICATIONS = 25;
export const PAPER_ASSIGNMENT_COVERAGE_BUCKET_COUNT =
  PAPER_ASSIGNMENT_COVERAGE_MAX_TARGET_CLASSIFICATIONS + 1;
export const PAPER_ASSIGNMENT_COVERAGE_SHARED_SNAPSHOT_KEY = "paperAssignmentCoverage";
export const PAPER_ASSIGNMENT_COVERAGE_GLOBAL_SCOPE_KEY = "__all__";

export const paperAssignmentCoverageCatalogValidator = v.object({
  availablePapers: v.array(v.string()),
  paperCounts: v.record(v.string(), paperCountValidator),
});

export const paperAssignmentCoverageUserDirectoryEntryValidator = v.object({
  userId: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  email: v.optional(v.union(v.string(), v.null())),
  role: v.string(),
  isActive: v.boolean(),
  experience: v.optional(userExperienceValidator),
});

export const paperAssignmentCoverageUserCountsValidator = v.object({
  userId: v.string(),
  counts: v.array(v.number()),
});

export const paperAssignmentCoverageSharedSnapshotValidator = v.object({
  catalog: paperAssignmentCoverageCatalogValidator,
  userDirectory: v.array(paperAssignmentCoverageUserDirectoryEntryValidator),
  updatedAt: v.number(),
});

export const paperAssignmentCoverageScopeSnapshotValidator = v.object({
  scopeKey: v.string(),
  paper: v.union(v.string(), v.null()),
  totals: totalsValidator,
  classificationBuckets: v.array(v.number()),
  classificationStats: classificationStatsValidator,
  activeClassifiers: v.number(),
  userAssignmentCounts: v.array(paperAssignmentCoverageUserCountsValidator),
  unassignedCounts: v.array(v.number()),
  updatedAt: v.number(),
});

export const paperAssignmentCoverageSnapshotPayloadValidator = v.object({
  sharedSnapshot: paperAssignmentCoverageSharedSnapshotValidator,
  scopeSnapshots: v.array(paperAssignmentCoverageScopeSnapshotValidator),
});

export const paperAssignmentCoverageCachedResponseValidator = v.object({
  sharedSnapshot: v.union(paperAssignmentCoverageSharedSnapshotValidator, v.null()),
  scopeSnapshots: v.array(paperAssignmentCoverageScopeSnapshotValidator),
});