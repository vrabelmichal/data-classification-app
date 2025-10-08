# Galaxy Backend Refactoring Documentation

## Overview
The galaxy-related backend files have been reorganized into a structured subdirectory to improve code organization and maintainability.

## Changes Made

### 1. Directory Structure
All galaxy-related files have been moved from `convex/` to `convex/galaxies/`:

```
convex/galaxies/
├── core.ts                      # Core galaxy operations (insertGalaxy, getAdditionalGalaxyDetailsByExternalId)
├── maintenance.ts               # Maintenance & debugging mutations (deleteAllGalaxies, rebuildGalaxyIdsTable, etc.)
├── aggregates.ts                # Galaxy aggregates for efficient queries
├── batch_ingest.ts              # Batch ingestion from HTTP endpoints
├── browse.ts                    # Galaxy browsing queries
├── navigation.ts                # Galaxy navigation for classification
├── sequence.ts                  # User sequence generation and management
├── skipped.ts                   # Skipped galaxy management
├── mock.ts                      # Mock data generation
├── deprecated.ts                # Deprecated functions (kept for reference)
└── navigation_deprecated.ts     # Deprecated navigation functions
```

### 2. File Renaming
Files were renamed to remove the redundant `galaxies_` prefix since they're already in the `galaxies` subdirectory:
- `galaxies_aggregates.ts` → `aggregates.ts`
- `galaxies_batch_ingest.ts` → `batch_ingest.ts`
- `galaxies_browse.ts` → `browse.ts`
- `galaxies_navigation.ts` → `navigation.ts`
- `galaxies_sequence.ts` → `sequence.ts`
- `galaxies_skipped.ts` → `skipped.ts`
- `galaxies_mock.ts` → `mock.ts`
- `galaxies_deprecated.ts` → `deprecated.ts`
- `galaxies_navigation_deprecated.ts` → `navigation_deprecated.ts`

### 3. New Files Created

#### `core.ts`
Contains core galaxy operations:
- `insertGalaxy()` - Helper function to insert a galaxy with all related data
- `getAdditionalGalaxyDetailsByExternalId()` - Query for fetching detailed galaxy information

#### `maintenance.ts`
Contains maintenance and debugging mutations:
- `deleteAllGalaxies()` - Delete all galaxy data (admin only)
- `rebuildGalaxyIdsTable()` - Rebuild the galaxyIds table
- `fillGalaxyMagAndMeanMue()` - Fill missing mag and mean_mue values
- `fillGalaxyNumericId()` - Fill sequential numericId values
- `zeroOutGalaxyStatistics()` - Reset galaxy statistics to zero

### 4. API Access Changes

The Convex API structure has changed. Frontend code now accesses galaxy functions using:

**Before:**
```typescript
api.galaxies.deleteAllGalaxies
api.galaxies.insertGalaxy
api.galaxies.getAdditionalGalaxyDetailsByExternalId
```

**After:**
```typescript
// Maintenance operations
api.galaxies_maintenance.deleteAllGalaxies
api.galaxies_maintenance.rebuildGalaxyIdsTable
api.galaxies_maintenance.fillGalaxyMagAndMeanMue
api.galaxies_maintenance.fillGalaxyNumericId
api.galaxies_maintenance.zeroOutGalaxyStatistics

// Core operations
api.galaxies_core.getAdditionalGalaxyDetailsByExternalId
// Note: insertGalaxy is a helper function, not a mutation/query

// Other operations (unchanged paths)
api.galaxies_browse.browseGalaxies
api.galaxies_navigation.getNextGalaxyToClassify
api.galaxies_navigation.getGalaxyByExternalId
api.galaxies_navigation.getGalaxyNavigation
api.galaxies_navigation.navigateToGalaxyInSequence
api.galaxies_sequence.getUsersWithSequences
api.galaxies_sequence.removeUserSequence
api.galaxies_skipped.skipGalaxy
api.galaxies_skipped.getSkippedGalaxies
api.galaxies_skipped.isGalaxySkipped
api.galaxies_skipped.removeFromSkipped
api.galaxies_aggregates.getAggregateInfo
api.galaxies_aggregates.rebuildGalaxyAggregates
api.galaxies_aggregates.clearGalaxyAggregates
api.galaxies_mock.generateMockGalaxies
```

### 5. Import Changes

**Backend files** (within `convex/galaxies/`) now use relative imports:
```typescript
// Before (in convex/)
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { galaxyIdsAggregate } from "./galaxies_aggregates";

// After (in convex/galaxies/)
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { galaxyIdsAggregate } from "./aggregates";
```

**Other backend files** (in `convex/`) import from the subdirectory:
```typescript
// Example: convex/router.ts
import { ingestGalaxiesHttp, ping } from "./galaxies/batch_ingest";
```

### 6. Frontend Changes

Updated all frontend files that referenced the old API paths:
- `src/components/admin/DebuggingTab.tsx`
- `src/components/admin/debugging/DeleteAllGalaxyDataSection.tsx`
- `src/components/admin/debugging/FillGalaxyMagMeanMueSection.tsx`
- `src/components/admin/debugging/FillGalaxyNumericIdSection.tsx`
- `src/components/admin/debugging/RebuildGalaxyIdsTableSection.tsx`
- `src/components/admin/debugging/ZeroOutGalaxyStatisticsSection.tsx`
- `src/components/classification/ClassificationInterface.tsx`

## Benefits

1. **Better Organization**: Related functionality is grouped together in a dedicated directory
2. **Clearer Separation**: Maintenance/debugging operations are separated from core galaxy operations
3. **Easier Navigation**: Developers can quickly find relevant code
4. **Reduced Clutter**: The main `convex/` directory is less crowded
5. **Cleaner Naming**: Removed redundant `galaxies_` prefix from files in the galaxies subdirectory

## Migration Notes

- All existing functionality remains intact
- No database schema changes were required
- The old `convex/galaxies.ts` file has been removed
- All tests and error checks pass successfully

## Future Considerations

- Consider further splitting `maintenance.ts` if it grows too large
- Evaluate moving deprecated files to a `deprecated/` subdirectory
- Document which operations require admin privileges
