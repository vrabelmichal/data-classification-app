import { useEffect, useState } from "react";
import { toast } from "sonner";
import { describeLocalStorageItem, LOCAL_STORAGE_GROUP_ORDER, type LocalStorageItemDescription } from "../../lib/browserStorage";

interface LocalStorageEntry {
  key: string;
  value: string;
  sizeBytes: number;
}

interface CategorizedLocalStorageEntry extends LocalStorageEntry {
  metadata: LocalStorageItemDescription;
}

interface LocalStorageGroup {
  id: LocalStorageItemDescription["groupId"];
  label: string;
  entries: CategorizedLocalStorageEntry[];
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

function ViewIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58a3 3 0 104.24 4.24" />
      <path d="M9.88 5.09A9.77 9.77 0 0112 5c5 0 9.27 3.11 11 7-1 2.25-2.73 4.15-4.88 5.3" />
      <path d="M6.61 6.61C4.62 7.85 3.03 9.72 2 12c.78 1.76 2 3.32 3.52 4.55" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={expanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function groupLocalStorageEntries(entries: LocalStorageEntry[]): LocalStorageGroup[] {
  const grouped = new Map<LocalStorageItemDescription["groupId"], LocalStorageGroup>();

  for (const entry of entries) {
    const metadata = describeLocalStorageItem(entry.key);
    const categorizedEntry: CategorizedLocalStorageEntry = {
      ...entry,
      metadata,
    };

    const existingGroup = grouped.get(metadata.groupId);
    if (existingGroup) {
      existingGroup.entries.push(categorizedEntry);
      continue;
    }

    grouped.set(metadata.groupId, {
      id: metadata.groupId,
      label: metadata.groupLabel,
      entries: [categorizedEntry],
    });
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((left, right) => {
        if (left.metadata.kind !== right.metadata.kind) {
          return left.metadata.kind === "commentDraft" ? -1 : 1;
        }

        if (left.metadata.known !== right.metadata.known) {
          return left.metadata.known ? -1 : 1;
        }

        return left.key.localeCompare(right.key);
      }),
    }))
    .sort((left, right) => LOCAL_STORAGE_GROUP_ORDER[left.id] - LOCAL_STORAGE_GROUP_ORDER[right.id]);
}

function LocalStorageItemRow({
  entry,
  isExpanded,
  onToggleExpanded,
  onDelete,
}: {
  entry: CategorizedLocalStorageEntry;
  isExpanded: boolean;
  onToggleExpanded: (key: string) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{entry.metadata.title}</h3>
            {!entry.metadata.known && (
              <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                Unknown or legacy
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(entry.sizeBytes)}</span>
          </div>
          <div className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{entry.key}</div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{entry.metadata.description}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">If deleted: {entry.metadata.deleteEffect}</p>
        </div>

        <div className="flex items-start gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => onToggleExpanded(entry.key)}
            title={isExpanded ? "Hide contents" : "View contents"}
            aria-label={isExpanded ? `Hide stored value for ${entry.key}` : `View stored value for ${entry.key}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ViewIcon hidden={isExpanded} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.key)}
            title="Delete item"
            aria-label={`Delete local storage item ${entry.key}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <TrashIcon />
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
}

export function LocalStorageSection() {
  const [entries, setEntries] = useState<LocalStorageEntry[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedDraftGroups, setExpandedDraftGroups] = useState<Record<string, boolean>>({});

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
  const groupedEntries = groupLocalStorageEntries(entries);

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

  const handleToggleDraftGroup = (groupId: string) => {
    setExpandedDraftGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 xl:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Local storage</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-4xl">
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
          groupedEntries.map((group) => {
            const draftEntries = group.entries.filter((entry) => entry.metadata.kind === "commentDraft");
            const regularEntries = group.entries.filter((entry) => entry.metadata.kind !== "commentDraft");
            const groupExpanded = expandedGroups[group.id] === true;
            const draftsExpanded = expandedDraftGroups[group.id] === true;

            return (
              <section
                key={group.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/20 p-4 xl:p-5"
              >
                <button
                  type="button"
                  onClick={() => handleToggleGroup(group.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{group.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group.entries.length} item{group.entries.length === 1 ? "" : "s"} saved for this area of the app.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <span className="text-xs">{formatBytes(group.entries.reduce((sum, entry) => sum + entry.sizeBytes, 0))}</span>
                    <ChevronIcon expanded={groupExpanded} />
                  </div>
                </button>

                {groupExpanded && (
                  <div className="mt-4 space-y-3">
                    {draftEntries.length > 0 && (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20">
                        <button
                          type="button"
                          onClick={() => handleToggleDraftGroup(group.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">Unfinished comment drafts</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {draftEntries.length} draft{draftEntries.length === 1 ? "" : "s"} saved for galaxies you have not submitted yet.
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                            <span className="text-xs">{formatBytes(draftEntries.reduce((sum, entry) => sum + entry.sizeBytes, 0))}</span>
                            <ChevronIcon expanded={draftsExpanded} />
                          </div>
                        </button>

                        {draftsExpanded && (
                          <div className="border-t border-blue-200 dark:border-blue-900/60 p-3 space-y-3">
                            {draftEntries.map((entry) => (
                              <LocalStorageItemRow
                                key={entry.key}
                                entry={entry}
                                isExpanded={expandedKeys[entry.key] === true}
                                onToggleExpanded={handleToggleExpanded}
                                onDelete={handleDelete}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {regularEntries.map((entry) => (
                      <LocalStorageItemRow
                        key={entry.key}
                        entry={entry}
                        isExpanded={expandedKeys[entry.key] === true}
                        onToggleExpanded={handleToggleExpanded}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}