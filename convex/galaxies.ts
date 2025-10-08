// Main galaxies module that provides nested API access
import * as aggregates from "./galaxies/aggregates";
import * as browse from "./galaxies/browse";
import * as core from "./galaxies/core";
import * as maintenance from "./galaxies/maintenance";
import * as navigation from "./galaxies/navigation";
import * as sequence from "./galaxies/sequence";
import * as skipped from "./galaxies/skipped";
import * as mock from "./galaxies/mock";
import * as batch_ingest from "./galaxies/batch_ingest";
import * as deprecated from "./galaxies/deprecated";
import * as navigation_deprecated from "./galaxies/navigation_deprecated";

// Export nested object structure for API access
export const galaxies = {
  aggregates,
  browse,
  core,
  maintenance,
  navigation,
  sequence,
  skipped,
  mock,
  batch_ingest,
  deprecated,
  navigation_deprecated,
};
