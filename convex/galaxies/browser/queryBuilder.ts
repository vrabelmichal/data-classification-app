import { allowedSort, type GalaxySearchFilters, safeBigInt, type Sortable } from "./shared";

export const buildGalaxyBrowseQuery = (
  ctx: any,
  requestedSort: Sortable,
  sortOrder: "asc" | "desc",
  filters: GalaxySearchFilters,
) => {
  const {
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
  } = filters;

  let indexName = allowedSort[requestedSort].index;
  let indexBuilder: ((qb: any) => any) | undefined;

  const applyRange = (qb: any, field: string, min?: string, max?: string) => {
    let out = qb;
    if (min) out = out.gte(field, parseFloat(min));
    if (max) out = out.lte(field, parseFloat(max));
    return out;
  };

  const applyInt64Range = (qb: any, field: string, min?: string, max?: string) => {
    let out = qb;
    const minVal = safeBigInt(min);
    const maxVal = safeBigInt(max);
    if (minVal !== null) out = out.gte(field, minVal);
    if (maxVal !== null) out = out.lte(field, maxVal);
    return out;
  };

  switch (requestedSort) {
    case "numericId":
      if (searchMagMin || searchMagMax) {
        indexName = "by_numericId_mag";
      } else if (searchMeanMueMin || searchMeanMueMax) {
        indexName = "by_numericId_mean_mue";
      } else if (searchQMin || searchQMax) {
        indexName = "by_numericId_q";
      } else if (searchReffMin || searchReffMax) {
        indexName = "by_numericId_reff";
      }
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
    case "totalClassifications":
      if (searchTotalClassificationsMin || searchTotalClassificationsMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "totalClassifications", searchTotalClassificationsMin, searchTotalClassificationsMax);
      }
      break;
    case "numVisibleNucleus":
      if (searchNumVisibleNucleusMin || searchNumVisibleNucleusMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numVisibleNucleus", searchNumVisibleNucleusMin, searchNumVisibleNucleusMax);
      }
      break;
    case "numAwesomeFlag":
      if (searchNumAwesomeFlagMin || searchNumAwesomeFlagMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numAwesomeFlag", searchNumAwesomeFlagMin, searchNumAwesomeFlagMax);
      }
      break;
    case "numFailedFitting":
      if (searchNumFailedFittingMin || searchNumFailedFittingMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "numFailedFitting", searchNumFailedFittingMin, searchNumFailedFittingMax);
      }
      break;
    case "totalAssigned":
      if (searchTotalAssignedMin || searchTotalAssignedMax) {
        indexBuilder = (qb) => applyInt64Range(qb, "totalAssigned", searchTotalAssignedMin, searchTotalAssignedMax);
      }
      break;
  }

  let qBase = ctx.db.query("galaxies");
  let q: any = indexBuilder
    ? qBase.withIndex(indexName as any, indexBuilder as any)
    : qBase.withIndex(indexName as any);

  q = q.order(sortOrder as any);

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

  const totalClassificationsMinVal = safeBigInt(searchTotalClassificationsMin);
  const totalClassificationsMaxVal = safeBigInt(searchTotalClassificationsMax);
  const numVisibleNucleusMinVal = safeBigInt(searchNumVisibleNucleusMin);
  const numVisibleNucleusMaxVal = safeBigInt(searchNumVisibleNucleusMax);
  const numAwesomeFlagMinVal = safeBigInt(searchNumAwesomeFlagMin);
  const numAwesomeFlagMaxVal = safeBigInt(searchNumAwesomeFlagMax);
  const numFailedFittingMinVal = safeBigInt(searchNumFailedFittingMin);
  const numFailedFittingMaxVal = safeBigInt(searchNumFailedFittingMax);
  const totalAssignedMinVal = safeBigInt(searchTotalAssignedMin);
  const totalAssignedMaxVal = safeBigInt(searchTotalAssignedMax);

  if (totalClassificationsMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("totalClassifications"), totalClassificationsMinVal));
  if (totalClassificationsMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("totalClassifications"), totalClassificationsMaxVal));
  if (numVisibleNucleusMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numVisibleNucleus"), numVisibleNucleusMinVal));
  if (numVisibleNucleusMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numVisibleNucleus"), numVisibleNucleusMaxVal));
  if (numAwesomeFlagMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numAwesomeFlag"), numAwesomeFlagMinVal));
  if (numAwesomeFlagMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numAwesomeFlag"), numAwesomeFlagMaxVal));
  if (numFailedFittingMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("numFailedFitting"), numFailedFittingMinVal));
  if (numFailedFittingMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("numFailedFitting"), numFailedFittingMaxVal));
  if (totalAssignedMinVal !== null)
    q = q.filter((f: any) => f.gte(f.field("totalAssigned"), totalAssignedMinVal));
  if (totalAssignedMaxVal !== null)
    q = q.filter((f: any) => f.lte(f.field("totalAssigned"), totalAssignedMaxVal));

  return q;
};
