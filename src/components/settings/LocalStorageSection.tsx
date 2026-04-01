import { useEffect, useState } from "react";
import { toast } from "sonner";
import { describeLocalStorageItem } from "../../lib/browserStorage";

interface LocalStorageEntry {
  key: string;
  value: string;
  sizeBytes: number;
}

function estimateBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  return `${kilobytes >= 10 ? kilobytes.toFixed(0) : kilobytes.toFixed(1)} KB`;
}

function formatStoredValue(value: string): string {
  if (!value) {
    return "(empty string)";
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function readLocalStorageEntries(): LocalStorageEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const entries: LocalStorageEntry[] = [];

  for (const key of Object.keys(window.localStorage).sort((left, right) => left.localeCompare(right))) {
    const value = window.localStorage.getItem(key) ?? "";
    entries.push({
      key,
      value,
      sizeBytes: estimateBytes(`${key}${value}`),
    });
  }

  return entries;
}

export function LocalStorageSection() {
  const [entries, setEntries] = useState<LocalStorageEntry[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const refresh = () => setEntries(readLocalStorageEntries());

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

  const handleToggleExpanded = (key: string) => {
    setExpandedKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleDelete = (key: string) => {
    const metadata = describeLocalStorageItem(key);
    const confirmed = window.confirm(
      `Delete "${key}" from this browser?\n\n${metadata.deleteEffect}`
    );

    if (!confirmed) {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setEntries(readLocalStorageEntries());
      setExpandedKeys((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.success("Browser item deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete browser item");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Local storage</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
            This list shows information saved only in this browser for this site. It can include display preferences,
            filter choices, and unfinished comment drafts. Deleting an item only changes this browser copy. In some
            cases the app will recreate an item the next time you use that feature.
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 sm:text-right">
          <div>{entries.length} item{entries.length === 1 ? "" : "s"}</div>
          <div>{formatBytes(totalBytes)} total</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
            No local storage items are currently saved for this site in this browser.
          </div>
        ) : (
          entries.map((entry) => {
            const metadata = describeLocalStorageItem(entry.key);
            const isExpanded = expandedKeys[entry.key] === true;

            return (
              <div
                key={entry.key}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{metadata.title}</h3>
                      {!metadata.known && (
                        <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                          Unknown or legacy
                        </span>
                      )}
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{entry.key}</div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{metadata.description}</p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">If deleted: {metadata.deleteEffect}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(entry.sizeBytes)}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleExpanded(entry.key)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isExpanded ? "Hide contents" : "View contents"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.key)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <pre className="mt-4 overflow-x-auto rounded-md bg-white dark:bg-gray-950 p-3 text-xs text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap break-words">
                    {formatStoredValue(entry.value)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}