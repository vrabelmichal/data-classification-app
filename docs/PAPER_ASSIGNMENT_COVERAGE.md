# Paper Assignment Coverage Statistics

## Purpose

The Paper Assignment Coverage module answers a target-driven planning question:

Which non-blacklisted galaxies are still below a chosen classification target, how are those galaxies distributed across paper scopes, and how much of that under-target work is already present in users' current sequences?

This document is written as an implementation specification. The goal is to describe the data inputs, transformations, formulas, and interpretation rules precisely enough that the same analysis could be rebuilt in another stack without needing this codebase.

## What The Module Reports

For a selected paper scope and a selected target classification count $T$, the module reports four groups of results:

1. catalog composition by paper, including total, blacklisted, and adjusted counts
2. progress totals for the effective non-blacklisted scope
3. target-progress metrics derived from classification-count buckets
4. a user-facing assignment table showing current-sequence ownership and remaining under-target work

The assignment table also supports a detailed drilldown modal that lists the actual remaining galaxies contributing to a row.

## Modes And Refresh Semantics

The page exists in two routes:

- cached mode at `/statistics/paper-assignment-coverage`
- live mode at `/statistics/paper-assignment-coverage-live`

Both modes use the same computation rules.

### Cached mode

- reads a previously stored snapshot
- is intended for fast repeated review
- can be refreshed automatically by a scheduled background job

### Live mode

- recomputes the snapshot on demand when the user clicks the calculate button
- returns the fresh result immediately
- also persists the successful live result into the cached snapshot store

So the semantic difference between the two modes is freshness, not methodology.

## Required Inputs

An external implementation needs the following source data.

### 1. Galaxy catalog

For every galaxy:

- stable external identifier
- paper label, equivalent to `misc.paper`
- stored total classification count
- detailed fields used only by the modal detail table: numeric id, RA, Dec, Reff, q, nucleus, magnitude, mean surface brightness, paper, and optional `thur_cls_n`

### 2. Blacklist

A set of galaxy external ids that must be excluded from all progress and assignment calculations.

### 3. Classifications

For every classification record:

- galaxy external id
- user id
- creation time
- the flags and class labels used for aggregate classification breakdowns:
  - awesome
  - visible nucleus
  - failed fitting
  - valid redshift
  - LSB vs non-LSB
  - morphology class

### 4. Skips

For every skip record:

- galaxy external id
- user id
- creation time

Skips do not contribute to classified totals, but they do count as a user having already handled that galaxy in the current sequence.

### 5. Sequences

For every sequence record:

- user id
- sequence creation time
- ordered list of assigned galaxy external ids
- user display metadata associated with that sequence snapshot: name, email, role, active flag, experience

Only the latest sequence per user is used.

### 6. System settings

The calculation uses:

- the configured paper list
- the default paper selection for the page
- cached auto-refresh enable/disable flag
- cached auto-refresh interval

The configured paper list is used as a baseline catalog of expected paper scopes, but additional paper labels discovered in the galaxy catalog are also included.

## Core Concepts

### Raw catalog vs effective catalog

For each paper and for the global scope, the module distinguishes:

- `total`: all galaxies in the catalog for that paper label
- `blacklisted`: galaxies in that paper that appear in the blacklist
- `adjusted`: `total - blacklisted`

Only the adjusted subset participates in progress totals, target metrics, sequence coverage, and remaining-work analysis.

### Scope

A scope is either:

- global, meaning all papers combined after blacklist removal
- one specific paper label after blacklist removal

Every metric except the raw paper catalog card counts is computed per scope.

### Classification bucket

Every non-blacklisted galaxy is assigned to a classification-count bucket based on its current total classification count.

If the bucket limit constant is $B = 25$, then:

- bucket `0` means 0 classifications
- bucket `1` means 1 classification
- ...
- bucket `24` means 24 classifications
- bucket `25` means 25 or more classifications

Formally:

$$
\mathrm{bucket}(g) = \min(\lfloor c_g \rfloor, B)
$$

where $c_g$ is the stored total classification count for galaxy $g$.

These buckets are the foundation for both progress charts and target-dependent calculations.

### Current sequence

For each user, only the latest sequence by creation time is considered active.

If a user has several historical sequences, all earlier sequences are ignored for assignment-coverage purposes.

### Handled galaxy

For a given user and a galaxy currently present in that user's latest sequence, the galaxy is treated as already handled by that user if either of the following is true:

- the user submitted at least one classification for that galaxy at or after the sequence creation time
- the user submitted at least one skip for that galaxy at or after the sequence creation time

Multiple classifications or multiple skips for the same user-galaxy pair still count as only one handled event for the assignment-coverage table.

## Full Calculation Algorithm

The easiest way to reproduce the module is to compute one snapshot for the full effective catalog, then derive per-scope outputs from that snapshot.

### Step 1: build the blacklist set

Load all blacklisted galaxy ids into a set.

### Step 2: scan the galaxy catalog

For every galaxy:

1. normalize the paper label so missing or null values map to the empty-paper bucket
2. increment the raw paper total for that paper
3. if the galaxy is blacklisted, increment that paper's blacklisted count and stop there for this galaxy
4. otherwise:
	- compute its classification bucket from its stored total classification count
	- store `{paper, bucketIndex}` keyed by galaxy external id
	- add the galaxy into the global scope accumulator
	- add the galaxy into its paper scope accumulator

At the end of this step, each scope has:

- total effective galaxies
- effective classified galaxies
- total effective classifications
- classification-count bucket histogram

### Step 3: determine the latest sequence per user

Scan all sequences and keep only the sequence with the greatest creation time for each user.

Call this mapping:

$$
\mathrm{latestSequence}(u)
$$

### Step 4: derive current-sequence assignment membership

For each user's latest sequence:

1. deduplicate repeated galaxy ids inside the sequence itself
2. ignore any galaxy id that is blacklisted or absent from the effective galaxy map
3. record each remaining galaxy under that user as a current-sequence assignment in both:
	- the global scope
	- the galaxy's paper scope
4. bucket the assignment using the galaxy's current stored classification bucket

This produces per user and per scope:

- `counts[b]`: number of unique current-sequence galaxies currently sitting in bucket `b`

It also builds a global set of galaxies assigned to at least one latest sequence, used later for the special unassigned row.

Important:

- per-user assignment counts are unique within a user sequence
- the same galaxy may still appear in multiple users' latest sequences, so summing user rows does not yield a distinct-galaxy total across users
- the `assignedBucketCounts` array used for the unassigned row counts each galaxy at most once across all users by consulting the distinct assigned-galaxy set

### Step 5: scan classifications

For every classification on a non-blacklisted galaxy:

1. add its categorical values into the global and paper-specific classification breakdown accumulators
2. mark the classifier as active for the galaxy's scope
3. check whether the classification belongs to the user's latest sequence context:
	- the user must have a latest sequence
	- the classification timestamp must be greater than or equal to that sequence's creation time
	- the classified galaxy must be present in that user's latest sequence
4. if those conditions hold:
	- increment `classifiedByUserCount` once per distinct `(user, galaxy)` pair
	- increment `processedByUserCounts[bucket]` once per distinct `(user, galaxy)` pair

This produces two different concepts:

- `classifiedByUserCount`: how many assigned current-sequence galaxies the user classified during the current sequence
- `processedByUserCounts`: how many assigned current-sequence galaxies the user has handled by classification, bucketed by the galaxy's current stored total classification count

The active-classifier metric does not use current-sequence filtering. It counts distinct users who have any classification in the non-blacklisted scope.

### Step 6: scan skips

For every skip on a non-blacklisted galaxy:

1. require the same current-sequence conditions as above:
	- the user has a latest sequence
	- the skip timestamp is greater than or equal to the sequence creation time
	- the skipped galaxy is present in the user's latest sequence
2. if the `(user, galaxy)` pair has not already been counted as processed, increment `processedByUserCounts[bucket]`

Skips affect only the processed/handled state. They do not increment `classifiedByUserCount`.

### Step 7: derive remaining current-sequence galaxy ids

After classifications and skips are processed, iterate over each galaxy still present in each user's latest sequence.

If a `(user, galaxy)` pair has not been marked as processed, add that galaxy id to:

- the global scope's remaining-id buckets for that user
- the paper scope's remaining-id buckets for that user

These remaining-id buckets are stored by the galaxy's current classification bucket, not by target.

This design matters:

- the snapshot stores target-independent bucketed state once
- any target $T$ can later be answered by summing or flattening only buckets `< T`

### Step 8: derive unassigned galaxy ids

Independently of user rows, iterate over every non-blacklisted galaxy in the effective catalog.

If the galaxy is absent from the distinct assigned-galaxy set built in step 4, add it to:

- the global unassigned-id bucket map
- its paper scope's unassigned-id bucket map

These ids drive the special `Not assigned to any user` row.

### Step 9: finalize the per-scope snapshot

For each scope, write:

- finalized progress totals
- classification bucket histogram
- classification breakdown totals
- active classifier count
- `userAssignmentCounts` rows containing assignment buckets, classified count, processed buckets, and remaining-id buckets
- `unassignedCounts`
- optional `unassignedGalaxyIdsByBucket`

The shared snapshot additionally stores:

- available paper labels
- paper raw/blacklisted/adjusted counts
- a sorted user directory derived from the latest sequences

## Exact Reported Metrics

### Paper catalog section

For each paper label `p`:

- `total_p`: all galaxies with paper `p`
- `blacklisted_p`: all blacklisted galaxies with paper `p`
- `adjusted_p = max(total_p - blacklisted_p, 0)`

The global paper selector changes downstream scope-sensitive panels, but these card counts themselves come from the raw catalog split.

### Summary cards

For the selected scope:

- effective galaxies
- classified galaxies, defined as galaxies with at least one classification
- unclassified galaxies
- total classifications
- progress percent, defined as classified galaxies divided by effective galaxies
- average classifications per galaxy

Formally, if $G$ is the effective selected-scope galaxy set:

$$
\mathrm{classifiedGalaxies} = |\{g \in G : c_g > 0\}|
$$

$$
\mathrm{progress} =
\begin{cases}
100 \cdot \frac{\mathrm{classifiedGalaxies}}{|G|}, & |G| > 0 \\
0, & |G| = 0
\end{cases}
$$

$$
\mathrm{avgClassificationsPerGalaxy} =
\begin{cases}
\frac{\sum_{g \in G} c_g}{|G|}, & |G| > 0 \\
0, & |G| = 0
\end{cases}
$$

### Progress section

Given target $T$ and bucket histogram $h_b$:

- galaxies at target:

$$
\sum_{b = T}^{B} h_b
$$

- galaxies below target:

$$
\sum_{b = 0}^{T-1} h_b
$$

- repeat classifications:

$$
\max(\mathrm{totalClassifications} - \mathrm{classifiedGalaxies}, 0)
$$

- remaining classifications to target:

$$
\sum_{b = 0}^{T-1} (T - b) \cdot h_b
$$

- target completion percent:

$$
\begin{cases}
100 \cdot \frac{\mathrm{totalClassifications}}{|G| \cdot T}, & |G| > 0 \\
0, & |G| = 0
\end{cases}
$$

- active classifiers: number of distinct users with at least one classification on a non-blacklisted galaxy in the selected scope

### Assignment table rows

For each user `u` in a scope:

- `Assigned galaxies`:

$$
\sum_{b = 0}^{B} \mathrm{assignedCounts}_{u,b}
$$

This is all unique current-sequence galaxies for that user in the selected scope, regardless of target.

- `Classified galaxies`:

the number of distinct assigned current-sequence galaxies that the same user classified at or after the creation time of that user's latest sequence

- `Remaining below-target galaxies`:

all remaining current-sequence galaxy ids in buckets below the selected target:

$$
\sum_{b = 0}^{T-1} \mathrm{remainingIdsCount}_{u,b}
$$

where a galaxy contributes only if:

- it is in the user's latest sequence
- it is non-blacklisted
- its current total classification count is below $T$
- the user has not classified it during that latest sequence
- the user has not skipped it during that latest sequence

### Row inclusion rule

A normal user row is shown only if its `Remaining below-target galaxies` count is greater than zero.

So a user can have non-zero assigned or classified context counts but still be absent from the table if they no longer have actionable under-target work.

### Special unassigned row

The special row labeled `Not assigned to any user` is computed per scope from galaxies absent from every latest sequence.

Its columns mean:

- `Assigned galaxies`: all effective galaxies in this scope that are not present in any latest sequence
- `Classified galaxies`: the subset of those unassigned galaxies with at least one classification, derived from the unassigned bucket histogram by summing buckets `>= 1`
- `Remaining below-target galaxies`: the subset of those unassigned galaxies whose bucket is `< T`

This row is included only when the last metric is positive.

## Remaining-Galaxy Drilldown Modal

When a row has explicit remaining galaxy ids, clicking the `Remaining below-target galaxies` count opens a detail modal.

### Which ids are shown

The modal uses the row's bucketed remaining ids and flattens only buckets below the currently selected target:

$$
\bigcup_{b=0}^{T-1} \mathrm{remainingIds}_{b}
$$

The same rule is used for both user rows and the special unassigned row.

### Which details are fetched

For the selected ids, the modal loads the current galaxy metadata and shows:

- preview image
- external id and numeric id
- current total classifications
- additional classifications still needed to reach target
- paper label
- RA, Dec, Reff, q, magnitude, mean surface brightness, nucleus flag
- a direct classification link

The modal paginates this list and offers export of:

- plain text ids
- a CSV containing the displayed metadata plus target-derived remaining-to-target counts

The exports are a convenience layer over the same remaining-id set. They do not use different semantics.

## User Directory Semantics

The snapshot stores a sorted user directory derived from the latest sequence scan. The UI then tries to refresh that directory through a live action so display names, emails, roles, active flags, and experience values do not remain stale in cached mode.

This user directory refresh changes labels only. It does not change any numeric statistics.

## Storage Notes That Do Not Change Semantics

The snapshot stores remaining and unassigned galaxy ids bucketed by current classification count. In large environments, those bucket arrays can become very large, so the stored representation may further chunk each bucket into smaller arrays for persistence.

That chunking is only a storage optimization to satisfy backend limits. For analytical reimplementation, treat each bucket as the flat set of galaxy ids assigned to that bucket.

## Practical Reimplementation Outline

An independent implementation can follow this sequence:

1. load galaxies, blacklist, latest sequences, classifications, and skips
2. drop blacklisted galaxies from every analytical step after raw paper totals are computed
3. assign every effective galaxy to a current classification bucket
4. build global and per-paper scope accumulators
5. keep only the latest sequence per user
6. bucket each user's current-sequence galaxies into the relevant scopes
7. mark processed `(user, galaxy)` pairs from classifications and skips that belong to the latest sequence window
8. compute remaining current-sequence ids as `assigned - processed`
9. compute unassigned ids as `effective galaxies - galaxies present in any latest sequence`
10. derive target-specific metrics at query/render time by summing or flattening only buckets below the selected target

If another system reproduces those steps and interpretation rules, it should reproduce the same reported statistics.

## Limitations And Interpretation Warnings

- The module is a snapshot of current state, not a forecast.
- It depends on stored galaxy classification totals rather than replaying classification history to rebuild those totals.
- The same galaxy may appear in multiple users' latest sequences, so summing user rows across the table does not produce a distinct-galaxy total.
- `Assigned galaxies` and `Classified galaxies` are context columns, while `Remaining below-target galaxies` is target-aware. This is why row membership changes as the target changes.
- A galaxy in a user's remaining count means only that the user still has current-sequence responsibility for it and has not yet handled it; it does not guarantee that the user will classify it next.

## Summary

The page combines one effective catalog filter with one ownership model.

1. Filter the catalog to non-blacklisted galaxies within the selected paper scope.
2. Measure current progress from stored total classification counts.
3. Overlay each user's latest sequence to determine which below-target galaxies are already in active sequences, which have already been handled by the assigned user, and which are still unassigned.

That makes Paper Assignment Coverage a planning-oriented, target-aware allocation view rather than a generic activity dashboard.