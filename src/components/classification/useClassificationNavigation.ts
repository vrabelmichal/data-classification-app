import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import type { GalaxyData, NavigationStateOrNull } from "./types";

export function useClassificationNavigation(currentGalaxy: GalaxyData | null, navigation: NavigationStateOrNull) {
  const navigate = useNavigate();
  const navigateToGalaxy = useMutation(api.galaxies.navigation.navigateToGalaxyInSequence);

  const handlePrevious = useCallback(async () => {
    if (!currentGalaxy || !navigation?.hasPrevious) return;
    try {
      const result = await navigateToGalaxy({ 
        direction: "previous", 
        currentGalaxyExternalId: currentGalaxy.id 
      });
      if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
      return result.galaxy;
    } catch (error) {
      toast.error("Failed to navigate to previous galaxy");
      console.error(error);
    }
  }, [currentGalaxy, navigation, navigateToGalaxy, navigate]);

  const handleNext = useCallback(async () => {
    if (!currentGalaxy || !navigation?.hasNext) return;
    try {
      const result = await navigateToGalaxy({ 
        direction: "next", 
        currentGalaxyExternalId: currentGalaxy.id 
      });
      if (result.galaxy?.id) navigate(`/classify/${result.galaxy.id}`);
      return result.galaxy;
    } catch (error) {
      toast.error("Failed to navigate to next galaxy");
      console.error(error);
    }
  }, [currentGalaxy, navigation, navigateToGalaxy, navigate]);

  return {
    handlePrevious,
    handleNext,
  };
}
