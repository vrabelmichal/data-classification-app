import { query } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId } from "./lib/auth";

// Get image URL for a galaxy image with optional quality override
export const getImageUrl = query({
  args: {
    galaxyId: v.string(),
    imageName: v.string(),
    quality: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx);
    
    // Get user preferences for image quality if not specified
    let imageQuality = args.quality;
    if (!imageQuality && userId) {
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      imageQuality = prefs?.imageQuality || "medium";
    } else if (!imageQuality) {
      imageQuality = "medium"; // default for anonymous users
    }

    // Return the necessary data for the frontend to construct the URL
    // The frontend will use the image provider system to generate the actual URL
    return {
      galaxyId: args.galaxyId,
      imageName: args.imageName,
      quality: imageQuality,
    };
  },
});

// Get multiple image URLs for a galaxy
export const getGalaxyImageUrls = query({
  args: {
    galaxyId: v.string(),
    imageNames: v.array(v.string()),
    quality: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    console.log("Galaxy Image Request", args.galaxyId);
    console.log("Requested imageNames:", args.imageNames);

  const userId = await getOptionalUserId(ctx);
    
    console.log("User ID:", userId);


    // Get user preferences for image quality if not specified
    let imageQuality = args.quality;
    if (!imageQuality && userId) {
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      imageQuality = prefs?.imageQuality || "medium";
    } else if (!imageQuality) {
      imageQuality = "medium"; // default for anonymous users
    }

    console.log("Using imageQuality:", imageQuality);

    // Return data for all requested images
    return args.imageNames.map(imageName => ({
      galaxyId: args.galaxyId,
      imageName,
      quality: imageQuality,
    }));
  },
});
