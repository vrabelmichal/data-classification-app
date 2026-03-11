import { useState } from "react";
import { cn } from "../../lib/utils";
import {
  classificationExportColumnDefinitions,
  classificationExportColumnGroups,
  countSelectedClassificationExportColumns,
  type ClassificationExportColumnKey,
  type ClassificationExportColumnSelection,
} from "../../lib/classificationsCsv";

type ClassificationExportConfigFormProps = {
  selection: ClassificationExportColumnSelection;
  onToggleColumn: (columnKey: ClassificationExportColumnKey) => void;
  onSelectAll: () => void;
  onResetDefaults: () => void;
  onClearAll: () => void;
};

const definitionsByKey = new Map(
  classificationExportColumnDefinitions.map((definition) => [definition.key, definition])
);

export function ClassificationExportConfigForm({
  selection,
  onToggleColumn,
  onSelectAll,
  onResetDefaults,
  onClearAll,
}: ClassificationExportConfigFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedCount = countSelectedClassificationExportColumns(selection);
  const totalCount = classificationExportColumnDefinitions.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
        aria-expanded={isExpanded}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CSV columns</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Optional configuration for generated CSV files. The exported table will currently contain {selectedCount} column{selectedCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {selectedCount} / {totalCount} selected
          </span>
          <svg
            className={cn("h-5 w-5 text-gray-500 transition-transform", isExpanded && "rotate-180")}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {classificationExportColumnGroups.map((group) => (
              <section
                key={group.key}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4"
              >
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{group.description}</p>
                </div>

                <div className="space-y-2">
                  {classificationExportColumnDefinitions
                    .filter((definition) => definition.group === group.key)
                    .map((definition) => (
                      <label
                        key={definition.key}
                        className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-200 hover:bg-white dark:hover:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={selection[definition.key]}
                          onChange={() => onToggleColumn(definition.key)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{definitionsByKey.get(definition.key)?.label ?? definition.key}</span>
                      </label>
                    ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onResetDefaults}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear all
            </button>
          </div>

          {selectedCount === 0 && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              Select at least one column before downloading a CSV.
            </p>
          )}
        </div>
      )}
    </div>
  );
}