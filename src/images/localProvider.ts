import type { ImageProvider, ImageName, GetImageUrlOptions } from "./provider";
import type { ImagesConfig } from "./config";

export class LocalImageProvider implements ImageProvider {
  constructor(private cfg: Extract<ImagesConfig, { provider: "local" }>) {}

  getImageUrl(id: string, name: ImageName, opts?: GetImageUrlOptions): string {
    const base = this.cfg.localServerBase.replace(/\/+$/, "");
    const qp = opts?.query ? toQueryString(opts.query) : "";
    
    // Add quality parameter if provided
    const qualityParam = opts?.quality ? `quality=${opts.quality}` : "";
    const fullQuery = [qp, qualityParam].filter(Boolean).join("&");
    const queryString = fullQuery ? `?${fullQuery}` : "";
    
    return `${base}/${encodeURIComponent(id)}/${encodeURIComponent(name)}${queryString}`;
  }

  getAbsolutePath(id: string, name: ImageName): string {
    return `${this.cfg.localDataDir}/${id}/${name}`;
  }
}

function toQueryString(q: Record<string, unknown>): string {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined) p.set(k, String(v));
  });
  return p.toString();
}
