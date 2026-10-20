// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { CLASSIFICATION_SEARCH_BATCH_SIZE } from "./galaxies/browser/classificationFilters";

const modules = import.meta.glob("./**/*.ts");
const galaxy = (id: number) => ({
  id: `gal-${id}`, numericId: BigInt(id), ra: id, dec: 0, reff: 1,
  reff_pixels: 1, q: 1, pa: 0, nucleus: true, misc: {},
});

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const me = await ctx.db.insert("users", {});
    const other = await ctx.db.insert("users", {});
    const third = await ctx.db.insert("users", {});
    await ctx.db.insert("userProfiles", { userId: me, role: "admin", isActive: true, isConfirmed: true, classificationsCount: 2, joinedAt: 0, lastActiveAt: 0 });
    for (const id of [1, 2, 3, 4, 5]) await ctx.db.insert("galaxies", galaxy(id));
    const labels = [[1, me, 1, 0], [1, other, 0, 1], [2, other, 1, 1], [2, third, 1, 1], [2, me, 0, 0], [3, other, 0, -1], [5, other, -1, 2]] as const;
    for (const [id, userId, lsb_class, morphology] of labels) {
      const classificationId = await ctx.db.insert("classifications", {
        userId, galaxyExternalId: `gal-${id}`, lsb_class, morphology, awesome_flag: false, valid_redshift: false, timeSpent: 1,
      });
      if (userId === me) await ctx.db.insert("userGalaxyClassifications", {
        userId, galaxyExternalId: `gal-${id}`, galaxyNumericId: BigInt(id), classificationId, classifiedAt: id,
      });
    }
    await ctx.db.insert("galaxySequences", { userId: me, galaxyExternalIds: ["gal-2", "gal-3"], currentIndex: 0, numClassified: 1, numSkipped: 0 });
    await ctx.db.insert("skippedGalaxies", { userId: me, galaxyExternalId: "gal-2", comments: "Check later" });
    return me;
  });
  return { t: t.withIdentity({ subject: userId }), userId };
}

const base = { offset: 0, numItems: 10, sortBy: "numericId" as const, sortOrder: "asc" as const };

describe("reviewer classification search", () => {
  it("requires both selected values on the same review and returns each galaxy once", async () => {
    const { t } = await setup();
    const both = await t.query(api.galaxies.browse.browseGalaxies, { ...base, searchLsbClass: "1", searchMorphology: "1" });
    expect(both.galaxies.map((g) => g.id)).toEqual(["gal-2"]);
    const morphology = await t.query(api.galaxies.browse.browseGalaxies, { ...base, searchMorphology: "1" });
    expect(morphology.galaxies.map((g) => g.id)).toEqual(["gal-1", "gal-2"]);
    const nonLsb = await t.query(api.galaxies.browse.browseGalaxies, { ...base, searchLsbClass: "0" });
    expect(nonLsb.galaxies.map((g) => g.id)).toEqual(["gal-1", "gal-2", "gal-3"]);
    const featureless = await t.query(api.galaxies.browse.browseGalaxies, { ...base, searchMorphology: "-1" });
    expect(featureless.galaxies.map((g) => g.id)).toEqual(["gal-3"]);
    const legacy = await t.query(api.galaxies.browse.browseGalaxies, { ...base, searchLsbClass: "-1" });
    expect(legacy.galaxies.map((g) => g.id)).toEqual(["gal-5"]);
  });

  it("combines reviewer labels with personal membership, physical filters, and sorting", async () => {
    const { t } = await setup();
    for (const filter of ["classified", "my_sequence", "skipped"] as const) {
      const page = await t.query(api.galaxies.browse.browseGalaxies, { ...base, filter, searchLsbClass: "1", searchMorphology: "1" });
      expect(page.galaxies.map((g) => g.id)).toEqual(["gal-2"]);
    }
    const unclassified = await t.query(api.galaxies.browse.browseGalaxies, { ...base, filter: "unclassified", searchLsbClass: "0" });
    expect(unclassified.galaxies.map((g) => g.id)).toEqual(["gal-3"]);
    const descending = await t.query(api.galaxies.browse.browseGalaxies, { ...base, sortOrder: "desc", searchLsbClass: "0", searchRaMin: "2" });
    expect(descending.galaxies.map((g) => g.id)).toEqual(["gal-3", "gal-2"]);
  });

  it("continues past empty batches and skips matched results for an offset", async () => {
    const { t } = await setup();
    let cursor: string | undefined;
    const ids: string[] = [];
    do {
      const batch = await t.query(api.galaxies.browse.browseGalaxies, { ...base, numItems: 1, offset: 1, cursor, searchLsbClass: "0" });
      ids.push(...batch.galaxies.map((g) => g.id));
      cursor = batch.cursor ?? undefined;
    } while (cursor);
    expect(ids).toEqual(["gal-2", "gal-3"]);
  });

  it("keeps the lookahead match available on the next page", async () => {
    const { t } = await setup();
    const first = await t.query(api.galaxies.browse.browseGalaxies, { ...base, numItems: 3, searchLsbClass: "0" });
    expect(first.galaxies.map((g) => g.id)).toEqual(["gal-1", "gal-2", "gal-3"]);
    const next = await t.query(api.galaxies.browse.browseGalaxies, { ...base, cursor: first.cursorBeforeLastMatch!, searchLsbClass: "0" });
    expect(next.galaxies.map((g) => g.id)).toEqual(["gal-3"]);
  });

  it("bounds a sparse search under a transaction read limit and returns no nonmatching candidates", async () => {
    const t = convexTest({ schema, modules, transactionLimits: { documentsRead: CLASSIFICATION_SEARCH_BATCH_SIZE * 2 } });
    const lastId = CLASSIFICATION_SEARCH_BATCH_SIZE * 3;
    const userId = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", {});
      for (let id = 0; id <= lastId; id++) await ctx.db.insert("galaxies", galaxy(id));
      await ctx.db.insert("classifications", {
        userId: user, galaxyExternalId: `gal-${lastId}`, lsb_class: 1, morphology: 2,
        awesome_flag: false, valid_redshift: false, timeSpent: 1,
      });
      return user;
    });
    const client = t.withIdentity({ subject: userId });
    const first = await client.query(api.galaxies.browse.browseGalaxies, { ...base, numItems: CLASSIFICATION_SEARCH_BATCH_SIZE, searchLsbClass: "1" });
    expect(first.galaxies).toEqual([]);
    expect(first.scanIncomplete).toBe(true);
    let cursor = first.cursor;
    const ids: string[] = [];
    while (cursor) {
      const next = await client.query(api.galaxies.browse.browseGalaxies, { ...base, numItems: CLASSIFICATION_SEARCH_BATCH_SIZE, cursor, searchLsbClass: "1" });
      ids.push(...next.galaxies.map((g) => g.id));
      cursor = next.cursor;
    }
    expect(ids).toEqual([`gal-${lastId}`]);
  });

  it("uses the same matching semantics for counts, exports, and saved views", async () => {
    const { t } = await setup();
    const filters = { searchLsbClass: "1", searchMorphology: "1" };
    const count = await t.query(api.galaxies.count.countFilteredGalaxiesBatch, { ...filters, batchSize: 10 });
    expect(count.count).toBe(1);
    const exported = await t.query(api.galaxies.export.exportGalaxiesBatch, { ...filters, batchSize: 10 });
    expect(exported.galaxies.map((g: { id: string }) => g.id)).toEqual(["gal-2"]);
    const saved = await t.mutation(api.galaxies.viewState.ensureBrowserView, { state: {
      filter: "all", sortBy: "numericId", sortOrder: "asc", isSearchActive: true, ...filters,
    } });
    const resolved = await t.query(api.galaxies.viewState.resolveBrowserView, { viewKey: saved.viewKey });
    expect(resolved.state).toMatchObject(filters);
  });
});
