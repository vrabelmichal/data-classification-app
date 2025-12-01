export type ImagesConfig =
  | {
      provider: "local";
      localDataDir: string;
      localServerBase: string;
    }
  | {
      provider: "r2";
      r2PublicBase: string;
      bucket: string;
    };

export function loadImagesConfig(): ImagesConfig {
  const mode = import.meta.env.VITE_IMAGE_PROVIDER_MODE || "local"; // default to 'local'
  
  // For Vite, we'll need to load these differently since we can't use fs in the browser
  // We'll define the configs directly here based on the mode
  if (mode === "r2") {
    return {
      provider: "r2",
      r2PublicBase: import.meta.env.VITE_R2_PUBLIC_BASE || "https://cdn.example.com",
      bucket: import.meta.env.VITE_R2_BUCKET || "galaxies-images",
    };
  } else {
    return {
      provider: "local",
      localDataDir: import.meta.env.VITE_LOCAL_DATA_DIR || "./.data",
      localServerBase: import.meta.env.VITE_LOCAL_SERVER_BASE || "http://localhost:5178",
    };
  }
}
