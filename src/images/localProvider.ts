import type { ImageProvider, ImageName, GetImageUrlOptions } from "./provider";
import type { ImagesConfig } from "./config";

export class LocalImageProvider implements ImageProvider {
  constructor(private cfg: Extract<ImagesConfig, { provider: "local" }>) {}

  getImageUrl(id: string, name: ImageName, opts?: GetImageUrlOptions): string {
    const base = this.cfg.localServerBase.replace(/\/+$/, "");
    const qp = opts?.query ? toQueryString(opts.query) : "";
    
    let ext = "png";
    if (opts?.quality === "low") ext = "avif";
    else if (opts?.quality === "medium") ext = "webp";

    const imageNameWithExt = `${name}.${ext}`;
    return `${base}/${encodeURIComponent(id)}/${encodeURIComponent(imageNameWithExt)}`;
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
