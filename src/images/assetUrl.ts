import { loadImagesConfig } from "./config";

/**
 * Build a public R2 URL for an asset stored under a specific path prefix.
 * 
 * This is separate from the main image provider which handles galaxy images
 * with specific naming conventions. This helper is for generic assets like
 * example images, documentation, etc.
 * 
 * @param path - The full path to the asset within the R2 bucket (e.g., "examples/kids/01_image.png")
 * @returns The full public URL to the asset, or a fallback URL if using local mode
 */
export function getAssetUrl(path: string): string {
  const config = loadImagesConfig();
  
  if (config.provider === "r2") {
    const base = config.r2PublicBase.replace(/\/+$/, "");
    return `${base}/${path}`;
  } else {
    // For local mode, serve directly via the local server
    // The path is already in the format (e.g., "examples/kids/image.png")
    return `${config.localServerBase}/${path}`;
  }
}

/**
 * Build a public R2 URL for a KiDS example image.
 * 
 * @param filename - The filename of the example image (e.g., "01_not-sure_examples.png")
 * @returns The full public URL to the example image
 */
export function getKidsExampleImageUrl(filename: string): string {
  // The domain prefix is part of the r2PublicBase in the config
  // So we just need to add the examples/kids/ path
  return getAssetUrl(`examples/kids/${filename}`);
}
