import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { getImageObjectKey, getImageUrl } from "../../images";
import { getClassificationAuditTargets, type ClassificationAuditTarget } from "../../images/classificationAuditTargets";
import { loadImagesConfig } from "../../images/config";
import { cn } from "../../lib/utils";

type AuditMode = "class_a" | "class_b" | "url";

type RequestAuthMode = "none" | "bearer" | "r2_keys";

type R2ClientInputs = {
  endpoint: string;
  bucket: string;
  prefix: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type AuditExecutionConfig =
  | {
      mode: "url";
      urlToken: string;
    }
  | {
      mode: "class_a" | "class_b";
      r2: R2ClientInputs;
    };

type ImageAuditStat = {
  imageKey: string;
  label: string;
  availableCount: number;
  missingCount: number;
  errorCount: number;
};

type ImageAuditRun = {
  _id: string;
  status: "paused" | "running" | "completed" | "failed";
  checkMode: AuditMode;
  paperFilter: string[];
  includeBlacklisted: boolean;
  batchSize: number;
  totalGalaxies: number;
  processedGalaxies: number;
  selectedImageKeys: string[];
  tokenHash: string;
  requestMethod: "head" | "get";
  requestAuthMode: RequestAuthMode;
  provider: "local" | "r2";
  imageBaseUrl: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2Prefix?: string;
  r2Region?: string;
  imageStats: ImageAuditStat[];
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  lastError?: string;
  lastProcessedGalaxyId?: string;
  processedBatchCount: number;
  creatorName: string;
  creatorEmail: string;
};

type ImageAuditOverview = {
  availablePapers: string[];
  totalGalaxies: number | null;
  blacklistedCount: number;
  recentRuns: ImageAuditRun[];
};

type ImageDelta = {
  availableCount: number;
  missingCount: number;
  errorCount: number;
};

type LiveSnapshot = {
  runId: string;
  batchCandidateCount: number;
  batchTotalChecks: number;
  completedChecks: number;
  imageDeltas: Record<string, ImageDelta>;
};

type ProbeStatus = "available" | "missing" | "error";

type ProbeResult = {
  status: ProbeStatus;
  errorMessage?: string;
};

const AUDIT_TARGETS = getClassificationAuditTargets();
const IMAGES_CONFIG = loadImagesConfig();
const DEFAULT_BATCH_SIZE = 50;
const MAX_CONCURRENT_REQUESTS = 24;
const DEFAULT_AUDIT_MODE: AuditMode = "class_b";
const DEFAULT_R2_REGION = "auto";
const CLASS_A_PRICE_PER_MILLION = 4.5;
const CLASS_B_PRICE_PER_MILLION = 0.36;

function formatCurrency(value: number) {
  return `$${value.toFixed(value < 0.1 ? 4 : 2)}`;
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, "");
}

function normalizePrefix(prefix: string) {
  return prefix.trim().replace(/^\/+|\/+$/g, "");
}

function normalizeR2ClientInputs(inputs: R2ClientInputs): R2ClientInputs {
  return {
    endpoint: normalizeEndpoint(inputs.endpoint),
    bucket: inputs.bucket.trim(),
    prefix: normalizePrefix(inputs.prefix),
    region: inputs.region.trim() || DEFAULT_R2_REGION,
    accessKeyId: inputs.accessKeyId.trim(),
    secretAccessKey: inputs.secretAccessKey.trim(),
  };
}

function buildAuditModeLabel(mode: AuditMode) {
  if (mode === "class_a") return "Class A: ListObjectsV2";
  if (mode === "class_b") return "Class B: HeadObject";
  return "URL availability";
}

function buildAuditModeSummary(mode: AuditMode) {
  if (mode === "class_a") {
    return "Lists each galaxy prefix through the R2 S3 API and compares expected object keys locally. Usually cheapest when checking many image types per galaxy.";
  }
  if (mode === "class_b") {
    return "Issues one HeadObject request per expected image through the R2 S3 API. Exact and simple, usually best for a smaller number of images.";
  }
  return "Checks the public or protected image URLs directly in the browser. Use this only when you want end-user URL verification or cannot use the S3 API.";
}

function buildUrlCredentialMaterial(baseUrl: string, token: string) {
  return JSON.stringify({
    mode: "url",
    baseUrl,
    token: token.trim(),
  });
}

function buildR2CredentialMaterial(mode: AuditMode, inputs: R2ClientInputs) {
  const normalized = normalizeR2ClientInputs(inputs);
  return JSON.stringify({
    mode,
    endpoint: normalized.endpoint,
    bucket: normalized.bucket,
    prefix: normalized.prefix,
    region: normalized.region,
    accessKeyId: normalized.accessKeyId,
    secretAccessKey: normalized.secretAccessKey,
  });
}

function buildAuditObjectKey(galaxyId: string, imageKey: string, prefix: string) {
  const normalizedPrefix = normalizePrefix(prefix);
  const objectKey = getImageObjectKey(galaxyId, imageKey);
  return normalizedPrefix ? `${normalizedPrefix}/${objectKey}` : objectKey;
}

function buildGalaxyPrefix(galaxyId: string, prefix: string) {
  const normalizedPrefix = normalizePrefix(prefix);
  return normalizedPrefix ? `${normalizedPrefix}/${galaxyId}/` : `${galaxyId}/`;
}

function createR2S3Client(inputs: R2ClientInputs) {
  const normalized = normalizeR2ClientInputs(inputs);
  return new S3Client({
    region: normalized.region,
    endpoint: normalized.endpoint,
    credentials: {
      accessKeyId: normalized.accessKeyId,
      secretAccessKey: normalized.secretAccessKey,
    },
  });
}

function isNotFoundError(error: unknown) {
  const maybeError = error as {
    name?: string;
    message?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = maybeError.Code ?? maybeError.code ?? maybeError.name;
  const statusCode = maybeError.$metadata?.httpStatusCode;

  return statusCode === 404 || code === "NotFound" || code === "NoSuchKey";
}

function formatAuditRequestError(mode: AuditMode, error: unknown, endpoint: string) {
  const maybeError = error as {
    name?: string;
    message?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const statusCode = maybeError.$metadata?.httpStatusCode;
  const code = maybeError.Code ?? maybeError.code;
  const rawMessage = (maybeError.message || maybeError.name || "Unknown request error").trim();
  const parts = [statusCode ? `HTTP ${statusCode}` : null, code || null, rawMessage || null].filter(
    (value, index, array): value is string => !!value && array.indexOf(value) === index
  );
  const baseMessage = parts.join(" - ") || "Unknown request error";

  if (rawMessage === "Failed to fetch" || rawMessage === "NetworkError when attempting to fetch resource.") {
    if (mode === "url") {
      return `${baseMessage}. The browser could not reach the image URL. Check the URL, auth token, and any CORS or network restrictions.`;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "this app origin";
    return `${baseMessage}. Browser-side R2 API access usually fails like this when bucket CORS does not allow ${origin}, the required GET/HEAD methods or AWS SDK headers are blocked, or the endpoint ${endpoint} is incorrect.`;
  }

  return baseMessage;
}

async function probeR2ObjectHead(
  client: S3Client,
  inputs: R2ClientInputs,
  galaxyId: string,
  imageKey: string,
  signal: AbortSignal
): Promise<ProbeResult> {
  const normalized = normalizeR2ClientInputs(inputs);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: normalized.bucket,
        Key: buildAuditObjectKey(galaxyId, imageKey, normalized.prefix),
      }),
      { abortSignal: signal }
    );

    return { status: "available" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    if (isNotFoundError(error)) {
      return { status: "missing" };
    }

    return {
      status: "error",
      errorMessage: formatAuditRequestError("class_b", error, normalized.endpoint),
    };
  }
}

async function listR2GalaxyObjectKeys(
  client: S3Client,
  inputs: R2ClientInputs,
  galaxyId: string,
  signal: AbortSignal
) {
  const normalized = normalizeR2ClientInputs(inputs);
  const keys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: normalized.bucket,
        Prefix: buildGalaxyPrefix(galaxyId, normalized.prefix),
        ContinuationToken: continuationToken,
      }),
      { abortSignal: signal }
    );

    for (const item of response.Contents ?? []) {
      if (item.Key) {
        keys.add(item.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

function estimateClassACost(galaxyCount: number) {
  return (galaxyCount / 1_000_000) * CLASS_A_PRICE_PER_MILLION;
}

function estimateClassBCost(galaxyCount: number, imageCount: number) {
  return ((galaxyCount * imageCount) / 1_000_000) * CLASS_B_PRICE_PER_MILLION;
}

function estimateUrlOriginCost(galaxyCount: number, imageCount: number, cacheHitRatePercent: number) {
  const clampedHitRate = Math.max(0, Math.min(100, cacheHitRatePercent));
  return estimateClassBCost(galaxyCount, imageCount) * ((100 - clampedHitRate) / 100);
}

function formatNumber(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }
  return value.toLocaleString();
}

function formatTimestamp(timestamp: number | undefined) {
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleString();
}

function formatPaperLabel(paper: string) {
  return paper === "" ? "(no paper)" : paper;
}

function formatPaperSummary(papers: string[]) {
  if (papers.length === 0) {
    return "All papers";
  }
  return papers.map(formatPaperLabel).join(", ");
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}

function sumImageChecks(stats: ImageAuditStat[]) {
  return stats.reduce(
    (totals, stat) => {
      totals.available += stat.availableCount;
      totals.missing += stat.missingCount;
      totals.error += stat.errorCount;
      return totals;
    },
    { available: 0, missing: 0, error: 0 }
  );
}

function mergeImageStats(stats: ImageAuditStat[], liveDeltas: Record<string, ImageDelta> | undefined) {
  if (!liveDeltas) {
    return stats;
  }

  return stats.map((stat) => {
    const delta = liveDeltas[stat.imageKey];
    if (!delta) {
      return stat;
    }

    return {
      ...stat,
      availableCount: stat.availableCount + delta.availableCount,
      missingCount: stat.missingCount + delta.missingCount,
      errorCount: stat.errorCount + delta.errorCount,
    };
  });
}

async function hashCredentialMaterial(material: string) {
  if (!material) {
    return "";
  }

  const encoded = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function probeImageAvailability(url: string, token: string, signal: AbortSignal): Promise<ProbeResult> {
  const trimmedToken = token.trim();
  const headers = trimmedToken ? { Authorization: `Bearer ${trimmedToken}` } : undefined;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers,
      cache: "no-store",
      signal,
    });

    if (response.ok) {
      return { status: "available" };
    }
    if (response.status === 404) {
      return { status: "missing" };
    }
    if (response.status === 405) {
      const fallback = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
        signal,
      });

      if (fallback.ok) {
        return { status: "available" };
      }
      if (fallback.status === 404) {
        return { status: "missing" };
      }

      return {
        status: "error",
        errorMessage: `HTTP ${fallback.status} - ${fallback.statusText || "URL availability check failed"}`,
      };
    }

    return {
      status: "error",
      errorMessage: `HTTP ${response.status} - ${response.statusText || "URL availability check failed"}`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      status: "error",
      errorMessage: formatAuditRequestError("url", error, url),
    };
  }
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let index = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = index;
        index += 1;

        if (currentIndex >= items.length) {
          return;
        }

        await worker(items[currentIndex]);
      }
    })
  );
}

function StatusBadge({ status }: { status: ImageAuditRun["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        status === "completed" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
        status === "running" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        status === "paused" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        status === "failed" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      )}
    >
      {status}
    </span>
  );
}

export function ImageAvailabilityAuditPanel() {
  const overview = useQuery(api.imageAudit.getImageAuditOverview, { limit: 30 }) as
    | ImageAuditOverview
    | undefined;
  const createImageAuditRun = useAction(api.imageAudit.createImageAuditRun);
  const deleteImageAuditRun = useAction(api.imageAudit.deleteImageAuditRun);
  const fetchImageAuditBatch = useAction(api.imageAudit.fetchImageAuditBatch);
  const getImageAuditMissingIdsPage = useAction(api.imageAudit.getImageAuditMissingIdsPage);
  const appendImageAuditBatch = useMutation(api.imageAudit.appendImageAuditBatch);
  const setImageAuditRunStatus = useMutation(api.imageAudit.setImageAuditRunStatus);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [auditMode, setAuditMode] = useState<AuditMode>(DEFAULT_AUDIT_MODE);
  const [token, setToken] = useState("");
  const [r2Endpoint, setR2Endpoint] = useState("");
  const [r2Bucket, setR2Bucket] = useState(IMAGES_CONFIG.provider === "r2" ? IMAGES_CONFIG.bucket : "");
  const [r2Prefix, setR2Prefix] = useState("");
  const [r2Region, setR2Region] = useState(DEFAULT_R2_REGION);
  const [r2AccessKeyId, setR2AccessKeyId] = useState("");
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState("");
  const [urlCacheHitRate, setUrlCacheHitRate] = useState(0);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [includeBlacklisted, setIncludeBlacklisted] = useState(true);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [selectedImageKeys, setSelectedImageKeys] = useState<Set<string>>(
    new Set(AUDIT_TARGETS.map((target) => target.key))
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isDeletingRunId, setIsDeletingRunId] = useState<string | null>(null);
  const [isDownloadingKey, setIsDownloadingKey] = useState<string | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
  const [liveErrorMessage, setLiveErrorMessage] = useState<string | null>(null);

  const activeRunIdRef = useRef<string | null>(null);
  const pauseRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const liveAnimationFrameRef = useRef<number | null>(null);
  const liveDeltasRef = useRef<Record<string, ImageDelta>>({});
  const liveCompletedChecksRef = useRef(0);
  const liveBatchTotalChecksRef = useRef(0);
  const liveBatchCandidateCountRef = useRef(0);

  const selectedRun = useQuery(
    api.imageAudit.getImageAuditRun,
    selectedRunId ? { runId: selectedRunId as any } : "skip"
  ) as ImageAuditRun | null | undefined;

  useEffect(() => {
    if (overview?.availablePapers && overview.availablePapers.length > 0 && selectedPapers.size === 0) {
      setSelectedPapers(new Set(overview.availablePapers));
    }
  }, [overview?.availablePapers, selectedPapers.size]);

  useEffect(() => {
    if (!selectedRunId && overview?.recentRuns && overview.recentRuns.length > 0) {
      setSelectedRunId(overview.recentRuns[0]._id);
    }
  }, [overview?.recentRuns, selectedRunId]);

  useEffect(() => {
    return () => {
      if (liveAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(liveAnimationFrameRef.current);
      }
    };
  }, []);

  const viewedRun = selectedRun ?? overview?.recentRuns.find((run) => run._id === selectedRunId) ?? null;
  const providerBaseUrl =
    IMAGES_CONFIG.provider === "r2" ? IMAGES_CONFIG.r2PublicBase : IMAGES_CONFIG.localServerBase;
  const selectedTargets = AUDIT_TARGETS.filter((target) => selectedImageKeys.has(target.key));
  const selectedImageCount = selectedTargets.length;
  const usesR2ApiMode = auditMode === "class_a" || auditMode === "class_b";
  const currentR2Inputs = normalizeR2ClientInputs({
    endpoint: r2Endpoint,
    bucket: r2Bucket,
    prefix: r2Prefix,
    region: r2Region,
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  });

  const flushLiveSnapshot = (runId: string) => {
    if (liveAnimationFrameRef.current !== null) {
      return;
    }

    liveAnimationFrameRef.current = window.requestAnimationFrame(() => {
      liveAnimationFrameRef.current = null;
      setLiveSnapshot({
        runId,
        batchCandidateCount: liveBatchCandidateCountRef.current,
        batchTotalChecks: liveBatchTotalChecksRef.current,
        completedChecks: liveCompletedChecksRef.current,
        imageDeltas: Object.fromEntries(
          Object.entries(liveDeltasRef.current).map(([imageKey, delta]) => [imageKey, { ...delta }])
        ),
      });
    });
  };

  const resetLiveSnapshot = () => {
    if (liveAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(liveAnimationFrameRef.current);
      liveAnimationFrameRef.current = null;
    }

    liveDeltasRef.current = {};
    liveCompletedChecksRef.current = 0;
    liveBatchTotalChecksRef.current = 0;
    liveBatchCandidateCountRef.current = 0;
    setLiveSnapshot(null);
  };

  const beginLiveBatch = (runId: string, targets: ClassificationAuditTarget[], candidateCount: number) => {
    liveDeltasRef.current = Object.fromEntries(
      targets.map((target) => [
        target.key,
        {
          availableCount: 0,
          missingCount: 0,
          errorCount: 0,
        },
      ])
    );
    liveCompletedChecksRef.current = 0;
    liveBatchCandidateCountRef.current = candidateCount;
    liveBatchTotalChecksRef.current = candidateCount * targets.length;
    flushLiveSnapshot(runId);
  };

  const updatePaperSelection = (paper: string) => {
    setSelectedPapers((current) => {
      const next = new Set(current);
      if (next.has(paper)) {
        next.delete(paper);
      } else {
        next.add(paper);
      }
      return next;
    });
  };

  const updateImageSelection = (imageKey: string) => {
    setSelectedImageKeys((current) => {
      const next = new Set(current);
      if (next.has(imageKey)) {
        next.delete(imageKey);
      } else {
        next.add(imageKey);
      }
      return next;
    });
  };

  const runAuditLoop = async (
    runId: string,
    targets: ClassificationAuditTarget[],
    executionConfig: AuditExecutionConfig
  ) => {
    pauseRequestedRef.current = false;
    activeRunIdRef.current = runId;
    abortControllerRef.current = new AbortController();
    setIsRunning(true);
    setIsPausing(false);
    setSelectedRunId(runId);
    setLiveErrorMessage(null);

    const r2Client = executionConfig.mode === "url" ? null : createR2S3Client(executionConfig.r2);

    try {
      await setImageAuditRunStatus({ runId: runId as any, status: "running", clearLastError: true });

      while (true) {
        if (pauseRequestedRef.current) {
          return;
        }

        const batch = await fetchImageAuditBatch({ runId: runId as any });

        if (batch.candidates.length === 0) {
          if (batch.isDone) {
            await appendImageAuditBatch({
              runId: runId as any,
              expectedPreviousCursor: batch.previousCursor ?? undefined,
              nextCursor: undefined,
              isDone: true,
              processedGalaxies: 0,
              lastProcessedGalaxyId: undefined,
              imageStatsDelta: targets.map((target) => ({
                imageKey: target.key,
                availableCount: 0,
                missingCount: 0,
                errorCount: 0,
              })),
              missingIdsByImage: [],
            });
            toast.success("Image audit completed.");
            break;
          }

          throw new Error("Image audit batch returned no candidates before completion.");
        }

        beginLiveBatch(runId, targets, batch.candidates.length);

        const batchDeltas = Object.fromEntries(
          targets.map((target) => [
            target.key,
            {
              availableCount: 0,
              missingCount: 0,
              errorCount: 0,
            },
          ])
        ) as Record<string, ImageDelta>;

        const missingIdsByImage = Object.fromEntries(
          targets.map((target) => [target.key, [] as string[]])
        ) as Record<string, string[]>;
        let batchErrorSample: string | undefined;

        if (executionConfig.mode === "class_b") {
          const checks = batch.candidates.flatMap((galaxyId: string) =>
            targets.map((target) => ({ galaxyId, target }))
          );

          await runWithConcurrency(checks, MAX_CONCURRENT_REQUESTS, async ({ galaxyId, target }) => {
            const result = await probeR2ObjectHead(
              r2Client!,
              executionConfig.r2,
              galaxyId,
              target.key,
              abortControllerRef.current!.signal
            );

            if (result.status === "available") {
              batchDeltas[target.key].availableCount += 1;
            } else if (result.status === "missing") {
              batchDeltas[target.key].missingCount += 1;
              missingIdsByImage[target.key].push(galaxyId);
            } else {
              batchDeltas[target.key].errorCount += 1;
              if (!batchErrorSample && result.errorMessage) {
                batchErrorSample = result.errorMessage;
                setLiveErrorMessage(result.errorMessage);
              }
            }

            liveDeltasRef.current[target.key] = { ...batchDeltas[target.key] };
            liveCompletedChecksRef.current += 1;
            flushLiveSnapshot(runId);
          });
        } else if (executionConfig.mode === "class_a") {
          await runWithConcurrency(batch.candidates, MAX_CONCURRENT_REQUESTS, async (galaxyId) => {
            try {
              const keys = await listR2GalaxyObjectKeys(
                r2Client!,
                executionConfig.r2,
                galaxyId,
                abortControllerRef.current!.signal
              );

              for (const target of targets) {
                const objectKey = buildAuditObjectKey(galaxyId, target.key, executionConfig.r2.prefix);
                if (keys.has(objectKey)) {
                  batchDeltas[target.key].availableCount += 1;
                } else {
                  batchDeltas[target.key].missingCount += 1;
                  missingIdsByImage[target.key].push(galaxyId);
                }
                liveDeltasRef.current[target.key] = { ...batchDeltas[target.key] };
              }
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
              }

              const errorMessage = formatAuditRequestError("class_a", error, executionConfig.r2.endpoint);
              if (!batchErrorSample) {
                batchErrorSample = errorMessage;
                setLiveErrorMessage(errorMessage);
              }

              for (const target of targets) {
                batchDeltas[target.key].errorCount += 1;
                liveDeltasRef.current[target.key] = { ...batchDeltas[target.key] };
              }
            }

            liveCompletedChecksRef.current += targets.length;
            flushLiveSnapshot(runId);
          });
        } else {
          const urlExecutionConfig = executionConfig as Extract<AuditExecutionConfig, { mode: "url" }>;
          const urlToken = urlExecutionConfig.urlToken;
          const checks = batch.candidates.flatMap((galaxyId: string) =>
            targets.map((target) => ({ galaxyId, target }))
          );

          await runWithConcurrency(checks, MAX_CONCURRENT_REQUESTS, async ({ galaxyId, target }) => {
            const result = await probeImageAvailability(
              getImageUrl(galaxyId, target.key),
              urlToken,
              abortControllerRef.current!.signal
            );

            if (result.status === "available") {
              batchDeltas[target.key].availableCount += 1;
            } else if (result.status === "missing") {
              batchDeltas[target.key].missingCount += 1;
              missingIdsByImage[target.key].push(galaxyId);
            } else {
              batchDeltas[target.key].errorCount += 1;
              if (!batchErrorSample && result.errorMessage) {
                batchErrorSample = result.errorMessage;
                setLiveErrorMessage(result.errorMessage);
              }
            }

            liveDeltasRef.current[target.key] = { ...batchDeltas[target.key] };
            liveCompletedChecksRef.current += 1;
            flushLiveSnapshot(runId);
          });
        }

        await appendImageAuditBatch({
          runId: runId as any,
          expectedPreviousCursor: batch.previousCursor ?? undefined,
          nextCursor: batch.nextCursor ?? undefined,
          isDone: batch.isDone,
          processedGalaxies: batch.candidates.length,
          lastProcessedGalaxyId: batch.candidates[batch.candidates.length - 1],
          imageStatsDelta: targets.map((target) => ({
            imageKey: target.key,
            availableCount: batchDeltas[target.key].availableCount,
            missingCount: batchDeltas[target.key].missingCount,
            errorCount: batchDeltas[target.key].errorCount,
          })),
          missingIdsByImage: targets
            .map((target) => ({
              imageKey: target.key,
              label: target.label,
              externalIds: missingIdsByImage[target.key],
            }))
            .filter((entry) => entry.externalIds.length > 0),
          lastErrorSample: batchErrorSample,
        });

        resetLiveSnapshot();

        if (batch.isDone) {
          toast.success("Image audit completed.");
          break;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message = error instanceof Error ? error.message : "Image audit failed.";
      setLiveErrorMessage(message);
      await setImageAuditRunStatus({
        runId: runId as any,
        status: "failed",
        lastError: message,
      });
      toast.error(message);
    } finally {
      abortControllerRef.current = null;
      activeRunIdRef.current = null;
      resetLiveSnapshot();
      pauseRequestedRef.current = false;
      setIsRunning(false);
      setIsPausing(false);
    }
  };

  const handleCreateRun = async () => {
    if (selectedTargets.length === 0) {
      toast.error("Select at least one image type to audit.");
      return;
    }
    if (selectedPapers.size === 0) {
      toast.error("Select at least one paper filter.");
      return;
    }

    try {
      setIsCreating(true);
      let executionConfig: AuditExecutionConfig;
      let tokenHashMaterial: string;
      let requestAuthMode: RequestAuthMode;
      let requestMethod: "head" | "get";

      if (auditMode === "url") {
        executionConfig = {
          mode: "url",
          urlToken: token,
        };
        tokenHashMaterial = buildUrlCredentialMaterial(providerBaseUrl, token);
        requestAuthMode = token.trim() ? "bearer" : "none";
        requestMethod = "head";
      } else {
        if (!currentR2Inputs.endpoint || !currentR2Inputs.bucket || !currentR2Inputs.accessKeyId || !currentR2Inputs.secretAccessKey) {
          toast.error("Endpoint, bucket, access key, and secret key are required for Class A and Class B checks.");
          return;
        }

        executionConfig = {
          mode: auditMode,
          r2: currentR2Inputs,
        };
        tokenHashMaterial = buildR2CredentialMaterial(auditMode, currentR2Inputs);
        requestAuthMode = "r2_keys";
        requestMethod = auditMode === "class_a" ? "get" : "head";
      }

      const tokenHash = await hashCredentialMaterial(tokenHashMaterial);
      const result = await createImageAuditRun({
        checkMode: auditMode,
        paperFilter:
          overview && selectedPapers.size === overview.availablePapers.length
            ? undefined
            : Array.from(selectedPapers),
        includeBlacklisted,
        batchSize,
        selectedImages: selectedTargets.map((target) => ({
          imageKey: target.key,
          label: target.label,
        })),
        tokenHash,
        requestMethod,
        requestAuthMode,
        provider: IMAGES_CONFIG.provider,
        imageBaseUrl: auditMode === "url" ? providerBaseUrl : currentR2Inputs.endpoint,
        r2Endpoint: auditMode === "url" ? undefined : currentR2Inputs.endpoint,
        r2Bucket: auditMode === "url" ? undefined : currentR2Inputs.bucket,
        r2Prefix: auditMode === "url" ? undefined : currentR2Inputs.prefix || undefined,
        r2Region: auditMode === "url" ? undefined : currentR2Inputs.region,
      });

      setSelectedRunId(result.runId);

      if (result.totalGalaxies === 0) {
        toast.info("No galaxies matched the selected filters. The run was saved as complete.");
        return;
      }

      await runAuditLoop(result.runId, selectedTargets, executionConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create image audit run.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePauseRun = async () => {
    const runId = activeRunIdRef.current;
    if (!runId) {
      return;
    }

    try {
      pauseRequestedRef.current = true;
      setIsPausing(true);
      await setImageAuditRunStatus({ runId: runId as any, status: "paused" });
      abortControllerRef.current?.abort();
      toast.message("Image audit paused.");
    } catch (error) {
      pauseRequestedRef.current = false;
      setIsPausing(false);
      const message = error instanceof Error ? error.message : "Failed to pause image audit.";
      toast.error(message);
    }
  };

  const handleResumeRun = async () => {
    if (!viewedRun || viewedRun.status === "completed") {
      return;
    }

    try {
      let executionConfig: AuditExecutionConfig;
      let tokenHashMaterial: string;

      if (viewedRun.checkMode === "url") {
        executionConfig = {
          mode: "url",
          urlToken: token,
        };
        tokenHashMaterial = buildUrlCredentialMaterial(viewedRun.imageBaseUrl, token);
      } else {
        const resumeR2Inputs = normalizeR2ClientInputs({
          endpoint: viewedRun.r2Endpoint ?? r2Endpoint,
          bucket: viewedRun.r2Bucket ?? r2Bucket,
          prefix: viewedRun.r2Prefix ?? r2Prefix,
          region: viewedRun.r2Region ?? r2Region,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        });

        if (!resumeR2Inputs.endpoint || !resumeR2Inputs.bucket || !resumeR2Inputs.accessKeyId || !resumeR2Inputs.secretAccessKey) {
          toast.error("Enter the same R2 endpoint, bucket, access key, and secret key used for the saved run.");
          return;
        }

        executionConfig = {
          mode: viewedRun.checkMode,
          r2: resumeR2Inputs,
        };
        tokenHashMaterial = buildR2CredentialMaterial(viewedRun.checkMode, resumeR2Inputs);
      }

      const tokenHash = await hashCredentialMaterial(tokenHashMaterial);
      if (tokenHash !== viewedRun.tokenHash) {
        toast.error("The provided client-side credentials do not match the saved hash for this run.");
        return;
      }

      await runAuditLoop(
        viewedRun._id,
        viewedRun.imageStats.map((stat) => ({
          key: stat.imageKey,
          label: stat.label,
          source: "contrast",
        })),
        executionConfig
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resume image audit run.";
      toast.error(message);
    }
  };

  const handleDownloadMissingIds = async (run: ImageAuditRun, stat: ImageAuditStat) => {
    try {
      setIsDownloadingKey(stat.imageKey);

      let cursor: string | undefined;
      const ids: string[] = [];

      while (true) {
        const page = await getImageAuditMissingIdsPage({
          runId: run._id as any,
          imageKey: stat.imageKey,
          cursor,
          limit: 250,
        });

        ids.push(...page.externalIds);
        if (page.isDone || !page.continueCursor) {
          break;
        }
        cursor = page.continueCursor;
      }

      const uniqueIds = Array.from(new Set(ids));
      const dateTag = new Date(run.startedAt).toISOString().slice(0, 10);
      const fileName = `image_audit_${dateTag}_${sanitizeFilenamePart(stat.imageKey)}_missing.txt`;

      downloadTextFile(uniqueIds.join("\n"), fileName);
      toast.success(`Downloaded ${uniqueIds.length} missing ID(s) for ${stat.label}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download missing IDs.";
      toast.error(message);
    } finally {
      setIsDownloadingKey(null);
    }
  };

  const handleDeleteRun = async (run: ImageAuditRun) => {
    const isRunActiveHere = activeRunIdRef.current === run._id;
    const isInterruptedRun = run.status === "running" && !isRunActiveHere;

    if (isRunActiveHere) {
      toast.error("Pause the run before deleting it.");
      return;
    }

    if (
      !window.confirm(
        isInterruptedRun
          ? `This run is still marked as running, but it is not active in this page and was likely interrupted. Force-delete the saved audit run from ${formatTimestamp(run.startedAt)} by ${run.creatorName}? This also deletes stored missing-ID chunks and cannot be undone.`
          : `Delete the saved audit run from ${formatTimestamp(run.startedAt)} by ${run.creatorName}? This also deletes stored missing-ID chunks and cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setIsDeletingRunId(run._id);
      const result = await deleteImageAuditRun({
        runId: run._id as any,
        forceRunning: isInterruptedRun || undefined,
      });

      if (!result.deleted) {
        toast.message("That audit run was already deleted.");
      } else {
        toast.success(
          result.deletedChunkCount > 0
            ? `Deleted audit run and ${result.deletedChunkCount.toLocaleString()} missing-ID chunk(s).`
            : "Deleted audit run."
        );
      }

      if (selectedRunId === run._id) {
        setSelectedRunId(null);
        setLiveErrorMessage(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image audit run.";
      toast.error(message);
    } finally {
      setIsDeletingRunId(null);
    }
  };

  if (!overview) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const liveDeltas = liveSnapshot && viewedRun && liveSnapshot.runId === viewedRun._id ? liveSnapshot.imageDeltas : undefined;
  const displayStats = viewedRun
    ? mergeImageStats(viewedRun.imageStats, liveDeltas).slice().sort((left, right) => {
        if (right.missingCount !== left.missingCount) {
          return right.missingCount - left.missingCount;
        }
        return left.label.localeCompare(right.label);
      })
    : [];
  const baseTotals = viewedRun ? sumImageChecks(viewedRun.imageStats) : { available: 0, missing: 0, error: 0 };
  const liveTotals = liveDeltas
    ? Object.values(liveDeltas).reduce(
        (totals, delta) => {
          totals.available += delta.availableCount;
          totals.missing += delta.missingCount;
          totals.error += delta.errorCount;
          return totals;
        },
        { available: 0, missing: 0, error: 0 }
      )
    : { available: 0, missing: 0, error: 0 };
  const totalChecks = viewedRun ? viewedRun.totalGalaxies * viewedRun.imageStats.length : 0;
  const completedChecks =
    baseTotals.available +
    baseTotals.missing +
    baseTotals.error +
    liveTotals.available +
    liveTotals.missing +
    liveTotals.error;
  const progressPercent = totalChecks > 0 ? Math.min(100, (completedChecks / totalChecks) * 100) : 0;
  const remainingGalaxies = viewedRun ? Math.max(viewedRun.totalGalaxies - viewedRun.processedGalaxies, 0) : 0;
  const isSelectedRunActive = viewedRun ? activeRunIdRef.current === viewedRun._id : false;
  const shouldShowUrlTokenInput =
    auditMode === "url" || (!!viewedRun && viewedRun.status !== "completed" && viewedRun.checkMode === "url");
  const shouldShowR2CredentialInputs =
    usesR2ApiMode || (!!viewedRun && viewedRun.status !== "completed" && viewedRun.checkMode !== "url");
  const calculatorGalaxyCount = Math.max(
    (overview.totalGalaxies ?? 0) - (includeBlacklisted ? 0 : overview.blacklistedCount),
    0
  );
  const estimatedClassARequests = calculatorGalaxyCount;
  const estimatedClassBRequests = calculatorGalaxyCount * selectedImageCount;
  const clampedUrlCacheHitRate = Math.max(0, Math.min(100, urlCacheHitRate));
  const estimatedUrlOriginRequests = Math.round(
    estimatedClassBRequests * ((100 - clampedUrlCacheHitRate) / 100)
  );
  const estimatedClassACost = estimateClassACost(calculatorGalaxyCount);
  const estimatedClassBCostValue = estimateClassBCost(calculatorGalaxyCount, selectedImageCount);
  const estimatedUrlCost = estimateUrlOriginCost(
    calculatorGalaxyCount,
    selectedImageCount,
    clampedUrlCacheHitRate
  );
  const displayedRunError =
    isSelectedRunActive && liveErrorMessage ? liveErrorMessage : viewedRun?.lastError;
  const isViewedRunInterrupted =
    !!viewedRun && viewedRun.status === "running" && activeRunIdRef.current !== viewedRun._id;
  const canDeleteViewedRun =
    !!viewedRun && activeRunIdRef.current !== viewedRun._id;
  const isDeletingViewedRun = viewedRun ? isDeletingRunId === viewedRun._id : false;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Image Availability Audit</h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
              Runs the audit entirely in the browser and lets you choose between direct R2 S3 checks
              and end-user URL checks. Convex stores only run metadata, counters, cursors, and missing
              external IDs for resume and downloads.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
            <div className="font-medium text-gray-900 dark:text-white">Selected audit mode</div>
            <div className="mt-1 text-gray-600 dark:text-gray-400">{buildAuditModeLabel(auditMode)}</div>
            <div className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
              {auditMode === "url"
                ? providerBaseUrl
                : currentR2Inputs.endpoint || "Enter an R2 endpoint below to enable S3 API checks."}
            </div>
          </div>
        </div>

        {auditMode === "url" && IMAGES_CONFIG.provider !== "r2" && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            URL mode uses the image URLs from the current frontend build. If those URLs do not point at the
            production storage path you want to verify, prefer Class A or Class B mode instead.
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <fieldset
              disabled={isRunning || isCreating}
              className="space-y-5 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
            <div>
              <div className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Audit mode</div>
              <div className="grid gap-3 md:grid-cols-3">
                {(["class_b", "class_a", "url"] as AuditMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuditMode(mode)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition",
                      auditMode === mode
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                    )}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {buildAuditModeLabel(mode)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {buildAuditModeSummary(mode)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {buildAuditModeSummary(auditMode)}
              </p>
            </div>

            {shouldShowUrlTokenInput && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                  URL auth token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-0 transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  placeholder="Optional Bearer token for authenticated URL checks"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  The raw token stays in the browser. Convex only stores a SHA-256 hash so unfinished URL-mode runs can be resumed safely.
                </p>
              </div>
            )}

            {shouldShowR2CredentialInputs && (
              <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">R2 S3 credentials</div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Required for Class A and Class B. The raw keys stay in the browser; Convex stores only a hash of the normalized connection details for resume verification.
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Browser-side R2 API checks also need bucket CORS for this app origin, the required GET and HEAD methods, and AWS SDK request headers. If the browser reports "Failed to fetch", check the bucket CORS policy first.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Endpoint
                    <input
                      type="text"
                      value={r2Endpoint}
                      onChange={(event) => setR2Endpoint(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder={viewedRun?.r2Endpoint || "https://<accountid>.r2.cloudflarestorage.com"}
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Bucket
                    <input
                      type="text"
                      value={r2Bucket}
                      onChange={(event) => setR2Bucket(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder={viewedRun?.r2Bucket || "bucket-name"}
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Prefix
                    <input
                      type="text"
                      value={r2Prefix}
                      onChange={(event) => setR2Prefix(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder={viewedRun?.r2Prefix || "Optional folder prefix"}
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Region
                    <input
                      type="text"
                      value={r2Region}
                      onChange={(event) => setR2Region(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder={viewedRun?.r2Region || DEFAULT_R2_REGION}
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Access key ID
                    <input
                      type="password"
                      value={r2AccessKeyId}
                      onChange={(event) => setR2AccessKeyId(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder="R2 access key ID"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Secret access key
                    <input
                      type="password"
                      value={r2SecretAccessKey}
                      onChange={(event) => setR2SecretAccessKey(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      placeholder="R2 secret access key"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Batch size
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={batchSize}
                  onChange={(event) => setBatchSize(Math.min(500, Math.max(1, Number(event.target.value) || DEFAULT_BATCH_SIZE)))}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  Blacklisted galaxies
                </div>
                <label className="flex items-center gap-3 py-2 text-sm text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={includeBlacklisted}
                    onChange={(event) => setIncludeBlacklisted(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include blacklisted galaxies</span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Paper filter</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Selected: {selectedPapers.size} / {overview.availablePapers.length}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPapers(new Set(overview.availablePapers))}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Check all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPapers(new Set())}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Uncheck all
                  </button>
                </div>
              </div>

              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
                {overview.availablePapers.map((paper) => (
                  <label
                    key={paper || "__empty__"}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPapers.has(paper)}
                      onChange={() => updatePaperSelection(paper)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{formatPaperLabel(paper)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Image types</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Selected: {selectedImageKeys.size} / {AUDIT_TARGETS.length}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedImageKeys(new Set(AUDIT_TARGETS.map((target) => target.key)))}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Check all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImageKeys(new Set())}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Uncheck all
                  </button>
                </div>
              </div>

              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
                {AUDIT_TARGETS.map((target) => (
                  <label
                    key={target.key}
                    className="flex min-w-0 items-start gap-3 rounded-md px-2 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedImageKeys.has(target.key)}
                      onChange={() => updateImageSelection(target.key)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="min-w-0 flex-1 select-text">
                      <span
                        className="block break-all font-medium"
                        title={target.label}
                      >
                        {target.label}
                      </span>
                      <span
                        className="block break-all text-xs text-gray-500 dark:text-gray-400"
                        title={target.key}
                      >
                        {target.key}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleCreateRun()}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreating || isRunning}
              >
                {isCreating ? "Preparing run..." : "Start new run"}
              </button>
              {isRunning && (
                <button
                  type="button"
                  onClick={() => void handlePauseRun()}
                  className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPausing}
                >
                  {isPausing ? "Pausing..." : "Pause current run"}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">All galaxies</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatNumber(overview.totalGalaxies)}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Blacklisted rows</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatNumber(overview.blacklistedCount)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
              <div className="font-medium text-gray-900 dark:text-white">Estimated request cost</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Class A</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(estimatedClassACost)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(estimatedClassARequests)} list requests
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Class B</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(estimatedClassBCostValue)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(estimatedClassBRequests)} head requests
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">URL mode</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(estimatedUrlCost)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(estimatedUrlOriginRequests)} estimated origin misses
                  </div>
                </div>
              </div>

              <label className="mt-4 block text-sm font-medium text-gray-900 dark:text-white">
                URL cache hit rate assumption
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={clampedUrlCacheHitRate}
                  onChange={(event) => setUrlCacheHitRate(Number(event.target.value))}
                  className="mt-3 w-full"
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{clampedUrlCacheHitRate}% cache hit rate</div>
              </label>

              <ul className="mt-3 space-y-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                <li>Class A uses roughly one ListObjectsV2 request per galaxy prefix, before pagination.</li>
                <li>Class B uses one HeadObject request per expected image.</li>
                <li>URL mode is only a rough origin-cost estimate. Cache hits may hide most R2 cost, while HEAD rejection or other edge behavior can make it higher.</li>
                <li>These estimates use {formatNumber(calculatorGalaxyCount)} galaxies and {formatNumber(selectedImageCount)} selected image types. Paper filters are not priced separately here.</li>
              </ul>
            </div>

            {viewedRun && !isRunning && viewedRun.status !== "completed" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {isViewedRunInterrupted
                    ? "This run is still marked running, but it is not active in this page. It was likely interrupted by a refresh or closed tab."
                    : `Selected run uses ${buildAuditModeLabel(viewedRun.checkMode)}.`}
                  {viewedRun.checkMode === "url"
                    ? " Provide the same URL token only if that run needed one."
                    : " Provide the same R2 endpoint, bucket, prefix, region, access key, and secret key to resume it."}
                </div>
                <button
                  type="button"
                  onClick={() => void handleResumeRun()}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {isViewedRunInterrupted ? "Resume interrupted run" : "Resume selected run"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(22rem,1fr)]">
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">Selected run</h4>
                {viewedRun ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <StatusBadge status={viewedRun.status} />
                    <span>{viewedRun.creatorName}</span>
                    <span>{formatTimestamp(viewedRun.startedAt)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select a run from the history panel.</p>
                )}
              </div>
              <div className="flex max-w-lg flex-col gap-3">
                {canDeleteViewedRun && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteRun(viewedRun)}
                    disabled={isDeletingViewedRun}
                    className="self-end rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {isDeletingViewedRun
                      ? "Deleting..."
                      : isViewedRunInterrupted
                        ? "Force delete run"
                        : "Delete run"}
                  </button>
                )}
                {viewedRun && displayedRunError && (
                  <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    <div className="font-medium">{viewedRun.status === "failed" ? "Run failed" : "Recent request issue"}</div>
                    <div className="mt-1">{displayedRunError}</div>
                  </div>
                )}
              </div>
            </div>

            {viewedRun ? (
              <div className="mt-6 space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      {formatNumber(completedChecks)} / {formatNumber(totalChecks)} image checks complete
                    </span>
                    <span>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-200",
                        viewedRun.status === "completed" ? "bg-green-500" : "bg-blue-500"
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {isSelectedRunActive && liveSnapshot && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Current batch: {formatNumber(liveSnapshot.batchCandidateCount)} galaxies, {formatNumber(liveSnapshot.completedChecks)} / {formatNumber(liveSnapshot.batchTotalChecks)} checks finished.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Galaxies</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                      {formatNumber(viewedRun.totalGalaxies)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Processed galaxies</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                      {formatNumber(viewedRun.processedGalaxies)}
                    </div>
                    {isSelectedRunActive && liveSnapshot && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        + current batch of {formatNumber(liveSnapshot.batchCandidateCount)}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Remaining galaxies</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                      {formatNumber(remainingGalaxies)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                    <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-300">Available</div>
                    <div className="mt-1 text-xl font-semibold text-green-700 dark:text-green-300">
                      {formatNumber(baseTotals.available + liveTotals.available)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/10">
                    <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Missing</div>
                    <div className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
                      {formatNumber(baseTotals.missing + liveTotals.missing)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
                    <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Errors</div>
                    <div className="mt-1 text-xl font-semibold text-red-700 dark:text-red-300">
                      {formatNumber(baseTotals.error + liveTotals.error)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Run configuration</div>
                    <dl className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between gap-4">
                        <dt>Audit mode</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{buildAuditModeLabel(viewedRun.checkMode)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Papers</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatPaperSummary(viewedRun.paperFilter)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Blacklisted galaxies</dt>
                        <dd className="text-right text-gray-900 dark:text-white">
                          {viewedRun.includeBlacklisted ? "Included" : "Excluded"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Batch size</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatNumber(viewedRun.batchSize)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Request auth</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{viewedRun.requestAuthMode}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Request method</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{viewedRun.requestMethod.toUpperCase()}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Provider</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{viewedRun.provider.toUpperCase()}</dd>
                      </div>
                      {viewedRun.checkMode !== "url" && (
                        <>
                          <div className="flex justify-between gap-4">
                            <dt>R2 bucket</dt>
                            <dd className="text-right break-all text-gray-900 dark:text-white">{viewedRun.r2Bucket || "-"}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>R2 prefix</dt>
                            <dd className="text-right break-all text-gray-900 dark:text-white">{viewedRun.r2Prefix || "-"}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>R2 region</dt>
                            <dd className="text-right text-gray-900 dark:text-white">{viewedRun.r2Region || "-"}</dd>
                          </div>
                        </>
                      )}
                    </dl>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Run metadata</div>
                    <dl className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between gap-4">
                        <dt>Started</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatTimestamp(viewedRun.startedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Updated</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatTimestamp(viewedRun.updatedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Completed</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatTimestamp(viewedRun.completedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Processed batches</dt>
                        <dd className="text-right text-gray-900 dark:text-white">{formatNumber(viewedRun.processedBatchCount)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt>Last galaxy</dt>
                        <dd className="text-right break-all text-gray-900 dark:text-white">{viewedRun.lastProcessedGalaxyId || "-"}</dd>
                      </div>
                      <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
                        {viewedRun.checkMode === "url" ? "Base URL" : "Endpoint"}: <span className="break-all">{viewedRun.imageBaseUrl}</span>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4 text-left font-medium text-gray-600 dark:text-gray-400">Image</th>
                        <th className="py-2 pr-4 text-right font-medium text-gray-600 dark:text-gray-400">Available</th>
                        <th className="py-2 pr-4 text-right font-medium text-gray-600 dark:text-gray-400">Missing</th>
                        <th className="py-2 pr-4 text-right font-medium text-gray-600 dark:text-gray-400">Errors</th>
                        <th className="py-2 text-right font-medium text-gray-600 dark:text-gray-400">Missing IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStats.map((stat) => (
                        <tr key={stat.imageKey} className="border-b border-gray-100 dark:border-gray-700/70">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-900 dark:text-white">{stat.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{stat.imageKey}</div>
                          </td>
                          <td className="py-3 pr-4 text-right font-medium text-green-700 dark:text-green-300">{formatNumber(stat.availableCount)}</td>
                          <td className="py-3 pr-4 text-right font-medium text-amber-700 dark:text-amber-300">{formatNumber(stat.missingCount)}</td>
                          <td className="py-3 pr-4 text-right font-medium text-red-700 dark:text-red-300">{formatNumber(stat.errorCount)}</td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDownloadMissingIds(viewedRun, stat)}
                              disabled={stat.missingCount === 0 || isDownloadingKey === stat.imageKey}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              {isDownloadingKey === stat.imageKey ? "Preparing..." : "Download .txt"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                No saved image audit run selected yet.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">Run history</h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review, resume, or delete previous audits.</p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{overview.recentRuns.length} runs</div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.recentRuns.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                No audit runs saved yet.
              </div>
            )}

            {overview.recentRuns.map((run) => {
              const runTotals = sumImageChecks(run.imageStats);
              const runCompletedChecks = runTotals.available + runTotals.missing + runTotals.error;
              const runTotalChecks = run.totalGalaxies * run.imageStats.length;
              const isSelected = selectedRunId === run._id;

              return (
                <button
                  key={run._id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedRunId(run._id)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50",
                    isRunning && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={run.status} />
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {run.creatorName}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(run.startedAt)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      <div>{formatNumber(run.processedGalaxies)} / {formatNumber(run.totalGalaxies)} galaxies</div>
                      <div>{formatNumber(runCompletedChecks)} / {formatNumber(runTotalChecks)} checks</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        run.status === "completed" ? "bg-green-500" : run.status === "failed" ? "bg-red-500" : "bg-blue-500"
                      )}
                      style={{ width: `${runTotalChecks > 0 ? Math.min(100, (runCompletedChecks / runTotalChecks) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Papers: {formatPaperSummary(run.paperFilter)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Mode: {buildAuditModeLabel(run.checkMode)}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}