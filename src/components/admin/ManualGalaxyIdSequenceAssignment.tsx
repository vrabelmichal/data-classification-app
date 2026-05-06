import type { ChangeEvent } from "react";

export type ManualAssignmentMode = "create" | "extend";

export function parseGalaxyIds(rawInput: string): string[] {
  return rawInput
    .split(/[\s,]+/)
    .map((galaxyId) => galaxyId.trim())
    .filter((galaxyId) => galaxyId.length > 0);
}

export function dedupeGalaxyIds(galaxyIds: string[]): string[] {
  const uniqueIds: string[] = [];
  const seenGalaxyIds = new Set<string>();

  for (const galaxyId of galaxyIds) {
    if (seenGalaxyIds.has(galaxyId)) {
      continue;
    }
    seenGalaxyIds.add(galaxyId);
    uniqueIds.push(galaxyId);
  }

  return uniqueIds;
}

export function getManualGalaxyIdInputState(typedGalaxyIds: string, uploadedGalaxyIds: string[]) {
  const parsedTypedGalaxyIds = parseGalaxyIds(typedGalaxyIds);
  const combinedGalaxyIds = dedupeGalaxyIds(parsedTypedGalaxyIds.concat(uploadedGalaxyIds));
  const duplicateCount = parsedTypedGalaxyIds.length + uploadedGalaxyIds.length - combinedGalaxyIds.length;

  return {
    parsedTypedGalaxyIds,
    combinedGalaxyIds,
    duplicateCount: Math.max(0, duplicateCount),
  };
}

type ManualGalaxyIdProcedureFieldsProps = {
  mode: ManualAssignmentMode;
  disabled: boolean;
  typedGalaxyIds: string;
  uploadedGalaxyIds: string[];
  uploadedFileName: string;
  onTypedGalaxyIdsChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onClearFile: () => void;
  tone?: "neutral" | "green";
};

const toneClasses = {
  neutral: {
    wrapper: "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20",
    heading: "text-sky-900 dark:text-sky-100",
    copy: "text-sky-700 dark:text-sky-300",
    hint: "text-sky-600 dark:text-sky-400",
    box: "border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-800",
    fileButton: "text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200",
  },
  green: {
    wrapper: "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20",
    heading: "text-teal-900 dark:text-teal-100",
    copy: "text-teal-700 dark:text-teal-300",
    hint: "text-teal-600 dark:text-teal-400",
    box: "border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-800",
    fileButton: "text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200",
  },
} as const;

export function ManualGalaxyIdProcedureFields({
  mode,
  disabled,
  typedGalaxyIds,
  uploadedGalaxyIds,
  uploadedFileName,
  onTypedGalaxyIdsChange,
  onFileChange,
  onClearFile,
  tone = "neutral",
}: ManualGalaxyIdProcedureFieldsProps) {
  const accent = toneClasses[tone];
  const { parsedTypedGalaxyIds, combinedGalaxyIds, duplicateCount } = getManualGalaxyIdInputState(
    typedGalaxyIds,
    uploadedGalaxyIds
  );

  return (
    <div className={`rounded-lg border p-4 space-y-4 ${accent.wrapper}`}>
      <div>
        <h4 className={`text-sm font-semibold ${accent.heading}`}>
          {mode === "create" ? "Manual Galaxy ID Input" : "Manual Galaxy ID Extension"}
        </h4>
        <p className={`text-xs mt-1 ${accent.copy}`}>
          {mode === "create"
            ? "Use this procedure when you already know the exact galaxies that should make up the new sequence."
            : "Use this procedure when you want to append a known list of galaxies directly to the current sequence."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${accent.heading}`}>
              Upload TXT File
            </label>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => void onFileChange(event)}
              disabled={disabled}
              className="block w-full text-sm text-gray-700 dark:text-gray-200"
            />
            <p className={`mt-2 text-xs ${accent.hint}`}>
              One galaxy ID per line. Uploaded IDs are merged with the pasted list below.
            </p>
            {uploadedFileName && (
              <div className={`mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-xs ${accent.box}`}>
                <span>
                  Loaded {uploadedGalaxyIds.length} IDs from {uploadedFileName}
                </span>
                <button
                  type="button"
                  onClick={onClearFile}
                  disabled={disabled}
                  className={`font-medium ${accent.fileButton}`}
                >
                  Clear file
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${accent.heading}`}>
              Galaxy IDs
            </label>
            <textarea
              value={typedGalaxyIds}
              onChange={(event) => onTypedGalaxyIdsChange(event.target.value)}
              disabled={disabled}
              rows={10}
              placeholder="galaxy-001&#10;galaxy-002&#10;galaxy-003"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
            />
            <p className={`mt-2 text-xs ${accent.hint}`}>
              Paste one galaxy ID per line or separate IDs with spaces or commas.
            </p>
          </div>

          <div className={`rounded-lg border p-4 text-sm ${accent.box}`}>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <span>Pasted IDs: {parsedTypedGalaxyIds.length}</span>
              <span>Uploaded IDs: {uploadedGalaxyIds.length}</span>
              <span>Unique combined IDs: {combinedGalaxyIds.length}</span>
              <span>Duplicate inputs removed locally: {duplicateCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}