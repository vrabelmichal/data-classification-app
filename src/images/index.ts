import { loadImagesConfig } from "./config";
import { LocalImageProvider } from "./localProvider";
import { R2ImageProvider } from "./r2Provider";
import type { ImageProvider, ImageName, GetImageUrlOptions, ImageQuality } from "./provider";
import { loadImageDisplaySettings } from "./displaySettings";

let provider: ImageProvider | null = null;

function resolveFinalImageOptions(
  name: ImageName,
  opts?: GetImageUrlOptions
): GetImageUrlOptions {
  const settings = loadImageDisplaySettings();
  let forcedQuality: ImageQuality | undefined;

  // Guard against undefined classification or contrastGroups
  const contrastGroups = settings.classification?.contrastGroups;
  if (!contrastGroups || contrastGroups.length === 0) {
    const finalOpts = { ...opts };
    return finalOpts;
  }

  for (const group of contrastGroups) {
    const entry = group.find((e) => e.key === name || e.key_masked === name);
    if (entry?.forcedQuality) {
      forcedQuality = entry.forcedQuality;
      break;
    }
  }

  const finalOpts = { ...opts };
  if (forcedQuality) {
    finalOpts.quality = forcedQuality;
  }

  return finalOpts;
}

function init(): ImageProvider {
  const cfg = loadImagesConfig();
  if (cfg.provider === "local") return new LocalImageProvider(cfg);
  else return new R2ImageProvider(cfg);
}

function ensureProvider(): ImageProvider {
  if (!provider) provider = init();
  return provider;
}

export function getImageUrl(
  id: string,
  name: ImageName,
  opts?: GetImageUrlOptions
): string {
  const finalOpts = resolveFinalImageOptions(name, opts);

  return ensureProvider().getImageUrl(id, name, finalOpts);
}

export function getImageObjectKey(
  id: string,
  name: ImageName,
  opts?: GetImageUrlOptions
): string {
  const cfg = loadImagesConfig();
  const finalOpts = resolveFinalImageOptions(name, opts);

  if (cfg.provider === "r2") {
    return new R2ImageProvider(cfg).getObjectKey(id, name, finalOpts.quality);
  }

  const baseName = name.replace(/\.[^/.]+$/, "");
  const ext = finalOpts.quality === "low" ? "avif" : "png";
  return `${id}/${baseName}.${ext}`;
}

// Re-export types for convenience
export type { ImageProvider, ImageName, GetImageUrlOptions, ImageQuality } from "./provider";
export type { ImagesConfig } from "./config";
export { getAssetUrl, getKidsExampleImageUrl } from "./assetUrl";
