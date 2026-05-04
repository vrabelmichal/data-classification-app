import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refresh overview snapshots when due",
  { minutes: 5 },
  internal.statistics.labelingOverview.cache.refreshSnapshotsIfDue,
  {}
);

crons.interval(
  "refresh paper assignment coverage snapshots when due",
  { minutes: 5 },
  internal.statistics.paperAssignmentCoverage.cache.refreshSnapshotsIfDue,
  {}
);

crons.interval(
  "refresh dirty user statistics snapshots",
  { hours: 1 },
  internal.users.refreshDirtyUserStatsSnapshots,
  {}
);

export default crons;