import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

interface UsersTabProps {
  users: any[];
}

export function UsersTab({ users }: UsersTabProps) {
  const updateUserStatus = useMutation(api.users.updateUserStatus);
  const confirmUser = useMutation(api.users.confirmUser);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const resetUserPassword = useAction(api.users.resetUserPassword);
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

  const handleResetPassword = async (userId: any) => {
    if (!confirm("Send password reset email to this user?")) return;
    try {
      await resetUserPassword({ targetUserId: userId });
      toast.success("Password reset email sent successfully.");
    } catch (e:any) {
      toast.error("Failed to send reset email");
      console.error(e);
    }
  };

  const handleCreateProfile = async (userId: any) => {
    try {
      await createUserProfile({ targetUserId: userId });
      toast.success("User profile created successfully");
    } catch (error) {
      toast.error("Failed to create user profile");
      console.error(error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          User Management
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Manage user accounts and permissions
        </p>
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
                        <button
                          onClick={() => void (async () => { await handleResetPassword(userProfile.userId); })()}
                          className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 transition-colors"
                        >
                          Reset PW
                        </button>
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
  );
}