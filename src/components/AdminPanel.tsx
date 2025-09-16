import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { usePageTitle } from "../hooks/usePageTitle";

export function AdminPanel() {
  usePageTitle("Admin");
  const [selectedTab, setSelectedTab] = useState<"users" | "galaxies" | "settings" | "debugging">("users");
  const [sequenceSize, setSequenceSize] = useState(50);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [generatingMock, setGeneratingMock] = useState(false);
  const [generatingSequence, setGeneratingSequence] = useState(false);
  const [clearingAggregate, setClearingAggregate] = useState(false);
  
  const userProfile = useQuery(api.users.getUserProfile);
  const isAdmin = userProfile?.role === "admin";
  
  const users = useQuery(api.users.getAllUsers, isAdmin ? {} : "skip");
  const systemSettings = useQuery(api.users.getSystemSettings, isAdmin ? {} : "skip");
  const updateUserStatus = useMutation(api.users.updateUserStatus);
  const confirmUser = useMutation(api.users.confirmUser);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const resetUserPassword = useMutation(api.users.resetUserPassword);
  const deleteUser = useMutation(api.users.deleteUser);
  const createUserProfile = useMutation(api.admin.createUserProfile);
  const generateMockGalaxies = useMutation(api.galaxies_mock.generateMockGalaxies);
  const generateUserSequence = useMutation(api.galaxies_sequence.generateRandomUserSequence);
  const updateSystemSettings = useMutation(api.users.updateSystemSettings);
  const clearGalaxyIdsAggregate = useMutation(api.galaxies.clearGalaxyIdsAggregate);

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
    if (!confirm("Trigger password reset? The user will need to use 'Forgot password' to receive the email code.")) return;
    try {
      await resetUserPassword({ targetUserId: userId });
      toast.success("Reset initiated. Ask the user to use 'Forgot password'.");
    } catch (e:any) {
      toast.error("Failed to initiate reset");
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

  const handleGenerateMockGalaxies = async () => {
    try {
      setGeneratingMock(true);
      const result = await generateMockGalaxies();
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to generate mock galaxies");
      console.error(error);
    } finally {
      setGeneratingMock(false);
    }
  };

  const handleGenerateSequence = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setGeneratingSequence(true);
      const result = await generateUserSequence({
        targetUserId: selectedUserId as any,
        sequenceSize,
      });
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to generate sequence");
      console.error(error);
    } finally {
      setGeneratingSequence(false);
    }
  };

  const handleClearGalaxyAggregate = async () => {
    if (!confirm("Clear galaxy IDs aggregate? This cannot be undone.")) return;
    try {
      setClearingAggregate(true);
      const res: any = await clearGalaxyIdsAggregate();
      toast.success(res?.message || "Galaxy aggregate cleared");
    } catch (e) {
      toast.error("Failed to clear galaxy aggregate");
      console.error(e);
    } finally {
      setClearingAggregate(false);
    }
  };

  const handleUpdateSettings = async (allowAnonymous: boolean) => {
    try {
      await updateSystemSettings({ allowAnonymous });
      toast.success("Settings updated successfully");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    }
  };

  if (userProfile === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-300">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (users === undefined || systemSettings === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Manage users and system settings</p>
      </div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "users", label: "Users", icon: "👥" },
            { id: "galaxies", label: "Galaxies", icon: "🌌" },
            { id: "settings", label: "Settings", icon: "⚙️" },
            { id: "debugging", label: "Debugging", icon: "🛠️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                selectedTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {selectedTab === "users" && (
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
                            onChange={(e) => handleUpdateUserRole(userProfile.userId, e.target.value as "user" | "admin")}
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
                            onClick={() => handleCreateProfile(userProfile.userId)}
                            className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                          >
                            Create Profile
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleUserStatus(userProfile.userId, userProfile.isActive)}
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
                              onClick={() => handleConfirmUser(userProfile.userId, userProfile.isConfirmed || false)}
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
                              onClick={() => handleDeleteUser(userProfile.userId)}
                              className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => handleResetPassword(userProfile.userId)}
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
      )}

      {selectedTab === "galaxies" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Galaxy Management
            </h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Generate Mock Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Generate 100 mock galaxies for testing and development purposes.
                </p>
                <button
                  onClick={handleGenerateMockGalaxies}
                  disabled={generatingMock}
                  className="relative inline-flex items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {generatingMock && (
                    <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {generatingMock ? 'Generating...' : 'Generate Mock Galaxies'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Generate User Sequence
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={generatingSequence}
                >
                  <option value="">Select a user...</option>
                  {users.filter(user => !user._id.toString().startsWith('temp_')).map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.user?.name || user.user?.email || "Anonymous"} ({user.classificationsCount} classifications)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Sequence Size
                </label>
                <input
                  type="number"
                  min="1"
                  max="500000"
                  value={sequenceSize}
                  onChange={(e) => setSequenceSize(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={generatingSequence}
                />
              </div>
              
              <button
                onClick={handleGenerateSequence}
                disabled={!selectedUserId || generatingSequence}
                className="inline-flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {generatingSequence && (
                  <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {generatingSequence ? 'Generating Sequence...' : 'Generate New Sequence'}
              </button>
              {generatingSequence && (
                <p className="text-xs text-gray-500 dark:text-gray-400">This may take a while for large sizes...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTab === "settings" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            System Settings
          </h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Allow Anonymous Users
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Allow users to classify galaxies without admin confirmation
                </p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.allowAnonymous || false}
                onChange={(e) => handleUpdateSettings(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>
        </div>
      )}

      {selectedTab === "debugging" && (
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Debugging Tools</h1>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clear Galaxy Aggregate</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This will clear the galaxy IDs aggregate. This action cannot be undone.
            </p>
            <button
              onClick={handleClearGalaxyAggregate}
              disabled={clearingAggregate}
              className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {clearingAggregate && (
                <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {clearingAggregate ? 'Clearing...' : 'Clear Galaxy Aggregate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
