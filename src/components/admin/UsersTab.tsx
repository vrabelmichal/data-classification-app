import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface UsersTabProps {
  users: any[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function fmt(value: number, decimals = 1): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : "N/A";
}

export function UsersTab({ users }: UsersTabProps) {
  const updateUserStatus = useMutation(api.users.updateUserStatus);
  const confirmUser = useMutation(api.users.confirmUser);
  const updateUserRole = useMutation(api.users.updateUserRole);
  // const resetUserPassword = useAction(api.users.resetUserPassword);   // Does not work at the moment, we need to modify convex's authVerificationCodes table in a proper way. Not sure if there is an API for that. 
  const deleteUser = useMutation(api.users.deleteUser);
  const createUserProfile = useMutation(api.admin.createUserProfile);

  const handleToggleUserStatus = async (userId: any, currentStatus: boolean) => {
    try {
      await updateUserStatus({
        targetUserId: userId,
        isActive: !currentStatus,
      });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error("Failed to update user status");
      console.error(error);
    }
  };

  const handleConfirmUser = async (userId: any, currentStatus: boolean) => {
    try {
      await confirmUser({
        targetUserId: userId,
        isConfirmed: !currentStatus,
      });
      toast.success(`User ${!currentStatus ? 'confirmed' : 'unconfirmed'} successfully`);
    } catch (error) {
      toast.error("Failed to update user confirmation");
      console.error(error);
    }
  };

  const handleUpdateUserRole = async (userId: any, newRole: "user" | "admin") => {
    try {
      await updateUserRole({
        targetUserId: userId,
        role: newRole,
      });
      toast.success("User role updated successfully");
    } catch (error) {
      toast.error("Failed to update user role");
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: any) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteUser({ targetUserId: userId });
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user");
      console.error(error);
    }
  };

  // const handleResetPassword = async (userId: any) => {
  //   if (!confirm("Send password reset email to this user?")) return;
  //   try {
  //     await resetUserPassword({ targetUserId: userId });
  //     toast.success("Password reset email sent successfully.");
  //   } catch (e:any) {
  //     toast.error("Failed to send reset email");
  //     console.error(e);
  //   }
  // };

  const handleCreateProfile = async (userId: any) => {
    try {
      await createUserProfile({ targetUserId: userId });
      toast.success("User profile created successfully");
    } catch (error) {
      toast.error("Failed to create user profile");
      console.error(error);
    }
  };

  const handleDownloadUsers = () => {
    // Create CSV content
    const headers = ["Name", "Email", "Role", "Classifications", "Assigned Galaxies", "Joined At", "Active", "Confirmed"];
    const rows = users.map(userProfile => {
      const hasProfile = !userProfile._id.toString().startsWith('temp_');
      const registered = hasProfile && userProfile.joinedAt ? new Date(userProfile.joinedAt).toISOString() : "N/A";

      return [
        userProfile.user?.name || "Anonymous",
        userProfile.user?.email || "No email",
        hasProfile ? userProfile.role : "No Profile",
        userProfile.classificationsCount || 0,
        userProfile.assignedGalaxiesCount ?? 0,
        registered,
        hasProfile ? (userProfile.isActive ? "Active" : "Inactive") : "N/A",
        hasProfile ? (userProfile.isConfirmed ? "Confirmed" : "Pending") : "N/A"
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => {
        // Escape cells that contain commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Users exported successfully");
  };

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              User Management
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Manage user accounts and permissions
            </p>
          </div>
          <button
            title={"Download CSV of users (Name, Email, Role, Classifications, Active, Confirmed)"}
            onClick={handleDownloadUsers}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Classifications
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Assigned
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Joined At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((userProfile) => {
              const hasProfile = !userProfile._id.toString().startsWith('temp_');
              
              return (
                <tr key={userProfile._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {userProfile.user?.name?.charAt(0) || userProfile.user?.email?.charAt(0) || "?"}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {userProfile.user?.name || "Anonymous"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {userProfile.user?.email || "No email"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {!hasProfile ? (
                      <span className="text-sm text-gray-500 dark:text-gray-400">No Profile</span>
                    ) : (
                      <select
                        value={userProfile.role}
                        onChange={(e) => void (async () => { await handleUpdateUserRole(userProfile.userId, e.target.value as "user" | "admin"); })()}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {userProfile.classificationsCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {(userProfile.assignedGalaxiesCount ?? 0) > 0 ? (
                      <span>{userProfile.assignedGalaxiesCount}</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {hasProfile && userProfile.joinedAt ? (
                      <time
                        dateTime={new Date(userProfile.joinedAt).toISOString()}
                        title={new Date(userProfile.joinedAt).toLocaleString()}
                        onClick={() => toast(`Joined at ${new Date(userProfile.joinedAt).toLocaleString()}`)}
                        className="cursor-default"
                      >
                        {new Date(userProfile.joinedAt).toLocaleDateString()}
                      </time>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {!hasProfile ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                        No Profile
                      </span>
                    ) : (
                      <div className="flex flex-col space-y-1">
                        <span className={cn(
                          "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                          userProfile.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                          {userProfile.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className={cn(
                          "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                          userProfile.isConfirmed
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        )}>
                          {userProfile.isConfirmed ? "Confirmed" : "Pending"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {!hasProfile ? (
                      <button
                        onClick={() => void (async () => { await handleCreateProfile(userProfile.userId); })()}
                        className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                      >
                        Create Profile
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => void (async () => { await handleToggleUserStatus(userProfile.userId, userProfile.isActive); })()}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium transition-colors",
                            userProfile.isActive
                              ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                          )}
                        >
                          {userProfile.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => void (async () => { await handleConfirmUser(userProfile.userId, userProfile.isConfirmed || false); })()}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium transition-colors",
                            userProfile.isConfirmed
                              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                          )}
                        >
                          {userProfile.isConfirmed ? "Unconfirm" : "Confirm"}
                        </button>
                        <button
                          onClick={() => void (async () => { await handleDeleteUser(userProfile.userId); })()}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                        {/* <button
                          onClick={() => void (async () => { await handleResetPassword(userProfile.userId); })()}
                          className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 transition-colors"
                        >
                          Reset PW
                        </button> */}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No users found</p>
        </div>
      )}
    </div>
    {users.length > 0 && <UsersStatsPanel users={users} />}
    </>
  );
}

function UsersStatsPanel({ users }: { users: any[] }) {
  const profileUsers = users.filter(u => !u._id.toString().startsWith('temp_'));

  // Assigned galaxies
  const assignedCounts = users.map(u => u.assignedGalaxiesCount ?? 0);
  const withAssigned = assignedCounts.filter(c => c > 0);
  const withoutAssigned = assignedCounts.filter(c => c === 0).length;

  const avgAssigned = withAssigned.length > 0
    ? withAssigned.reduce((a, b) => a + b, 0) / withAssigned.length
    : 0;
  const maxAssigned = withAssigned.length > 0 ? Math.max(...withAssigned) : 0;
  const minAssigned = withAssigned.length > 0 ? Math.min(...withAssigned) : 0;
  const medAssigned = median(withAssigned);

  // Classification counts (all users)
  const classCounts = users.map(u => u.classificationsCount ?? 0);
  const nonZeroClass = classCounts.filter(c => c > 0);
  const avgClass = classCounts.length > 0
    ? classCounts.reduce((a, b) => a + b, 0) / classCounts.length
    : 0;
  const maxClass = classCounts.length > 0 ? Math.max(...classCounts) : 0;
  const medClass = median(classCounts);

  // Pending approval
  const pendingApproval = profileUsers.filter(u => !u.isConfirmed).length;

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </div>
  );

  const SectionTitle = ({ children }: { children: ReactNode }) => (
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 mt-2">{children}</h3>
  );

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">User Statistics</h2>

      {/* Overview */}
      <SectionTitle>Overview</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="With Profile" value={profileUsers.length} />
        <StatCard label="Pending Approval" value={pendingApproval} sub="awaiting confirmation" />
        <StatCard label="No Assigned Galaxies" value={withoutAssigned} sub={`${withAssigned.length} have assignments`} />
      </div>

      {/* Assigned galaxies */}
      <SectionTitle>Assigned Galaxies (users with assignments only)</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Avg Assigned" value={fmt(avgAssigned)} />
        <StatCard label="Max Assigned" value={maxAssigned > 0 ? maxAssigned : "—"} />
        <StatCard label="Min Assigned" value={minAssigned > 0 ? minAssigned : "—"} />
        <StatCard label="Median Assigned" value={medAssigned > 0 ? fmt(medAssigned) : "—"} />
      </div>

      {/* Classifications */}
      <SectionTitle>Classifications (all users)</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Avg Classified" value={fmt(avgClass)} />
        <StatCard label="Max Classified" value={maxClass} />
        <StatCard label="Median Classified" value={fmt(medClass)} />
        <StatCard label="Active classifiers" value={nonZeroClass.length} sub="users with ≥1 classification" />
      </div>
    </div>
  );
}