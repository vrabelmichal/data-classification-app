#!/usr/bin/env python3
"""
Generate og-preview.png (1200x630) for Open Graph social card previews.
Outputs to static/og-preview.png (served at /og-preview.png by Vite/Vercel).

Usage:
    pip install Pillow
    python scripts/generate_og_preview.py
"""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    print("Pillow is required. Run:  pip install Pillow")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
GALAXY_PNG = ROOT / "resources" / "galaxy.png"
OUTPUT = ROOT / "static" / "og-preview.png"

# ---------------------------------------------------------------------------
# Design tokens (mirroring tailwind.config.js / index.css)
# ---------------------------------------------------------------------------
W, H = 1200, 630

BG_LEFT   = (23, 23, 23)       # #171717  dark background (left)
BG_RIGHT  = (20, 18, 34)       # slightly purple-dark (right) — subtle gradient
INDIGO    = (79, 70, 229)      # #4F46E5  primary
INDIGO_LIGHT = (139, 92, 246)  # #8B5CF6  accent / subtitle highlight
WHITE     = (255, 255, 255)
GRAY      = (156, 163, 175)    # text-gray-400

TITLE_TEXT    = "Galaxy Classification"
SUBTITLE_TEXT = "Citizen science morphology labeling"
BADGE_TEXT    = "v0.2"

# ---------------------------------------------------------------------------
# Helper: horizontal gradient background
# ---------------------------------------------------------------------------
def make_gradient(w: int, h: int, left: tuple, right: tuple) -> Image.Image:
    base = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(base)
    for x in range(w):
        t = x / (w - 1)
        r = int(left[0] + (right[0] - left[0]) * t)
        g = int(left[1] + (right[1] - left[1]) * t)
        b = int(left[2] + (right[2] - left[2]) * t)
        draw.line([(x, 0), (x, h)], fill=(r, g, b))
    return base


# ---------------------------------------------------------------------------
# Build canvas
# ---------------------------------------------------------------------------
canvas = make_gradient(W, H, BG_LEFT, BG_RIGHT).convert("RGBA")

# ---------------------------------------------------------------------------
# Galaxy image — right side, blended
# ---------------------------------------------------------------------------
if GALAXY_PNG.exists():
    galaxy = Image.open(GALAXY_PNG).convert("RGBA")

    # Scale to fill a ~600×630 region (right half), preserving aspect ratio
    target_h = H
    scale = target_h / galaxy.height
    target_w = int(galaxy.width * scale)
    galaxy = galaxy.resize((target_w, target_h), Image.LANCZOS)

    # Crop from left if wider than half canvas
    if target_w > W // 2:
        left_crop = (target_w - W // 2) // 2
        galaxy = galaxy.crop((left_crop, 0, left_crop + W // 2, target_h))
    galaxy_w = galaxy.width

    # Left-side fade: darken the left ~40% of the galaxy image so text is readable
    fade_mask = Image.new("L", (galaxy_w, H), 0)
    fade_draw = ImageDraw.Draw(fade_mask)
    fade_width = int(galaxy_w * 0.55)
    for x in range(fade_width):
        alpha = int(255 * (x / fade_width) ** 1.5)
        fade_draw.line([(x, 0), (x, H)], fill=alpha)
    # Right portion: fully visible
    fade_draw.rectangle([fade_width, 0, galaxy_w, H], fill=255)

    # Overall opacity for the galaxy: ~70%
    r, g, b, a = galaxy.split()
    a = Image.eval(a, lambda px: int(px * 0.70))
    a = Image.composite(a, Image.new("L", (galaxy_w, H), 0), fade_mask)
    galaxy.putalpha(a)

    # Paste onto right side of canvas
    paste_x = W - galaxy_w
    canvas.alpha_composite(galaxy, dest=(max(paste_x, W // 2), 0))
else:
    print(f"Warning: {GALAXY_PNG} not found; skipping galaxy overlay.")

# ---------------------------------------------------------------------------
# Decorative indigo bar on the left edge
# ---------------------------------------------------------------------------
draw = ImageDraw.Draw(canvas)
bar_w = 8
draw.rectangle([0, 0, bar_w, H], fill=(*INDIGO, 255))

# Subtle horizontal rule under text area
rule_y = 440
draw.rectangle([60, rule_y, 640, rule_y + 1], fill=(*INDIGO, 120))

# ---------------------------------------------------------------------------
# Load fonts — fall back to default if system fonts unavailable
# ---------------------------------------------------------------------------
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold else
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    # Pillow built-in bitmap fallback
    print(f"Warning: no TTF font found for size={size}; using bitmap fallback.")
    return ImageFont.load_default()


font_title    = load_font(72, bold=True)
font_subtitle = load_font(34, bold=False)
font_badge    = load_font(24, bold=True)
font_url      = load_font(22, bold=False)

# ---------------------------------------------------------------------------
# Text layout — left-aligned block, vertically centred
# ---------------------------------------------------------------------------
TEXT_X = 58  # just right of the indigo bar (+ small gap)

# Title
TITLE_Y = 190
draw.text((TEXT_X, TITLE_Y), TITLE_TEXT, font=font_title, fill=(*WHITE, 255))

# Subtitle
SUBTITLE_Y = TITLE_Y + 90
draw.text((TEXT_X, SUBTITLE_Y), SUBTITLE_TEXT, font=font_subtitle, fill=(*GRAY, 255))

# Indigo accent dots
dot_y = SUBTITLE_Y + 55
for i, color in enumerate([INDIGO, INDIGO_LIGHT, WHITE]):
    dot_x = TEXT_X + i * 22
    draw.ellipse([dot_x, dot_y, dot_x + 10, dot_y + 10], fill=(*color, 220))

# Badge "v0.2"
badge_x, badge_y = TEXT_X, dot_y + 36
bbox = draw.textbbox((0, 0), BADGE_TEXT, font=font_badge)
bw = bbox[2] - bbox[0]
bh = bbox[3] - bbox[1]
pad = 10
draw.rounded_rectangle(
    [badge_x, badge_y, badge_x + bw + pad * 2, badge_y + bh + pad * 2],
    radius=6,
    fill=(*INDIGO, 200),
)
draw.text((badge_x + pad, badge_y + pad), BADGE_TEXT, font=font_badge, fill=(*WHITE, 255))

# URL hint
draw.text((TEXT_X, H - 56), "galaxies.michalvrabel.sk", font=font_url, fill=(*GRAY, 160))

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
final = canvas.convert("RGB")
final.save(OUTPUT, "PNG", optimize=True)
print(f"Saved {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)")
