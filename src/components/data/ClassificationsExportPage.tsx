import { useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  buildAllClassificationsFileName,
  buildClassificationCsvColumns,
  buildUserClassificationsFileName,
  CLASSIFICATION_EXPORT_BATCH_SIZE,
  countSelectedClassificationExportColumns,
  getDefaultClassificationExportColumnSelection,
  sanitizeClassificationExportColumnSelection,
  type ClassificationExportRow,
  type ClassificationExportColumnKey,
  type ClassificationExportColumnSelection,
  type EnrichedClassificationExportRow,
} from "../../lib/classificationsCsv";
import { usePaginatedCsvDownload } from "../../hooks/usePaginatedCsvDownload";
import {
  getUserStatisticsDisplayName,
  UserStatisticsTable,
  type UserStatisticsRow,
} from "../userStatistics/UserStatisticsTable";
import { ExportProgressCard } from "./ExportProgressCard";
import { ClassificationExportConfigForm } from "./ClassificationExportConfigForm";

const EXPORT_COLUMNS_STORAGE_KEY = "data.classifications.exportColumns.v1";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to export classifications";
}

export function ClassificationsExportPage() {
  usePageTitle("Data – Classifications");

  const convex = useConvex();
  const rows = useQuery(api.users.getUsersStatisticsOverview) as UserStatisticsRow[] | undefined;
  const { state, startDownload, cancel, reset, isRunning } = usePaginatedCsvDownload();
  const [columnSelection, setColumnSelection] = useState<ClassificationExportColumnSelection>(
    getDefaultClassificationExportColumnSelection()
  );
  const [isColumnSelectionHydrated, setIsColumnSelectionHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawSelection = window.localStorage.getItem(EXPORT_COLUMNS_STORAGE_KEY);
      if (rawSelection) {
        const parsed = JSON.parse(rawSelection) as Partial<ClassificationExportColumnSelection>;
        setColumnSelection(sanitizeClassificationExportColumnSelection(parsed));
      }
    } catch {
      // Ignore malformed saved export settings
    }

    setIsColumnSelectionHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isColumnSelectionHydrated) return;
    window.localStorage.setItem(EXPORT_COLUMNS_STORAGE_KEY, JSON.stringify(columnSelection));
  }, [columnSelection, isColumnSelectionHydrated]);

  const totalClassifications = useMemo(
    () => rows?.reduce((sum, row) => sum + row.classificationsCount, 0) ?? 0,
    [rows]
  );

  const userLookup = useMemo(
    () =>
      new Map(
        (rows ?? []).map((row) => [
          row.userId,
          {
            userName: row.name,
            userEmail: row.email,
          },
        ])
      ),
    [rows]
  );

  const selectedColumns = useMemo(
    () => buildClassificationCsvColumns(columnSelection),
    [columnSelection]
  );

  const selectedColumnCount = useMemo(
    () => countSelectedClassificationExportColumns(columnSelection),
    [columnSelection]
  );

  const downloadAllButtonDescription =
    selectedColumnCount === 0
      ? "Select at least one CSV column to enable the export."
      : "Build one CSV containing classifications from every user.";

  if (rows === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="h-10 w-10 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const handleExport = (options: {
    contextKey: string;
    label: string;
    fileName: string;
    totalRows: number;
    userId?: string;
    successMessage: (rowCount: number) => string;
  }) => {
    if (selectedColumns.length === 0) {
      toast.error("Select at least one CSV column before downloading");
      return;
    }

    void startDownload<EnrichedClassificationExportRow>({
      columns: selectedColumns,
      totalRows: options.totalRows,
      fileName: options.fileName,
      label: options.label,
      contextKey: options.contextKey,
      fetchPage: async (cursor) => {
        const result = await convex.query(api.classifications.export.getAdminExportBatch, {
          userId: options.userId as never,
          paginationOpts: {
            cursor,
            numItems: CLASSIFICATION_EXPORT_BATCH_SIZE,
          },
        });

        return {
          rows: result.page.map((row) => {
            const user = userLookup.get(row.userId) ?? { userName: null, userEmail: null };
            return {
              ...(row as ClassificationExportRow),
              userName: user.userName,
              userEmail: user.userEmail,
            };
          }),
          continueCursor: result.continueCursor,
          isDone: result.isDone,
        };
      },
      onSuccess: (rowCount) => {
        toast.success(options.successMessage(rowCount));
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    });
  };

  const downloadAllButtonLabel = (() => {
    if (isRunning && state.contextKey === "all") {
      return "Preparing CSV...";
    }
    return "Download all CSV";
  })();

  const toggleColumn = (columnKey: ClassificationExportColumnKey) => {
    setColumnSelection((currentSelection) => ({
      ...currentSelection,
      [columnKey]: !currentSelection[columnKey],
    }));
  };

  const handleSelectAllColumns = () => {
    setColumnSelection((currentSelection) => {
      const nextSelection = { ...currentSelection };
      for (const key of Object.keys(nextSelection) as ClassificationExportColumnKey[]) {
        nextSelection[key] = true;
      }
      return nextSelection;
    });
  };

  const handleClearAllColumns = () => {
    setColumnSelection((currentSelection) => {
      const nextSelection = { ...currentSelection };
      for (const key of Object.keys(nextSelection) as ClassificationExportColumnKey[]) {
        nextSelection[key] = false;
      }
      return nextSelection;
    });
  };

  const handleResetDefaultColumns = () => {
    setColumnSelection(getDefaultClassificationExportColumnSelection());
  };

  return (
    <div className="space-y-6">
      <ExportProgressCard state={state} onCancel={cancel} onDismiss={reset} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Exportable classifications</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {totalClassifications.toLocaleString()}
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Total rows available for the combined export.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Export all users</div>
            <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">Download combined CSV</div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {downloadAllButtonDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleExport({
                contextKey: "all",
                label: "all classifications",
                fileName: buildAllClassificationsFileName(),
                totalRows: totalClassifications,
                successMessage: (rowCount) => `Downloaded ${rowCount.toLocaleString()} classifications`,
              })
            }
            disabled={isRunning || totalClassifications === 0 || selectedColumnCount === 0}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-800"
          >
            {downloadAllButtonLabel}
          </button>
        </div>
      </div>

      <ClassificationExportConfigForm
        selection={columnSelection}
        onToggleColumn={toggleColumn}
        onSelectAll={handleSelectAllColumns}
        onResetDefaults={handleResetDefaultColumns}
        onClearAll={handleClearAllColumns}
      />

      <UserStatisticsTable
        rows={rows}
        title="Classifications by user"
        description="Download a CSV for one user or build a single CSV containing every classification. Data is fetched in batches and assembled in the browser to avoid pulling everything in one request."
        storageKeyPrefix="data.classifications"
        showSummaryCards={false}
        renderActions={(row) => {
          const isRowRunning = isRunning && state.contextKey === `user:${row.userId}`;
          const displayName = getUserStatisticsDisplayName(row);
          const isDisabled = isRunning || row.classificationsCount === 0 || selectedColumnCount === 0;

          return (
            <button
              type="button"
              onClick={() =>
                handleExport({
                  contextKey: `user:${row.userId}`,
                  label: `${displayName} classifications`,
                  fileName: buildUserClassificationsFileName(displayName),
                  totalRows: row.classificationsCount,
                  userId: row.userId,
                  successMessage: (rowCount) =>
                    `Downloaded ${rowCount.toLocaleString()} classifications for ${displayName}`,
                })
              }
              disabled={isDisabled}
              className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:disabled:border-gray-700 dark:disabled:text-gray-500"
            >
              {row.classificationsCount === 0
                ? "No classifications"
                : isRowRunning
                  ? "Preparing CSV..."
                  : "Download CSV"}
            </button>
          );
        }}
      />
    </div>
  );
}