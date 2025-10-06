# Quick Start: Customizing Image Display Settings

## Overview

The application now supports runtime configuration for image display settings through an optional external JSON file. This allows you to customize image names, labels, and contrast groups **without rebuilding the application**.

## Quick Setup

### 1. Create the config file

```bash
# From the project root
mkdir -p static/config
cp static/config/images.json.example static/config/images.json
```

### 2. Edit the config

Edit `static/config/images.json` to customize:
- **Preview image name**: Used in browse views and thumbnails
- **Contrast groups**: Sets of images shown in the classification interface
- **Default group**: Which contrast group to show by default

### 3. Deploy

The config file will be automatically served from `/config/images.json` when you deploy your application.

## How It Works

1. **On app startup**: The application attempts to fetch `/config/images.json`
2. **If found**: External settings are merged with defaults
3. **If not found**: Built-in defaults are used (no errors)
4. **Partial configs**: You can override just the settings you need

## Example Config

```json
{
  "previewImageName": "my_custom_preview",
  "classification": {
    "defaultGroupIndex": 0,
    "contrastGroups": [
      [
        { "key": "image1", "label": "Image 1\n(details)" },
        { "key": "image2", "label": "Image 2\n(details)" }
      ]
    ]
  }
}
```

## Development

During development with `npm run dev`:
- Config is loaded from `static/config/images.json`
- Changes require a page refresh to take effect
- Check browser console for loading status

## Production Deployment

### Static Hosting (Vercel, Netlify, etc.)
Place `images.json` in your static/public folder - it will be served automatically.

### Custom Server
Configure your web server to serve the file at `/config/images.json`:

**Nginx:**
```nginx
location /config/images.json {
    alias /path/to/your/images-config.json;
    add_header Cache-Control "no-cache";
}
```

## Full Documentation

See [IMAGE_CONFIG.md](./docs/IMAGE_CONFIG.md) for:
- Complete configuration reference
- Deployment strategies
- Troubleshooting guide
- Advanced usage examples

## Development Notes

- Config is fetched with `cache: "no-cache"` to ensure updates are picked up
- The loading is asynchronous and non-blocking
- Existing components work unchanged - they get defaults immediately and will update when config loads
- For admin panels or special cases, async versions are available: `loadImageDisplaySettingsAsync()`, `reloadImageDisplaySettings()`
