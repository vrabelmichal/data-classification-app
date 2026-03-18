import { query } from "../_generated/server";
import { browseGalaxiesArgs } from "./browser/args";
import {
  browseGalaxiesHandler,
  getClassificationSearchOptionsHandler,
  getGalaxySearchBoundsHandler,
} from "./browser/handlers";

export const browseGalaxies = query({
  args: browseGalaxiesArgs,
  handler: browseGalaxiesHandler,
});

export const getGalaxySearchBounds = query({
  args: {},
  handler: getGalaxySearchBoundsHandler,
});

export const getClassificationSearchOptions = query({
  args: {},
  handler: getClassificationSearchOptionsHandler,
});
