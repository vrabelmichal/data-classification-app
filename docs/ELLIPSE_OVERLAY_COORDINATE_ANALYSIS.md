# Ellipse Overlay – Coordinate & Angle Analysis

This document explains the working coordinate transforms used to draw the
GALFIT half-light-radius ellipse overlay in
`src/components/classification/ImageViewer.tsx`.

The correct formulas were arrived at by trial and error and then back-explained
here.  See §4 for the debugging history.

---

## 1. Coordinate Systems

### 1.1 GALFIT / FITS (catalogue values)

| Property | Value |
|---|---|
| Origin | Bottom-left of the image |
| Axis x | Increases **rightward** (same as screen +x) |
| Axis y | Increases **upward** (opposite to screen +y) |
| Indexing | **1-based** – pixel (1, 1) is the centre of the bottom-left pixel |

The reference image size used by GALFIT is **256 × 256 pixels**
(`HALF_LIGHT_ORIGINAL_SIZE = 256`).

### 1.2 SVG / Browser (display)

| Property | Value |
|---|---|
| Origin | Top-left of the image |
| Axis x | Increases **rightward** |
| Axis y | Increases **downward** |
| Pixel centre | Pixel (i, j) 0-indexed has its centre at SVG point (i + 0.5, j + 0.5) |

### 1.3 Image orientation in the browser

The PNG tiles served to the browser are generated with `np.flipud` applied at
tile-generation time, so:

- FITS y = 1 (sky bottom) → displayed at **bottom** of browser image
- FITS y = H (sky top) → displayed at **top** of browser image

This is the correct astronomical orientation (North up).  It means the FITS
y-up axis must be mirrored to obtain SVG y-down coordinates.

---

## 2. Working Formulas (empirically confirmed)

```
scaleX = imageWidth  / HALF_LIGHT_ORIGINAL_SIZE
scaleY = imageHeight / HALF_LIGHT_ORIGINAL_SIZE

cx  = (x + PIXEL_OFFSET_CORRECTION_X) × scaleX
    = (x − 0.5) × scaleX

cy  = (HALF_LIGHT_ORIGINAL_SIZE − y + PIXEL_OFFSET_CORRECTION_Y) × scaleY
    = (256 − y + 1.5) × scaleY

rx  = reff × scaleX
ry  = reff × q × scaleY

svgRotation = 90 − pa
```

---

## 3. Derivation of Each Term

### 3.1 cx — x axis (no flip needed)

FITS x increases rightward, same as SVG, so no axis reversal is required.
Only the 1-based → 0-based pixel-centre conversion applies:

```
x_fits = 1  →  SVG centre = 0.5
x_fits = 2  →  SVG centre = 1.5
…
x_fits = k  →  SVG centre = k − 0.5
```

Therefore: `cx = (x − 0.5) × scaleX`, encoded as
`PIXEL_OFFSET_CORRECTION_X = −0.5`.

### 3.2 cy — y axis (flip + pixel-centre + empirical offset)

Because the image is pre-flipped, FITS y must be mirrored to SVG row index:

```
display_row_0based = H − y_fits    (FITS y=1 → row 255, FITS y=256 → row 0)
```

Adding the pixel-centre shift (+0.5) gives the theoretical SVG coordinate:

```
cy_theoretical = (H − y + 0.5) × scaleY
```

Through trial and error an additional **+1.0 offset** was required.  The total
constant is therefore:

```
PIXEL_OFFSET_CORRECTION_Y = 0.5 (pixel-centre) + 1.0 (pipeline offset) = 1.5
```

The +1.0 is a systematic shift introduced by the data processing pipeline — most
likely it is due to an error in the procedure used to flip coordinates of FITS files (images) later used by GALFIT(m).

**Update `PIXEL_OFFSET_CORRECTION_Y` if the tile-generation pipeline changes.**

### 3.3 Semi-axes

```
rx = reff × scaleX      (semi-major axis, in pixels of the reference image)
ry = reff × q × scaleY  (semi-minor axis; q = b/a ≤ 1)
```

When `q = 1` the ellipse degenerates to a circle.

### 3.4 Position angle (SVG rotation)

SVG `rotate(angle, cx, cy)` rotates **clockwise on screen** for positive angle
(because SVG +y points downward).

- The semi-major axis (rx) starts aligned with **+x** (East on screen).
- Rotating **90° CW** aligns it with **−y = North** (upward on screen).
- GALFIT PA is measured **CCW from North**, which is the *opposite* sense to
  SVG's CW positive convention.  Each degree of PA therefore subtracts from
  the base 90° rotation:

```
svgRotation = 90 − pa
```

| PA | svgRotation | Major axis direction |
|---|---|---|
| 0° | 90° CW | North (−y, upward) ✓ |
| 90° | 0° | East (+x) ✓ |
| 45° | 45° CW | NE ✓ |
| −45° | 135° CW | NW ✓ |

This equals the Python reference formula `mpl_angle = 90 + pa_for_draw`
applied after the vertical flip (`pa_for_draw = −pa`):
`90 + (−pa) = 90 − pa` ✓

---

## 4. Constants at a Glance

| Constant | Value | Meaning |
|---|---|---|
| `HALF_LIGHT_ORIGINAL_SIZE` | 256 | Pixel dimension of the GALFIT reference image |
| `PIXEL_OFFSET_CORRECTION_X` | −0.5 | 1-based → SVG pixel-centre for x (`x − 1 + 0.5`) |
| `PIXEL_OFFSET_CORRECTION_Y` | +1.5 | Axis-flip pixel-centre (+0.5) + empirical pipeline offset (+1.0) |

---

## 5. Python Reference Comparison

| Quantity | Python reference | TypeScript |
|---|---|---|
| Image | `np.flipud(fits_data)` displayed | PNG pre-flipped (same result) |
| cx | `(x_fits − 1)` (0-based, no centre shift) | `(x − 0.5) × scaleX` |
| cy (after flip) | `(H − 1) − (y_fits − 1) = H − y_fits` | `(H − y + 1.5) × scaleY` |
| Rotation | `mpl_angle = 90 − pa` | `svgRotation = 90 − pa` |

The Python script does not add a sub-pixel centre correction because matplotlib
renders patches at integer pixel boundaries and the galaxy centres are large
enough that 0.5 px is irrelevant.  The +1.0 empirical offset does not appear in
Python because the Python script reads FITS files directly (no tile-cutting
pipeline offset).

---

## 6. Debugging History

### Round 1 — Assumed non-flipped images
- Added `PIXEL_OFFSET_CORRECTION = 1` to both axes.
- Set `svgRotation = −(90 + pa)` (correct for a non-flipped frame).
- Both were wrong: the images are flipped and the original `90 − pa` was correct.

### Round 2 — Assumed flipped images, derived flip formula
- Used `cy = (H − 1 − (y − 1)) × scaleY = (H − y) × scaleY` (flip mirror).
- Restored `svgRotation = 90 − pa`.
- Introduced `IMAGE_IS_VERTICALLY_FLIPPED` flag.
- Still wrong: placed the ellipse at the vertically-mirrored position.

### Round 3 — Wrongly removed the flip
- Simplified `cy = (y − PIXEL_OFFSET_CORRECTION) × scaleY`.
- Removed `IMAGE_IS_VERTICALLY_FLIPPED`.
- Ellipse was now at the mirror of the correct y position (flip needed was removed).

### Round 4 — Trial and error → correct result
- User experimentally arrived at `cy = (H − y + 1.5) × scaleY` and
  `cx = (x − 0.5) × scaleX`.
- Analysis: `H − y` restores the flip; `+0.5` is the pixel-centre correction;
  the extra `+1.0` compensates a pipeline tile-cutting offset.
- `svgRotation = 90 − pa` was always correct (confirmed).
- This is the current, working implementation.
