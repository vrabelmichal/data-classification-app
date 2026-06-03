import { v } from "convex/values";

export const USER_ROLES = ["user", "analyst", "maintainer", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_EXPERIENCE_LEVELS = ["normal", "senior"] as const;

export type UserExperience = (typeof USER_EXPERIENCE_LEVELS)[number];

export const APP_PERMISSION_KEYS = [
  "manageUsers",
  "manageGalaxyAssignments",
  "viewGalaxyAssignmentDetails",
  "manageSettings",
  "manageMaintenance",
  "manageSystem",
  "manageNotifications",
  "accessDataPage",
  "unlimitedGalaxyExport",
  "viewOverviewStatistics",
  "viewLiveOverviewStatistics",
  "viewUserStatistics",
  "viewAssignmentStatistics",
  "viewAssignmentCoverage",
  "viewLiveAssignmentCoverage",
  "viewAssignmentCoverageAllRows",
  "viewUserEmails",
  "viewDataAnalysis",
  "viewIssueReports",
  "manageIssueReports",
  "viewGalaxyResults",
] as const;

export type AppPermissionKey = (typeof APP_PERMISSION_KEYS)[number];
export type PermissionRecord = Record<AppPermissionKey, boolean>;
export type RolePermissionsMatrix = Record<UserRole, PermissionRecord>;

function buildPermissionRecord(
  overrides: Partial<PermissionRecord> = {}
): PermissionRecord {
  return APP_PERMISSION_KEYS.reduce((record, key) => {
    record[key] = overrides[key] ?? false;
    return record;
  }, {} as PermissionRecord);
}

function buildFullPermissionRecord(): PermissionRecord {
  return buildPermissionRecord(
    APP_PERMISSION_KEYS.reduce((record, key) => {
      record[key] = true;
      return record;
    }, {} as Partial<PermissionRecord>)
  );
}

export const FULL_PERMISSION_RECORD = buildFullPermissionRecord();

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  user: buildPermissionRecord(),
  analyst: buildPermissionRecord({
    accessDataPage: true,
    unlimitedGalaxyExport: true,
    viewOverviewStatistics: true,
    viewLiveOverviewStatistics: true,
    viewUserStatistics: true,
    viewAssignmentStatistics: true,
    viewAssignmentCoverage: true,
    viewLiveAssignmentCoverage: true,
    viewAssignmentCoverageAllRows: true,
    viewUserEmails: true,
    viewDataAnalysis: true,
    viewIssueReports: true,
    viewGalaxyResults: true,
  }),
  maintainer: buildPermissionRecord({
    manageGalaxyAssignments: true,
    viewGalaxyAssignmentDetails: true,
    viewOverviewStatistics: true,
    viewLiveOverviewStatistics: true,
    viewAssignmentStatistics: true,
    viewAssignmentCoverage: true,
    viewLiveAssignmentCoverage: true,
    viewAssignmentCoverageAllRows: true,
    viewIssueReports: true,
  }),
  admin: FULL_PERMISSION_RECORD,
};

export const userRoleValidator = v.union(
  v.literal("user"),
  v.literal("analyst"),
  v.literal("maintainer"),
  v.literal("admin")
);

export const userExperienceValidator = v.union(v.literal("normal"), v.literal("senior"));

export const permissionRecordValidator = v.object({
  manageUsers: v.boolean(),
  manageGalaxyAssignments: v.boolean(),
  viewGalaxyAssignmentDetails: v.boolean(),
  manageSettings: v.boolean(),
  manageMaintenance: v.boolean(),
  manageSystem: v.boolean(),
  manageNotifications: v.boolean(),
  accessDataPage: v.boolean(),
  unlimitedGalaxyExport: v.boolean(),
  viewOverviewStatistics: v.boolean(),
  viewLiveOverviewStatistics: v.boolean(),
  viewUserStatistics: v.boolean(),
  viewAssignmentStatistics: v.boolean(),
  viewAssignmentCoverage: v.boolean(),
  viewLiveAssignmentCoverage: v.boolean(),
  viewAssignmentCoverageAllRows: v.boolean(),
  viewUserEmails: v.boolean(),
  viewDataAnalysis: v.boolean(),
  viewIssueReports: v.boolean(),
  manageIssueReports: v.boolean(),
  viewGalaxyResults: v.boolean(),
});

export const rolePermissionsValidator = v.object({
  user: permissionRecordValidator,
  analyst: permissionRecordValidator,
  maintainer: permissionRecordValidator,
  admin: permissionRecordValidator,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePermissionRecord(
  value: unknown,
  fallback: PermissionRecord
): PermissionRecord {
  const source = isPlainObject(value) ? value : {};
  const legacyEmailPermission =
    typeof source.viewAssignmentCoverageUserEmails === "boolean"
      ? (source.viewAssignmentCoverageUserEmails as boolean)
      : undefined;

  return APP_PERMISSION_KEYS.reduce((record, key) => {
    if (key === "viewUserEmails" && typeof source[key] !== "boolean" && legacyEmailPermission !== undefined) {
      record[key] = legacyEmailPermission;
      return record;
    }

    record[key] = typeof source[key] === "boolean" ? (source[key] as boolean) : fallback[key];
    return record;
  }, {} as PermissionRecord);
}

export function normalizeRole(role: unknown): UserRole {
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "user";
}

export function normalizeUserExperience(experience: unknown): UserExperience {
  return experience === "senior" ? "senior" : "normal";
}

export function normalizeRolePermissions(
  value: unknown
): RolePermissionsMatrix {
  const source = isPlainObject(value) ? value : {};

  return {
    user: normalizePermissionRecord(source.user, DEFAULT_ROLE_PERMISSIONS.user),
    analyst: normalizePermissionRecord(source.analyst, DEFAULT_ROLE_PERMISSIONS.analyst),
    maintainer: normalizePermissionRecord(
      source.maintainer,
      DEFAULT_ROLE_PERMISSIONS.maintainer
    ),
    admin: buildFullPermissionRecord(),
  };
}

export function getRolePermissionsFromSettings(settings: {
  rolePermissions?: unknown;
}): RolePermissionsMatrix {
  return normalizeRolePermissions(settings.rolePermissions);
}

export function getPermissionsForRole(
  role: unknown,
  settings: { rolePermissions?: unknown }
): PermissionRecord {
  const normalizedRole = normalizeRole(role);
  const permissions = getRolePermissionsFromSettings(settings);
  return normalizedRole === "admin"
    ? FULL_PERMISSION_RECORD
    : permissions[normalizedRole];
}

export function hasPermissionForRole(
  role: unknown,
  settings: { rolePermissions?: unknown },
  permission: AppPermissionKey
): boolean {
  return getPermissionsForRole(role, settings)[permission];
}

export function hasAnyPermissionForRole(
  role: unknown,
  settings: { rolePermissions?: unknown },
  permissions: readonly AppPermissionKey[]
): boolean {
  const resolved = getPermissionsForRole(role, settings);
  return permissions.some((permission) => resolved[permission]);
}

export function canAccessAdminPanelForRole(
  role: unknown,
  settings: { rolePermissions?: unknown }
): boolean {
  const permissions = getPermissionsForRole(role, settings);
  return Boolean(
    permissions.manageUsers ||
      permissions.manageGalaxyAssignments ||
      permissions.manageSettings ||
      permissions.manageMaintenance ||
      permissions.manageSystem ||
      permissions.manageNotifications
  );
}