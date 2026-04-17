import { toPng } from "html-to-image";
import {
  downloadTextFile,
  formatDateForFilename,
  sanitizeFilenameSegment,
} from "../../../lib/csv";

export const APP_GUIDE_EXPORT_EXCLUDE_ATTR = "data-app-guide-export-exclude";
export const APP_GUIDE_STATIC_PREVIEW_ATTR = "data-app-guide-static-preview";

type PreviewCaptureRequest = {
  key: string;
  alt: string;
  node: HTMLElement;
};

type ExportApplicationGuideOptions = {
  appName: string;
  articleNode: HTMLElement;
  previewCaptures: PreviewCaptureRequest[];
};

type ExportImageWarning = {
  url: string;
  reason: string;
};

type ExportApplicationGuideResult = {
  warnings: ExportImageWarning[];
};

type InlineImageResult = {
  dataUrl: string;
  warning?: ExportImageWarning;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to convert blob into a data URL."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read blob for export."));
    };

    reader.readAsDataURL(blob);
  });
}

function createPlaceholderImageDataUrl({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960" role="img" aria-label="${escapeHtml(label)}">
      <rect width="960" height="960" fill="#f3f4f6" />
      <rect x="40" y="40" width="880" height="880" rx="36" fill="#e5e7eb" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="14 12" />
      <g fill="#475569" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">
        <text x="480" y="442" font-size="42" font-weight="700">${escapeHtml(label)}</text>
        <text x="480" y="500" font-size="26">${escapeHtml(detail)}</text>
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const handleDone = () => {
            image.removeEventListener("load", handleDone);
            image.removeEventListener("error", handleDone);
            resolve();
          };

          image.addEventListener("load", handleDone, { once: true });
          image.addEventListener("error", handleDone, { once: true });
        })
    )
  );
}

async function fetchDataUrl(
  url: string,
  cache: Map<string, Promise<InlineImageResult>>
) {
  if (url.startsWith("data:")) {
    return { dataUrl: url } satisfies InlineImageResult;
  }

  const cached = cache.get(url);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        dataUrl: await blobToDataUrl(await response.blob()),
      } satisfies InlineImageResult;
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : "Image could not be fetched from the browser.";

      return {
        dataUrl: createPlaceholderImageDataUrl({
          label: "Image unavailable",
          detail: "The export could not access this image.",
        }),
        warning: {
          url,
          reason,
        },
      } satisfies InlineImageResult;
    }
  })();

  cache.set(url, pending);
  return pending;
}

async function inlineImages(
  root: ParentNode,
  cache: Map<string, Promise<InlineImageResult>>,
  warningMap: Map<string, ExportImageWarning>
) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (image) => {
      const source = image.currentSrc || image.getAttribute("src") || image.src;
      if (!source) {
        return;
      }

      const result = await fetchDataUrl(source, cache);
      image.setAttribute("src", result.dataUrl);
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.setAttribute("loading", "eager");

      if (result.warning) {
        warningMap.set(result.warning.url, result.warning);
        image.setAttribute(
          "alt",
          image.alt
            ? `${image.alt} (image unavailable in export)`
            : "Image unavailable in export"
        );
      }
    })
  );
}

function collectStylesheets() {
  let css = "";

  for (const stylesheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(stylesheet.cssRules)) {
        css += `${rule.cssText}\n`;
      }
    } catch {
      continue;
    }
  }

  return css;
}

function buildReplacementImage(
  documentRef: Document,
  preview: { alt: string; dataUrl: string; width: number; height: number }
) {
  const figure = documentRef.createElement("figure");
  figure.style.margin = "0";

  const image = documentRef.createElement("img");
  image.src = preview.dataUrl;
  image.alt = preview.alt;
  image.width = preview.width;
  image.height = preview.height;
  image.style.display = "block";
  image.style.width = "100%";
  image.style.maxWidth = `${preview.width}px`;
  image.style.height = "auto";
  image.style.margin = "0 auto";
  image.style.borderRadius = "1.5rem";
  image.style.boxShadow = "0 18px 42px rgba(15, 23, 42, 0.14)";
  figure.appendChild(image);

  return figure;
}

async function capturePreview(
  request: PreviewCaptureRequest,
  cache: Map<string, Promise<InlineImageResult>>,
  warningMap: Map<string, ExportImageWarning>
) {
  const bounds = request.node.getBoundingClientRect();
  const sandbox = document.createElement("div");
  sandbox.style.position = "fixed";
  sandbox.style.left = "-100000px";
  sandbox.style.top = "0";
  sandbox.style.width = `${Math.ceil(bounds.width)}px`;
  sandbox.style.pointerEvents = "none";
  sandbox.style.opacity = "0";
  sandbox.style.zIndex = "-1";

  const clone = request.node.cloneNode(true) as HTMLElement;
  clone.style.width = `${Math.ceil(bounds.width)}px`;
  clone.style.maxWidth = `${Math.ceil(bounds.width)}px`;

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    await inlineImages(clone, cache, warningMap);
    await waitForImages(clone);

    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });

    return {
      key: request.key,
      alt: request.alt,
      dataUrl,
      width: Math.max(Math.ceil(bounds.width), clone.scrollWidth),
      height: Math.max(Math.ceil(bounds.height), clone.scrollHeight),
    };
  } finally {
    document.body.removeChild(sandbox);
  }
}

function buildExportHtml({
  appName,
  articleHtml,
  stylesheets,
  generatedAt,
  darkMode,
  warnings,
}: {
  appName: string;
  articleHtml: string;
  stylesheets: string;
  generatedAt: Date;
  darkMode: boolean;
  warnings: ExportImageWarning[];
}) {
  const htmlClass = darkMode ? ' class="dark"' : "";
  const generatedLabel = generatedAt.toLocaleString();
  const warningMarkup =
    warnings.length > 0
      ? `
      <section class="app-guide-export-warning" aria-live="polite">
        <h2>Export notes</h2>
        <p>${escapeHtml(String(warnings.length))} image${warnings.length === 1 ? " was" : "s were"} unavailable while generating this file. Placeholder frames were inserted where those images could not be embedded, which commonly happens when the browser is blocked by CORS.</p>
        <ul>
          ${warnings
            .slice(0, 8)
            .map(
              (warning) =>
                `<li><strong>${escapeHtml(warning.reason)}</strong><br />${escapeHtml(warning.url)}</li>`
            )
            .join("")}
        </ul>
        ${warnings.length > 8 ? `<p>Additional unavailable images: ${escapeHtml(String(warnings.length - 8))}</p>` : ""}
      </section>`
      : "";

  return `<!doctype html>
<html lang="en"${htmlClass}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(appName)} App Guide</title>
    <style>
      ${stylesheets}

      body {
        margin: 0;
        background: #eef2f7;
      }

      .app-guide-export-shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }

      .app-guide-export-header {
        margin-bottom: 24px;
        padding: 24px 28px;
        border-radius: 24px;
        border: 1px solid rgba(148, 163, 184, 0.32);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.94));
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      }

      .dark body {
        background: #020617;
      }

      .dark .app-guide-export-header {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.84));
        border-color: rgba(71, 85, 105, 0.48);
        box-shadow: 0 16px 40px rgba(2, 6, 23, 0.45);
      }

      .app-guide-export-header h1 {
        margin: 0;
      }

      .app-guide-export-header p {
        margin: 10px 0 0;
        max-width: 70ch;
      }

      .app-guide-export-meta {
        margin-top: 12px;
        font-size: 0.9rem;
        opacity: 0.75;
      }

      .app-guide-export-warning {
        margin-bottom: 24px;
        padding: 18px 22px;
        border-radius: 18px;
        border: 1px solid rgba(245, 158, 11, 0.35);
        background: rgba(255, 251, 235, 0.96);
        color: #78350f;
      }

      .app-guide-export-warning h2 {
        margin: 0 0 10px;
        font-size: 1.1rem;
      }

      .app-guide-export-warning p {
        margin: 0 0 10px;
      }

      .app-guide-export-warning ul {
        margin: 0;
        padding-left: 20px;
      }

      .app-guide-export-warning li + li {
        margin-top: 10px;
      }

      .dark .app-guide-export-warning {
        background: rgba(69, 26, 3, 0.72);
        border-color: rgba(245, 158, 11, 0.38);
        color: #fcd34d;
      }
    </style>
  </head>
  <body>
    <main class="app-guide-export-shell">
      <header class="app-guide-export-header">
        <h1>${escapeHtml(appName)} Application Guide</h1>
        <p>This standalone export preserves the App Guide article as HTML, inlines the guide images, and embeds the interface examples as PNG snapshots.</p>
        <div class="app-guide-export-meta">Generated ${escapeHtml(generatedLabel)}</div>
      </header>
      ${warningMarkup}
      ${articleHtml}
    </main>
  </body>
</html>`;
}

export async function exportApplicationGuideHtml({
  appName,
  articleNode,
  previewCaptures,
}: ExportApplicationGuideOptions): Promise<ExportApplicationGuideResult> {
  if (typeof document === "undefined") {
    throw new Error("Application guide export is only available in the browser.");
  }

  const fontsReady = document.fonts?.ready;
  if (fontsReady) {
    await fontsReady;
  }

  const imageCache = new Map<string, Promise<InlineImageResult>>();
  const warningMap = new Map<string, ExportImageWarning>();
  const capturedPreviews = await Promise.all(
    previewCaptures.map((preview) => capturePreview(preview, imageCache, warningMap))
  );

  const clone = articleNode.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(`[${APP_GUIDE_EXPORT_EXCLUDE_ATTR}]`)
    .forEach((node) => node.remove());

  for (const preview of capturedPreviews) {
    const target = clone.querySelector(
      `[${APP_GUIDE_STATIC_PREVIEW_ATTR}="${preview.key}"]`
    );
    if (!target) {
      continue;
    }

    target.replaceWith(buildReplacementImage(document, preview));
  }

  await inlineImages(clone, imageCache, warningMap);

  const warnings = Array.from(warningMap.values()).sort((left, right) =>
    left.url.localeCompare(right.url)
  );

  const html = buildExportHtml({
    appName,
    articleHtml: clone.outerHTML,
    stylesheets: collectStylesheets(),
    generatedAt: new Date(),
    darkMode: document.documentElement.classList.contains("dark"),
    warnings,
  });

  const filename = `${sanitizeFilenameSegment(appName)}-app-guide-${formatDateForFilename()}.html`;
  downloadTextFile(html, filename, "text/html;charset=utf-8");

  return { warnings };
}