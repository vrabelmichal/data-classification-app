import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

const CLOUDFLARE_PURGE_BATCH_SIZE = 30;

type CloudflarePurgeErrorPayload = {
  message: string;
  details?: unknown;
};

type CloudflarePurgeResponse = {
  success?: boolean;
  errors?: Array<CloudflarePurgeErrorPayload | string>;
  messages?: string[];
  result?: unknown;
};

type CloudflareAdminSettings = {
  cloudflareCachePurgeEnabled: boolean;
  cloudflareZoneId?: string;
  cloudflareApiToken?: string;
};

type AdminPurgeStatus = {
  enabled: boolean;
  hasCredentials: boolean;
  available: boolean;
  missingCredentials: string[];
};

function getCloudflareCredentials(settings: {
  cloudflareZoneId?: string;
  cloudflareApiToken?: string;
}) {
  const zoneId = (settings.cloudflareZoneId ?? "").trim();
  const apiToken = (settings.cloudflareApiToken ?? "").trim();

  return {
    zoneId,
    apiToken,
    hasCredentials: zoneId.length > 0 && apiToken.length > 0,
  };
}

function normalizeUrls(urls: string[]) {
  const normalized = new Set<string>();

  for (const candidate of urls) {
    const value = candidate.trim();
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      normalized.add(parsed.toString());
    } catch {
      continue;
    }
  }

  return Array.from(normalized);
}

function chunkUrls(urls: string[], size: number) {
  const batches: string[][] = [];

  for (let index = 0; index < urls.length; index += size) {
    batches.push(urls.slice(index, index + size));
  }

  return batches;
}

function formatCloudflareErrors(errors: CloudflarePurgeResponse["errors"]) {
  if (!errors || errors.length === 0) {
    return ["Unknown Cloudflare error"];
  }

  return errors.map((error) => {
    if (typeof error === "string") {
      return error;
    }

    if (typeof error?.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }

    return JSON.stringify(error);
  });
}

async function assertAdmin(ctx: Parameters<typeof action>[0] extends never ? never : any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const profile = await ctx.runQuery(api.users.getUserProfile);
  if (!profile || profile.role !== "admin") {
    throw new Error("Admin access required");
  }

  return profile;
}

export const getAdminPurgeStatus = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    hasCredentials: v.boolean(),
    available: v.boolean(),
    missingCredentials: v.array(v.string()),
  }),
  handler: async (ctx): Promise<AdminPurgeStatus> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.runQuery(api.users.getUserProfile);
    const canViewStatus = Boolean(
      profile?.permissions?.manageSettings || profile?.permissions?.manageSystem
    );
    if (!canViewStatus) {
      throw new Error("Settings access required");
    }

    const settings: CloudflareAdminSettings = await ctx.runQuery(
      internal.system_settings.loadMergedSystemSettingsInternal,
      {},
    );
    const credentials = getCloudflareCredentials(settings);
    const missingCredentials: string[] = [];

    if (!credentials.zoneId) {
      missingCredentials.push("CLOUDFLARE_ZONE_ID");
    }
    if (!credentials.apiToken) {
      missingCredentials.push("CLOUDFLARE_API_TOKEN");
    }

    return {
      enabled: settings.cloudflareCachePurgeEnabled,
      hasCredentials: credentials.hasCredentials,
      available: settings.cloudflareCachePurgeEnabled && credentials.hasCredentials,
      missingCredentials,
    };
  },
});

export const purgeImageUrls = action({
  args: {
    urls: v.array(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    requestedCount: v.number(),
    uniqueUrlCount: v.number(),
    submittedCount: v.number(),
    failedCount: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);

    const settings = await ctx.runQuery(
      internal.system_settings.loadMergedSystemSettingsInternal,
      {},
    );
    if (!settings.cloudflareCachePurgeEnabled) {
      throw new Error("Cloudflare cache invalidation is disabled in admin settings");
    }

    const credentials = getCloudflareCredentials(settings);
    if (!credentials.hasCredentials) {
      throw new Error("Cloudflare cache invalidation credentials are not configured");
    }

    const urls = normalizeUrls(args.urls);
    if (urls.length === 0) {
      throw new Error("No valid image URLs were provided for cache invalidation");
    }

    const batches = chunkUrls(urls, CLOUDFLARE_PURGE_BATCH_SIZE);
    const errors: string[] = [];
    let submittedCount = 0;

    for (const batch of batches) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${credentials.zoneId}/purge_cache`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ files: batch }),
        }
      );

      let payload: CloudflarePurgeResponse | null = null;
      try {
        payload = (await response.json()) as CloudflarePurgeResponse;
      } catch {
        payload = null;
      }

      if (response.ok && payload?.success) {
        submittedCount += batch.length;
        continue;
      }

      const batchErrors = formatCloudflareErrors(payload?.errors);
      errors.push(...batchErrors);
    }

    return {
      success: errors.length === 0,
      requestedCount: args.urls.length,
      uniqueUrlCount: urls.length,
      submittedCount,
      failedCount: urls.length - submittedCount,
      errors,
    };
  },
});