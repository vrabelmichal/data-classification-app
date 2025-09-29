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
app.use(aggregate, { name: "galaxiesByNumericId" });

export default app;
