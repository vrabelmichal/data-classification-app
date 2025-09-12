import { query } from "./_generated/server";
import { v } from "convex/values";

const tables = [
  "galaxies",
  "userProfiles",
  "userPreferences",
  "classifications",
  "skippedGalaxies",
  "galaxySequences",
  "systemSettings",
  // Include auth table optionally
  "users",
] as const;

// type TableName = (typeof tables)[number];

// export const exportTable = query({
//   args: {
//     table: v.union(
//       v.literal("galaxies"),
//       v.literal("userProfiles"),
//       v.literal("userPreferences"),
//       v.literal("classifications"),
//       v.literal("skippedGalaxies"),
//       v.literal("galaxySequences"),
//       v.literal("systemSettings"),
//       v.literal("users"),
//     ),
//   },
//   handler: async (ctx, args) => {
//     const t = args.table as TableName;
//     switch (t) {
//       case "galaxies":
//         return await ctx.db.query("galaxies").collect();
//       case "userProfiles":
//         return await ctx.db.query("userProfiles").collect();
//       case "userPreferences":
//         return await ctx.db.query("userPreferences").collect();
//       case "classifications":
//         return await ctx.db.query("classifications").collect();
//       case "skippedGalaxies":
//         return await ctx.db.query("skippedGalaxies").collect();
//       case "galaxySequences":
//         return await ctx.db.query("galaxySequences").collect();
//       case "systemSettings":
//         return await ctx.db.query("systemSettings").collect();
//       case "users":
//         return await ctx.db.query("users").collect();
//       default:
//         throw new Error("Unsupported table");
//     }
//   },
// });
