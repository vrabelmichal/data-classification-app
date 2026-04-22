import type { PreparedDataset } from "./tabTypes";

const ANALYSIS_DATASET_STORAGE_KEY = "statistics.dataAnalysis.dataset.v3";
const ANALYSIS_DATASET_STORAGE_VERSION = 3;
const ANALYSIS_DATASET_DB_NAME = "dataClassificationApp";
const ANALYSIS_DATASET_STORE_NAME = "analysisDatasets";
const ANALYSIS_DATASET_RECORD_KEY = "classificationAnalysis";

type StoredAnalysisDataset = {
  version: number;
  savedAt: number;
  recordCount: number;
};

export type AnalysisDatasetIndexedDbInfo = {
  id: string;
  title: string;
  description: string;
  deleteEffect: string;
  dbName: string;
  storeName: string;
  recordKey: string;
  savedAt: number;
  recordCount: number;
  estimatedSizeBytes: number | null;
};

type StoredAnalysisDatasetPayload = {
  version: number;
  savedAt: number;
  dataset: PreparedDataset;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openAnalysisDatasetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(ANALYSIS_DATASET_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ANALYSIS_DATASET_STORE_NAME)) {
        database.createObjectStore(ANALYSIS_DATASET_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function readMetadata() {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ANALYSIS_DATASET_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredAnalysisDataset>;
    if (
      parsedValue.version !== ANALYSIS_DATASET_STORAGE_VERSION ||
      typeof parsedValue.savedAt !== "number" ||
      typeof parsedValue.recordCount !== "number"
    ) {
      return null;
    }

    return {
      savedAt: parsedValue.savedAt,
      recordCount: parsedValue.recordCount,
    };
  } catch {
    return null;
  }
}

function writeMetadata(metadata: StoredAnalysisDataset) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(ANALYSIS_DATASET_STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // Ignore metadata write failures.
  }
}

function clearMetadata() {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(ANALYSIS_DATASET_STORAGE_KEY);
  } catch {
    // Ignore metadata cleanup failures.
  }
}

function isPreparedDataset(value: unknown): value is PreparedDataset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PreparedDataset>;
  return (
    Array.isArray(candidate.records) &&
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

export function getStoredAnalysisDatasetInfo() {
  return readMetadata();
}

export async function getAnalysisDatasetIndexedDbInfo(): Promise<AnalysisDatasetIndexedDbInfo | null> {
  const metadata = readMetadata();
  if (!metadata) {
    return null;
  }

  let estimatedSizeBytes: number | null = null;

  try {
    const storedDataset = await getStoredAnalysisDataset();
    if (storedDataset) {
      estimatedSizeBytes = new TextEncoder().encode(
        JSON.stringify(storedDataset.dataset)
      ).length;
    }
  } catch {
    estimatedSizeBytes = null;
  }

  return {
    id: ANALYSIS_DATASET_RECORD_KEY,
    title: "Data analysis dataset cache",
    description:
      "Stores the saved client-side classification analysis dataset in IndexedDB so it can be reloaded without fetching every page from the database again.",
    deleteEffect:
      "Deleting it removes the saved browser cache of the analysis dataset. The live database data is not changed.",
    dbName: ANALYSIS_DATASET_DB_NAME,
    storeName: ANALYSIS_DATASET_STORE_NAME,
    recordKey: ANALYSIS_DATASET_RECORD_KEY,
    savedAt: metadata.savedAt,
    recordCount: metadata.recordCount,
    estimatedSizeBytes,
  };
}

export async function getStoredAnalysisDataset() {
  const metadata = readMetadata();
  if (!metadata) {
    return null;
  }

  try {
    const database = await openAnalysisDatasetDb();

    const payload = await new Promise<StoredAnalysisDatasetPayload | null>((resolve, reject) => {
      const transaction = database.transaction(ANALYSIS_DATASET_STORE_NAME, "readonly");
      const store = transaction.objectStore(ANALYSIS_DATASET_STORE_NAME);
      const request = store.get(ANALYSIS_DATASET_RECORD_KEY);

      request.onsuccess = () => {
        resolve((request.result as StoredAnalysisDatasetPayload | undefined) ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error("Failed to read IndexedDB payload."));
    });

    database.close();

    if (
      !payload ||
      payload.version !== ANALYSIS_DATASET_STORAGE_VERSION ||
      typeof payload.savedAt !== "number" ||
      !isPreparedDataset(payload.dataset)
    ) {
      return null;
    }

    return {
      savedAt: metadata.savedAt,
      dataset: payload.dataset,
    };
  } catch {
    return null;
  }
}

export async function saveAnalysisDatasetToStorage(dataset: PreparedDataset) {
  if (!canUseIndexedDb()) {
    return { ok: false as const, error: "IndexedDB is not available in this browser." };
  }

  try {
    const payload: StoredAnalysisDatasetPayload = {
      version: ANALYSIS_DATASET_STORAGE_VERSION,
      savedAt: Date.now(),
      dataset,
    };

    const database = await openAnalysisDatasetDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ANALYSIS_DATASET_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ANALYSIS_DATASET_STORE_NAME);
      const request = store.put(payload, ANALYSIS_DATASET_RECORD_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Failed to write IndexedDB payload."));
    });
    database.close();

    writeMetadata({
      version: ANALYSIS_DATASET_STORAGE_VERSION,
      savedAt: payload.savedAt,
      recordCount: dataset.records.length,
    });

    return { ok: true as const, savedAt: payload.savedAt };
  } catch {
    return {
      ok: false as const,
      error:
        "Failed to save the analysis dataset to browser storage. Try freeing browser storage or using a different browser profile.",
    };
  }
}

export async function clearStoredAnalysisDataset() {
  if (!canUseIndexedDb()) {
    clearMetadata();
    return;
  }

  try {
    const database = await openAnalysisDatasetDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ANALYSIS_DATASET_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ANALYSIS_DATASET_STORE_NAME);
      const request = store.delete(ANALYSIS_DATASET_RECORD_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Failed to clear IndexedDB payload."));
    });
    database.close();
  } catch {
    // Ignore storage cleanup failures.
  }

  clearMetadata();
}

export function getAnalysisDatasetStorageKey() {
  return ANALYSIS_DATASET_STORAGE_KEY;
}

export type IndexedDbEntryInfo = {
  id: string;
  title: string;
  description: string;
  deleteEffect: string;
  dbName: string;
  storeName: string;
  recordKey: string;
  recordCount: number;
  estimatedSizeBytes: number | null;
};

export async function getAllIndexedDbEntries(): Promise<IndexedDbEntryInfo[]> {
  if (!canUseIndexedDb()) {
    return [];
  }

  const entries: IndexedDbEntryInfo[] = [];
  const processedIds = new Set<string>();
  const indexedDbWithDatabases = window.indexedDB as IDBFactory & {
    databases?: () => Promise<IDBDatabaseInfo[]>;
  };
  let discoveredDatabases: IDBDatabaseInfo[] | undefined;

  try {
    // Try to use the modern IndexedDB.databases() API if available
    const databases = indexedDbWithDatabases.databases
      ? await indexedDbWithDatabases.databases()
      : undefined;

    if (databases && Array.isArray(databases)) {
      discoveredDatabases = databases;

      // Process each database discovered via databases() API
      for (const dbInfo of databases) {
        const dbName = dbInfo.name;
        if (!dbName) {
          continue;
        }

        try {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = window.indexedDB.open(dbName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("Failed to open database"));
          });

          try {
            // Get all stores in this database
            const storeNames = Array.from(database.objectStoreNames);

            for (const storeName of storeNames) {
              try {
                // Get all keys in this store
                const storeKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
                  const transaction = database.transaction(storeName, "readonly");
                  const store = transaction.objectStore(storeName);
                  const request = store.getAllKeys();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => reject(request.error ?? new Error("Failed to get keys"));
                });

                // For each key, create entry without loading data (skip size calculation for now)
                for (const recordKey of storeKeys) {
                  // Generate a descriptive title and info based on known entries
                  let title = `${dbName} / ${storeName}`;
                  let description = `IndexedDB store entry`;
                  let deleteEffect = `Deleting this item removes it from IndexedDB. The data may be recreated when you use the feature again.`;

                  if (dbName === ANALYSIS_DATASET_DB_NAME && storeName === ANALYSIS_DATASET_STORE_NAME && recordKey === ANALYSIS_DATASET_RECORD_KEY) {
                    title = "Data analysis dataset cache";
                    description = "Stores the saved client-side classification analysis dataset in IndexedDB so it can be reloaded without fetching every page from the database again.";
                    deleteEffect = "Deleting it removes the saved browser cache of the analysis dataset. The live database data is not changed.";
                  }

                  const entryId = `${dbName}/${storeName}/${String(recordKey)}`;

                  // Avoid duplicates
                  if (!processedIds.has(entryId)) {
                    const entry: IndexedDbEntryInfo = {
                      id: entryId,
                      title,
                      description,
                      deleteEffect,
                      dbName,
                      storeName,
                      recordKey: String(recordKey),
                      recordCount: 1,
                      estimatedSizeBytes: null, // Skip size calculation for now - will be done lazily
                    };

                    entries.push(entry);
                    processedIds.add(entryId);
                  }
                }
              } catch {
                // Skip stores we can't access
              }
            }
          } finally {
            database.close();
          }
        } catch {
          // Skip databases we can't open
        }
      }
    }
  } catch {
    // Silently continue to fallback
  }

  // Fallback: only probe the known analysis dataset database when databases() confirmed
  // that the database already exists. If databases() is unavailable, skip this direct
  // open to avoid creating an empty phantom database during enumeration.
  try {
    const analysisDbId = `${ANALYSIS_DATASET_DB_NAME}/${ANALYSIS_DATASET_STORE_NAME}/${ANALYSIS_DATASET_RECORD_KEY}`;

    const analysisDbExists = Array.isArray(discoveredDatabases)
      ? discoveredDatabases.some((dbInfo) => dbInfo.name === ANALYSIS_DATASET_DB_NAME)
      : false;

    if (!processedIds.has(analysisDbId) && analysisDbExists) {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(ANALYSIS_DATASET_DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open analysis database"));
      });

      try {
        // Check if the store and record exist (without reading data)
        if (database.objectStoreNames.contains(ANALYSIS_DATASET_STORE_NAME)) {
          const recordExists = await new Promise<boolean>((resolve, reject) => {
            const transaction = database.transaction(ANALYSIS_DATASET_STORE_NAME, "readonly");
            const store = transaction.objectStore(ANALYSIS_DATASET_STORE_NAME);
            const request = store.getKey(ANALYSIS_DATASET_RECORD_KEY);
            request.onsuccess = () => resolve(request.result !== undefined);
            request.onerror = () => reject(request.error ?? new Error("Failed to check analysis record"));
          });

          // If record exists, add it
          if (recordExists) {
            const entry: IndexedDbEntryInfo = {
              id: analysisDbId,
              title: "Data analysis dataset cache",
              description: "Stores the saved client-side classification analysis dataset in IndexedDB so it can be reloaded without fetching every page from the database again.",
              deleteEffect: "Deleting it removes the saved browser cache of the analysis dataset. The live database data is not changed.",
              dbName: ANALYSIS_DATASET_DB_NAME,
              storeName: ANALYSIS_DATASET_STORE_NAME,
              recordKey: ANALYSIS_DATASET_RECORD_KEY,
              recordCount: 1,
              estimatedSizeBytes: null, // Skip size calculation for now - will be done lazily
            };

            entries.push(entry);
            processedIds.add(analysisDbId);
          }
        }
      } finally {
        database.close();
      }
    }
  } catch {
    // Silently continue if fallback fails
  }

  return entries;
}

export async function estimateIndexedDbEntrySizeBytes(
  dbName: string,
  storeName: string,
  recordKey: string
): Promise<number | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open database"));
    });

    try {
      if (!database.objectStoreNames.contains(storeName)) {
        return null;
      }

      const recordData = await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(recordKey as IDBValidKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to get record"));
      });

      if (recordData === undefined) {
        return null;
      }

      try {
        return new TextEncoder().encode(JSON.stringify(recordData)).length;
      } catch {
        return null;
      }
    } finally {
      database.close();
    }
  } catch {
    return null;
  }
}