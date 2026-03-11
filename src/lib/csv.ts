export type CsvColumn<T> = {
  header: string;
  getValue: (row: T) => unknown;
};

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const normalizedValue = value instanceof Date
    ? value.toISOString()
    : typeof value === "bigint"
      ? value.toString()
      : String(value);

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

export function createCsvHeader<T>(columns: CsvColumn<T>[]): string {
  return columns.map((column) => escapeCsvCell(column.header)).join(",");
}

export function createCsvRow<T>(row: T, columns: CsvColumn<T>[]): string {
  return columns.map((column) => escapeCsvCell(column.getValue(row))).join(",");
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForFilename(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function sanitizeFilenameSegment(value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || "export";
}