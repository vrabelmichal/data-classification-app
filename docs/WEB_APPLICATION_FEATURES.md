# Web Application Features Overview

This document explains the main features of the galaxy classification web application for a general audience. It focuses on what users see, what they are asked to do, how images are presented, and how galaxies are assigned for review.

## Purpose of the Application

The application supports a galaxy-review workflow in which registered users inspect astronomical images and record structured judgments about each object. The goal is to make the classification process consistent, trackable, and efficient while still giving users enough visual context to make informed decisions.

In practical terms, the application helps users:

- review one galaxy at a time,
- compare several image representations of the same object,
- answer a small set of classification questions,
- add flags and optional notes,
- skip uncertain cases for later follow-up,
- browse and revisit previously seen galaxies.

## Getting Started

Before a user begins regular classification, there are usually three onboarding steps:

1. The user creates an account and confirms their email address.
2. An administrator approves the account for project participation.
3. A classification sequence is prepared for that user.

Only after these steps does the main classification workflow begin. Depending on project settings, users may receive a notification when their sequence is ready.

## The Main Classification Process

The core of the application is the classification interface. It is designed around a simple pattern: show one galaxy, provide several complementary images, ask the user a few structured questions, and then move to the next object.

### What the user is asked to answer

For each galaxy, the user is generally asked to provide:

1. An LSB classification.
2. A morphology classification.
3. Zero or more additional flags.
4. Optional written comments.

### LSB classification

The first decision is whether the object should be treated as an LSB candidate.

The interface typically offers these options:

- `Non-LSB`: the object does not appear to be a low-surface-brightness galaxy.
- `LSB`: the object does appear to be a galaxy of interest.
- `Failed fitting`: in some project configurations this is a separate checkbox; in others it appears as part of the main LSB choice. It indicates that the model-fitting process did not produce a usable result.

### Morphology classification

Users also assign a broad morphological description. The available categories are:

- `Featureless`: smooth appearance, without clear structure.
- `Not sure (Irr/other)`: irregular or uncertain appearance.
- `LTG (Sp)`: late-type or spiral-looking galaxy.
- `ETG (Ell)`: early-type or elliptical-looking galaxy.

These categories are intentionally broad. The interface is not trying to force an overly detailed scientific interpretation at this stage.

### Additional flags

Depending on the project configuration, users may also mark one or more simple flags:

- `Awesome`: the galaxy looks especially interesting or notable.
- `Valid redshift`: the redshift estimate appears trustworthy.
- `Visible nucleus`: a clear central nucleus is visible.
- `Failed fitting`: when this is enabled as a separate flag instead of an LSB category.

These flags help highlight useful scientific or quality-control details without making the main classification form overly complicated.

### Comments

Users can optionally add free-text comments. This is useful for ambiguous objects, unusual visual features, or anything that may deserve follow-up later.

### Submit, skip, and navigate

Once the user has reviewed the current galaxy, they can:

- submit the classification,
- skip the galaxy if they are unsure,
- move to the previous or next galaxy in the sequence.

Skipped objects are not lost. They are collected in a separate section so they can be reviewed again later.

## Quick Input Workflow

In addition to the standard form, the application includes a compact quick-input field. This is meant for experienced users who want to classify rapidly using short codes and keyboard shortcuts.

For example, the first character can represent the LSB decision, the second can represent morphology, and additional letters can add flags. Users who prefer the regular form can ignore quick input entirely.

This design allows the same application to support both careful step-by-step reviewing and fast expert workflows.

## What Images the User Sees

The classification interface is built around multiple views of the same target. The application does not rely on a single picture. Instead, it shows a small image set that helps users compare the object from several angles.

The detailed image-system documentation for this behavior is available in [docs/IMAGE_CONFIG.md](docs/IMAGE_CONFIG.md), [docs/IMAGE_CONFIG_QUICKSTART.md](docs/IMAGE_CONFIG_QUICKSTART.md), and [docs/IMAGE_CONFIG_SUMMARY.md](docs/IMAGE_CONFIG_SUMMARY.md). Those pages describe how image labels, contrast groups, mobile ordering, and overlay options are configured. This section translates that setup into plain language for end users.

### Six-image classification layout

Each contrast group contains exactly six images.

On desktop, the layout is organized as a grid. The first three positions are especially important because they form the main analysis set:

1. The observed single-band image, usually the g-band view.
2. The residual image, which shows the difference between the observed data and the fitted model.
3. The fitted model image.

The remaining three positions provide comparison images, typically RGB-style views created with different display methods. These help users judge faint structure, color context, and whether a feature is robust or only appears under a particular contrast stretch.

More explicitly, the user usually sees some combination of the following visualization types:

- `Observed band image`: a direct astronomical image of the target, typically the g-band panel used as the main reference.
- `Residual image`: the observed data minus the fitted model. This is useful for spotting structures the model misses, artifacts, or possible fitting failures.
- `Model image`: the fitted galaxy model, shown so users can compare the idealized fit with the actual observation.
- `RGB comparison images`: color composite views produced with display styles such as APLpy-style or Lupton-style rendering. These offer additional visual context and can make diffuse features or neighboring structures easier to interpret.

So the user is not just seeing “the galaxy image” repeated six times. They are seeing different visual products derived from the same target, each highlighting a different aspect of the data.

### Visualization styles and stretches

The detailed image docs explain that these images are shown with several different display strategies rather than a single fixed brightness mapping. In practice, the user may encounter visualizations based on:

- `Linear scaling`: a direct brightness mapping that works well as a practical baseline.
- `Logarithmic scaling`: useful for bringing out faint extended emission that may be hard to see in a linear display.
- `Zscale`: an automatic stretch that often gives a balanced view without manual tuning.
- `Unified threshold displays`: observed image, residual, and model are shown on a shared brightness basis so they can be compared more directly.
- `Masked variants`: versions where contaminating regions are masked out to isolate the target.
- `Unmasked variants`: views that preserve the surrounding context.

The labels visible in the interface reflect these visualization choices. For example, a label may indicate whether the image is a band image, residual, or model, whether it is masked or unmasked, and whether it uses linear, logarithmic, or zscale-style display.

### Why multiple image versions are shown

Different image renderings reveal different things.

- A direct observed image shows what is actually in the data.
- A model image shows the fitted interpretation of that object.
- A residual image highlights what the model fails to explain.
- RGB comparison views provide broader visual context and can make subtle structures easier to spot.
- Different stretches such as linear, logarithmic, and zscale can reveal different structures in the same galaxy.

This combination helps reduce bias from relying on just one display style.

## How Images Are Organized

The application organizes classification images into contrast groups. Each group contains the same six logical positions, but the brightness scaling and display style can change from one group to another.

In other words, the user is not changing to a different galaxy view set when switching groups. They are seeing the same galaxy through a different display strategy.

### Contrast groups

The current configuration includes several contrast groups with names such as:

- `Practical (linear)`
- `Unified log`
- `Unified linear`
- `Mixed`
- `Unified zscale`

These labels describe how brightness values are stretched or normalized. Some groups are better for faint extended emission, some are better for direct comparison between observed, model, and residual panels, and some are meant to provide a practical default view.

Based on the current image configuration, these groups correspond roughly to the following user-visible experiences:

- `Practical (linear)`: starts from a straightforward linear display. The observed band image uses a full linear range, while the residual is shown with a tighter range to make structure easier to see.
- `Unified log`: observed image, residual, and model all use logarithmic scaling on a shared brightness basis. This is especially useful for faint diffuse emission.
- `Unified linear`: similar shared comparison logic, but with linear scaling instead of logarithmic scaling.
- `Mixed`: combines different display choices for different panels, for example a logarithmic band image with linear residual and model views.
- `Unified zscale`: uses an automatic zscale-style stretch across the panels for a balanced comparison view.

Users can cycle through contrast groups during classification. This is valuable because one rendering may make a diffuse structure obvious while another may make artifacts or fitting problems easier to spot.

### Current contrast groups and their images

The current configuration defines five contrast groups. Each one contains six images: three core analysis panels followed by three comparison panels.

#### Group 1: Practical (linear)

This is the default practical starting view. It keeps the core observed, residual, and model comparison straightforward, then adds RGB-style comparison images.

1. `Unified Band (100%, mask-thresh)`: the main observed band image, shown with linear scaling and a mask-threshold-based display. This is the primary single-band reference view.
2. `Residual (0.5-99.5, mask-thresh)`: the residual panel, displayed with a narrower brightness range so mismatches between data and model are easier to see.
3. `Unified Model (100%, masked)`: the fitted model displayed on the same general brightness basis as the main band image.
4. `APLpy linear (109534177-based, irg)`: an RGB comparison image using an APLpy-style linear rendering based on a reference normalization. This gives a color-context view of the target.
5. `APLpy Zscale (unmasked)`: an APLpy-style RGB image using zscale-style automatic contrast for a balanced broader-context comparison.
6. `APLpy Linear (p1_995 wide)`: a wide-field APLpy linear view with a highlighted rectangle showing the smaller central region used by the main analysis images.

#### Group 2: Unified log

This group is designed to bring out faint extended emission by showing the core analysis panels with logarithmic scaling on a shared brightness basis.

1. `Unified Band (log, 100%, mask-thresh)`: the observed band image in logarithmic scaling, useful for faint diffuse structure.
2. `Unified Residual (log, 100%, masked)`: the residual image with the same logarithmic display approach.
3. `Unified Model (log, 100%, masked)`: the fitted model in the same log-scaled comparison scheme.
4. `APLpy Linear (109534177-based)`: an APLpy-style linear RGB comparison image.
5. `Lupton (q=8, stretch=20, unmasked)`: a Lupton-style RGB rendering that emphasizes color structure with a specific stretch setting.
6. `APLpy Linear (p1_995 wide)`: the same wide contextual APLpy view used to show the wider surroundings of the target.

#### Group 3: Unified linear

This group keeps the same shared-comparison idea as Group 2, but uses linear scaling instead of logarithmic scaling.

1. `Unified Band (100%, mask-thresh)`: the observed band image in a shared linear comparison mode.
2. `Unified Residual (100%, masked)`: the residual image on the same linear comparison basis.
3. `Unified Model (100%, masked)`: the fitted model matched to the same linear display logic.
4. `APLpy Linear (109534177-based)`: an APLpy-style linear RGB comparison image.
5. `APLpy Defaults (unmasked)`: an APLpy RGB comparison image using the default APLpy display behavior rather than a custom stretch.
6. `APLpy Linear (p1_995 wide)`: the wide-field comparison image showing the broader field around the object.

#### Group 4: Mixed

This group intentionally mixes display styles between panels so the user can combine a faint-structure-friendly observed image with more direct residual and model views.

1. `Band (log, 100%, unmasked)`: the observed band image in logarithmic scaling with the full unmasked context.
2. `Residual (100%, mask-thresh)`: the residual image shown in a more direct linear-style full-range view.
3. `Model (100%, unmasked)`: the fitted model image in a full-range unmasked view.
4. `APLpy Arcsinh (p0.01-100, vmid=0.2, 100426834)`: an APLpy arcsinh RGB rendering tuned for faint structure and smoother dynamic-range compression.
5. `APLpy Arcsinh (p0.01-100, vmid=0.1, mask)`: a masked arcsinh RGB comparison view with a slightly different midpoint setting.
6. `APLpy Linear (p1_995 wide)`: the wide-field contextual image with the central working region marked.

#### Group 5: Unified zscale

This group uses an automatic zscale-style display for the three main analysis panels, making it a useful balanced comparison mode.

1. `Unified Band (zscale, unmasked)`: the observed band image using zscale-style normalization.
2. `Unified Residual (zscale, unmasked)`: the residual panel shown with the same zscale-based comparison logic.
3. `Unified Model (zscale, unmasked)`: the fitted model under the same automatic stretch strategy.
4. `APLpy Linear (365515297-based)`: an APLpy-style linear RGB comparison image with a different reference normalization.
5. `APLpy Arcsinh (p0.01-100, vmid=0.2, mask, irg)`: a masked arcsinh RGB comparison image in IRG ordering.
6. `APLpy Linear (p1_995 wide)`: the wide-field comparison image showing the galaxy in broader context.

### What changes between groups

Across these groups, the galaxy itself does not change. What changes is how the same target is rendered.

- Images 1-3 change substantially because they define the main analysis mode for that group.
- Images 4-6 act as comparison/context panels, but their exact RGB rendering also changes from group to group.
- The wide-field panel in position 6 remains consistent across groups so users always retain a stable broader-context reference.

This design gives users both variety and continuity: the main interpretation panels can change aggressively to highlight different structures, while at least one contextual view remains familiar.

### Masked and unmasked variants

The interface can also switch between masked and unmasked image variants when both are available.

- Masked views help isolate the target from nearby contaminants.
- Unmasked views preserve the full surrounding field.

This is useful when the user wants to compare the target both in isolation and in its wider environment.

### Effective-radius overlay

The application can display an effective-radius ellipse overlay on relevant images. This provides a visual indication of the fitted size and shape of the object. Users can toggle this overlay on or off during review.

The image configuration system also supports other visual guides, such as rectangle overlays, when a workflow needs to highlight a specific sub-region of a larger image.

### Desktop and mobile order

The same six images are available on both desktop and mobile, but the order is adapted for smaller screens.

On desktop, users see the full grid at once.

On mobile, the images are reordered into a swipe-friendly sequence so the most useful views appear earlier in the review flow. In the current configuration, the order starts with one of the RGB comparison views, then moves through the main observed-band and residual/model panels, and later returns to the remaining comparison images.

This helps small-screen users get context quickly without losing access to the more technical views.

### Image labels shown to users

The image labels in the interface are meaningful. They are not arbitrary names. They usually communicate a combination of:

- image role, such as band, residual, or model,
- visualization style, such as linear, log, or zscale,
- masking state,
- whether a unified threshold or comparison scheme is being used.

For a general user, the important point is that the label tells them what kind of view they are looking at. For advanced users, those labels also make it possible to compare views systematically and understand why one panel may emphasize faint structure more strongly than another.

## A Simple Mental Model for the Image Workflow

One helpful way to think about the image workflow is:

```text
same galaxy
-> several image roles
-> several contrast strategies
-> one final human judgment
```

The application is designed so that users do not need to trust a single panel. Instead, they compare complementary evidence before making a decision.

## Galaxy Metadata and Context

Alongside the images, the interface can show supporting information about the current target, such as identifying information and measured properties. This helps users relate what they see in the images to the object’s recorded parameters.

The interface also provides direct links and review tools, including opening the current galaxy in Aladin for broader astronomical context.

## Progress Tracking

The classification screen includes progress information so users can see where they are in their assigned sequence. This helps make long review sessions manageable and gives a clear sense of forward movement through the dataset.

## How Galaxies Are Assigned to Users

The application uses a balanced assignment strategy when creating a user’s classification sequence. The goal is not simply to hand out galaxies at random. Instead, the system tries to distribute work in a way that is fair, useful, and scientifically practical.

In the application, a user normally does not classify from the entire database directly. Instead, the system prepares a personal sequence: an ordered list of galaxy identifiers assigned to that user. The classification interface then walks through that sequence one galaxy at a time.

### General idea

When preparing a sequence for a user, the application:

1. looks for galaxies that have been assigned fewer times overall,
2. avoids assigning a galaxy to the same user too many times,
3. excludes blacklisted galaxies,
4. can apply additional project filters such as paper or subset restrictions,
5. fills the user’s sequence up to the requested size.

### What the system is trying to optimize

The assignment logic is designed around several goals that can compete with one another:

1. spread classifications across the dataset rather than concentrating them on a few already-popular galaxies,
2. avoid repeatedly assigning the same galaxy to the same user,
3. preserve the ability to generate usable sequences even when the ideal candidate pool becomes small,
4. respect administrative exclusions and project-specific subsets,
5. keep the resulting sequence as a clean ordered unit that the user can work through over time.

Because of this, the assignment procedure is best understood as a filtered and prioritized selection process rather than as simple random sampling.

### Step-by-step assignment procedure

When a new user sequence is generated, the system follows this general procedure.

#### 1. Validate the request

The generator first checks the requested assignment parameters.

These include:

- the expected number of participating users,
- the target minimum number of assignments per galaxy,
- the maximum number of times the same user may receive the same galaxy,
- the requested sequence size,
- whether the system is allowed to go beyond the target assignment threshold if necessary.

If these settings are internally inconsistent, the system records warnings. For example, it can warn when the requested balancing target is too ambitious to satisfy exactly.

#### 2. Check preconditions

Before selecting any galaxies, the system checks whether sequence generation is even allowed.

It verifies that:

- the user does not already have a sequence,
- there is not already a sequence-generation job running for that user,
- the database actually contains galaxies to assign.

At this stage, the system also loads the blacklist of galaxies that should never appear in normal user sequences.

#### 3. Create a tracked generation job

When the generation is a real assignment rather than a dry run, the system creates a tracked job record. This is used for progress reporting and cancellation.

That means sequence generation is treated as a visible, controlled workflow rather than a hidden one-shot operation. If needed, the process can be stopped between batches.

#### 4. Start with the under-target pool

The first selection pass focuses on galaxies whose total assignment count is still below the target threshold.

This is the core of the balancing strategy. The system prefers galaxies that still need more coverage overall, rather than continuing to assign galaxies that are already well represented.

Within this under-target pool, galaxies are considered in ascending order of assignment count. In effect, the least-assigned galaxies are examined first.

#### 5. Filter candidates before accepting them

As the system scans candidate galaxies, it does not automatically accept each one. Each candidate must pass several filters.

The main filters are:

- `Blacklist filter`: blacklisted galaxies are skipped immediately.
- `Already selected filter`: a galaxy already chosen earlier in the same generation run is skipped.
- `Project subset filter`: if the generation is limited to a subset such as one or more paper labels, galaxies outside that subset are skipped.
- `Per-user cap filter`: if the target user has already been assigned that galaxy too many times, it is skipped.

Only galaxies that pass all filters are added to the sequence.

#### 6. Continue in batches until enough galaxies are found

The generator scans the database in batches rather than trying to read everything at once. After each batch, it updates progress information, including how many galaxies have been scanned and how many valid assignments have been found.

This batching serves two purposes:

- it keeps the process scalable for large datasets,
- it allows cancellation and progress reporting during longer runs.

The under-target phase continues until either:

- the requested sequence size has been reached, or
- the under-target pool has been exhausted.

#### 7. Optionally fall back to the over-target pool

If the requested sequence is not yet full and the project allows over-assignment, the generator performs a second pass.

This pass looks at galaxies whose total assignment count is already at or above the target threshold. The same filtering rules still apply, but now the system is allowed to use higher-coverage galaxies in order to finish building the sequence.

This fallback exists because a strict balancing rule can otherwise leave some users with too few galaxies to classify, especially late in a campaign or inside a tightly filtered subset.

If over-assignment is disabled, the system stops after the under-target pool is exhausted, even if the requested sequence size has not been reached.

### Priority order

The system first prefers galaxies that are still below a target assignment count. This means the least-covered galaxies are considered first.

If the sequence cannot be filled from that under-covered pool alone, the system can continue into more heavily assigned galaxies, depending on project settings. This allows the application to keep sequences usable even when the ideal pool becomes small.

In practical terms, the priority order is:

1. galaxies below the target assignment count,
2. among those, galaxies with the smallest total assignment count,
3. among ties, a stable numeric ordering,
4. only after that, if allowed, galaxies already at or above the target threshold.

### Per-user limits

The sequence generator also respects a per-user cap. In plain terms, it avoids giving the same user the same galaxy more times than allowed.

This matters because total assignment count and per-user assignment count are not the same thing. A galaxy may still need more total reviews overall, but the same user should not keep receiving it indefinitely.

### Blacklists and exclusions

Some galaxies can be explicitly blacklisted from sequences. These are skipped entirely during assignment. This is useful for corrupted entries, unsuitable targets, or objects that should not be shown in the normal labeling workflow.

The generator can also be restricted to a subset of galaxies, for example by a paper-related label stored in the galaxy metadata. In that case, only galaxies belonging to the requested subset are eligible.

### Sequence size

A user’s sequence does not have to be permanent. Administrators can later extend or shorten it. This means the project can adapt over time without forcing users into a rigid one-time assignment.

If the requested size exceeds the application’s sequence limit, the request is capped. If too few eligible galaxies exist, the generated sequence may end up shorter than requested, and the system reports that explicitly.

### Sequence creation and stored state

Once the selection phase is complete, the chosen galaxy identifiers are stored as the user’s sequence.

The stored sequence includes:

- the ordered list of galaxy identifiers,
- the current position in that list,
- counters for how many items have been classified,
- counters for how many items have been skipped.

This allows the interface to resume from where the user left off instead of recomputing their assignment every time they open the app.

### Updating assignment statistics after sequence creation

Creating the sequence is only part of the process. After the sequence exists, the system also updates assignment statistics for the affected galaxies.

This follow-up step increases tracking counters such as:

- the total number of times a galaxy has been assigned,
- the per-user assignment count for that galaxy.

These updates are performed in batches. This protects the system from doing too much work in one operation and helps keep assignment accounting consistent.

Conceptually, the workflow is:

1. choose the galaxies,
2. save the user’s ordered sequence,
3. update galaxy-level assignment counters in batches.

That distinction is important because the sequence itself is the user-facing object, while the assignment counters are the bookkeeping layer that supports future balancing.

### What happens when a sequence is extended

Extending a user’s sequence later uses the same core logic as initial generation.

The main difference is that the extension process must also exclude galaxies already present in that user’s existing sequence. Newly selected galaxies are appended to the end of the current list, and the corresponding assignment statistics are then updated in batches.

### What happens when a sequence is shortened

If administrators reduce a sequence, galaxies removed from the tail of the sequence no longer count as pending assignments for that user. The bookkeeping layer is adjusted accordingly so the assignment statistics remain meaningful.

### Failure, warnings, and partial results

The assignment process is designed to be explicit about imperfect outcomes.

It can report warnings such as:

- only part of the requested sequence could be generated,
- the under-target pool was exhausted,
- the system had to use over-target galaxies,
- no galaxies matched the current filters.

This is useful operationally because it distinguishes between a true system failure and a valid but limited result caused by the available data.

### Assignment procedure as pseudocode

The logic can be summarized like this:

```text
validate requested balancing parameters
check that the user can receive a sequence
load blacklisted galaxies and active filters

scan galaxies with totalAssigned < target threshold
	skip blacklisted galaxies
	skip galaxies already selected in this run
	skip galaxies outside the requested subset
	skip galaxies already assigned to this user too often
	accept remaining galaxies in ascending assignment order
	stop when the requested sequence size is reached

if sequence is still too short and over-assignment is allowed
	scan galaxies with totalAssigned >= target threshold
	apply the same filters
	keep filling the sequence until full or exhausted

save the ordered list as the user's sequence
update assignment counters for the selected galaxies in batches
```

This approach balances fairness, coverage, and practicality.

## Other Main Sections of the Website

Besides the main classification view, the site contains several additional sections that support reviewing, tracking progress, and managing the user experience.

### Browse Galaxies

The browse section allows users to search and inspect galaxies outside the strict one-by-one classification flow. It supports filtering, sorting, preview images, and quick review of results. This is useful for exploration, checking edge cases, and looking up specific objects.

### Skipped Galaxies

This section collects galaxies the user skipped during classification. It acts as a revisit queue, making it easy to return to uncertain cases later rather than losing them.

### Statistics

The statistics area shows progress and performance information.

Depending on user permissions and project settings, this can include:

- personal classification statistics,
- project overview statistics,
- user-level summaries,
- assignment-related statistics.

This section helps both individual contributors and project managers understand how work is progressing.

### Notifications

The notifications area is used for project messages and status updates relevant to the user experience, such as changes to availability or workflow-related communication.

### Settings

The settings area allows users to control personal preferences, including general display behavior and image-quality preferences. It also includes account details and a local-storage section for browser-stored data related to the application experience.

### Help

The help section provides built-in documentation for:

- getting started,
- classification categories and flags,
- keyboard shortcuts,
- image documentation.

This is the main place for users to learn the interface without needing to inspect technical documentation.

### Admin and Data Sections

Administrator-only areas provide access to management tools, data-related operations, issue reporting workflows, and sequence administration. These sections support project maintenance rather than everyday classification.

## Why the Application Is Structured This Way

The design reflects a practical tension: galaxy review needs enough structure to produce useful data, but enough flexibility to handle ambiguous objects.

That is why the application combines:

- structured categorical answers,
- optional flags,
- free-text comments,
- multiple image views,
- revisit paths such as skipped lists and browsing,
- assignment logic that spreads work across the dataset.

Taken together, these features create a workflow that is efficient for regular users, flexible for expert reviewers, and robust enough for a scientific labeling project.

## Summary

At a high level, the web application does four things well:

1. It presents each galaxy with several complementary image views.
2. It asks users to make a small number of structured, repeatable judgments.
3. It organizes reviewing through balanced user-specific sequences.
4. It supports the broader workflow with browsing, skipped-item recovery, statistics, settings, and help.

That combination makes it suitable not just for viewing galaxy images, but for running a complete collaborative classification campaign.