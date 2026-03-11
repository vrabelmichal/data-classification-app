import { useCallback, useEffect, useRef, useState } from "react";
import { createCsvHeader, createCsvRow, downloadTextFile, type CsvColumn } from "../lib/csv";

type DownloadStatus = "idle" | "running" | "success" | "error" | "cancelled";

type FetchPageResult<T> = {
  rows: T[];
  continueCursor: string | null;
  isDone: boolean;
};

type StartDownloadOptions<T> = {
  columns: CsvColumn<T>[];
  totalRows: number;
  fileName: string;
  label: string;
  contextKey: string;
  fetchPage: (cursor: string | null) => Promise<FetchPageResult<T>>;
  onSuccess?: (processedRows: number) => void;
  onError?: (error: unknown) => void;
};

export type PaginatedCsvDownloadState = {
  status: DownloadStatus;
  contextKey: string | null;
  label: string | null;
  fileName: string | null;
  processedRows: number;
  totalRows: number;
  percent: number;
  errorMessage: string | null;
};

const initialState: PaginatedCsvDownloadState = {
  status: "idle",
  contextKey: null,
  label: null,
  fileName: null,
  processedRows: 0,
  totalRows: 0,
  percent: 0,
  errorMessage: null,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to create CSV export";
}

export function usePaginatedCsvDownload() {
  const [state, setState] = useState<PaginatedCsvDownloadState>(initialState);
  const cancelRequestedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRequestedRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    cancelRequestedRef.current = false;
    setState(initialState);
  }, []);

  const cancel = useCallback(() => {
    cancelRequestedRef.current = true;
  }, []);

  const startDownload = useCallback(
    async <T,>(options: StartDownloadOptions<T>) => {
      if (state.status === "running") {
        return false;
      }

      cancelRequestedRef.current = false;

      if (mountedRef.current) {
        setState({
          status: "running",
          contextKey: options.contextKey,
          label: options.label,
          fileName: options.fileName,
          processedRows: 0,
          totalRows: options.totalRows,
          percent: options.totalRows === 0 ? 100 : 0,
          errorMessage: null,
        });
      }

      try {
        const csvLines = [createCsvHeader(options.columns)];

        if (options.totalRows === 0) {
          downloadTextFile(csvLines.join("\n"), options.fileName, "text/csv;charset=utf-8;");

          if (mountedRef.current) {
            setState({
              status: "success",
              contextKey: options.contextKey,
              label: options.label,
              fileName: options.fileName,
              processedRows: 0,
              totalRows: 0,
              percent: 100,
              errorMessage: null,
            });
          }

          options.onSuccess?.(0);
          return true;
        }

        let cursor: string | null = null;
        let processedRows = 0;

        while (true) {
          if (cancelRequestedRef.current) {
            if (mountedRef.current) {
              setState((currentState) => ({
                ...currentState,
                status: "cancelled",
                percent: 0,
                errorMessage: null,
              }));
            }
            return false;
          }

          const page = await options.fetchPage(cursor);

          for (const row of page.rows) {
            csvLines.push(createCsvRow(row, options.columns));
          }

          processedRows += page.rows.length;

          if (mountedRef.current) {
            const percent = options.totalRows > 0
              ? Math.min((processedRows / options.totalRows) * 100, 100)
              : 0;

            setState((currentState) => ({
              ...currentState,
              processedRows,
              percent,
            }));
          }

          if (page.isDone || page.continueCursor === null) {
            break;
          }

          cursor = page.continueCursor;
        }

        if (cancelRequestedRef.current) {
          if (mountedRef.current) {
            setState((currentState) => ({
              ...currentState,
              status: "cancelled",
              percent: 0,
              errorMessage: null,
            }));
          }
          return false;
        }

        downloadTextFile(csvLines.join("\n"), options.fileName, "text/csv;charset=utf-8;");

        if (mountedRef.current) {
          setState({
            status: "success",
            contextKey: options.contextKey,
            label: options.label,
            fileName: options.fileName,
            processedRows,
            totalRows: processedRows,
            percent: 100,
            errorMessage: null,
          });
        }

        options.onSuccess?.(processedRows);
        return true;
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        if (mountedRef.current) {
          setState((currentState) => ({
            ...currentState,
            status: "error",
            percent: 0,
            errorMessage,
          }));
        }

        options.onError?.(error);
        return false;
      }
    },
    [state.status]
  );

  return {
    state,
    startDownload,
    cancel,
    reset,
    isRunning: state.status === "running",
  };
}