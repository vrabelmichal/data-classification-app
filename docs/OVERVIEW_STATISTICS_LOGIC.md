# Overview Statistics Logic

This document specifies the Overview Statistics feature in a language-independent way so that the same statistics and plots can be reproduced from the same dataset in any environment, including Python, R, Julia, C++, SQL, JavaScript, or spreadsheets.

The goal is not to describe the UI code first. The goal is to describe:

1. what input data is required,
2. how the data must be normalized,
3. which mathematical quantities are computed,
4. how each quantity is rendered in the overview,
5. which parts are paper-scoped and which parts remain global,
6. and only then how this repository implements those rules.

## Purpose

The Overview Statistics page is designed to answer two questions:

1. How large is the usable galaxy catalog that still matters for the project?
2. How much progress has been made toward classifying that usable catalog?

The key term is usable. In this project, galaxies on the blacklist are excluded from the catalog-progress part of the overview. They may still exist in the database and may still have historical classifications, but they must not increase the denominator for overview progress metrics or inflate the remaining work estimate.

This immediately creates two kinds of overview quantities:

- galaxy-catalog quantities, which operate on eligible galaxies and therefore exclude blacklisted galaxies,
- classification-record quantities, which summarize stored classifications and users and are global in the current product.

To reproduce the current overview exactly, that distinction must be preserved.

## Required Input Data

You need the following logical datasets.

### Galaxy catalog

For each galaxy, you need at least:

- a unique galaxy identifier,
- a paper label or paper category,
- the total number of classifications attached to that galaxy.

If a galaxy has no paper label, it should still exist in the catalog and must be placed into an “unassigned” paper bucket.

### Blacklist

For each blacklist row, you need at least:

- the galaxy identifier being blacklisted.

The blacklist must be interpreted as a set of unique galaxy identifiers for overview purposes. Multiple blacklist rows for the same galaxy must count as a single excluded galaxy.

### Classification records

For each classification, you need at least:

- a timestamp,
- the user identifier,
- the LSB class value,
- the morphology value,
- boolean flag values such as awesome, visible nucleus, valid redshift, and failed fitting.

These records are used for throughput, top-classifier rankings, and classification-breakdown panels.

### User or profile summaries

For each user, you need at least:

- a cumulative classification count,
- a last-active timestamp,
- a display name or fallback identifier.

If your dataset does not already contain user summaries, you can derive them from the classification table.

## Preprocessing Rules

Before computing any overview statistics, normalize the data using the following rules.

### 1. Deduplicate the blacklist

If the blacklist contains repeated rows for the same galaxy, those rows must collapse into a single excluded galaxy.

Example:

- blacklist rows: `galaxy_a`, `galaxy_a`, `galaxy_b`
- effective blacklist set: `galaxy_a`, `galaxy_b`

### 2. Resolve blacklist identifiers against the galaxy catalog

Some blacklist identifiers may no longer correspond to a galaxy in the current catalog. Those stale blacklist entries must not be assigned to any paper bucket when computing paper-level blacklist counts.

In other words:

- if a blacklisted identifier resolves to a galaxy, use that galaxy’s paper,
- if it does not resolve to a galaxy, ignore it for paper-count calculations.

### 3. Normalize paper values

Every galaxy must belong to exactly one paper bucket.

- use its paper label if present,
- otherwise place it into an “unassigned” bucket.

### 4. Define the eligible galaxy set

Let $G$ be the set of all galaxies in the catalog.

Let $B$ be the set of unique blacklisted galaxy identifiers that resolve to actual galaxies.

Then the eligible galaxy set is:

$$
E = G \setminus B
$$

All catalog-progress statistics must be computed from $E$, not from $G$.

## Scope Rules

The Overview page mixes paper-scoped and global sections.

### Paper-scoped sections

These respond to the currently selected paper filter:

- Galaxy catalog by paper card counts,
- Summary Cards,
- Target Progress.

### Global sections

These remain global in the current product, even when a paper is selected:

- Recent Throughput,
- Top Classifiers,
- Active Users,
- Classification Breakdowns.

This is a product decision, not a mathematical necessity. If you want to reproduce the current application exactly, keep these sections global.

## Galaxy Catalog by Paper

This section shows how the raw catalog is distributed across papers and how much of each paper remains eligible after blacklist exclusion.

For each paper $p$, define:

- $T_p$: total number of galaxies in paper $p$ in the raw catalog,
- $B_p$: number of unique blacklisted galaxies in paper $p$,
- $A_p$: adjusted number of eligible galaxies in paper $p$.

The adjusted count is:

$$
A_p = \max(T_p - B_p, 0)
$$

### Totals across all papers

Define:

$$
T = \sum_p T_p
$$

$$
B = \sum_p B_p
$$

$$
A = \sum_p A_p
$$

These correspond to:

- total raw catalog size,
- total unique blacklisted catalog galaxies,
- total effective catalog size.

### Stacked-bar plot semantics

The stacked bar in this section shows each paper’s share of the raw catalog, not the adjusted eligible catalog.

For each paper $p$, the segment width is:

$$
S_p = \frac{T_p}{T}
$$

Here $S_p$ is the raw-catalog share of paper $p$.

This is important. The bar answers “what share of the catalog belongs to this paper?” rather than “what share of the eligible catalog belongs to this paper?”.

### Card contents

Each paper card exposes three dataset-level counts:

- `total` = $T_p$
- `blacklisted` = $B_p$
- `adjusted` = $A_p$

The “All papers” card shows the same three quantities aggregated across all papers:

- `total` = $T$
- `blacklisted` = $B$
- `adjusted` = $A$

## Summary Cards

The Summary Cards section uses the currently selected paper scope if one is active; otherwise it uses the whole eligible catalog.

Let $S$ be the current eligible scope:

- if no paper is selected, $S = E$,
- if paper $p$ is selected, $S = \{g \in E : \text{paper}(g)=p\}$.

Define:

- $N = |S|$: number of eligible galaxies in scope,
- $c(g)$: total classifications for galaxy $g$,
- $C_1 = |\{g \in S : c(g) \ge 1\}|$: number of eligible galaxies with at least one classification,
- $C_0 = N - C_1$: number of eligible galaxies with zero classifications.

Then the summary cards show:

- `Galaxies` = $N$
- `Classified` = $C_1$
- `Unclassified` = $C_0$
- `Completion` = $100 \times C_1 / N$

If $N = 0$, completion should be reported as 0.

## Target Progress

This section answers: how close is the eligible galaxy set to a target of at least $k$ classifications per galaxy?

Let:

- $k$: selected target number of classifications,
- $S$: current eligible scope,
- $N = |S|$,
- $c(g)$: total classifications for galaxy $g$.

### Total classifications in scope

$$
C_{\text{total}} = \sum_{g \in S} c(g)
$$

Here $C_{\text{total}}$ is the total number of classifications attached to galaxies in the current eligible scope.

### Galaxies with at least one classification

$$
C_1 = |\{g \in S : c(g) \ge 1\}|
$$

### Galaxies at target

$$
C_k = |\{g \in S : c(g) \ge k\}|
$$

### Primary target percentage

The large target-percentage number in the panel is galaxy-level target attainment:

$$
100 \times \frac{C_k}{N}
$$

This is not the same as label volume.

### Target classifications total

If every eligible galaxy reached exactly the target, the required label volume would be:

$$
T_k = N \times k
$$

Here $T_k$ is the total number of classifications that would be needed if every eligible galaxy reached target $k$ exactly.

### Label volume percentage

The overview also reports raw label volume relative to the target requirement:

$$
100 \times \frac{C_{\text{total}}}{T_k}
$$

This percentage can be higher than the galaxy-level target attainment because repeat classifications on already-covered galaxies still contribute to the numerator.

### Galaxies below target

$$
G_{\text{below},k} = N - C_k
$$

Here $G_{\text{below},k}$ is the number of eligible galaxies that are still below target $k$.

### Repeat classifications

Repeat classifications are all classifications beyond the first classification on each eligible galaxy:

$$
R_{\text{repeat}} = C_{\text{total}} - C_1
$$

Here $R_{\text{repeat}}$ is the number of repeat classifications, meaning all classifications beyond the first one on each eligible galaxy.

### Galaxies with multiple classifications

$$
G_{\ge 2} = |\{g \in S : c(g) \ge 2\}|
$$

Here $G_{\ge 2}$ is the number of eligible galaxies with at least two classifications.

### Remaining classifications to target

For each eligible galaxy $g$, define the missing number of classifications required to reach target $k$ as:

$$
m(g) = \max(k - c(g), 0)
$$

Then the remaining classifications to target are:

$$
R_k = \sum_{g \in S} m(g)
$$

Here $R_k$ is the number of additional classifications still needed for the current eligible scope to reach target $k$.

This is the metric most sensitive to blacklist handling. Blacklisted galaxies must be removed from $S$ before this sum is computed.

### At least one classification progress bar

The second progress bar shows simple coverage:

$$
100 \times \frac{C_1}{N}
$$

### Average classifications per galaxy

$$
\bar{c} = \frac{C_{\text{total}}}{N}
$$

Here $\bar{c}$ is the mean number of classifications per eligible galaxy in the current scope.

If $N = 0$, report 0.

### Active users and average per active user

The Target Progress panel also shows an activity metric based on users.

Let:

- $U_{\text{active}}$: number of users with at least one classification overall.

Then:

- `Active users` = $U_{\text{active}}$
- `Avg per active user` = $C_{\text{total}} / U_{\text{active}}$

In the current app, $U_{\text{active}}$ is global and does not change when a paper is selected.

## Recent Throughput

This section is global in the current product.

It is computed from classification timestamps, not from eligible-galaxy scope.

Let `now` be the time at which the overview is generated.

### Past 24h

Count classification records with timestamps in the closed interval:

$$
[\text{now} - 24\text{h}, \text{now}]
$$

### Past 7d

Count classification records with timestamps in:

$$
[\text{now} - 7\text{d}, \text{now}]
$$

### Daily activity series

Construct 7 trailing daily windows:

- day 1: $[\text{now} - 7d, \text{now} - 6d)$
- day 2: $[\text{now} - 6d, \text{now} - 5d)$
- ...
- day 7: $[\text{now} - 1d, \text{now})$

For each window, count the number of classification records in that half-open interval.

### Plot semantics

The plot shows one bar per day.

Let $d_i$ be the exact count for day $i$, and let:

$$
M = \max_i d_i
$$

Then the rendered bar width for day $i$ is proportional to:

$$
\frac{d_i}{M}
$$

The label next to the bar is the exact daily count $d_i$.

## Top Classifiers

This section is global in the current product.

For each user $u$, define:

Let $L(u)$ be the total number of classifications created by user $u$.

Sort users in descending order of $L(u)$ and take the top 5.

For each displayed user, show:

- display name or fallback identifier,
- total labels $L(u)$,
- last active timestamp.

If you need deterministic tie-breaking in your own implementation, use a stable secondary key such as user id.

## Classification Breakdowns

These sections are global in the current product.

They are computed from classification records rather than from eligible galaxies. Therefore they describe the classification table, not the blacklist-adjusted galaxy catalog.

To reproduce the current app exactly:

- do not apply the paper filter to these panels,
- do not replace them with galaxy-level aggregates,
- and do not expect their totals to match paper-scoped eligible-galaxy denominators.

### LSB Classification

Each classification record has an LSB class value.

The current category mapping is:

- `1` = LSB
- `0` = non-LSB
- `-1` = legacy non-LSB value

For the panel:

- `LSB` = number of classifications with LSB class `1`
- `Non-LSB` = number of classifications with LSB class `0` plus number with legacy value `-1`

This legacy folding is required to reproduce the current application exactly.

### Morphology Classification

The current morphology mapping is:

- `-1` = featureless
- `0` = irregular
- `1` = spiral
- `2` = elliptical

Count classification records in each category.

### Composition plot semantics

Both the LSB and morphology panels show:

- a stacked strip whose segment widths represent category shares of the panel total,
- a legend-like list with raw counts and percentages.

If category $i$ has count $x_i$ and the panel total is:

$$
X = \sum_i x_i
$$

then the displayed percentage is:

$$
100 \times \frac{x_i}{X}
$$

### Classification Flags

Each flag is counted independently over classification records.

For example:

- `Awesome` = number of classifications where awesome is true
- `Visible Nucleus` = number of classifications where visible nucleus is true
- `Valid Redshift` = number of classifications where valid redshift is true
- `Failed Fitting` = number of classifications where failed fitting is true

If a flag count is $f_i$ and the denominator for the panel is total classifications $C$, the displayed percentage is:

$$
100 \times \frac{f_i}{C}
$$

Because flags can overlap, these percentages do not sum to 100%.

## Reproducibility Workflow

To reproduce the Overview page from a raw dataset, use this order.

### Step 1. Build the unique blacklist set

Deduplicate blacklist rows by galaxy identifier.

### Step 2. Resolve blacklist entries against the current galaxy catalog

Ignore unresolved blacklist identifiers when building paper-level blacklist counts.

### Step 3. Build paper-level catalog counts

For every paper bucket, compute:

- raw total galaxies,
- unique blacklisted galaxies,
- adjusted eligible galaxies.

### Step 4. Build the eligible scope

Use all non-blacklisted galaxies for global scope, or all non-blacklisted galaxies in the selected paper for paper scope.

### Step 5. Compute per-galaxy classification counts

For every eligible galaxy in scope, compute its total classification count.

### Step 6. Compute summary counters

From those per-galaxy counts, compute:

- eligible galaxies,
- classified galaxies,
- unclassified galaxies,
- completion,
- total classifications,
- average classifications per galaxy.

### Step 7. Compute target-progress metrics

For the chosen target $k$, compute:

- galaxies at target,
- galaxies below target,
- total target label volume,
- repeat classifications,
- remaining classifications to target.

### Step 8. Compute global classification-level panels

From the classification table and user summaries, compute:

- throughput over the last 24h and 7d,
- trailing 7-day daily counts,
- top classifiers,
- LSB breakdown,
- morphology breakdown,
- flag counts.

## Worked Example

Suppose one paper contains 35,340 raw catalog galaxies and 1,000 of them are blacklisted.

Then:

$$
T_p = 35{,}340
$$

$$
B_p = 1{,}000
$$

$$
A_p = 34{,}340
$$

Now suppose 32,946 eligible galaxies in that paper already have at least one classification.

Then:

- eligible galaxies = 34,340
- classified galaxies = 32,946
- unclassified galaxies = 1,394

If the target is one classification per galaxy, then:

$$
M_1 = 34{,}340 - 32{,}946 = 1{,}394
$$

Here $M_1$ is the remaining number of classifications needed to reach target $k=1$.

That is the correct result because the blacklist has already been removed from the scope.

If instead the same 32,946 classified galaxies were incorrectly compared against the raw catalog size, the result would be wrong:

$$
35{,}340 - 32{,}946 = 2{,}394
$$

The general rule is:

- remove blacklisted galaxies first,
- then compute progress and remaining work.

## Cached Versus Live Overview

The product has two modes.

### Live mode

Live mode computes statistics directly from the current database state.

### Cached mode

Cached mode reads stored snapshots that were previously computed and saved.

For reproducibility, cached mode should not be treated as a different statistical definition. It is intended to be a stored copy of the same logic.

The intended semantics are identical in both modes:

- same blacklist exclusion rules for eligible galaxies,
- same paper-level catalog counts,
- same target-progress formulas,
- same global throughput and classification summaries.

## Implementation Notes For This Repository

Everything above is enough to reproduce the overview independently of this codebase. The notes below are only for readers who want to understand how this repository implements the same logic.

### Main backend modules

The main implementation files are:

- `convex/statistics/labelingOverview/shared.ts`
- `convex/statistics/labelingOverview/totalsAndPapers.ts`
- `convex/statistics/labelingOverview/recency.ts`
- `convex/statistics/labelingOverview/topClassifiers.ts`
- `convex/statistics/labelingOverview/classificationStats.ts`
- `convex/statistics/labelingOverview/cache.ts`

### Cached histogram buckets

For cached target-progress snapshots, this repository stores classification-count histograms rather than storing all galaxy rows.

At present:

- the maximum target slider value is 25,
- bucket `0` stores galaxies with zero classifications,
- bucket `1` stores galaxies with exactly one classification,
- ...
- the final bucket stores galaxies with 25 or more classifications.

This is an implementation optimization. A separate implementation in another language can compute exact values directly from per-galaxy counts instead.

### Paper-specific live counting

For a selected paper in live mode, this repository scans galaxies page by page and accumulates:

- eligible galaxies processed,
- eligible classified galaxies,
- total classifications,
- histogram of per-galaxy classification counts.

This is done to avoid large one-shot queries.

### Refresh model

Cached overview snapshots are refreshed by a due-based scheduler:

- a lightweight cron checks every 5 minutes,
- administrators can enable or disable automatic refresh,
- administrators can configure the refresh interval in minutes,
- snapshots are recomputed only when the configured interval has elapsed.

### Global-only sections in the current app

In the current implementation, selecting a paper does not change:

- throughput,
- top classifiers,
- classification breakdown panels,
- active-user count.

That is a product choice rather than a mathematical requirement.