# Data Analysis Page

## Purpose

The Statistics / Data Analysis page builds a local analysis snapshot from the galaxy catalog and the classification table, then evaluates every histogram, query card, and split comparison entirely in the browser. The page is designed for exploratory analysis, reproducible exports, and portable offline review of the same prepared dataset.

This document describes:

- how the page loads and stores data
- how every major section is computed
- the predefined query cards and classification split cards
- how threshold-split distributions work
- how to reproduce the analysis in other tools, including Python and Jupyter
- the main limitations and interpretation risks

## What The Page Loads

The local analysis dataset is built from two logical tables.

### Galaxy fields used by the analysis

Each galaxy row contributes these fields:

- `_id`
- `_creationTime`
- `id`
- `numericId`
- `ra`
- `dec`
- `reff`
- `q`
- `nucleus`
- `mag`
- `mean_mue`
- `paper`
- `totalClassifications`
- `numVisibleNucleus`
- `numAwesomeFlag`
- `numFailedFitting`

### Classification fields used by the analysis

Each classification row contributes these fields:

- `_id`
- `_creationTime`
- `userId`
- `galaxyExternalId`
- `lsb_class`
- `morphology`
- `awesome_flag`
- `valid_redshift`
- `visible_nucleus`
- `failed_fitting`
- `comments`

### Data loading behavior

- Live loading fetches the full galaxy table and the full classification table in pages of up to 2,500 rows each.
- The page does not auto-refresh. A loaded snapshot remains fixed until you explicitly reload, upload a ZIP, or load from browser cache.
- Query edits, split cards, and exports are always local to the current browser session.
- The current prepared dataset can be saved to browser cache, exported as a ZIP snapshot, exported as an HTML report, or exported as JSON statistics.

## Data Sources Available In The UI

The page can operate from three sources.

### Live fetch

- Pulls the current galaxy and classification tables from the backend.
- Produces a fresh local snapshot with a new `loadedAt` timestamp.

### Browser cache

- Stores the prepared dataset in IndexedDB and stores metadata in local storage.
- Lets you reopen the exact same prepared dataset without fetching the backend again.
- Deleting the cache removes only the browser copy, not the database rows.

### Portable ZIP snapshot

- Serializes the prepared dataset so it can be moved to another browser or machine.
- Useful when you want another person to reproduce the same analysis state without re-running database pagination.

## Analysis Workflow On The Page

The page is organized into five major layers.

1. Dataset loading and export controls.
2. Dataset summary cards.
3. Global histograms.
4. Interactive query cards.
5. Threshold-split comparison cards.

### Dataset summary cards

The summary area reports:

- total galaxy rows in the catalog
- total classification rows
- number of catalog rows marked with nucleus
- number of distinct paper values available to the filters
- number of classified galaxies in the loaded snapshot
- number of unclassified galaxies
- maximum classifications on one galaxy
- total comments, average comment length, and maximum comment length
- awesome-vote totals
- visible-nucleus yes totals
- failed-fitting yes totals
- orphaned galaxy and classification counts

### Integrity watch

If classifications reference a galaxy ID that is not present in the loaded galaxy table, those classifications are counted as orphaned. They are reported in the Integrity watch summary, but they do not appear in the per-galaxy analysis cards because no galaxy record can be built for them.

## Core Per-Galaxy Aggregation Rules

The page first groups all classifications by `galaxyExternalId`, then computes one derived analysis record per galaxy.

### Comment normalization

- `comments` are trimmed.
- Empty or whitespace-only comments are treated as missing.
- Comment searches are case-insensitive and operate on the trimmed lowercase text.

### Count aggregates

For each galaxy, the page computes:

- `totalClassifications`
- `lsbVotes`
- `nonLsbVotes`
- `failedFittingVotes`
- `failedFittingComparableVotes`
- `featurelessVotes`
- `irregularVotes`
- `ltgVotes`
- `etgVotes`
- `awesomeVotes`
- `validRedshiftVotes`
- `commentedClassifications`
- `totalCommentLength`
- `maxCommentLength`
- `visibleNucleusVotes`
- `visibleNucleusComparableVotes`

### Important decision-tree semantics

- Top-level agreement is based only on explicit `Is-LSB` votes.
- `lsb_class == 1` counts as LSB.
- `lsb_class == 0` counts as Non-LSB.
- Legacy or non-comparable values such as `lsb_class == -1` are not counted as `Is-LSB` votes.
- `failed_fitting` is tracked separately and does not act as an `Is-LSB` vote.

### Morphology mapping

Morphology is counted as:

- `-1` -> Featureless
- `0` -> Irregular / not sure
- `1` -> LTG
- `2` -> ETG

Other morphology values are ignored by the aggregate counters.

### Derived decision summaries

For each galaxy, the page derives four decision summaries.

#### Dominant Is-LSB

Based on `lsbVotes` and `nonLsbVotes` only.

- `lsb` if LSB has the unique largest count
- `nonLsb` if Non-LSB has the unique largest count
- `split` if the largest count is tied
- `noComparableVotes` if there are no comparable `Is-LSB` votes

The agreement count is the winning vote count. The agreement rate is:

$$
\text{lsbAgreementRate} = \frac{\text{agreementCount}}{\text{lsbComparableVotes}}
$$

when `lsbComparableVotes > 0`, otherwise null.

#### Dominant morphology

Based on the four morphology vote counts and all classifications as the denominator.

- `featureless`
- `irregular`
- `ltg`
- `etg`
- `split` if the largest morphology count is tied
- `noClassifications` if there are no classifications

The agreement rate is:

$$
\text{morphologyAgreementRate} = \frac{\text{morphologyAgreementCount}}{\text{totalClassifications}}
$$

when `totalClassifications > 0`, otherwise null.

#### Visible nucleus summary

Based only on rows where `visible_nucleus` is present.

- `yes`
- `no`
- `split`
- `noResponses`

The agreement rate is:

$$
\text{visibleNucleusAgreementRate} = \frac{\text{visibleNucleusAgreementCount}}{\text{visibleNucleusComparableVotes}}
$$

when `visibleNucleusComparableVotes > 0`, otherwise null.

#### Failed-fitting summary

Based only on rows where `failed_fitting` is present.

- `yes`
- `no`
- `split`
- `noResponses`

The agreement rate is:

$$
\text{failedFittingAgreementRate} = \frac{\text{failedFittingAgreementCount}}{\text{failedFittingComparableVotes}}
$$

when `failedFittingComparableVotes > 0`, otherwise null.

### Nucleus confirmation rate

This metric is not based on the catalog value directly. It is the fraction of answered visible-nucleus responses that are `true`:

$$
\text{nucleusConfirmationRate} = \frac{\text{visibleNucleusVotes}}{\text{visibleNucleusComparableVotes}}
$$

when `visibleNucleusComparableVotes > 0`, otherwise null.

### Other derived fields

- `firstClassificationTime` is the earliest `_creationTime` among the galaxy's sorted votes.
- `averageCommentLength` is computed only over non-empty comments.
- `commentSearchTexts` is the list of trimmed lowercase non-empty comments.

## Global Histograms

The page shows several summary histograms before any query cards are applied.

- Classification coverage by item
- Is-LSB agreement counts
- Morphology agreement counts inside LSB-majority galaxies
- Visible-nucleus agreement counts inside LSB-majority galaxies
- Awesome-vote distribution
- Failed-fitting vote distribution
- Catalog nucleus confirmations

### Histogram bucketing rules

Per-galaxy histogram bucketing depends on the metric type.

#### Ratio metrics

These use 10 percentage buckets:

- `0-10%`
- `10-20%`
- `20-30%`
- `30-40%`
- `40-50%`
- `50-60%`
- `60-70%`
- `70-80%`
- `80-90%`
- `90-100%`

The value is clamped to the interval `[0, 1]` before binning.

#### Exact-count metrics

`totalClassifications` and `commentedClassifications` use one bucket per integer value from `0` to the observed maximum.

#### Comment-length metrics

`maxCommentLength` and `averageCommentLength` use approximately 8 bins, with a bucket size chosen from this step list:

- `10`
- `25`
- `50`
- `100`
- `250`
- `500`
- `1000`

#### Other count metrics

Most other integer metrics use exact buckets from `0` through `12`, with a final overflow bucket labeled `12+` if needed.

## Interactive Query Cards

Each query card filters the same loaded dataset, computes a histogram for its selected metric, ranks matching galaxies, and shows summary totals.

### Shared filters used by every query card

Before the numeric conditions run, every query card can restrict the candidate galaxies by:

- `paper`
- `catalogNucleus`
- `dominantLsb`

The shared filter logic is:

- `paper == __any__` means no paper filter
- otherwise the paper must exactly match the stored galaxy paper string, with missing paper treated as an empty string
- `catalogNucleus == yes` keeps only `galaxy.nucleus == true`
- `catalogNucleus == no` keeps only `galaxy.nucleus == false`
- `dominantLsb` can be `any`, `lsb`, `nonLsb`, `split`, or `noComparableVotes`

### Query conditions

Each query card has one or more conditions. A galaxy matches the card only if it satisfies all conditions.

Available condition operators:

- `atLeast`
- `exactly`
- `atMost`

Available per-galaxy condition metrics:

- `totalClassifications`
- `lsbComparableVotes`
- `lsbVotes`
- `nonLsbVotes`
- `failedFittingVotes`
- `lsbAgreementCount`
- `featurelessVotes`
- `irregularVotes`
- `ltgVotes`
- `etgVotes`
- `morphologyAgreementCount`
- `awesomeVotes`
- `validRedshiftVotes`
- `commentedClassifications`
- `maxCommentLength`
- `averageCommentLength`
- `visibleNucleusVotes`
- `visibleNucleusComparableVotes`
- `visibleNucleusAgreementCount`
- `failedFittingComparableVotes`
- `failedFittingAgreementCount`
- `lsbAgreementRate`
- `morphologyAgreementRate`
- `visibleNucleusAgreementRate`
- `failedFittingAgreementRate`
- `nucleusConfirmationRate`
- `galaxyCreationTime`
- `firstClassificationTime`

Time conditions compare raw timestamps.

### Comment rules

Query cards can optionally add comment rules.

- Terms are split on newlines, commas, or semicolons.
- Matching is case-insensitive substring matching.
- `containsAny` means at least one comment on the galaxy contains at least one term.
- `notContainsAny` means no comment on the galaxy contains any listed term.

### Query sorting

Matched galaxies are sorted by the selected metric and direction.

Tie-breaking rules:

- if sorting by an agreement rate, the corresponding agreement count is used as the first tie-breaker in descending order
- then `totalClassifications` descending
- then `numericId` ascending
- then `id` lexicographically

### Predefined query cards

The page initializes with these predefined query cards.

| Card | Filters and thresholds | Sort / histogram |
| --- | --- | --- |
| Strongest Is-LSB consensus | `lsbComparableVotes >= 3` | sort by `lsbAgreementRate` descending, histogram `lsbAgreementCount` |
| Split Is-LSB decisions | `lsbComparableVotes >= 3` | sort by `lsbAgreementRate` ascending, histogram `lsbAgreementCount` |
| LSB-majority morphology consensus | `dominantLsb = lsb`, `lsbAgreementCount >= 3`, `totalClassifications >= 3` | sort by `morphologyAgreementRate` descending, histogram `morphologyAgreementCount` |
| Visible-nucleus agreement inside LSB-majority galaxies | `dominantLsb = lsb`, `lsbAgreementCount >= 3`, `visibleNucleusComparableVotes >= 2` | sort by `visibleNucleusAgreementRate` descending, histogram `visibleNucleusAgreementCount` |
| Awesome-flag standouts with stable Is-LSB calls | `awesomeVotes >= 2`, `lsbAgreementCount >= 3` | sort by `awesomeVotes` descending, histogram `awesomeVotes` |
| Failed-fitting pileups | `failedFittingVotes >= 2` | sort by `failedFittingVotes` descending, histogram `failedFittingVotes` |
| Highly commented targets | `commentedClassifications >= 2` | sort by `commentedClassifications` descending, histogram `commentedClassifications` |
| Longest comment standouts | `commentedClassifications >= 1` | sort by `maxCommentLength` descending, histogram `maxCommentLength` |
| Consistently detailed comments | `commentedClassifications >= 2` | sort by `averageCommentLength` descending, histogram `averageCommentLength` |

## Galaxy Threshold-Split Distributions

Threshold-split distribution cards compare two subsets of galaxies inside the same scoped population.

### Current default state

The page currently creates no predefined galaxy threshold-split cards by default. These cards are user-created from the "Threshold-split distributions" section.

### Evaluation order

Each card uses three stages.

1. Apply shared filters: `paper`, `catalogNucleus`, `dominantLsb`.
2. Apply `scopeConditions` to define the scoped population.
3. Apply `conditions` inside that scope.

The result is:

- `scopedRecords`: galaxies that pass the shared filters and all `scopeConditions`
- `matchedRecords`: scoped galaxies that pass all split conditions
- `failedRecords`: scoped galaxies that fail at least one split condition

This distinction matters:

- `scopeConditions` decide which galaxies are visible at all
- `conditions` decide how the remaining galaxies are split into pass and fail subsets

### What the card shows

Each galaxy split card shows:

- scoped, matched, and failed counts
- a combined histogram comparing matched versus failed subsets
- counts or relative frequencies
- per-subset mean, median, minimum, and maximum for the selected histogram metric
- preview tables of the highest-ranked matched and failed galaxies

### Histogram scale options

- `count`: raw bin counts
- `relativeFrequency`: each subset is normalized by its own subset total

### Preview sorting

Preview galaxies are sorted descending by the selected histogram metric, regardless of the split condition direction.

## Classification Threshold-Split Distributions

Classification split cards operate at the individual-classification level rather than the galaxy level.

### Classification points

After shared galaxy-level filters are applied, each classification row becomes one classification point containing:

- the raw vote row
- a reference to its parent galaxy record
- a normalized comment
- `commentLength`

### Evaluation order

Each classification card uses the same three-stage structure.

1. Apply shared galaxy-level filters: `paper`, `catalogNucleus`, `dominantLsb`.
2. Convert all classifications on the remaining galaxies into classification points.
3. Apply `scopeConditions` and then split `conditions` to those points.

The result is:

- `scopedPoints`
- `matchedPoints`
- `failedPoints`

### Classification metrics available for conditions and plots

- `failedFittingFlag`
- `failedFittingAnsweredFlag`
- `visibleNucleusFlag`
- `visibleNucleusAnsweredFlag`
- `awesomeFlag`
- `validRedshiftFlag`
- `hasComment`
- `commentLength`
- `classificationCreationTime` for conditions and X-axis use

Binary metrics are encoded as `1` for yes or present and `0` for no or absent.

### Visualization modes

Classification split cards support four visualizations.

#### Histogram comparison

Compares matched and failed classification subsets as a standard histogram for the chosen classification metric.

#### Frequency bubbles

Builds a 2D grid over:

- X axis: a classification condition metric
- Y axis: a classification histogram metric

Each cell stores total count, within-X-bin relative frequency, and subset-specific relative frequencies.

#### Frequency lines

Uses the same binning logic as the frequency bubble view, but visualizes the frequencies as line series.

#### Count lines

Shows scoped, matched, and failed classification counts across the chosen X-axis bins.

### X-axis binning rules

If the X-axis metric is not time, the page bins by the metric's discrete buckets.

If the X-axis metric is `classificationCreationTime`, there are two possible time-binning behaviors.

#### Ordered time bins

Used when the binning mode is `binCount` or `pointsPerBin`.

- Classifications are sorted by creation time.
- Bins contain roughly equal numbers of classifications.
- Quiet periods therefore do not stretch the chart.
- Bin durations are not necessarily equal in clock time.

#### Fixed time bins

Used when the binning mode is `timeInterval`.

- The first bin starts at local midnight of the first classification day in the scoped data.
- Each bin spans a fixed number of calendar days.
- This is the best option when you want a physical time scale.

### Classification subset summary statistics

For both matched and failed classification subsets, the page reports:

- record count
- share of scope
- mean of the selected classification metric
- median
- minimum
- maximum

For binary classification metrics, the mean is the empirical positive rate.

### Predefined classification split cards

The page initializes with these predefined classification split cards.

| Card | Scope conditions | Split conditions | Visualization |
| --- | --- | --- | --- |
| Failed-fitting votes before Feb 16, 2026 | none | `classificationCreationTime <= 2026-02-15 23:59:59.999` local time equivalent of the stored threshold | `frequencyLine`, X = `classificationCreationTime`, Y = `failedFittingFlag`, relative frequency, ordered time bins |
| Classifications per day | none | none | `countLine`, X = `classificationCreationTime`, fixed 1-day bins |

Important detail for the second card:

- with no split conditions, every scoped classification lands in the matching subset
- the failing subset is empty
- the card effectively becomes a scoped activity-over-time plot

## Reproducing The Analysis Outside The App

This section describes how to reproduce the same outputs in Python, a notebook, SQL, or another analysis tool.

### Required raw inputs

You need the full galaxy table and the full classification table, or a portable ZIP exported from the page.

Minimum required columns are the fields listed earlier in this document.

### Reproduction recipe

1. Load all galaxy rows.
2. Load all classification rows.
3. Group classifications by `galaxyExternalId`.
4. For each galaxy, accumulate aggregate counters exactly as described above.
5. Sort each galaxy's classifications by `_creationTime` ascending.
6. Build one derived analysis record per galaxy.
7. Compute query-card matches or split-card subsets from those derived records.
8. Build histograms using the same bucket rules.
9. For classification split cards, expand galaxy records back to classification points after shared galaxy-level filters are applied.

### Python/Jupyter outline

```python
import math
import pandas as pd

galaxies = pd.read_json("galaxies.json")
votes = pd.read_json("classifications.json")

votes["normalized_comment"] = (
    votes["comments"]
    .fillna("")
    .astype(str)
    .str.strip()
)
votes.loc[votes["normalized_comment"] == "", "normalized_comment"] = pd.NA

votes["is_lsb_vote"] = votes["lsb_class"] == 1
votes["is_non_lsb_vote"] = votes["lsb_class"] == 0
votes["failed_fitting_answered"] = votes["failed_fitting"].notna()
votes["failed_fitting_yes"] = votes["failed_fitting"] == True
votes["visible_nucleus_answered"] = votes["visible_nucleus"].notna()
votes["visible_nucleus_yes"] = votes["visible_nucleus"] == True
votes["has_comment"] = votes["normalized_comment"].notna()
votes["comment_length"] = votes["normalized_comment"].fillna("").str.len()

votes["featureless_vote"] = votes["morphology"] == -1
votes["irregular_vote"] = votes["morphology"] == 0
votes["ltg_vote"] = votes["morphology"] == 1
votes["etg_vote"] = votes["morphology"] == 2

agg = votes.groupby("galaxyExternalId").agg(
    totalClassifications=("_id", "count"),
    lsbVotes=("is_lsb_vote", "sum"),
    nonLsbVotes=("is_non_lsb_vote", "sum"),
    failedFittingVotes=("failed_fitting_yes", "sum"),
    failedFittingComparableVotes=("failed_fitting_answered", "sum"),
    featurelessVotes=("featureless_vote", "sum"),
    irregularVotes=("irregular_vote", "sum"),
    ltgVotes=("ltg_vote", "sum"),
    etgVotes=("etg_vote", "sum"),
    awesomeVotes=("awesome_flag", "sum"),
    validRedshiftVotes=("valid_redshift", "sum"),
    commentedClassifications=("has_comment", "sum"),
    totalCommentLength=("comment_length", "sum"),
    maxCommentLength=("comment_length", "max"),
    visibleNucleusVotes=("visible_nucleus_yes", "sum"),
    visibleNucleusComparableVotes=("visible_nucleus_answered", "sum"),
    firstClassificationTime=("_creationTime", "min"),
)

records = galaxies.merge(agg, how="left", left_on="id", right_index=True)
records = records.fillna({
    "totalClassifications": 0,
    "lsbVotes": 0,
    "nonLsbVotes": 0,
    "failedFittingVotes": 0,
    "failedFittingComparableVotes": 0,
    "featurelessVotes": 0,
    "irregularVotes": 0,
    "ltgVotes": 0,
    "etgVotes": 0,
    "awesomeVotes": 0,
    "validRedshiftVotes": 0,
    "commentedClassifications": 0,
    "totalCommentLength": 0,
    "maxCommentLength": 0,
    "visibleNucleusVotes": 0,
    "visibleNucleusComparableVotes": 0,
})

records["lsbComparableVotes"] = records["lsbVotes"] + records["nonLsbVotes"]
records["averageCommentLength"] = records.apply(
    lambda row: row.totalCommentLength / row.commentedClassifications
    if row.commentedClassifications > 0 else math.nan,
    axis=1,
)
records["lsbAgreementCount"] = records[["lsbVotes", "nonLsbVotes"]].max(axis=1)
records["lsbAgreementRate"] = records.apply(
    lambda row: row.lsbAgreementCount / row.lsbComparableVotes
    if row.lsbComparableVotes > 0 else math.nan,
    axis=1,
)
records["visibleNucleusAgreementCount"] = records.apply(
    lambda row: max(row.visibleNucleusVotes,
                    row.visibleNucleusComparableVotes - row.visibleNucleusVotes),
    axis=1,
)
records["visibleNucleusAgreementRate"] = records.apply(
    lambda row: row.visibleNucleusAgreementCount / row.visibleNucleusComparableVotes
    if row.visibleNucleusComparableVotes > 0 else math.nan,
    axis=1,
)
records["failedFittingAgreementCount"] = records.apply(
    lambda row: max(row.failedFittingVotes,
                    row.failedFittingComparableVotes - row.failedFittingVotes),
    axis=1,
)
records["failedFittingAgreementRate"] = records.apply(
    lambda row: row.failedFittingAgreementCount / row.failedFittingComparableVotes
    if row.failedFittingComparableVotes > 0 else math.nan,
    axis=1,
)
records["nucleusConfirmationRate"] = records.apply(
    lambda row: row.visibleNucleusVotes / row.visibleNucleusComparableVotes
    if row.visibleNucleusComparableVotes > 0 else math.nan,
    axis=1,
)
```

This outline reproduces the core numeric fields. To match the app exactly, you must also reproduce:

- dominant-state tie handling
- histogram bucket definitions
- the query-card filter order
- the classification-point expansion for classification split cards
- the ordered-time versus fixed-time binning distinction

### Query-card reproduction logic

To reproduce a query card exactly:

1. Start from the derived per-galaxy record table.
2. Apply shared filters: paper, catalog nucleus, dominant Is-LSB.
3. Apply all numeric or time conditions.
4. Apply all comment rules.
5. Sort using the app's sort metric and tie-break rules.
6. Build the histogram from the matched records only.
7. Compute the summary totals from the matched set.

### Galaxy split-card reproduction logic

To reproduce a galaxy threshold-split card exactly:

1. Start from the derived per-galaxy record table.
2. Apply shared filters.
3. Apply all `scopeConditions` to define the scope.
4. Inside that scope, apply all split `conditions`.
5. Build matched and failed subsets.
6. Build separate histograms for scoped, matched, and failed subsets.
7. If needed, convert to relative frequency by dividing each bin by that subset's total.
8. Compute subset summary statistics on the selected histogram metric.

### Classification split-card reproduction logic

To reproduce a classification threshold-split card exactly:

1. Start from the derived per-galaxy record table.
2. Apply shared filters at the galaxy level.
3. Expand all remaining classifications into classification points.
4. Apply `scopeConditions` to points.
5. Inside the scoped point set, apply split `conditions`.
6. Build matched and failed point subsets.
7. Build either histograms, 2D frequency grids, or count-line bins using the selected metric and binning mode.

## Exported Reports And Snapshots

The HTML report mirrors the major sections of the page:

- dataset overview
- dataset statistics
- global histograms
- query cards
- galaxy threshold-split distributions
- classification threshold-split distributions

The export includes both visible summaries and machine-readable JSON payload data, including histogram bins and top-match previews.

## Limitations And Interpretation Risks

The analysis page is practical and reproducible, but it is not a substitute for a controlled offline pipeline. The main limitations are below.

### Snapshot, not live streaming

- All results are based on a fixed local snapshot.
- New backend rows arriving after the snapshot are invisible until a reload.

### Browser-local state

- Query definitions and split cards are client-side analysis state.
- Browser cache and uploaded ZIP snapshots can become stale relative to the backend.

### Orphaned classifications are excluded from per-galaxy outputs

- Classification rows whose galaxy ID is absent from the galaxy table are counted in the integrity summary.
- They do not contribute to query cards, preview cards, or per-galaxy histograms because no analysis record can be built for them.

### Local timezone affects displayed and entered time thresholds

- Time filters and displayed labels use the local browser timezone.
- When reproducing the analysis elsewhere, make sure you interpret thresholds in the same timezone convention.

### Ordered time bins are not fixed-duration bins

- `binCount` and `pointsPerBin` on classification time plots produce ordered bins with similar numbers of classifications.
- Those bins preserve order, not equal clock duration.
- Use fixed time intervals when the analysis question depends on true elapsed time.

### Relative frequencies are subset-normalized

- In split histograms, relative frequency uses the matched subset total and the failed subset total independently.
- Relative-frequency plots therefore compare shapes, not absolute volume.

### Missing-answer semantics matter

- Visible-nucleus and failed-fitting metrics use only answered rows as denominators.
- Treating missing values as no would produce different results.

### Legacy `lsb_class` values are excluded from top-level Is-LSB agreement

- Only explicit `0` and `1` values count toward the Is-LSB consensus.
- Pipelines that collapse legacy states into `no` or `failed` will not match this page.

### Morphology agreement uses all classifications as the denominator

- Morphology agreement does not use a separate answered-only denominator.
- If you choose a different denominator in an external pipeline, agreement rates will differ.

### Histogram buckets are intentionally presentation-oriented

- Some metrics use exact integer bins.
- Some use overflow bins or adaptive comment-length bins.
- Reproducing the counts is straightforward, but reproducing the exact chart shape requires using the same bucket rules.

### Count-line cards with no split conditions are valid

- A classification split card can intentionally have no split conditions.
- In that case, all scoped rows are in the matched subset and the failed subset is empty.
- This is expected behavior, not a bug.

## Recommended Reproducibility Practice

If you need exact reproducibility across people or machines:

1. Export the prepared dataset as a ZIP from the page.
2. Record the generated report HTML or JSON alongside the ZIP.
3. Record the local timezone used for any time-based thresholds.
4. Record the exact card configuration, especially `scopeConditions` versus split `conditions`.
5. Preserve whether each plot used counts, relative frequency, ordered time bins, or fixed time bins.

Following those steps is usually sufficient to reproduce the analysis in Python, SQL, R, or another notebook environment with matching results.