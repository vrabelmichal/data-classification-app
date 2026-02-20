# Changes to Contrast Groups and Mask Toggle

This document describes the changes made to image contrast groups and the new mask overlay feature in the `revising-contrast-groups` branch, since commit `ecb3d788`.

---

## Background

When classifying galaxy images, users browse through a set of **contrast groups** — predefined views of each galaxy showing the same object rendered with different brightness/contrast settings (e.g. linear scaling, log scaling, zscale). Each group typically shows three panels: the galaxy **band** image, the **residual** (what remains after subtracting a model), and the fitted **model**.

Many of these images come in two flavours: **unmasked** (the full image including nearby sources) and **masked** (nearby sources hidden, making the target galaxy easier to inspect). Previously, users had to switch contrast groups to toggle between masked and unmasked versions.

---

## Mask Toggle Button

A new **Masks ON/OFF button** was added to the classification interface. It allows users to instantly switch all visible images between their masked and unmasked variants without changing the contrast group.

Key details:
- The button is always visible in the toolbar and can also be activated with the keyboard shortcut **Shift+M**.
- The toggle state (on or off) is saved automatically so it persists between sessions.
- **Masks are shown by default**, since masked images are generally easier to inspect for classification.
- Each contrast group entry can now specify both a masked and an unmasked image variant. When the toggle is switched, the displayed image and its label update accordingly — no contrast group change is needed.

---

## Contrast Group Presets — Restructured and Consolidated

The contrast group presets (the predefined sets of views) went through a significant cleanup:

### Paired masked/unmasked variants
Instead of having separate contrast groups for masked and unmasked versions of the same scaling (e.g. one group for "Unified Band, zscale, masked" and another for "Unified Band, zscale, unmasked"), each group now holds **both variants together**. The mask toggle switches between them dynamically. This roughly halved the number of contrast groups users need to cycle through.

### New and updated contrast groups
Each contrast group now shows **6 images**: the first three use the new unified rendering described below; the last three are the existing APLpy-rendered images, which remain unchanged and are available in every group.

The 5 new contrast groups are:

**Group 1 — Practical (linear)**
A general-purpose view. The band image uses full linear scaling; the residual uses a narrower brightness range (0.5–99.5%) to highlight structure without being overwhelmed by bright or dark extremes; the model uses the same full linear range as the band. Good starting point for most objects.

**Group 2 — Unified log**
All three panels (band, residual, model) use logarithmic scaling with thresholds derived from the band image, so the brightness range is identical across all three. Log scaling brings out faint extended emission that linear scaling can suppress.

**Group 3 — Unified linear**
Same idea as Group 2 but with linear scaling. The band, residual, and model are all displayed on the same brightness scale, making direct visual comparison between panels straightforward.

**Group 4 — Mixed**
A practical combination of different independent scalings: the band is shown in log scale (full range, unmasked); the residual uses full-range linear scaling based on the unmasked area; the model uses full linear range. Useful when the unified scaling in Groups 2/3 makes the residual or model too faint or too bright to read clearly.

**Group 5 — Unified zscale**
All three panels share the same zscale stretch parameters, calculated from the unmasked band image. Zscale is an automatic algorithm that sets the brightness range based on the typical pixel values, which often gives a good view without manual adjustment. All panels being on the same scale makes differences between them easier to spot.

In all five groups the band image shows the source ellipse overlay (indicating the fitted extent of the galaxy). The APLpy images in positions 4–6 vary per group, cycling through colour-composite (irg), reference-normalised linear, default APLpy settings, arcsinh, and a wide low-resolution overview.

### All new image types covered
The presets were verified and updated to ensure every new image type in the dataset has appropriate contrast group settings assigned. Previously some new image types were falling back to incorrect or missing presets.

### Configuration consolidated
The many separate per-type preset files that existed before have been merged into a single location. This has no effect on what users see, but makes it much easier to maintain and extend the contrast group definitions going forward.

---

## Image Display Settings — Simplified Storage

Each image type now has a dedicated **configuration key** (`configKey`) used to save and restore per-user display settings (such as manual brightness/contrast adjustments). Previously, settings could get mixed up when switching between masked and unmasked variants of the same image type. With the config key tied to the image type rather than the specific image variant, settings are now stored and retrieved consistently.

Additionally, image display settings are no longer loaded from an external configuration file — they are defined directly in the code, removing a source of potential misconfiguration.

---

*Branch: `revising-contrast-groups` — changes since `ecb3d788d54b6ef5410506d2e0c44ea590fc1b3c`*
