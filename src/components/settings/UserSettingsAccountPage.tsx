interface UserSettingsAccountPageProps {
  displayName: string;
  displayEmail: string;
  displayRole: string;
  profile: any;
  authUser: any;
}

export function UserSettingsAccountPage({
  displayName,
  displayEmail,
  displayRole,
  profile,
  authUser,
}: UserSettingsAccountPageProps) {
  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Details</h2>

        <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Name</div>
            <div className="font-medium">{displayName || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
            <div className="font-medium break-all">{displayEmail || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Role</div>
            <div className="font-medium">{displayRole}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Profile ID</div>
            <div className="font-medium break-all">{profile?._id ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">User ID (ref)</div>
            <div className="font-medium break-all">{profile?.userId ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
            <div className="font-medium">{profile?.isActive ? "Yes" : "No"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Confirmed</div>
            <div className="font-medium">{profile?.isConfirmed ? "Yes" : "No"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Classifications</div>
            <div className="font-medium">{profile?.classificationsCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Joined</div>
            <div className="font-medium">{profile?.joinedAt ? new Date(profile.joinedAt).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Last Active</div>
            <div className="font-medium">{profile?.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sequence Generated</div>
            <div className="font-medium">{profile?.sequenceGenerated ? "Yes" : "No"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Profile Created</div>
            <div className="font-medium">{profile?._creationTime ? new Date(profile._creationTime).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Email Verified</div>
            <div className="font-medium">{authUser?.emailVerificationTime ? new Date(authUser.emailVerificationTime).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">User doc ID</div>
            <div className="font-medium break-all">{authUser?._id ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">User Created</div>
            <div className="font-medium">{authUser?._creationTime ? new Date(authUser._creationTime).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Phone</div>
            <div className="font-medium">{authUser?.phone ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Phone Verified</div>
            <div className="font-medium">{authUser?.phoneVerificationTime ? new Date(authUser.phoneVerificationTime).toLocaleString() : "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Anonymous</div>
            <div className="font-medium">{authUser?.isAnonymous ? "Yes" : "No"}</div>
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Image URL</div>
            <div className="font-medium break-all">{authUser?.image ?? "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}