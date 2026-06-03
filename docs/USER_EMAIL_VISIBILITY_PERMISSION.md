# User Email Visibility Permission

## Purpose

This document describes where user email addresses can be disclosed in the application and how disclosure is protected by permissions.

The dedicated permission is:

- `viewUserEmails`

This permission controls whether callers receive other users' raw email addresses in API responses. When denied, backend hides email fields when a user name is available, and only returns obfuscated email values when a name is not available.

## Default Role Policy

Default role permissions for viewing other users' emails:

- `admin`: always allowed (full permissions)
- `analyst`: allowed by default
- `maintainer`: not allowed by default
- `user`: not allowed

Notes:

- Admin permission is always enforced as full access by backend normalization logic.
- Legacy stored settings key `viewAssignmentCoverageUserEmails` is mapped to `viewUserEmails` for backward compatibility.

## Backend Disclosure Points

The following backend endpoints may disclose other users' emails and are now gated by `viewUserEmails`:

1. `convex/classification.ts`
- `getGalaxyAssignmentDetails`
- `getGalaxyResults`

2. `convex/statistics/paperAssignmentCoverage/cache.ts`
- user-directory filtering in cached/live coverage responses

3. `convex/users.ts`
- `getUsersForSelection`
- `getUsersStatisticsOverview`
- `getUserBasicInfo` (self-email still allowed)
- `getAllUsers`

4. `convex/issueReports.ts`
- `getAllReports`

5. `convex/galaxyBlacklist.ts`
- `getAllBlacklistedGalaxies`
- `searchBlacklistedGalaxies`

6. `convex/generateBalancedUserSequence.ts`
- `generateBalancedUserSequence`

7. `convex/updateUserSequence.ts`
- `updateUserSequence`

## Frontend Handling

Frontend permission and UI wiring:

1. Permission definitions
- `src/lib/permissions.ts`
- `src/components/admin/settings/PermissionsSettingsPage.tsx`

2. Email visibility behavior
- `src/components/admin/UsersTab.tsx`
  - email visibility toggle is disabled when `viewUserEmails` is not granted
- `src/components/admin/IssueReportsPage.tsx`
- `src/components/admin/IssueReportsTab.tsx`
  - hidden email values are displayed as "Email hidden"

## Admin-only Paths (By Design)

Some endpoints include email fields but are admin-only (`requireAdmin`). These are considered safe under the default policy because admins always have full permissions.

Examples include:

- `convex/notifications.ts` (creator / recipient emails)
- `convex/imageAudit.ts` (run creator email)

## Security Model Summary

Email disclosure is protected in depth:

1. Route/query authorization checks (`requirePermission`, `requireAdmin`)
2. Field-level email handling by `viewUserEmails` (raw when allowed; when denied, hide if name exists, otherwise obfuscate)
3. Frontend controls that avoid exposing or implying unavailable email data
4. Backward compatibility mapping from old permission key to prevent accidental misconfiguration during rollout

## Migration Notes

- Old key: `viewAssignmentCoverageUserEmails`
- New key: `viewUserEmails`

Stored role-permission settings using the old key continue to work via normalization fallback. New settings and metadata use only `viewUserEmails`.
