import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { formatDateForFilename } from "../../../lib/csv";
import type { PreparedDataset } from "./tabTypes";

const ANALYSIS_DATASET_ARCHIVE_FORMAT = "classification-analysis-dataset";
const ANALYSIS_DATASET_ARCHIVE_VERSION = 1;
const ANALYSIS_DATASET_ARCHIVE_ENTRY_NAME =
  "classification-analysis-dataset.json";

type AnalysisDatasetArchivePayload = {
  format: typeof ANALYSIS_DATASET_ARCHIVE_FORMAT;
  version: typeof ANALYSIS_DATASET_ARCHIVE_VERSION;
  exportedAt: number;
  recordCount: number;
  classificationRowCount: number;
  dataset: PreparedDataset;
};

export type ImportedAnalysisDatasetArchive = {
  dataset: PreparedDataset;
  exportedAt: number;
  fileName: string;
};

function isPreparedDatasetRecord(
  value: unknown
): value is PreparedDataset["records"][number] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    aggregate?: { totalClassifications?: unknown };
  };

  return (
    !!candidate.aggregate &&
    typeof candidate.aggregate === "object" &&
    typeof candidate.aggregate.totalClassifications === "number"
  );
}

function isPreparedDataset(value: unknown): value is PreparedDataset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PreparedDataset>;
  return (
    Array.isArray(candidate.records) &&
    candidate.records.every(isPreparedDatasetRecord) &&
    typeof candidate.loadedAt === "number" &&
    typeof candidate.classifiedGalaxyCount === "number" &&
    typeof candidate.maxClassificationsPerGalaxy === "number" &&
    typeof candidate.totalAwesomeVotes === "number" &&
    typeof candidate.totalVisibleNucleusVotes === "number" &&
    typeof candidate.totalFailedFittingVotes === "number" &&
    typeof candidate.totalCommentedClassifications === "number" &&
    (candidate.averageCommentLength === null ||
      candidate.averageCommentLength === undefined ||
      typeof candidate.averageCommentLength === "number") &&
    typeof candidate.maxCommentLength === "number" &&
    typeof candidate.orphanedGalaxyCount === "number" &&
    typeof candidate.orphanedClassificationCount === "number"
  );
}

function getDatasetClassificationRowCount(dataset: PreparedDataset) {
  return (
    dataset.records.reduce(
      (sum, record) => sum + record.aggregate.totalClassifications,
      0
    ) + dataset.orphanedClassificationCount
  );
}

function isAnalysisDatasetArchivePayload(
  value: unknown
): value is AnalysisDatasetArchivePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnalysisDatasetArchivePayload>;
  if (
    candidate.format !== ANALYSIS_DATASET_ARCHIVE_FORMAT ||
    candidate.version !== ANALYSIS_DATASET_ARCHIVE_VERSION ||
    typeof candidate.exportedAt !== "number" ||
    typeof candidate.recordCount !== "number" ||
    typeof candidate.classificationRowCount !== "number" ||
    !isPreparedDataset(candidate.dataset)
  ) {
    return false;
  }

  return (
    candidate.recordCount === candidate.dataset.records.length &&
    candidate.classificationRowCount ===
      getDatasetClassificationRowCount(candidate.dataset)
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createAnalysisDatasetArchivePayload(
  dataset: PreparedDataset,
  exportedAt: number
): AnalysisDatasetArchivePayload {
  return {
    format: ANALYSIS_DATASET_ARCHIVE_FORMAT,
    version: ANALYSIS_DATASET_ARCHIVE_VERSION,
    exportedAt,
    recordCount: dataset.records.length,
    classificationRowCount: getDatasetClassificationRowCount(dataset),
    dataset,
  };
}

function getArchiveJsonEntry(entries: Record<string, Uint8Array>) {
  const primaryEntry = entries[ANALYSIS_DATASET_ARCHIVE_ENTRY_NAME];
  if (primaryEntry) {
    return primaryEntry;
  }

  const fallbackEntry = Object.entries(entries).find(([name]) =>
    name.toLowerCase().endsWith(".json")
  );

  return fallbackEntry?.[1] ?? null;
}

export function buildAnalysisDatasetArchiveFileName(exportedAt = Date.now()) {
  return `classification-analysis-dataset-${formatDateForFilename(new Date(exportedAt))}.zip`;
}

export function downloadAnalysisDatasetArchive(dataset: PreparedDataset) {
  const exportedAt = Date.now();
  const payload = createAnalysisDatasetArchivePayload(dataset, exportedAt);
  const archiveBytes = zipSync(
    {
      [ANALYSIS_DATASET_ARCHIVE_ENTRY_NAME]: strToU8(JSON.stringify(payload)),
    },
    { level: 9 }
  );
  const archiveBlobBytes = new Uint8Array(archiveBytes.byteLength);
  archiveBlobBytes.set(archiveBytes);
  const fileName = buildAnalysisDatasetArchiveFileName(exportedAt);

  downloadBlob(
    new Blob([archiveBlobBytes.buffer], { type: "application/zip" }),
    fileName
  );

  return {
    fileName,
    exportedAt,
    recordCount: payload.recordCount,
  };
}

export async function importAnalysisDatasetArchive(
  file: File
): Promise<ImportedAnalysisDatasetArchive> {
  let archiveEntries: Record<string, Uint8Array>;

  try {
    const archiveBytes = new Uint8Array(await file.arrayBuffer());
    archiveEntries = unzipSync(archiveBytes);
  } catch {
    throw new Error("The selected file is not a valid ZIP archive.");
  }

  const jsonEntry = getArchiveJsonEntry(archiveEntries);
  if (!jsonEntry) {
    throw new Error(
      "The selected ZIP archive does not contain a client-side analysis dataset export."
    );
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(strFromU8(jsonEntry));
  } catch {
    throw new Error(
      "The analysis dataset export inside the ZIP file could not be read."
    );
  }

  if (!isAnalysisDatasetArchivePayload(parsedPayload)) {
    throw new Error(
      "The selected ZIP file is not a supported analysis dataset export."
    );
  }

  return {
    dataset: parsedPayload.dataset,
    exportedAt: parsedPayload.exportedAt,
    fileName:
      file.name.trim() ||
      buildAnalysisDatasetArchiveFileName(parsedPayload.exportedAt),
  };
}