# Classification-Based Assignment Test Results

## Scope

This document records the automated tests added for the classification-based galaxy assignment work, the exact test and validation commands that were run, the failures that were discovered, the fixes that were applied, and the final results.

The test coverage added here focuses on three areas:

1. pure backend helper logic used by the classification-based assignment flow,
2. procedure-specific messaging used by notification emails,
3. admin UI behavior for generating and extending sequences with the new classification-based procedure.

These tests are **unit/component tests**. They do not run against a live Convex deployment or a real browser session. Instead, the React component tests mock the Convex hooks and verify that the UI sends the correct payloads and handles the relevant states correctly.

## Added Test Files

### `tests/classificationBasedAssignmentCore.test.ts`

This file validates the extracted pure helper logic in `convex/lib/classificationBasedAssignmentCore.ts`.

Covered behaviors:

- uploaded blacklist IDs are trimmed, blank lines are removed, and duplicate IDs are deduplicated,
- generic user-ID lists are deduplicated without changing first-seen order,
- classification-based sequence extension keeps galaxies already present in the target user's sequence excluded, so the planner must look for additional galaxies instead of reassigning existing sequence entries,
- large galaxy-ID exclusion lists can be serialized and restored safely when internal selector queries need to filter more than 8192 IDs,
- ranked classification candidates are ordered by:
  - lower senior-classifier count first,
  - lower numeric galaxy ID as the stable tie-breaker,
- combined system/uploaded/carry-forward exclusion lists are merged into a unique set.

### `tests/sequenceProcedureMessaging.test.ts`

This file validates `convex/lib/sequenceProcedureMessaging.ts`.

Covered behaviors:

- default generate emails use the regular balanced procedure label/explanation,
- extend emails in classification-based mode use the correct classification-based wording and explain the balanced fallback.

### `tests/GenerateBalancedUserSequence.test.tsx`

This file validates the admin generate-sequence UI in `src/components/admin/GenerateBalancedUserSequence.tsx`.

Covered behaviors:

- the regular balanced procedure is the default UI,
- toggling to classification-based mode reveals the extra controls,
- existing regular-form values are preserved when switching procedures,
- uploaded blacklist files are parsed and forwarded,
- selected existing user sequences are forwarded as exclusions,
- batch-mode carry-forward exclusions are propagated from earlier users to later users,
- notification emails are triggered with `procedureType: "classificationBased"`.

### `tests/UpdateUserSequence.test.tsx`

This file validates the admin extend-sequence UI in `src/components/admin/UpdateUserSequence.tsx`.

Covered behaviors:

- regression coverage for the reported runtime error in classification-based extend mode,
- classification-based extend works even when no blacklist file is uploaded and sends an empty `additionalBlacklistedIds` array instead of throwing,
- uploaded blacklist IDs are forwarded correctly,
- excluded user-sequence IDs are forwarded correctly,
- classification-based extension emails are triggered with `procedureType: "classificationBased"`.

## Regression Found During Testing

The first full automated test run exposed a real runtime regression in the extend-sequence UI.

### Failure

When the classification-based extend handler built the action payload, it referenced:

- `additionalBlacklistedIds`

but the actual React state variable was named:

- `additionalBlacklistIds`

That typo caused a runtime `ReferenceError`:

`ReferenceError: additionalBlacklistedIds is not defined`

This exactly matches the error observed manually in the application.

### Fix Implemented

The extend handler in `src/components/admin/UpdateUserSequence.tsx` was corrected to send:

`additionalBlacklistedIds: additionalBlacklistIds`

This fix was validated immediately by the focused UI regression tests and then by the full test suite.

## Test Run Log

Every automated test/validation run performed during this task is listed below.

### Run 1

Command:

```bash
npm run test
```

Result: **failed**

Summary:

- `tests/sequenceProcedureMessaging.test.ts`: passed
- `tests/classificationBasedAssignmentCore.test.ts`: passed
- `tests/GenerateBalancedUserSequence.test.tsx`: 1 failed, 1 passed
- `tests/UpdateUserSequence.test.tsx`: 2 failed

Observed failures:

1. `ReferenceError: additionalBlacklistedIds is not defined`
   - thrown by `handleExtendSequence` in `src/components/admin/UpdateUserSequence.tsx`
   - reproduced by both classification-based extend tests
2. one generate-page test used an overly broad text selector for `Target Classification Count`
   - the selector matched descriptive text inside the procedure card instead of the actual field label
   - this was a test issue, not an application defect

Action taken after Run 1:

- fixed the variable-name typo in `UpdateUserSequence.tsx`,
- narrowed the test selector in `tests/GenerateBalancedUserSequence.test.tsx` to match the exact field label.

### Run 2

Command:

```bash
npx vitest run tests/GenerateBalancedUserSequence.test.tsx tests/UpdateUserSequence.test.tsx
```

Result: **passed**

Summary:

- test files passed: 2/2
- tests passed: 4/4

Purpose of this run:

- validate the direct regression fix before rerunning the full suite,
- confirm the extend UI no longer throws the `additionalBlacklistedIds` runtime error,
- confirm the updated generate-page assertion is stable.

### Run 3

Command:

```bash
npm run test
```

Result: **passed**

Summary:

- test files passed: 4/4
- tests passed: 10/10

Passing files:

- `tests/sequenceProcedureMessaging.test.ts`
- `tests/classificationBasedAssignmentCore.test.ts`
- `tests/UpdateUserSequence.test.tsx`
- `tests/GenerateBalancedUserSequence.test.tsx`

### Run 4

Command:

```bash
npm run lint
```

Result: **passed**

What this validates:

- Convex TypeScript project typecheck,
- application TypeScript typecheck,
- `convex dev --once` backend validation,
- production `vite build`.

Notes:

- the build completed successfully,
- Vite reported the existing large-chunk warning for some bundles, but this is a warning only and did not fail the build.

### Run 5

Command:

```bash
npm run test
```

Result: **passed**

Summary:

- test files passed: 4/4
- tests passed: 11/11

Purpose of this run:

- validate the new regression coverage for classification-based sequence extension exclusions,
- confirm that galaxies already present in the target user's sequence remain excluded and the planner searches for additional galaxies instead of reassigning existing sequence entries.

### Run 6

Command:

```bash
npm run test
```

Result: **passed**

Summary:

- test files passed: 4/4
- tests passed: 12/12

Purpose of this run:

- validate the fix for large exclusion lists passed through internal Convex selectors,
- confirm the new serialization regression coverage for classification-based assignment exclusion lists,
- verify that the shared balanced-selector path still passes after the argument-shape change.

## Final Result

The classification-based assignment work now has automated coverage for the main pure-helper logic and the admin UI paths that were changed.

Final status:

- automated tests: **12/12 passed**
- focused regression rerun: **passed**
- full typecheck/build validation: **passed**

## Remaining Limitations

The current automated coverage does **not** yet include:

- live Convex integration tests against a seeded backend,
- end-to-end browser automation against a running app,
- performance/load validation for very large candidate pools.

Those would be the next layer if deeper validation is needed, but for the current code changes the implemented unit/component coverage successfully caught a real runtime bug and verified the main new behaviors.