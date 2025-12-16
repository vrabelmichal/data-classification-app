import { loadImagesConfig } from "./config";
import { LocalImageProvider } from "./localProvider";
import { R2ImageProvider } from "./r2Provider";
import type { ImageProvider, ImageName, GetImageUrlOptions, ImageQuality } from "./provider";
import { loadImageDisplaySettings } from "./displaySettings";

let provider: ImageProvider | null = null;

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
  const settings = loadImageDisplaySettings();
  let forcedQuality: ImageQuality | undefined;

  // Check if any group has this image with a forced quality
  for (const group of settings.classification.contrastGroups) {
    const entry = group.find((e) => e.key === name);
    if (entry?.forcedQuality) {
      forcedQuality = entry.forcedQuality;
      break;
    }
  }

  const finalOpts = { ...opts };
  if (forcedQuality) {
    finalOpts.quality = forcedQuality;
  }

  return ensureProvider().getImageUrl(id, name, finalOpts);
}

// Re-export types for convenience
export type { ImageProvider, ImageName, GetImageUrlOptions, ImageQuality } from "./provider";
export type { ImagesConfig } from "./config";
export { getAssetUrl, getKidsExampleImageUrl } from "./assetUrl";
