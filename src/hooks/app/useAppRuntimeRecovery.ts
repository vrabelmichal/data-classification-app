import { useCallback, useEffect, useState } from "react";
import type { RuntimeIssue } from "../../components/app/AppBanners";

const LOADING_RECOVERY_DELAY_MS = 15000;
const STALLED_REQUEST_DELAY_MS = 30000;

interface ConnectionStateLike {
  hasInflightRequests: boolean;
  timeOfOldestInflightRequest: Date | null;
}

interface UseAppRuntimeRecoveryOptions {
  appVersion: unknown;
  authIsLoading: boolean;
  isAuthenticated: boolean;
  isUserProfileLoading: boolean;
  connectionState: ConnectionStateLike;
}

const STALLED_REQUEST_ISSUE: RuntimeIssue = {
  kind: "stalled-request",
  title: "A backend request is taking unusually long",
  message:
    "If this tab was left open for a long time or the network changed, refresh the app to re-establish a clean session.",
};

const NETWORK_RUNTIME_ISSUE: RuntimeIssue = {
  kind: "network",
  title: "The connection to the backend failed",
  message:
    "A request could not reach Convex. This usually happens after the tab has been open for a long time or the network path changed. Refresh the app to recover.",
};

function getRuntimeErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? getRuntimeErrorMessage(error.cause) : "";

  return [name, message, cause].filter(Boolean).join(" ");
}

function isRecoverableNetworkError(error: unknown): boolean {
  const message = getRuntimeErrorMessage(error);

  if (!message) {
    return false;
  }

  return [
    /Failed to fetch/i,
    /NetworkError/i,
    /Load failed/i,
    /ERR_QUIC_PROTOCOL_ERROR/i,
    /ERR_ECH_FALLBACK_CERTIFICATE_INVALID/i,
    /ERR_CONNECTION_REFUSED/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ERR_CONNECTION_TIMED_OUT/i,
    /fetch.*failed/i,
  ].some((pattern) => pattern.test(message));
}

export function useAppRuntimeRecovery({
  appVersion,
  authIsLoading,
  isAuthenticated,
  isUserProfileLoading,
  connectionState,
}: UseAppRuntimeRecoveryOptions) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showVersionUpdate, setShowVersionUpdate] = useState(false);
  const [runtimeIssue, setRuntimeIssue] = useState<RuntimeIssue | null>(null);
  const [showLoadingRecovery, setShowLoadingRecovery] = useState(false);

  const reportRuntimeIssue = useCallback((issue: RuntimeIssue) => {
    setRuntimeIssue((current) => {
      if (current?.kind === issue.kind && current.message === issue.message) {
        return current;
      }

      return issue;
    });
  }, []);

  const dismissRuntimeIssue = useCallback(() => {
    setRuntimeIssue(null);
  }, []);

  const dismissVersionUpdate = useCallback(() => {
    setShowVersionUpdate(false);
    setCurrentVersion(appVersion !== undefined && appVersion !== null ? String(appVersion) : null);
  }, [appVersion]);

  useEffect(() => {
    if (appVersion === undefined || appVersion === null) {
      return;
    }

    const serverVersion = String(appVersion);
    if (currentVersion === null) {
      setCurrentVersion(serverVersion);
      return;
    }

    if (currentVersion !== serverVersion) {
      setShowVersionUpdate(true);
    }
  }, [appVersion, currentVersion]);

  useEffect(() => {
    const isAuthOrProfileLoading = authIsLoading || (isAuthenticated && isUserProfileLoading);

    if (!isAuthOrProfileLoading) {
      setShowLoadingRecovery(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowLoadingRecovery(true);
    }, LOADING_RECOVERY_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [authIsLoading, isAuthenticated, isUserProfileLoading]);

  useEffect(() => {
    if (!connectionState.hasInflightRequests || connectionState.timeOfOldestInflightRequest === null) {
      setRuntimeIssue((current) => (current?.kind === "stalled-request" ? null : current));
      return;
    }

    const requestAgeMs = Date.now() - connectionState.timeOfOldestInflightRequest.getTime();
    const delayMs = Math.max(0, STALLED_REQUEST_DELAY_MS - requestAgeMs);
    const timeout = window.setTimeout(() => {
      reportRuntimeIssue(STALLED_REQUEST_ISSUE);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [connectionState.hasInflightRequests, connectionState.timeOfOldestInflightRequest, reportRuntimeIssue]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isRecoverableNetworkError(event.reason)) {
        return;
      }

      reportRuntimeIssue(NETWORK_RUNTIME_ISSUE);
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isRecoverableNetworkError(event.error ?? event.message)) {
        return;
      }

      reportRuntimeIssue(NETWORK_RUNTIME_ISSUE);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, [reportRuntimeIssue]);

  return {
    dismissRuntimeIssue,
    dismissVersionUpdate,
    runtimeIssue,
    showLoadingRecovery,
    showVersionUpdate,
  };
}