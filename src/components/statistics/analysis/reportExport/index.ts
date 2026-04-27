import { buildAnalysisHtmlReport } from "./html";
import { buildReportData, buildStatsOnlyExport } from "./data";
import type { ExportInput } from "./shared";

export type { ExportInput } from "./shared";
export { buildAnalysisHtmlReport };

export function buildAnalysisStatsExport(input: ExportInput) {
  return buildStatsOnlyExport(buildReportData(input));
}