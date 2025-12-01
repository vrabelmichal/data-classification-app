import type { ImageProvider, ImageName, GetImageUrlOptions } from "./provider";
import type { ImagesConfig } from "./config";

export class R2ImageProvider implements ImageProvider {
  constructor(private cfg: Extract<ImagesConfig, { provider: "r2" }>) {}

  getImageUrl(id: string, name: ImageName, opts?: GetImageUrlOptions): string {
    const base = this.cfg.r2PublicBase.replace(/\/+$/, "");
    // For the new, simplified R2 public URL format we expose url as:
    // <r2PublicBase>/<objectId>/<imageName>.<ext>
    // Quality selects the file extension:
    // - medium, high => png
    // - low => avif
    const ext = (opts?.quality === "low") ? "avif" : "png";
    // If the provided name already has an extension, strip it before adding our own
    const baseName = name.replace(/\.[^/.]+$/, "");
    const imageNameWithExt = `${baseName}.${ext}`;
    // We don't use query args for R2 public URLs at the moment
    return `${base}/${encodeURIComponent(id)}/${encodeURIComponent(imageNameWithExt)}`;
  }

  getObjectKey(id: string, name: ImageName, quality?: string): string {
    // Construct key used *inside* the bucket: {id}/{name}.{ext}
    const ext = (quality === "low") ? "avif" : "png";
    const baseName = name.replace(/\.[^/.]+$/, "");
    const imageNameWithExt = `${baseName}.${ext}`;
    return `${id}/${imageNameWithExt}`;
  }
}
// No query-string handling for R2 public URLs at this time.
