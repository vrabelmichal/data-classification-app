import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
// Register default aggregate component for random access / counts.
app.use(aggregate);

// Named aggregates for galaxies table with different sort keys
app.use(aggregate, { name: "galaxiesById" });
app.use(aggregate, { name: "galaxiesByRa" });
app.use(aggregate, { name: "galaxiesByDec" });
app.use(aggregate, { name: "galaxiesByReff" });
app.use(aggregate, { name: "galaxiesByQ" });
app.use(aggregate, { name: "galaxiesByPa" });
app.use(aggregate, { name: "galaxiesByNucleus" });
app.use(aggregate, { name: "galaxiesByMag" });
app.use(aggregate, { name: "galaxiesByMeanMue" });
app.use(aggregate, { name: "galaxiesByTotalClassifications" });
app.use(aggregate, { name: "galaxiesByNumVisibleNucleus" });
app.use(aggregate, { name: "galaxiesByNumAwesomeFlag" });
app.use(aggregate, { name: "galaxiesByNumFailedFitting" });
app.use(aggregate, { name: "galaxiesByTotalAssigned" });
app.use(aggregate, { name: "galaxiesByNumericId" });
// Labeling aggregates
app.use(aggregate, { name: "classificationsByCreated" });
app.use(aggregate, { name: "userProfilesByClassificationsCount" });
app.use(aggregate, { name: "userProfilesByLastActive" });
// Classification flag/class aggregates for fast counts
app.use(aggregate, { name: "classificationsByAwesomeFlag" });
app.use(aggregate, { name: "classificationsByVisibleNucleus" });
app.use(aggregate, { name: "classificationsByFailedFitting" });
app.use(aggregate, { name: "classificationsByValidRedshift" });
app.use(aggregate, { name: "classificationsByLsbClass" });
app.use(aggregate, { name: "classificationsByMorphology" });

export default app;
