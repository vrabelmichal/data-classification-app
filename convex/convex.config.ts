import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
// Register default aggregate component for random access / counts.
app.use(aggregate);

export default app;
