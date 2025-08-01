import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminButton() {
  const userProfile = useQuery(api.users.getUserProfile);
  const makeCurrentUserAdmin = useMutation(api.admin.makeCurrentUserAdmin);

  const handleBecomeAdmin = async () => {
    try {
      const result = await makeCurrentUserAdmin();
      toast.success(result.message);
      window.location.reload();
    } catch (error) {
      toast.error("Failed to make admin");
      console.error(error);
    }
  };

  if (!userProfile || userProfile.role === "admin") {
    return null;
  }

  return (
    <button
      onClick={handleBecomeAdmin}
      className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
      title="Make yourself admin for testing"
    >
      Become Admin
    </button>
  );
}
