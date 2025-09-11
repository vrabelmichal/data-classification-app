export type ImageName = string;

export type ImageQuality = "high" | "medium" | "low";

export interface GetImageUrlOptions {
  quality?: ImageQuality;
  query?: Record<string, unknown>;
}

export interface ImageProvider {
  getImageUrl(id: string, name: ImageName, opts?: GetImageUrlOptions): string;
}
