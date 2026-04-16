export const USER_ROLES = ["user", "analyst", "maintainer", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const APP_PERMISSION_KEYS = [
  "manageUsers",
  "manageGalaxyAssignments",
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
  "viewDataAnalysis",
  "viewIssueReports",
  "manageIssueReports",
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

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  user: buildPermissionRecord(),
  analyst: buildPermissionRecord({
    accessDataPage: true,
    unlimitedGalaxyExport: true,
    viewOverviewStatistics: true,
    viewLiveOverviewStatistics: true,
    viewUserStatistics: true,
    viewAssignmentStatistics: true,
    viewDataAnalysis: true,
    viewIssueReports: true,
  }),
  maintainer: buildPermissionRecord({
    manageGalaxyAssignments: true,
    viewOverviewStatistics: true,
    viewLiveOverviewStatistics: true,
    viewAssignmentStatistics: true,
    viewIssueReports: true,
  }),
  admin: buildPermissionRecord(
    APP_PERMISSION_KEYS.reduce((record, key) => {
      record[key] = true;
      return record;
    }, {} as Partial<PermissionRecord>)
  ),
};

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  analyst: "Data Analyst",
  maintainer: "Maintainer",
  admin: "Admin",
};

export const PERMISSION_METADATA: Record<
  AppPermissionKey,
  { label: string; description: string; group: "admin" | "data" | "statistics" | "reports" }
> = {
  manageUsers: {
    label: "Manage users",
    description: "View users, change roles, confirm accounts, and update activation state.",
    group: "admin",
  },
  manageGalaxyAssignments: {
    label: "Manage galaxy assignments",
    description: "Access assignment planning, sequence management, blacklist tools, and related admin galaxy pages.",
    group: "admin",
  },
  manageSettings: {
    label: "Manage settings",
    description: "Open admin settings and change application configuration.",
    group: "admin",
  },
  manageMaintenance: {
    label: "Run maintenance tools",
    description: "Access maintenance pages and operational repair workflows.",
    group: "admin",
  },
  manageSystem: {
    label: "Access system tools",
    description: "Open the system tab and system-level admin utilities.",
    group: "admin",
  },
  manageNotifications: {
    label: "Create notifications",
    description: "Compose and send project notifications.",
    group: "admin",
  },
  accessDataPage: {
    label: "Access data page",
    description: "Use the Data section and classification export workflows.",
    group: "data",
  },
  unlimitedGalaxyExport: {
    label: "Unlimited galaxy export",
    description: "Download full galaxy-browser exports without the regular-user export cap.",
    group: "data",
  },
  viewOverviewStatistics: {
    label: "View overview statistics",
    description: "Access the cached project overview tab.",
    group: "statistics",
  },
  viewLiveOverviewStatistics: {
    label: "View live overview statistics",
    description: "Access the live overview tab.",
    group: "statistics",
  },
  viewUserStatistics: {
    label: "View per-user statistics",
    description: "Access the Users tab and inspect other users' statistics.",
    group: "statistics",
  },
  viewAssignmentStatistics: {
    label: "View assignment statistics",
    description: "Access assignment statistics in the statistics area.",
    group: "statistics",
  },
  viewDataAnalysis: {
    label: "View data analysis",
    description: "Access the detailed classification data analysis tab.",
    group: "statistics",
  },
  viewIssueReports: {
    label: "View issue reports",
    description: "Open the issue reports page and inspect all reports.",
    group: "reports",
  },
  manageIssueReports: {
    label: "Manage issue reports",
    description: "Change issue report status, notes, and delete reports.",
    group: "reports",
  },
};

export function cloneRolePermissions(
  rolePermissions: RolePermissionsMatrix
): RolePermissionsMatrix {
  return USER_ROLES.reduce((matrix, role) => {
    matrix[role] = { ...rolePermissions[role] };
    return matrix;
  }, {} as RolePermissionsMatrix);
}

export function canAccessAdminPanel(
  permissions: PermissionRecord | null | undefined
) {
  return Boolean(
    permissions?.manageUsers ||
      permissions?.manageGalaxyAssignments ||
      permissions?.manageSettings ||
      permissions?.manageMaintenance ||
      permissions?.manageSystem ||
      permissions?.manageNotifications
  );
}

export function getRoleLabel(role: UserRole | string | null | undefined) {
  if (!role || !(role in ROLE_LABELS)) {
    return ROLE_LABELS.user;
  }

  return ROLE_LABELS[role as UserRole];
}