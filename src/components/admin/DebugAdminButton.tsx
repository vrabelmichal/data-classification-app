import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

export function DebugAdminButton() {
  const userProfile = useQuery(api.users.getUserProfile);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const becomeAdmin = useMutation(api.users.becomeAdmin);

  const handleBecomeAdmin = async () => {
    try {
      await becomeAdmin();
      toast.success("You are now an admin!");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to become admin");
      console.error(error);
    }
  };

  // Only show if debug admin mode is enabled and user is not already admin
  if (!systemSettings?.debugAdminMode || (userProfile && userProfile.role === "admin")) {
    return null;
  }

  return (
    <button
      onClick={handleBecomeAdmin}
      className="px-3 py-1 text-xs font-medium text-orange-600 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 rounded-lg transition-colors"
      title="Debug: Become admin (development only)"
    >
      Become Admin
    </button>
  );
}