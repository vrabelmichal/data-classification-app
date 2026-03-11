import { Component, type ErrorInfo, type ReactNode } from "react";

const chunkLoadErrorPatterns = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? getErrorMessage(error.cause) : "";

  return [name, message, cause].filter(Boolean).join(" ");
}

export function isChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return chunkLoadErrorPatterns.some((pattern) => pattern.test(message));
}

function ChunkLoadFallback() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
          Update required
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
          This page was updated while the tab was still open.
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
          The next screen could not be loaded from the older app version. Refresh once to load the
          latest files and continue.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Refresh app
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          If you were navigating to another section, return there after the refresh completes.
        </p>
      </div>
    </div>
  );
}

interface ChunkLoadBoundaryProps {
  children: ReactNode;
}

interface ChunkLoadBoundaryState {
  error: unknown;
}

export class ChunkLoadBoundary extends Component<ChunkLoadBoundaryProps, ChunkLoadBoundaryState> {
  state: ChunkLoadBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ChunkLoadBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Application render error", error, errorInfo);
  }

  render() {
    const { error } = this.state;

    if (error !== null) {
      if (!isChunkLoadError(error)) {
        throw error;
      }

      return <ChunkLoadFallback />;
    }

    return this.props.children;
  }
}
