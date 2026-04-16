import {
  APP_PERMISSION_KEYS,
  PERMISSION_METADATA,
  ROLE_LABELS,
  USER_ROLES,
  cloneRolePermissions,
} from "../../../lib/permissions";
import { usePageTitle } from "../../../hooks/usePageTitle";
import type { SettingsPageProps } from "./types";

const permissionGroups = ["statistics", "data", "reports", "admin"] as const;
const editablePermissionKeys = [
  "manageUsers",
  "manageGalaxyAssignments",
  "manageSettings",
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

export function PermissionsSettingsPage({
  localSettings,
  handleSettingChange,
}: SettingsPageProps) {
  usePageTitle("Admin – Settings – Permissions");

  const updatePermission = (
    role: Exclude<(typeof USER_ROLES)[number], "admin">,
    permission: (typeof APP_PERMISSION_KEYS)[number],
    checked: boolean
  ) => {
    const nextRolePermissions = cloneRolePermissions(localSettings.rolePermissions);
    nextRolePermissions[role][permission] = checked;
    handleSettingChange("rolePermissions", nextRolePermissions);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Role Permissions
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Define which role can access each protected area. Admin access is always enforced as full access.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        Admin users always keep every permission, even if boxes are unchecked elsewhere. The admin row is read-only on purpose.
      </div>

      {permissionGroups.map((group) => {
        const groupEntries = editablePermissionKeys.filter(
          (permission) => PERMISSION_METADATA[permission].group === group
        );

        if (groupEntries.length === 0) {
          return null;
        }

        return (
          <div
            key={group}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {group} Permissions
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Permission
                    </th>
                    {USER_ROLES.map((role) => (
                      <th
                        key={role}
                        className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                      >
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
                  {groupEntries.map((permission) => {
                    const metadata = PERMISSION_METADATA[permission];
                    return (
                      <tr key={permission}>
                        <td className="py-4 pr-4 align-top">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {metadata.label}
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                            {metadata.description}
                          </div>
                        </td>
                        {USER_ROLES.map((role) => (
                          <td key={`${permission}-${role}`} className="px-3 py-4 text-center align-top">
                            <input
                              type="checkbox"
                              checked={localSettings.rolePermissions[role][permission]}
                              disabled={role === "admin"}
                              onChange={(event) => {
                                if (role === "admin") {
                                  return;
                                }

                                updatePermission(role, permission, event.target.checked);
                              }}
                              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}