import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAdminCloudflareCachePurgeAvailability() {
  const userProfile = useQuery(api.users.getUserProfile);
  const isAdmin = userProfile?.role === "admin";
  const status = useQuery(api.cloudflareCache.getAdminPurgeStatus, isAdmin ? {} : "skip");

  return {
    isAdmin,
    status,
    isAvailable: status?.available === true,
    isCheckingAvailability:
      userProfile === undefined || (isAdmin && status === undefined),
  };
}