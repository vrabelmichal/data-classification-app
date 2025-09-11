import { loadImagesConfig } from "./config";
import { LocalImageProvider } from "./localProvider";
import { R2ImageProvider } from "./r2Provider";
import type { ImageProvider, ImageName, GetImageUrlOptions } from "./provider";

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
  return ensureProvider().getImageUrl(id, name, opts);
}

// Re-export types for convenience
export type { ImageProvider, ImageName, GetImageUrlOptions, ImageQuality } from "./provider";
export type { ImagesConfig } from "./config";
