# Image Display Configuration

The application supports loading image display settings from an external configuration file. This allows you to customize image names, labels, and contrast groups without rebuilding the application.

## Configuration File Location

The application will attempt to load the configuration from:
```
/config/images.json
```

This path is relative to your application's public/static folder.

## File Structure

The configuration file should be a JSON file with the following structure:

```json
{
  "previewImageName": "aplpy_arcsinh_p001_100_vmid02_based_on_100426834_unmasked",
  "classification": {
    "defaultGroupIndex": 0,
    "contrastGroups": [
      [
        { "key": "g_zscale_masked", "label": "Masked g-Band\n(zscale)" },
        { "key": "residual_zscale", "label": "Residual\n(zscale)" }
      ]
    ]
  }
}
```

### Fields

- **`previewImageName`** (string, optional): The default image name used for preview thumbnails in browse views and skipped galaxies list.

- **`classification`** (object, optional): Settings for the classification interface
  - **`defaultGroupIndex`** (number, optional): The index of the contrast group to show by default (0-based)
  - **`contrastGroups`** (array, optional): Array of contrast group arrays. Each contrast group contains multiple image configurations shown simultaneously in the classification view.
    - Each entry has:
      - **`key`** (string): The internal image identifier used to construct the image URL
      - **`label`** (string): Display label shown to users. Use `\n` for line breaks.

## Deployment Options

### Option 1: Static Folder (Recommended for Production)

1. Create the config directory in your static/public folder:
   ```bash
   mkdir -p static/config
   ```

2. Copy the example and customize it:
   ```bash
   cp static/config/images.json.example static/config/images.json
   # Edit static/config/images.json with your settings
   ```

3. Deploy as normal - the config file will be served alongside other static assets.

### Option 2: Runtime Server Configuration

If your hosting environment provides a way to serve additional static files or you're using a reverse proxy, you can configure it to serve the config file:

**Nginx example:**
```nginx
location /config/images.json {
    alias /path/to/your/images-config.json;
    add_header Cache-Control "no-cache";
}
```

**Apache example:**
```apache
Alias /config/images.json /path/to/your/images-config.json
<Location /config/images.json>
    Header set Cache-Control "no-cache"
</Location>
```

### Option 3: No External Config (Use Defaults)

If no external config file is provided, the application will use the built-in default configuration defined in the code. This is perfectly fine for development and testing.

## Behavior

- **Graceful Fallback**: If the config file is not found or fails to load, the application will use default settings without breaking.
- **Partial Configuration**: You can provide only the fields you want to override. Missing fields will use default values.
- **Console Logging**: Check the browser console for messages about config loading status.
- **No Cache**: Config is fetched with `cache: "no-cache"` to ensure updates are picked up on reload.

## Development

During development, you can test the external config by:

1. Creating `static/config/images.json`
2. Running the dev server: `npm run dev`
3. The Vite dev server will serve files from the `static` folder at the root path

## Programmatic Access

For advanced use cases (like admin panels), the config system provides:

```typescript
// Async version - waits for external config to load
const settings = await loadImageDisplaySettingsAsync();

// Force reload from server
const settings = await reloadImageDisplaySettings();

// Synchronous access (may return defaults if async load incomplete)
const settings = loadImageDisplaySettings();
```

## Example Configurations

### Minimal Override (Preview Image Only)
```json
{
  "previewImageName": "my_custom_preview_image"
}
```

### Custom Contrast Groups
```json
{
  "classification": {
    "defaultGroupIndex": 1,
    "contrastGroups": [
      [
        { "key": "image1", "label": "Image 1" },
        { "key": "image2", "label": "Image 2" }
      ],
      [
        { "key": "image3", "label": "Image 3" },
        { "key": "image4", "label": "Image 4" }
      ]
    ]
  }
}
```

## Troubleshooting

### Config not loading?
1. Check browser console for error messages
2. Verify file is accessible at `https://yourdomain.com/config/images.json`
3. Ensure valid JSON syntax (use a JSON validator)
4. Check server permissions and CORS settings if applicable

### Changes not appearing?
1. Hard refresh your browser (Ctrl+F5 / Cmd+Shift+R)
2. Check if caching is being enforced by your CDN or reverse proxy
3. Verify the file was updated on the server
