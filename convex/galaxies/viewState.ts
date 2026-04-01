import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireUserId } from "../lib/auth";
import {
  buildGalaxyBrowserViewHash,
  createGalaxyBrowserViewKey,
  galaxyBrowserResolvedViewValidator,
  galaxyBrowserViewScopeValidator,
  galaxyBrowserViewStateValidator,
  getGalaxyBrowserViewScope,
  normalizeGalaxyBrowserViewState,
} from "./browser/viewState";

export const ensureBrowserView = mutation({
  args: {
    state: galaxyBrowserViewStateValidator,
  },
  returns: v.object({
    viewKey: v.string(),
    scope: galaxyBrowserViewScopeValidator,
    isShareable: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const state = normalizeGalaxyBrowserViewState(args.state);
    const scope = getGalaxyBrowserViewScope(state.filter);
    const ownerScopeKey = scope === "owner" ? userId : "__global__";
    const stateHash = buildGalaxyBrowserViewHash(state, ownerScopeKey);

    const existing = await ctx.db
      .query("galaxyBrowserViews")
      .withIndex("by_owner_scope_hash", (q) => q.eq("ownerScopeKey", ownerScopeKey).eq("stateHash", stateHash))
      .unique();

    if (existing) {
      return {
        viewKey: existing.viewKey,
        scope,
        isShareable: scope === "global",
      };
    }

    const now = Date.now();
    const viewKey = createGalaxyBrowserViewKey();
    await ctx.db.insert("galaxyBrowserViews", {
      viewKey,
      scope,
      ownerUserId: scope === "owner" ? userId : undefined,
      ownerScopeKey,
      stateHash,
      state,
      createdAt: now,
      updatedAt: now,
    });

    return {
      viewKey,
      scope,
      isShareable: scope === "global",
    };
  },
});

export const resolveBrowserView = query({
  args: {
    viewKey: v.string(),
  },
  returns: galaxyBrowserResolvedViewValidator,
  handler: async (ctx, args): Promise<{
    status: "ok" | "owner_only" | "not_found";
    message?: string;
    scope?: "global" | "owner";
    viewKey?: string;
    state?: {
      filter: "all" | "my_sequence" | "classified" | "unclassified" | "skipped";
      sortBy:
        | "id"
        | "ra"
        | "dec"
        | "reff"
        | "q"
        | "pa"
        | "mag"
        | "mean_mue"
        | "nucleus"
        | "numericId"
        | "totalClassifications"
        | "numVisibleNucleus"
        | "numAwesomeFlag"
        | "numFailedFitting"
        | "totalAssigned";
      sortOrder: "asc" | "desc";
      isSearchActive: boolean;
      searchId?: string;
      searchRaMin?: string;
      searchRaMax?: string;
      searchDecMin?: string;
      searchDecMax?: string;
      searchReffMin?: string;
      searchReffMax?: string;
      searchQMin?: string;
      searchQMax?: string;
      searchPaMin?: string;
      searchPaMax?: string;
      searchMagMin?: string;
      searchMagMax?: string;
      searchMeanMueMin?: string;
      searchMeanMueMax?: string;
      searchNucleus?: boolean;
      searchTotalClassificationsMin?: string;
      searchTotalClassificationsMax?: string;
      searchNumVisibleNucleusMin?: string;
      searchNumVisibleNucleusMax?: string;
      searchNumAwesomeFlagMin?: string;
      searchNumAwesomeFlagMax?: string;
      searchNumFailedFittingMin?: string;
      searchNumFailedFittingMax?: string;
      searchTotalAssignedMin?: string;
      searchTotalAssignedMax?: string;
      searchAwesome?: boolean;
      searchValidRedshift?: boolean;
      searchVisibleNucleus?: boolean;
    };
  }> => {
    const viewerUserId = await getOptionalUserId(ctx);
    const record = await ctx.db
      .query("galaxyBrowserViews")
      .withIndex("by_view_key", (q) => q.eq("viewKey", args.viewKey))
      .unique();

    if (!record) {
      return {
        status: "not_found",
        message: "This saved galaxy browser view could not be found.",
      };
    }

    if (record.scope === "owner" && record.ownerUserId !== viewerUserId) {
      return {
        status: "owner_only",
        viewKey: record.viewKey,
        scope: record.scope,
        state: record.state,
        message: "This saved galaxy browser view depends on personal galaxy state and cannot be shown for another user.",
      };
    }

    return {
      status: "ok",
      viewKey: record.viewKey,
      scope: record.scope,
      state: record.state,
    };
  },
});
