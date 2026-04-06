interface RecoverableLoadingScreenProps {
  isOnline: boolean;
  message: string;
  showRecovery: boolean;
  onRefresh: () => void;
}

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </div>
  );
}

export function RecoverableLoadingScreen({
  isOnline,
  message,
  showRecovery,
  onRefresh,
}: RecoverableLoadingScreenProps) {
  if (!showRecovery) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300">{message}</p>
          {!isOnline && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              The browser is offline. The app will resume once the connection returns.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-xl dark:border-amber-800 dark:bg-gray-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Connection recovery
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
          This session needs to reconnect.
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {isOnline
            ? "This tab has been open for a while and the app is still waiting for the backend. Refresh once to restore a clean connection."
            : "The browser is offline, so the app cannot finish loading yet. Reconnect to the internet, then refresh if the page does not recover on its own."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            Refresh app
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Status: {isOnline ? "browser online" : "browser offline"}. {message}
        </p>
      </div>
    </div>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center px-4">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-lg">
          {message || "You do not have permission to view this page."}
        </p>
      </div>
    </div>
  );
}