// convex/ingest.ts
import {
  httpAction,
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { galaxySchemaDefinition, photometryBandSchema, photometryBandSchemaR, photometryBandSchemaI, sourceExtractorSchema, thuruthipillySchema } from "../schema";
// Ingestion now expects each array element shaped as:
// {
//   galaxy: { core galaxy fields },
//   photometryBand?: { sersic: {...} }, // g band
//   photometryBandR?: { sersic?: {...} },
//   photometryBandI?: { sersic?: {...} },
//   sourceExtractor?: { g:{}, r:{}, i:{}, y?:{}, z?:{} },
//   thuruthipilly?: { ... }
// }
import { insertGalaxy } from "./core";
import { galaxyIdsAggregate } from "./aggregates";

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
// Individual object validators mirroring split tables
const galaxyCoreSchema = v.object(galaxySchemaDefinition);
const gBandSchema = v.optional(v.union(
  v.null(),
  v.object({ sersic: photometryBandSchema.sersic } as any)
));
const rBandSchema = v.optional(v.union(
  v.null(),
  v.object({ sersic: photometryBandSchemaR.sersic } as any)
));
const iBandSchema = v.optional(v.union(
  v.null(),
  v.object({ sersic: photometryBandSchemaI.sersic } as any)
));
const sourceExtractorSplitSchema = v.optional(v.union(
  v.null(),
  v.object({
    g: sourceExtractorSchema.g,
    r: sourceExtractorSchema.r,
    i: sourceExtractorSchema.i,
    y: sourceExtractorSchema.y ?? v.optional(v.object({})),
    z: sourceExtractorSchema.z ?? v.optional(v.object({})),
  })
));
const thuruthipillySplitSchema = v.optional(v.union(
  v.null(),
  v.object({
    n: thuruthipillySchema.n,
    q: thuruthipillySchema.q,
    reff_g: thuruthipillySchema.reff_g,
    reff_i: thuruthipillySchema.reff_i,
    mag_g_cor: thuruthipillySchema.mag_g_cor,
    mag_g_gf: thuruthipillySchema.mag_g_gf,
    mag_i_cor: thuruthipillySchema.mag_i_cor,
    mag_i_gf: thuruthipillySchema.mag_i_gf,
    mue_mean_g_gf: thuruthipillySchema.mue_mean_g_gf,
    mu_mean_g_cor: thuruthipillySchema.mu_mean_g_cor,
    mue_mean_i_gf: thuruthipillySchema.mue_mean_i_gf,
    mu_mean_i_cor: thuruthipillySchema.mu_mean_i_cor,
  })
));

// New batch item schema
const batchGalaxyItem = v.object({
  galaxy: galaxyCoreSchema,
  photometryBand: gBandSchema,       // g band
  photometryBandR: rBandSchema,
  photometryBandI: iBandSchema,
  sourceExtractor: sourceExtractorSplitSchema,
  thuruthipilly: thuruthipillySplitSchema,
});

const batchArgs = {
  galaxies: v.array(batchGalaxyItem),
};

/**
 * Helper (plain TypeScript) — does the DB work.
 * FAIL-FAST: Any error will throw and roll back the entire batch.
 * This ensures atomicity - either all galaxies in the batch are inserted, or none.
 */
async function insertGalaxiesBatchHelper(
  ctx: MutationCtx,
  galaxies: Array<any>
) {
  const results = {
    inserted: 0,
    skipped: 0,
    totalInBatch: galaxies.length,
  };

  // Find maximum value of numericId so far using galaxyIdsAggregate
  const maxNumericIdFromAgg = await galaxyIdsAggregate.max(ctx);
  let resolvedNumericId = maxNumericIdFromAgg !== null ? maxNumericIdFromAgg.key + BigInt(1) : BigInt(1);

  for (let index = 0; index < galaxies.length; index++) {
    const item = galaxies[index];
    const { galaxy, photometryBand, photometryBandR, photometryBandI, sourceExtractor, thuruthipilly } = item;
    const galaxyExternalId = galaxy?.id || 'unknown';

    // Check existence in core table by external id
    const existing = await ctx.db
      .query("galaxyIds")
      .withIndex("by_external_id", (q) => q.eq("id", galaxy.id))
      .unique();
    
    if (existing) {
      results.skipped++;
      continue;
    }

    // No try/catch here - let errors propagate to fail the entire mutation
    // This ensures the transaction is rolled back on any failure
    try {
      await insertGalaxy(
        ctx,
        galaxy,
        photometryBand || undefined,
        photometryBandR || undefined,
        photometryBandI || undefined,
        sourceExtractor || undefined,
        thuruthipilly || undefined,
        resolvedNumericId
      );
    } catch (error) {
      // Re-throw with more context about which galaxy failed
      throw new Error(
        `Failed at batch index ${index}, galaxy external ID "${galaxyExternalId}": ${String(error)}`
      );
    }

    results.inserted++;
    resolvedNumericId++;
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
 * 
 * FAIL-FAST: Returns HTTP 500 on any insertion error with detailed error info.
 * The mutation is atomic - on error, all writes are rolled back.
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

  // 3) Validate body structure before calling mutation
  if (!body || typeof body !== 'object' || !('galaxies' in body)) {
    return new Response(
      JSON.stringify({ error: "Invalid body structure", detail: "Expected { galaxies: [...] }" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const galaxiesArray = (body as { galaxies: unknown }).galaxies;
  if (!Array.isArray(galaxiesArray)) {
    return new Response(
      JSON.stringify({ error: "Invalid body structure", detail: "'galaxies' must be an array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4) Call internal mutation via internal reference
  try {
    const results = await ctx.runMutation(
      internal.galaxies.batch_ingest.insertGalaxiesBatchInternal,
      body as any // Convex validates against `batchArgs` at runtime
    );

    // Success - all galaxies in batch were processed
    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Mutation failed - entire batch was rolled back
    // Return 500 to signal failure to client
    const errorMessage = String(err);
    console.error("Batch ingestion failed:", errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Batch ingestion failed",
        detail: errorMessage,
        // Help client understand the batch was NOT committed
        rollback: true,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
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

