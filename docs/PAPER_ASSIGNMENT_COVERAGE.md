# Paper Assignment Coverage Statistics

## Purpose

The Paper Assignment Coverage statistics page answers a practical question:

Which galaxies are still below the current target number of classifications, and to which users are those under-target galaxies currently assigned?

The page is designed to support assignment planning on top of the existing paper-based catalog view. It combines three perspectives into one place:

- catalog size by paper
- classification progress for the selected paper subset
- current sequence ownership of galaxies that are still under target

This document focuses on the calculation logic and interpretation rules rather than implementation details.

## Two Modes

The page exists in two variants.

### Cached mode

- Uses snapshots refreshed on a background schedule.
- Opens at `/statistics/paper-assignment-coverage`.
- Intended for quick repeated review.

### Live mode

- Recomputes the statistics only when the user clicks the calculation button.
- Opens at `/statistics/paper-assignment-coverage-live`.
- Intended when an up-to-the-minute view is needed.

Both modes use the same calculation rules and present the same metrics. The only difference is when the numbers are refreshed.

## Scope Selection By Paper

The page starts from the same paper catalog split used elsewhere in the statistics area.

- Every galaxy belongs either to a specific `misc.paper` value or to the empty-paper bucket.
- The paper cards and stacked bar show the full catalog composition by paper.
- Selecting a paper changes the rest of the page to that paper-specific subset.
- Choosing “All papers” switches back to the full effective catalog.

An administration setting can define which paper is selected by default when the page is opened without a paper parameter in the URL.

- The default can be All papers.
- The default can also be a specific paper category.
- Users can still change the paper selection after the page loads.

## Blacklist Rule

All reported progress and assignment coverage statistics on this page exclude blacklisted galaxies.

This means:

- blacklisted galaxies are still counted in the paper catalog cards as part of the raw catalog totals
- blacklisted galaxies are removed from the effective subset used for progress statistics
- blacklisted galaxies are removed from the under-target assignment table

As a result, the page distinguishes between:

- total galaxies in a paper
- blacklisted galaxies in that paper
- adjusted galaxies after blacklist removal

The adjusted count is the effective scope for the rest of the page.

## Core Per-Galaxy Progress Logic

For every non-blacklisted galaxy in the selected scope, the page reads its stored total classification count.

Each galaxy is then placed into a classification-count bucket:

- 0 classifications
- 1 classification
- 2 classifications
- and so on, with counts greater than or equal to 25 grouped into the final bucket; that threshold comes from the backend constant `PAPER_ASSIGNMENT_COVERAGE_MAX_TARGET_CLASSIFICATIONS` and is not currently admin-configurable.

From those buckets, the page derives the main progress statistics.

### Summary statistics

For the selected scope, the page reports:

- number of effective galaxies
- number of galaxies with at least one classification
- number of unclassified galaxies
- total number of classifications
- percentage of galaxies with at least one classification
- average number of classifications per galaxy

### Target progress statistics

The target slider defines the current desired number of classifications per galaxy.

For a selected target $T$, the page computes:

- galaxies at target: galaxies with at least $T$ classifications
- galaxies below target: galaxies with fewer than $T$ classifications
- repeat classifications: total classifications beyond the first one on classified galaxies
- remaining classifications to target: the total number of additional classifications still needed for all below-target galaxies

The remaining classifications to target are computed as:

$$
\sum_{g \in \text{below target}} (T - c_g)
$$

where $c_g$ is the current classification count of galaxy $g$.

## Assignment Coverage Logic

The assignment table is the key new part of this page.

It focuses only on galaxies that are still below the current target.

### Step 1: identify the under-target subset

For the selected paper scope and current target $T$, the page collects all non-blacklisted galaxies whose classification count is less than $T$.

These are the galaxies that still need more classifications to reach the current target.

### Step 2: inspect active sequences

The page then looks at the current user sequences.

For each user sequence, it records the user’s current sequence galaxies from the selected non-blacklisted scope into classification-count buckets.

The table then derives three count columns from those per-user buckets:

- Assigned galaxies: all unique current sequence galaxies for that user in the selected scope, regardless of the current target
- Classified galaxies: the subset of those assigned galaxies that the same user has already classified
- Below-target galaxies: the subset of those assigned galaxies that are still below the selected target $T$

This last column is the target-aware planning metric that determines whether a user appears in the table at all.

A user row is shown only if that user currently has at least one galaxy below target in their sequence.

### Step 3: compute the unassigned row

The page also reports a special row for galaxies that do not appear in any current sequence.

That row uses the same column logic:

- Assigned galaxies: all non-blacklisted galaxies in the selected scope that are not currently present in any sequence
- Classified galaxies: for this special non-user row, the number shown is the unassigned subset that already has at least one classification
- Below-target galaxies: the unassigned subset that is still below the selected target

This row answers a different planning question:

- how much of the under-target work has not yet been queued for any user at all

### Important interpretation rule

The table shows current sequence ownership, not guaranteed future work completion.

So a galaxy contributing to the highlighted target-aware count for a user means:

- it is below target now
- it is currently present in that user’s active sequence

It does **not** guarantee that the user will actually classify it next, or ever, because the sequence may change or the galaxy may be skipped.

Meanwhile, the `Assigned galaxies` column provides broader context about that user’s current sequence ownership in the selected scope, and the `Classified galaxies` column shows how much of that same in-scope sequence the user has already completed by classification. Neither column is itself filtered down to only below-target galaxies.

## Why The Table Changes When The Target Changes

The under-target subset depends directly on the selected target.

If the target is increased:

- more galaxies can become under-target
- more sequence entries may start contributing to user counts
- the unassigned count may increase

If the target is decreased:

- fewer galaxies remain under-target
- some sequence entries stop contributing to the table
- the unassigned count may decrease

So the table is not a static assignment overview. It is a target-aware view of assignment coverage.

One subtle consequence of the current implementation is that only the highlighted `Below-target galaxies` column is directly target-aware. The `Assigned galaxies` and `Classified galaxies` columns are scope-aware context columns, so users may appear or disappear as the target changes even though those two context columns do not change in lockstep with the target.

## Reading The Page In Practice

The page is usually most useful as a three-step workflow.

1. Choose a paper or keep the global view.
2. Set the target classifications per galaxy.
3. Read the user table together with the remaining-to-target metric.

This helps distinguish between three situations:

- the scope is mostly complete because most galaxies already reached target
- the scope is incomplete, but much of the remaining work is already sitting in user sequences
- the scope is incomplete and a meaningful part of the remaining work is still unassigned

## Cached Refresh Settings

The cached version can be refreshed automatically on a configurable interval.

The admin settings allow:

- enabling or disabling automatic refresh
- adjusting the refresh interval in minutes

If automatic refresh is disabled, the cached page may stay outdated until a later manual or administrative refresh path is used. The live page remains the explicit way to compute a fresh snapshot on demand.

## Main Limitations

The page should be interpreted with a few constraints in mind.

- It reflects the current snapshot of classification counts and user sequences, not future outcomes.
- The user table measures sequence inclusion, not eventual completion.
- A single galaxy may appear in multiple users’ sequences, so user row totals do not represent distinct galaxy counts across users.
- The unassigned row counts galaxies not present in any current sequence, but those galaxies may still be picked up in a future assignment run.

## Summary

Conceptually, the page is built from one filtered galaxy subset and two follow-up questions.

1. After removing blacklisted galaxies, how large is the selected paper subset and how far is it from the current classification target?
2. Within the galaxies still below target, which ones are already queued in user sequences and which ones are not assigned anywhere?

That combination makes the page a planning tool for target-driven assignment coverage rather than a general-purpose activity dashboard.