# Sequence Blacklist-Aware Counts

This document explains the blacklist-aware sequence count feature, why it was implemented the way it was, and how to roll it out safely to an existing production deployment.

## Problem

Historically, user sequences stored all assigned galaxy IDs in `galaxySequences.galaxyExternalIds`, including galaxies that were blacklisted later.

That created two user-facing inconsistencies:

1. The classification interface and navigation logic already skipped blacklisted galaxies, so a user could be told that the sequence was fully processed.
2. Progress displays and statistics still used the raw stored sequence length, so the same user could see totals such as `900 / 1000` even when all non-blacklisted work was complete.

The requirement was to fix the displayed totals without removing blacklisted galaxies from existing sequences.

## Design Summary

The implementation is additive and backward-compatible.

It keeps the raw sequence arrays unchanged and adds optional persisted fields that describe the effective, user-visible sequence after blacklisted galaxies are excluded.

### New persisted fields

The `galaxySequences` table now has these optional fields:

- `effectiveGalaxyCount`
- `blacklistedGalaxyCount`
- `blacklistedClassifiedCount`
- `blacklistedSkippedCount`
- `blacklistStatsVersion`

Two `systemSettings` keys are also used:

- `sequenceBlacklistStatsVersion`
- `sequenceBlacklistStatsBackfillCursor`

Because these fields are optional, older rows remain valid and existing deployments can be upgraded without a destructive schema migration.

## How It Works

### 1. Shared stats helper

Core logic lives in `convex/lib/sequenceBlacklistStats.ts`.

That helper is responsible for:

- computing effective counts from a raw sequence plus the current blacklist
- computing how many blacklisted galaxies in a sequence were classified or skipped by the user
- converting a raw sequence index into the visible blacklist-aware position
- deciding whether stored stats are current enough to trust

### 2. Read path behavior

User-facing queries now prefer stored effective stats when they are current, and otherwise fall back to live computation.

The main read surfaces are:

- `convex/classification.ts` via `getProgress`
- `convex/galaxies/navigation.ts` via `getGalaxyNavigation`
- `convex/updateUserSequence.ts` via `getUserSequenceInfo`

This fallback behavior is the safety net that allows a production deployment to go live before all historical rows are backfilled.

### 3. Write path behavior

Sequence stats are populated or refreshed whenever sequence membership changes.

This includes:

- sequence creation in `convex/generateBalancedUserSequence.ts`
- random sequence creation in `convex/galaxies/sequence.ts`
- manual assignment, shortening, and extension in `convex/updateUserSequence.ts`

Sequence progress counters are also kept consistent when the user acts on a sequence galaxy:

- classification writes in `convex/classification.ts`
- skip and unskip writes in `convex/galaxies/skipped.ts`

### 4. Blacklist invalidation

Whenever blacklist membership changes, the app increments `systemSettings.sequenceBlacklistStatsVersion`.

That happens in `convex/galaxyBlacklist.ts` for:

- single add/remove
- bulk add/remove
- clear blacklist

If a stored sequence row has an older `blacklistStatsVersion`, reads automatically stop trusting the stored stats and recompute them live until the row is rebuilt.

## Frontend Changes

The user-facing UI now consumes effective counts instead of raw sequence length where that is the right semantic:

- classification progress and sidebar navigation
- galaxy position display
- My Statistics progress overview

Admin sequence tooling still keeps raw stored counts visible so administrators can reason about the actual stored sequence length separately from the effective user-visible work.

## Why This Approach Was Chosen

This design balances correctness, rollout safety, and performance.

### Benefits

1. No destructive migration is required.
2. Existing sequences remain intact.
3. Production can be deployed before the backfill finishes.
4. Reads stay correct even if the backfill has not yet run or if it is interrupted.
5. Repeated user-facing reads become cheaper once stored stats are filled.

### Tradeoff

The app now has two sources of truth for blacklist-aware sequence stats:

- persisted optional fields for performance
- live fallback computation for correctness

The version key is what keeps those two paths consistent.

## Production Rollout Plan

The rollout is intentionally two-phase.

### Phase 1: Deploy code and schema

Deploy the new Convex schema, backend functions, and frontend.

At this point:

- new and updated sequences will start writing the persisted stats
- existing rows may still be missing the new fields
- reads will still be correct because stale or missing rows fall back to live computation

This means the deployment is safe even before the historical backfill runs.

### Phase 2: Backfill historical sequence rows

After the deployment is live, rebuild persisted sequence stats for existing rows using:

- `api.sequenceBlacklistStats.rebuildSequenceBlacklistStatsBatch`
- `api.sequenceBlacklistStats.getRebuildSequenceBlacklistStatsState`

These functions are now surfaced in the admin UI at:

- `Admin -> Maintenance -> Aggregates -> Rebuild Sequence Blacklist Stats`

The rebuild is resumable. It stores progress in `systemSettings.sequenceBlacklistStatsBackfillCursor`.

## How To Update an Existing Production Database

### Recommended order

1. Deploy the application code and Convex schema.
2. Verify that user-facing sequence progress still works on production.
3. Start the sequence stats rebuild in small batches.
4. Continue running rebuild batches until `isComplete` becomes `true`.
5. Run a final verification against a user known to have blacklisted galaxies in their sequence.

### Admin UI location

The rebuild is available from the admin panel:

1. Open `Admin`.
2. Open `Maintenance`.
3. Open `Aggregates`.
4. Find the card labeled `Rebuild Sequence Blacklist Stats`.

That card shows:

- the current sequence blacklist stats version
- whether a saved rebuild cursor already exists
- a configurable batch size
- buttons to start, resume, restart, or stop the current run

### Rebuild procedure

#### Preferred: use the admin UI

Use the `Rebuild Sequence Blacklist Stats` card under `Admin -> Maintenance -> Aggregates`.

Recommended workflow:

1. Leave `Batch Size` at `25` for the first production run.
2. Click `Start Rebuild` if no saved cursor exists, or `Resume Rebuild` if a prior run was interrupted.
3. If you intentionally want to discard saved progress and start from the beginning, click `Restart From Beginning`.
4. If you need to pause the long-running loop, click `Stop`.
5. Wait until the UI reports that the rebuild finished.

The section internally uses:

- `api.sequenceBlacklistStats.getRebuildSequenceBlacklistStatsState` to display current status
- `api.sequenceBlacklistStats.rebuildSequenceBlacklistStatsBatch` to process each batch

#### Alternative: invoke the Convex functions directly

Start the rebuild from the beginning:

```ts
await api.sequenceBlacklistStats.rebuildSequenceBlacklistStatsBatch({
  batchSize: 25,
  reset: true,
});
```

Continue calling the same mutation until the response reports `isComplete: true`:

```ts
await api.sequenceBlacklistStats.rebuildSequenceBlacklistStatsBatch({
  batchSize: 25,
});
```

Inspect the current state at any time:

```ts
await api.sequenceBlacklistStats.getRebuildSequenceBlacklistStatsState({});
```

The direct-function path is mainly useful for scripted operational runs. For normal production maintenance, prefer the admin UI.

### Expected rebuild response

Each rebuild batch returns:

- `processed`
- `isComplete`
- `nextCursor`
- `currentVersion`
- `batchSize`

If a rebuild run is interrupted, rerun the mutation without `reset`; it resumes from the stored cursor.

If you intentionally want to restart the rebuild from the beginning, run the mutation once with `reset: true`.

## Recommended Batch Size

The current implementation clamps batch size between `1` and `100` and defaults to `25`.

For production, start with `25` unless you already know the deployment has enough headroom for a larger batch.

## What Happens If The Blacklist Changes During Migration

If blacklist rows change while the rebuild is in progress:

1. `sequenceBlacklistStatsVersion` increments.
2. Rows already rebuilt under the previous version become stale.
3. Reads remain correct because they fall back to live computation.
4. Run the rebuild again so all rows are updated to the new version.

In other words, blacklist changes during rollout do not corrupt data. They only mean the rebuild may need to be rerun.

## Verification Checklist After Production Migration

Check these surfaces with a user whose sequence includes galaxies that were blacklisted after assignment:

1. Classification sidebar progress shows the effective total, not the raw stored total.
2. Galaxy position text excludes blacklisted sequence entries.
3. My Statistics shows:
   - blacklist-aware remaining work
   - the number of blacklisted galaxies in the sequence
   - the number of blacklisted galaxies already classified
4. Admin sequence management still shows the raw stored sequence size separately.

## Rollback / Recovery Notes

No rollback-specific data migration is required because the new fields are additive.

If you need to pause after deployment but before backfill completion:

- leave the deployment running
- do not delete the new fields
- resume the rebuild later

The system will continue to serve correct user-facing values through live fallback.

## Files Involved

Backend:

- `convex/lib/sequenceBlacklistStats.ts`
- `convex/sequenceBlacklistStats.ts`
- `convex/classification.ts`
- `convex/galaxies/navigation.ts`
- `convex/updateUserSequence.ts`
- `convex/generateBalancedUserSequence.ts`
- `convex/galaxies/sequence.ts`
- `convex/galaxies/skipped.ts`
- `convex/galaxyBlacklist.ts`
- `convex/schema.ts`

Frontend:

- `src/components/classification/ClassificationInterface.tsx`
- `src/components/classification/ProgressBar.tsx`
- `src/components/classification/GalaxyInfo.tsx`
- `src/components/layout/Navigation.tsx`
- `src/components/statistics/StatisticsTab.tsx`
- `src/components/admin/UpdateUserSequence.tsx`

Tests:

- `tests/sequenceBlacklistStats.test.ts`
- `tests/StatisticsTab.test.tsx`
- `tests/UpdateUserSequence.test.tsx`
