import { v } from "convex/values";
import { query } from "../_generated/server";
import { getOptionalUserId } from "../lib/auth";

type Sortable =
  | "numericId"
  | "id"
  | "ra"
  | "dec"
  | "reff"
  | "q"
  | "pa"
  | "mag"
  | "mean_mue"
  | "nucleus";

/**
 * Count galaxies using the same index strategy as browseGalaxies.
 * The old implementation is kept as countFilteredGalaxiesBatchLegacy for comparison.
 */
export const countFilteredGalaxiesBatch = query({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("id"),
      v.literal("ra"),
      v.literal("dec"),
      v.literal("reff"),
      v.literal("q"),
      v.literal("pa"),
      v.literal("mag"),
      v.literal("mean_mue"),
      v.literal("nucleus"),
      v.literal("numericId")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
    )),
    searchId: v.optional(v.string()),
    searchRaMin: v.optional(v.string()),
    searchRaMax: v.optional(v.string()),
    searchDecMin: v.optional(v.string()),
    searchDecMax: v.optional(v.string()),
    searchReffMin: v.optional(v.string()),
    searchReffMax: v.optional(v.string()),
    searchQMin: v.optional(v.string()),
    searchQMax: v.optional(v.string()),
    searchPaMin: v.optional(v.string()),
    searchPaMax: v.optional(v.string()),
    searchMagMin: v.optional(v.string()),
    searchMagMax: v.optional(v.string()),
    searchMeanMueMin: v.optional(v.string()),
    searchMeanMueMax: v.optional(v.string()),
    searchNucleus: v.optional(v.boolean()),
    searchTotalClassificationsMin: v.optional(v.string()),
    searchTotalClassificationsMax: v.optional(v.string()),
    searchNumVisibleNucleusMin: v.optional(v.string()),
    searchNumVisibleNucleusMax: v.optional(v.string()),
    searchNumAwesomeFlagMin: v.optional(v.string()),
    searchNumAwesomeFlagMax: v.optional(v.string()),
    searchNumFailedFittingMin: v.optional(v.string()),
    searchNumFailedFittingMax: v.optional(v.string()),
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return { count: 0, cursor: null, isDone: true };
    }

    const {
      cursor: paginationCursor = null,
      batchSize = 500,
      sortBy = "numericId",
      sortOrder = "asc",
      filter,
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    } = args;

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

    const allowedSort: Record<Sortable, { index: string; field: string }> = {
      numericId: { index: "by_numeric_id", field: "numericId" },
      id: { index: "by_external_id", field: "id" },
      ra: { index: "by_ra", field: "ra" },
      dec: { index: "by_dec", field: "dec" },
      reff: { index: "by_reff", field: "reff" },
      q: { index: "by_q", field: "q" },
      pa: { index: "by_pa", field: "pa" },
      mag: { index: "by_mag", field: "mag" },
      mean_mue: { index: "by_mean_mue", field: "mean_mue" },
      nucleus: { index: "by_nucleus", field: "nucleus" },
    };

    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    // Special handling for skipped filter mirrors browseGalaxies behavior
    if (filter === "skipped") {
      const skippedGalaxies = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();

      if (skippedGalaxies.length === 0) {
        return { count: 0, cursor: null, isDone: true };
      }

      const skippedIds = new Set(skippedGalaxies.map((sg: any) => sg.galaxyExternalId));
      let allGalaxies = await ctx.db.query("galaxies").collect();
      allGalaxies = allGalaxies.filter((g: any) => skippedIds.has(g.id));

      // Apply search filters
      if (searchId) allGalaxies = allGalaxies.filter((g: any) => g.id === searchId.trim());
      const applyNumericFilter = (values: any[], field: string, min?: string, max?: string) => {
        if (!min && !max) return values;
        return values.filter((g) => {
          const val = g[field];
          if (typeof val !== "number") return false;
          if (min && val < parseFloat(min)) return false;
          if (max && val > parseFloat(max)) return false;
          return true;
        });
      };

      allGalaxies = applyNumericFilter(allGalaxies, "ra", searchRaMin, searchRaMax);
      allGalaxies = applyNumericFilter(allGalaxies, "dec", searchDecMin, searchDecMax);
      allGalaxies = applyNumericFilter(allGalaxies, "reff", searchReffMin, searchReffMax);
      allGalaxies = applyNumericFilter(allGalaxies, "q", searchQMin, searchQMax);
      allGalaxies = applyNumericFilter(allGalaxies, "pa", searchPaMin, searchPaMax);
      allGalaxies = applyNumericFilter(allGalaxies, "mag", searchMagMin, searchMagMax);
      allGalaxies = applyNumericFilter(allGalaxies, "mean_mue", searchMeanMueMin, searchMeanMueMax);

      if (searchNucleus !== undefined) allGalaxies = allGalaxies.filter((g: any) => g.nucleus === searchNucleus);

      if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalClassifications || 0;
          if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
          if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
          return true;
        });
      }

      if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numVisibleNucleus || 0;
          if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
          if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
          return true;
        });
      }

      if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numAwesomeFlag || 0;
          if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
          if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
          return true;
        });
      }

      if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numFailedFitting || 0;
          if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
          if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
          return true;
        });
      }

      if (searchTotalAssignedMin || searchTotalAssignedMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalAssigned || 0;
          if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
          if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
          return true;
        });
      }

      return { count: allGalaxies.length, cursor: null, isDone: true };
    }

    // Special handling for classified/unclassified filters
    if (filter === "classified" || filter === "unclassified") {
      // Get user's classifications
      const userClassifications = await ctx.db
        .query("classifications")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();
      const userClassifiedGalaxyIds = new Set(userClassifications.map((c: any) => c.galaxyExternalId));

      if (filter === "classified") {
        // Count only galaxies the user has classified
        if (userClassifiedGalaxyIds.size === 0) {
          return { count: 0, cursor: null, isDone: true };
        }

        // Fetch all classified galaxies
        let classifiedGalaxies = (await Promise.all(
          Array.from(userClassifiedGalaxyIds).map(async (galaxyExternalId) => {
            return await ctx.db
              .query("galaxies")
              .withIndex("by_external_id", (q: any) => q.eq("id", galaxyExternalId))
              .unique();
          })
        )).filter((g): g is any => g !== null);

        // Apply search filters
        if (searchId) classifiedGalaxies = classifiedGalaxies.filter((g: any) => g.id === searchId.trim());
        const applyNumericFilter = (values: any[], field: string, min?: string, max?: string) => {
          if (!min && !max) return values;
          return values.filter((g) => {
            const val = g[field];
            if (typeof val !== "number") return false;
            if (min && val < parseFloat(min)) return false;
            if (max && val > parseFloat(max)) return false;
            return true;
          });
        };

        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "ra", searchRaMin, searchRaMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "dec", searchDecMin, searchDecMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "reff", searchReffMin, searchReffMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "q", searchQMin, searchQMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "pa", searchPaMin, searchPaMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "mag", searchMagMin, searchMagMax);
        classifiedGalaxies = applyNumericFilter(classifiedGalaxies, "mean_mue", searchMeanMueMin, searchMeanMueMax);

        if (searchNucleus !== undefined) classifiedGalaxies = classifiedGalaxies.filter((g: any) => g.nucleus === searchNucleus);

        if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
          classifiedGalaxies = classifiedGalaxies.filter((g: any) => {
            const total = g.totalClassifications || 0;
            if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
            if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
            return true;
          });
        }

        if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
          classifiedGalaxies = classifiedGalaxies.filter((g: any) => {
            const total = g.numVisibleNucleus || 0;
            if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
            if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
            return true;
          });
        }

        if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
          classifiedGalaxies = classifiedGalaxies.filter((g: any) => {
            const total = g.numAwesomeFlag || 0;
            if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
            if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
            return true;
          });
        }

        if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
          classifiedGalaxies = classifiedGalaxies.filter((g: any) => {
            const total = g.numFailedFitting || 0;
            if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
            if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
            return true;
          });
        }

        if (searchTotalAssignedMin || searchTotalAssignedMax) {
          classifiedGalaxies = classifiedGalaxies.filter((g: any) => {
            const total = g.totalAssigned || 0;
            if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
            if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
            return true;
          });
        }

        return { count: classifiedGalaxies.length, cursor: null, isDone: true };
      } else {
        // "unclassified": Count galaxies user has NOT classified
        let allGalaxies = await ctx.db.query("galaxies").collect();
        let unclassifiedGalaxies = allGalaxies.filter((g: any) => !userClassifiedGalaxyIds.has(g.id));

        // Apply search filters
        if (searchId) unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => g.id === searchId.trim());
        const applyNumericFilter = (values: any[], field: string, min?: string, max?: string) => {
          if (!min && !max) return values;
          return values.filter((g) => {
            const val = g[field];
            if (typeof val !== "number") return false;
            if (min && val < parseFloat(min)) return false;
            if (max && val > parseFloat(max)) return false;
            return true;
          });
        };

        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "ra", searchRaMin, searchRaMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "dec", searchDecMin, searchDecMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "reff", searchReffMin, searchReffMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "q", searchQMin, searchQMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "pa", searchPaMin, searchPaMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "mag", searchMagMin, searchMagMax);
        unclassifiedGalaxies = applyNumericFilter(unclassifiedGalaxies, "mean_mue", searchMeanMueMin, searchMeanMueMax);

        if (searchNucleus !== undefined) unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => g.nucleus === searchNucleus);

        if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
          unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => {
            const total = g.totalClassifications || 0;
            if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
            if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
            return true;
          });
        }

        if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
          unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => {
            const total = g.numVisibleNucleus || 0;
            if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
            if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
            return true;
          });
        }

        if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
          unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => {
            const total = g.numAwesomeFlag || 0;
            if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
            if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
            return true;
          });
        }

        if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
          unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => {
            const total = g.numFailedFitting || 0;
            if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
            if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
            return true;
          });
        }

        if (searchTotalAssignedMin || searchTotalAssignedMax) {
          unclassifiedGalaxies = unclassifiedGalaxies.filter((g: any) => {
            const total = g.totalAssigned || 0;
            if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
            if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
            return true;
          });
        }

        return { count: unclassifiedGalaxies.length, cursor: null, isDone: true };
      }
    }

    // Pick best index starting with the sort key and optionally second fields based on filters
    let indexName = allowedSort[requestedSort].index;
    let indexBuilder: ((qb: any) => any) | undefined = undefined;

    const applyRange = (qb: any, field: string, min?: string, max?: string) => {
      let out = qb;
      if (min) out = out.gte(field, parseFloat(min));
      if (max) out = out.lte(field, parseFloat(max));
      return out;
    };

    switch (requestedSort) {
      case "numericId":
        // Note: by_numericId_nucleus index has fields [numericId, nucleus] so we cannot
        // query on nucleus alone. Use by_numeric_id and apply nucleus filter via .filter()
        if (searchMagMin || searchMagMax) {
          indexName = "by_numericId_mag";
        } else if (searchMeanMueMin || searchMeanMueMax) {
          indexName = "by_numericId_mean_mue";
        } else if (searchQMin || searchQMax) {
          indexName = "by_numericId_q";
        } else if (searchReffMin || searchReffMax) {
          indexName = "by_numericId_reff";
        }
        // searchNucleus is applied via .filter() below
        break;
      case "ra":
        if (searchDecMin || searchDecMax) {
          indexName = "by_ra_dec";
          indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
        } else if (searchRaMin || searchRaMax) {
          indexBuilder = (qb) => applyRange(qb, "ra", searchRaMin, searchRaMax);
        }
        break;
      case "reff":
        if (searchMeanMueMin || searchMeanMueMax) {
          indexName = "by_reff_mean_mue";
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        } else if (searchMagMin || searchMagMax) {
          indexName = "by_reff_mag";
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        } else if (searchReffMin || searchReffMax) {
          indexBuilder = (qb) => applyRange(qb, "reff", searchReffMin, searchReffMax);
        }
        break;
      case "mag":
        if (searchReffMin || searchReffMax) {
          indexName = "by_mag_reff";
          indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
        } else if (searchMagMin || searchMagMax) {
          indexBuilder = (qb) => applyRange(qb, "mag", searchMagMin, searchMagMax);
        }
        break;
      case "mean_mue":
        if (searchReffMin || searchReffMax) {
          indexName = "by_mean_mue_reff";
          indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
        } else if (searchMeanMueMin || searchMeanMueMax) {
          indexBuilder = (qb) => applyRange(qb, "mean_mue", searchMeanMueMin, searchMeanMueMax);
        }
        break;
      case "q":
        if (searchReffMin || searchReffMax) {
          indexName = "by_q_reff";
          indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
        } else if (searchQMin || searchQMax) {
          indexBuilder = (qb) => applyRange(qb, "q", searchQMin, searchQMax);
        }
        break;
      case "nucleus":
        if (searchNucleus !== undefined) {
          indexBuilder = (qb) => qb.eq("nucleus", !!searchNucleus);
          if (searchMagMin || searchMagMax) indexName = "by_nucleus_mag";
          else if (searchMeanMueMin || searchMeanMueMax) indexName = "by_nucleus_mean_mue";
          else if (searchQMin || searchQMax) indexName = "by_nucleus_q";
        }
        break;
      case "id":
        if (searchId) {
          indexBuilder = (qb) => qb.eq("id", searchId.trim());
        }
        break;
      case "dec":
        if (searchDecMin || searchDecMax) {
          indexBuilder = (qb) => applyRange(qb, "dec", searchDecMin, searchDecMax);
        }
        break;
      case "pa":
        if (searchPaMin || searchPaMax) {
          indexBuilder = (qb) => applyRange(qb, "pa", searchPaMin, searchPaMax);
        }
        break;
    }

    let qBase = ctx.db.query("galaxies");
    let q: any = indexBuilder
      ? qBase.withIndex(indexName as any, indexBuilder as any)
      : qBase.withIndex(indexName as any);
    q = q.order(normalizedSortOrder as any);

    // Apply additional filters via chained .filter calls
    if (searchId) q = q.filter((f: any) => f.eq(f.field("id"), searchId.trim()));
    if (searchRaMin) q = q.filter((f: any) => f.gte(f.field("ra"), parseFloat(searchRaMin)));
    if (searchRaMax) q = q.filter((f: any) => f.lte(f.field("ra"), parseFloat(searchRaMax)));
    if (searchDecMin) q = q.filter((f: any) => f.gte(f.field("dec"), parseFloat(searchDecMin)));
    if (searchDecMax) q = q.filter((f: any) => f.lte(f.field("dec"), parseFloat(searchDecMax)));
    if (searchReffMin) q = q.filter((f: any) => f.gte(f.field("reff"), parseFloat(searchReffMin)));
    if (searchReffMax) q = q.filter((f: any) => f.lte(f.field("reff"), parseFloat(searchReffMax)));
    if (searchQMin) q = q.filter((f: any) => f.gte(f.field("q"), parseFloat(searchQMin)));
    if (searchQMax) q = q.filter((f: any) => f.lte(f.field("q"), parseFloat(searchQMax)));
    if (searchPaMin) q = q.filter((f: any) => f.gte(f.field("pa"), parseFloat(searchPaMin)));
    if (searchPaMax) q = q.filter((f: any) => f.lte(f.field("pa"), parseFloat(searchPaMax)));
    if (searchMagMin) q = q.filter((f: any) => f.gte(f.field("mag"), parseFloat(searchMagMin)));
    if (searchMagMax) q = q.filter((f: any) => f.lte(f.field("mag"), parseFloat(searchMagMax)));
    if (searchMeanMueMin) q = q.filter((f: any) => f.gte(f.field("mean_mue"), parseFloat(searchMeanMueMin)));
    if (searchMeanMueMax) q = q.filter((f: any) => f.lte(f.field("mean_mue"), parseFloat(searchMeanMueMax)));
    if (searchNucleus !== undefined) q = q.filter((f: any) => f.eq(f.field("nucleus"), !!searchNucleus));

    const { page, isDone, continueCursor } = await q.paginate({
      numItems: batchSize,
      cursor: paginationCursor,
    });

    let filteredPage = page;

    // Note: "classified" and "unclassified" filters are handled above with special logic
    if (filter === "my_sequence") {
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .unique();

      if (userSequence && userSequence.galaxyExternalIds) {
        const sequenceIds = new Set(userSequence.galaxyExternalIds);
        filteredPage = filteredPage.filter((g: any) => sequenceIds.has(g.id));
      } else {
        filteredPage = [];
      }
    }

    if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalClassifications || 0;
        if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
        if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
        return true;
      });
    }

    if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numVisibleNucleus || 0;
        if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
        if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
        return true;
      });
    }

    if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numAwesomeFlag || 0;
        if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
        if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
        return true;
      });
    }

    if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numFailedFitting || 0;
        if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
        if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
        return true;
      });
    }

    if (searchTotalAssignedMin || searchTotalAssignedMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalAssigned || 0;
        if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
        if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
        return true;
      });
    }

    return {
      count: filteredPage.length,
      cursor: continueCursor,
      isDone,
    };
  },
});

/**
 * Legacy count implementation kept for comparison/testing.
 */
export const countFilteredGalaxiesBatchLegacy = query({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("id"),
      v.literal("ra"),
      v.literal("dec"),
      v.literal("reff"),
      v.literal("q"),
      v.literal("pa"),
      v.literal("mag"),
      v.literal("mean_mue"),
      v.literal("nucleus"),
      v.literal("numericId")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("my_sequence"),
      v.literal("classified"),
      v.literal("unclassified"),
      v.literal("skipped")
    )),
    searchId: v.optional(v.string()),
    searchRaMin: v.optional(v.string()),
    searchRaMax: v.optional(v.string()),
    searchDecMin: v.optional(v.string()),
    searchDecMax: v.optional(v.string()),
    searchReffMin: v.optional(v.string()),
    searchReffMax: v.optional(v.string()),
    searchQMin: v.optional(v.string()),
    searchQMax: v.optional(v.string()),
    searchPaMin: v.optional(v.string()),
    searchPaMax: v.optional(v.string()),
    searchMagMin: v.optional(v.string()),
    searchMagMax: v.optional(v.string()),
    searchMeanMueMin: v.optional(v.string()),
    searchMeanMueMax: v.optional(v.string()),
    searchNucleus: v.optional(v.boolean()),
    searchTotalClassificationsMin: v.optional(v.string()),
    searchTotalClassificationsMax: v.optional(v.string()),
    searchNumVisibleNucleusMin: v.optional(v.string()),
    searchNumVisibleNucleusMax: v.optional(v.string()),
    searchNumAwesomeFlagMin: v.optional(v.string()),
    searchNumAwesomeFlagMax: v.optional(v.string()),
    searchNumFailedFittingMin: v.optional(v.string()),
    searchNumFailedFittingMax: v.optional(v.string()),
    searchTotalAssignedMin: v.optional(v.string()),
    searchTotalAssignedMax: v.optional(v.string()),
    searchAwesome: v.optional(v.boolean()),
    searchValidRedshift: v.optional(v.boolean()),
    searchVisibleNucleus: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    if (!userId) {
      return { count: 0, cursor: null, isDone: true };
    }

    const {
      cursor: paginationCursor = null,
      batchSize = 500,
      sortBy = "numericId",
      sortOrder = "asc",
      filter,
      searchId,
      searchRaMin,
      searchRaMax,
      searchDecMin,
      searchDecMax,
      searchReffMin,
      searchReffMax,
      searchQMin,
      searchQMax,
      searchPaMin,
      searchPaMax,
      searchMagMin,
      searchMagMax,
      searchMeanMueMin,
      searchMeanMueMax,
      searchNucleus,
      searchTotalClassificationsMin,
      searchTotalClassificationsMax,
      searchNumVisibleNucleusMin,
      searchNumVisibleNucleusMax,
      searchNumAwesomeFlagMin,
      searchNumAwesomeFlagMax,
      searchNumFailedFittingMin,
      searchNumFailedFittingMax,
      searchTotalAssignedMin,
      searchTotalAssignedMax,
    } = args;

    const normalizedSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";

    const allowedSort: Record<Sortable, { index: string }> = {
      numericId: { index: "by_numeric_id" },
      id: { index: "by_external_id" },
      ra: { index: "by_ra" },
      dec: { index: "by_dec" },
      reff: { index: "by_reff" },
      q: { index: "by_q" },
      pa: { index: "by_pa" },
      mag: { index: "by_mag" },
      mean_mue: { index: "by_mean_mue" },
      nucleus: { index: "by_nucleus" },
    };

    const requestedSort = (Object.keys(allowedSort) as Sortable[]).includes(sortBy as Sortable)
      ? (sortBy as Sortable)
      : "numericId";

    // Special handling for skipped filter - load all at once since it's typically small
    if (filter === "skipped") {
      const skippedGalaxies = await ctx.db
        .query("skippedGalaxies")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();

      const skippedIds = new Set(skippedGalaxies.map((sg: any) => sg.galaxyExternalId));
      let allGalaxies = await ctx.db.query("galaxies").collect();
      
      allGalaxies = allGalaxies.filter((g: any) => skippedIds.has(g.id));

      // Apply search filters
      if (searchId) allGalaxies = allGalaxies.filter((g: any) => g.id === searchId.trim());
      if (searchRaMin) allGalaxies = allGalaxies.filter((g: any) => g.ra >= parseFloat(searchRaMin));
      if (searchRaMax) allGalaxies = allGalaxies.filter((g: any) => g.ra <= parseFloat(searchRaMax));
      if (searchDecMin) allGalaxies = allGalaxies.filter((g: any) => g.dec >= parseFloat(searchDecMin));
      if (searchDecMax) allGalaxies = allGalaxies.filter((g: any) => g.dec <= parseFloat(searchDecMax));
      if (searchReffMin) allGalaxies = allGalaxies.filter((g: any) => g.reff >= parseFloat(searchReffMin));
      if (searchReffMax) allGalaxies = allGalaxies.filter((g: any) => g.reff <= parseFloat(searchReffMax));
      if (searchQMin) allGalaxies = allGalaxies.filter((g: any) => g.q >= parseFloat(searchQMin));
      if (searchQMax) allGalaxies = allGalaxies.filter((g: any) => g.q <= parseFloat(searchQMax));
      if (searchPaMin) allGalaxies = allGalaxies.filter((g: any) => g.pa >= parseFloat(searchPaMin));
      if (searchPaMax) allGalaxies = allGalaxies.filter((g: any) => g.pa <= parseFloat(searchPaMax));
      if (searchMagMin) allGalaxies = allGalaxies.filter((g: any) => (g.mag ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMagMin));
      if (searchMagMax) allGalaxies = allGalaxies.filter((g: any) => (g.mag ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMagMax));
      if (searchMeanMueMin) allGalaxies = allGalaxies.filter((g: any) => (g.mean_mue ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMeanMueMin));
      if (searchMeanMueMax) allGalaxies = allGalaxies.filter((g: any) => (g.mean_mue ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMeanMueMax));
      if (searchNucleus !== undefined) allGalaxies = allGalaxies.filter((g: any) => g.nucleus === searchNucleus);

      if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalClassifications || 0;
          if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
          if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
          return true;
        });
      }

      if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numVisibleNucleus || 0;
          if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
          if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
          return true;
        });
      }

      if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numAwesomeFlag || 0;
          if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
          if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
          return true;
        });
      }

      if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.numFailedFitting || 0;
          if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
          if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
          return true;
        });
      }

      if (searchTotalAssignedMin || searchTotalAssignedMax) {
        allGalaxies = allGalaxies.filter((g: any) => {
          const total = g.totalAssigned || 0;
          if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
          if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
          return true;
        });
      }

      return { count: allGalaxies.length, cursor: null, isDone: true };
    }

    // For other filters, use single paginated query
    const indexName = allowedSort[requestedSort].index;

    // Get user sequence if needed
    let sequenceIds: Set<string> | null = null;
    if (filter === "my_sequence") {
      const userSequence = await ctx.db
        .query("galaxySequences")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .unique();
      
      if (userSequence && userSequence.galaxyExternalIds) {
        sequenceIds = new Set(userSequence.galaxyExternalIds);
      } else {
        // No sequence, return 0
        return { count: 0, cursor: null, isDone: true };
      }
    }

    // Single paginated query
    const q = ctx.db
      .query("galaxies")
      .withIndex(indexName as any)
      .order(normalizedSortOrder as any);

    const { page, isDone, continueCursor } = await q.paginate({
      numItems: batchSize,
      cursor: paginationCursor,
    });

    let filteredPage = page;

    // Apply search filters
    if (searchId) filteredPage = filteredPage.filter((g: any) => g.id === searchId.trim());
    if (searchRaMin) filteredPage = filteredPage.filter((g: any) => g.ra >= parseFloat(searchRaMin));
    if (searchRaMax) filteredPage = filteredPage.filter((g: any) => g.ra <= parseFloat(searchRaMax));
    if (searchDecMin) filteredPage = filteredPage.filter((g: any) => g.dec >= parseFloat(searchDecMin));
    if (searchDecMax) filteredPage = filteredPage.filter((g: any) => g.dec <= parseFloat(searchDecMax));
    if (searchReffMin) filteredPage = filteredPage.filter((g: any) => g.reff >= parseFloat(searchReffMin));
    if (searchReffMax) filteredPage = filteredPage.filter((g: any) => g.reff <= parseFloat(searchReffMax));
    if (searchQMin) filteredPage = filteredPage.filter((g: any) => g.q >= parseFloat(searchQMin));
    if (searchQMax) filteredPage = filteredPage.filter((g: any) => g.q <= parseFloat(searchQMax));
    if (searchPaMin) filteredPage = filteredPage.filter((g: any) => g.pa >= parseFloat(searchPaMin));
    if (searchPaMax) filteredPage = filteredPage.filter((g: any) => g.pa <= parseFloat(searchPaMax));
    if (searchMagMin) filteredPage = filteredPage.filter((g: any) => (g.mag ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMagMin));
    if (searchMagMax) filteredPage = filteredPage.filter((g: any) => (g.mag ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMagMax));
    if (searchMeanMueMin) filteredPage = filteredPage.filter((g: any) => (g.mean_mue ?? Number.MAX_SAFE_INTEGER) >= parseFloat(searchMeanMueMin));
    if (searchMeanMueMax) filteredPage = filteredPage.filter((g: any) => (g.mean_mue ?? Number.MIN_SAFE_INTEGER) <= parseFloat(searchMeanMueMax));
    if (searchNucleus !== undefined) filteredPage = filteredPage.filter((g: any) => g.nucleus === searchNucleus);

    // Apply filter-specific logic
    if (filter === "classified") {
      filteredPage = filteredPage.filter((g: any) => (g.totalClassifications || 0) > 0);
    } else if (filter === "unclassified") {
      filteredPage = filteredPage.filter((g: any) => (g.totalClassifications || 0) === 0);
    } else if (filter === "my_sequence" && sequenceIds) {
      filteredPage = filteredPage.filter((g: any) => sequenceIds!.has(g.id));
    }

    // Apply classification-based search filters
    if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalClassifications || 0;
        if (searchTotalClassificationsMin && total < parseInt(searchTotalClassificationsMin)) return false;
        if (searchTotalClassificationsMax && total > parseInt(searchTotalClassificationsMax)) return false;
        return true;
      });
    }

    if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numVisibleNucleus || 0;
        if (searchNumVisibleNucleusMin && total < parseInt(searchNumVisibleNucleusMin)) return false;
        if (searchNumVisibleNucleusMax && total > parseInt(searchNumVisibleNucleusMax)) return false;
        return true;
      });
    }

    if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numAwesomeFlag || 0;
        if (searchNumAwesomeFlagMin && total < parseInt(searchNumAwesomeFlagMin)) return false;
        if (searchNumAwesomeFlagMax && total > parseInt(searchNumAwesomeFlagMax)) return false;
        return true;
      });
    }

    if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.numFailedFitting || 0;
        if (searchNumFailedFittingMin && total < parseInt(searchNumFailedFittingMin)) return false;
        if (searchNumFailedFittingMax && total > parseInt(searchNumFailedFittingMax)) return false;
        return true;
      });
    }

    if (searchTotalAssignedMin || searchTotalAssignedMax) {
      filteredPage = filteredPage.filter((g: any) => {
        const total = g.totalAssigned || 0;
        if (searchTotalAssignedMin && total < parseInt(searchTotalAssignedMin)) return false;
        if (searchTotalAssignedMax && total > parseInt(searchTotalAssignedMax)) return false;
        return true;
      });
    }

    return { 
      count: filteredPage.length, 
      cursor: continueCursor, 
      isDone 
    };
  },
});
