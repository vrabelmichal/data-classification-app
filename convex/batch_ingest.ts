// // convex/ingest.ts
// import { httpAction, mutation } from "./_generated/server";
// import { v } from "convex/values";

// // Constant-time compare to mitigate timing attacks
// function timingSafeEqual(a: string, b: string): boolean {
//   if (a.length !== b.length) return false;
//   // XOR char codes so runtime depends on full length
//   let result = 0;
//   for (let i = 0; i < a.length; i++) {
//     result |= a.charCodeAt(i) ^ b.charCodeAt(i);
//   }
//   return result === 0;
// }

// // Schema for the incoming payload
// const galaxySchema = v.object({
//   id: v.string(),
//   ra: v.number(),
//   dec: v.number(),
//   reff: v.number(),
//   q: v.number(),
//   pa: v.number(),
//   nucleus: v.boolean(),
//   imageUrl: v.optional(v.string()),
//   isActive: v.optional(v.boolean()),
//   redshift_x: v.optional(v.number()),
//   redshift_y: v.optional(v.number()),
//   x: v.optional(v.number()),
//   y: v.optional(v.number()),
// });

// const payloadSchema = v.object({
//   galaxies: v.array(galaxySchema),
// });

// // Private mutation: not exposed publicly; only called from our httpAction
// export const insertGalaxiesBatchInternal = mutation({
//   args: {
//     galaxies: v.array(galaxySchema),
//   },
//   handler: async (ctx, args) => {
//     const results = {
//       inserted: 0,
//       skipped: 0,
//       errors: [] as string[],
//     };

//     for (const galaxy of args.galaxies) {
//       try {
//         // Check if galaxy with this external ID already exists
//         const existing = await ctx.db
//           .query("galaxies")
//           .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
//           .unique();

//         if (existing) {
//           results.skipped++;
//           continue;
//         }

//         // Insert the new galaxy
//         await ctx.db.insert("galaxies", galaxy);
//         results.inserted++;
//       } catch (error: any) {
//         results.errors.push(
//           `Error inserting galaxy ${galaxy.id}: ${String(error)}`
//         );
//       }
//     }

//     return results;
//   },
// });

// // Public HTTP endpoint: verifies token, validates body, invokes internal mutation
// export const ingestGalaxiesHttp = httpAction(async (ctx, request) => {
//   try {
//     const auth = request.headers.get("authorization") || "";
//     const isBearer = auth.startsWith("Bearer ");
//     if (!isBearer) {
//       return new Response(JSON.stringify({ error: "Missing Bearer token" }), {
//         status: 401,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     const presented = auth.slice(7).trim();
//     const expected = process.env.INGEST_TOKEN;
//     if (!expected || !presented || !timingSafeEqual(presented, expected)) {
//       return new Response(JSON.stringify({ error: "Unauthorized" }), {
//         status: 401,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     // Parse and validate JSON body
//     const body = await request.json();
//     const parsed = payloadSchema.parse(body); // Convex v schema supports parse

//     // Call the internal mutation
//     const results = await ctx.runMutation(
//       insertGalaxiesBatchInternal as any,
//       { galaxies: parsed.galaxies }
//     );

//     return new Response(JSON.stringify(results), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (err: any) {
//     return new Response(
//       JSON.stringify({ error: "Bad Request", detail: String(err) }),
//       { status: 400, headers: { "Content-Type": "application/json" } }
//     );
//   }
// });