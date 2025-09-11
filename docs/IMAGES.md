# Galaxy Image Provider System

This project includes a flexible image provider system that can work with both local development and production cloud storage (like Cloudflare R2).

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# For local development (default)
VITE_IMAGE_PROVIDER_MODE=local
VITE_LOCAL_DATA_DIR=./.data
VITE_LOCAL_SERVER_BASE=http://localhost:5178

# For production with Cloudflare R2
# VITE_IMAGE_PROVIDER_MODE=r2
# VITE_R2_PUBLIC_BASE=https://your-cdn-domain.com
# VITE_R2_BUCKET=galaxy-images
```

## Local Development

### 1. Set up image data directory

Create a `.data` directory in your project root and organize images:

```
.data/
  galaxy123/
    masked_g_band.fits
    galfit_model.fits
    residual.fits
    masked_aplpy.png
    aplpy.png
    zoomed_out.png
  galaxy456/
    masked_g_band.fits
    ...
```

### 2. Start the local image server

```bash
# Start everything (frontend, backend, and image server)
npm run dev:all

# Or start just the image server
npm run dev:images
```

The image server will run on `http://localhost:5178` by default.

### 3. Image URLs

Images will be served at:
- `http://localhost:5178/{galaxyId}/{imageName}`
- `http://localhost:5178/{galaxyId}/{imageName}?quality=high`

## Production with Cloudflare R2

### 1. Set up R2 bucket

1. Create a bucket in Cloudflare R2
2. Upload images with the following structure:
   ```
   images/
     galaxy123/
       masked_g_band.fits
       galfit_model.fits
       ...
   images/high/
     galaxy123/
       masked_g_band.fits
       ...
   images/low/
     galaxy123/
       masked_g_band.fits
       ...
   ```

### 2. Configure public access

Set up a custom domain or use R2's public URL access.

### 3. Update environment

```bash
VITE_IMAGE_PROVIDER_MODE=r2
VITE_R2_PUBLIC_BASE=https://your-cdn-domain.com
VITE_R2_BUCKET=galaxy-images
```

## Usage in Components

### Using the hook

```tsx
import { useGalaxyImages } from "../hooks/useGalaxyImages";

function MyComponent() {
  const imageNames = ["masked_g_band.fits", "galfit_model.fits"];
  const { imageUrls, isLoading, quality } = useGalaxyImages(
    "galaxy123",
    imageNames,
    "high" // optional quality override
  );

  if (isLoading) return <div>Loading images...</div>;

  return (
    <div>
      {imageUrls?.map((url, index) => (
        <img key={index} src={url} alt={imageNames[index]} />
      ))}
    </div>
  );
}
```

### Direct API usage

```tsx
import { getImageUrl } from "../images";

const url = getImageUrl("galaxy123", "masked_g_band.fits", {
  quality: "high"
});
```

## Image Quality Settings

The system supports three quality levels:
- `high`: Best quality, larger file size
- `medium`: Default quality (used when not specified)
- `low`: Compressed quality, smaller file size

Quality is automatically selected based on user preferences stored in their profile, but can be overridden per request.

## Architecture

- **Frontend**: Image provider classes handle URL generation
- **Backend**: Convex functions resolve user preferences and image metadata
- **Development**: Express server serves local files
- **Production**: Direct CDN/R2 access for optimal performance

## File Structure

```
src/
  images/
    provider.ts         # Base interfaces
    config.ts          # Configuration loading
    localProvider.ts   # Local development provider
    r2Provider.ts      # Cloudflare R2 provider  
    index.ts           # Main entry point
  hooks/
    useGalaxyImages.ts # React hook for components
convex/
  images.ts            # Backend image resolution
scripts/
  local-image-server.mjs # Development image server
```
