# Improvements in the `revising-contrast-groups` Branch

This document summarises the improvements made since commit `ecb3d788` on the `revising-contrast-groups` branch.

---

## Image Display & Contrast Groups

- **Mask overlay support added.** Users can now toggle an image mask on and off while classifying images. Masks are shown by default, making it easier to see the region of interest immediately.
- **Updated contrast group presets.** Contrast settings were revised and extended to cover all new image types, including masked images. Outdated presets were removed to keep the interface clean and consistent.
- **Simplified settings retrieval.** Image display settings (brightness, contrast, etc.) are now stored and retrieved in a more reliable, consistent way using a dedicated configuration key per image type — reducing the chance of mismatched settings across sessions.

---

## User Interface Improvements

- **Keyboard shortcuts enhanced.** Additional keyboard shortcuts were added to control mask visibility and other image display options, making the workflow faster for power users. The shortcut reference panel was also cleaned up to display allowed characters more clearly.
- **QuickInput panel improved.** The layout of the quick-input panel (used for rapid data entry) was refined for better readability, with clearer formatting of detail fields.
- **Notification position moved.** Pop-up toast notifications were relocated to the top-centre of the screen, where they are less likely to obscure important content.
- **Responsive layout fixes.** The input container now adapts better to different screen sizes, reducing layout issues on smaller displays.

---

## Help Page

- **Help page reorganised and expanded.** The help page was restructured for easier navigation and now includes descriptions of the different image types available in the application, giving new users clearer guidance on what they are looking at.
- **Dynamic page titles and routing.** The help section now updates the browser page title and supports direct links to specific help topics, making it easier to share or bookmark relevant sections.

---

## Reliability & Data Handling

- **Progress tracking fixed.** A bug was corrected in the query used to track classification progress, ensuring accurate counts are shown to users.
- **Error handling improved in data ingestion.** The script used to load new data into the system now handles unexpected errors more gracefully, preventing silent failures during ingestion.
- **Object ID filtering for ingestion.** Support was added to filter ingested data by specific object IDs, useful for targeted testing and debugging of new image batches.
- **Contrast group resolution simplified.** The internal logic for looking up contrast group settings was streamlined, reducing the risk of configuration errors when adding new image types.

---

*Branch: `revising-contrast-groups` — changes since `ecb3d788d54b6ef5410506d2e0c44ea590fc1b3c`*
