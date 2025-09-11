import type { ImageProvider, ImageName, GetImageUrlOptions } from "./provider";
import type { ImagesConfig } from "./config";

export class R2ImageProvider implements ImageProvider {
  constructor(private cfg: Extract<ImagesConfig, { provider: "r2" }>) {}

  getImageUrl(id: string, name: ImageName, opts?: GetImageUrlOptions): string {
    const base = this.cfg.r2PublicBase.replace(/\/+$/, "");
    
    // For R2, we can use different paths based on quality
    const qualityPath = opts?.quality && opts.quality !== "medium" ? `/${opts.quality}` : "";
    const qp = opts?.query ? toQueryString(opts.query) : "";
    const queryString = qp ? `?${qp}` : "";
    
    return `${base}/images${qualityPath}/${encodeURIComponent(id)}/${encodeURIComponent(name)}${queryString}`;
  }

  getObjectKey(id: string, name: ImageName, quality?: string): string {
    const qualityPath = quality && quality !== "medium" ? `/${quality}` : "";
    return `images${qualityPath}/${id}/${name}`;
  }
}

function toQueryString(q: Record<string, unknown>): string {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  return p.toString();
}
