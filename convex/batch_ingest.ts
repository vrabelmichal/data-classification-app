// convex/ingest.ts
import {
  httpAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { galaxySchemaDefinition } from "./schema";
import { insertGalaxy } from "./galaxies";

/**
 * Constant-time comparison to avoid timing leaks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Schemas
 */
// Match extended schema in `schema.ts` (imageUrl removed; new nested objects)
const galaxySchema = v.object(galaxySchemaDefinition);

const batchArgs = {
  galaxies: v.array(galaxySchema),
};

/**
 * Helper (plain TypeScript) — does the DB work.
 * This is where your original mutation logic lives.
 */
async function insertGalaxiesBatchHelper(
  ctx: MutationCtx,
  galaxies: Array<any>
) {
  const results = {
    inserted: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const galaxy of galaxies) {
    try {
      const existing = await ctx.db
        .query("galaxyIds")
        .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
        .unique();

      if (existing) {
        results.skipped++;
        continue;
      }

      // Supply defaults for required nested objects if missing
      const toInsert = {
        ...galaxy,
        photometry: galaxy.photometry ?? {
          g: { sersic: {}, source_extractor: {} },
          r: { sersic: {}, source_extractor: {} },
          i: { sersic: {}, source_extractor: {} },
        },
        misc: galaxy.misc ?? {},
        thuruthipilly: galaxy.thuruthipilly ?? {},
      };
      // await ctx.db.insert("galaxies", toInsert);
      // await galaxiesAggregate.insert(ctx, toInsert);
      // const id = await ctx.db.insert("galaxies", toInsert);
      // const doc = await ctx.db.get(id);
      // await galaxiesAggregate.insert(ctx, doc!);

      // insertGalaxy(ctx, toInsert);

      results.inserted++;
    } catch (error) {
      results.errors.push(`Error inserting galaxy ${galaxy.id}: ${String(error)}`);
    }
  }

  return results;
}

/**
 * Internal mutation — safe to call using `ctx.runMutation(internal.ingest.*)`
 * Validates args with Convex `v` and then calls the helper.
 */
export const insertGalaxiesBatchInternal = internalMutation({
  args: batchArgs,
  handler: async (ctx, { galaxies }) => {
    return insertGalaxiesBatchHelper(ctx, galaxies);
  },
});

/**
 * Public HTTP action — verifies token, parses JSON,
 * and then calls the INTERNAL mutation by reference.
 */
export const ingestGalaxiesHttp = httpAction(async (ctx, request) => {
  // 1) Auth
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Bearer token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const presented = auth.slice(7).trim();
  const expected = process.env.INGEST_TOKEN || "";
  if (!presented || !expected || !timingSafeEqual(presented, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3) Call internal mutation via internal reference
  try {
    const results = await ctx.runMutation(
      internal.batch_ingest.insertGalaxiesBatchInternal,
      body as any // Convex validates against `batchArgs` at runtime
    );

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Validation failures or handler errors end up here
    return new Response(
      JSON.stringify({
        error: "Validation or processing error",
        detail: String(err),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});


// -----------


export const ping = httpAction(async (_ctx, _request) => {
    return new Response(JSON.stringify({ message: "pong" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});

