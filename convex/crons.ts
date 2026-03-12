import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refresh cached overview snapshots",
  { hours: 1 },
  internal.statistics.labelingOverview.cache.refreshAllSnapshots,
  {}
);

export default crons;