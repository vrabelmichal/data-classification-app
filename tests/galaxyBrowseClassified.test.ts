import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleClassifiedGalaxies } from "../convex/galaxies/browser/specialFilters";
import { buildGalaxyBrowseQuery } from "../convex/galaxies/browser/queryBuilder";

vi.mock("../convex/galaxies/browser/queryBuilder", () => ({ buildGalaxyBrowseQuery: vi.fn() }));

const galaxies = [
  { id: "gal-3", numericId: 3n, nucleus: true, numVisibleNucleus: 1n },
  { id: "gal-2", numericId: 2n, nucleus: false, numVisibleNucleus: 0n },
  { id: "gal-1", numericId: 1n, nucleus: true, numVisibleNucleus: 2n },
];

function setup() {
  const records = galaxies.map((g) => ({
    galaxyExternalId: g.id, galaxyNumericId: g.numericId,
    classificationId: `classification-${g.id}`, classifiedAt: 42,
  }));
  let reads = 0;
  const order = vi.fn((direction: string) => ({
    async *[Symbol.asyncIterator]() {
      for (const record of direction === "desc" ? records : [...records].reverse()) {
        reads++;
        yield record;
      }
    },
  }));
  const withIndex = vi.fn(() => ({ order }));
  const ctx = { db: { query: vi.fn(() => ({ withIndex })) } };
  vi.mocked(buildGalaxyBrowseQuery).mockImplementation((_ctx, sort, _order, filters) => {
    expect(sort).toBe("id");
    return { first: async () => galaxies.find((g) => g.id === filters.searchId &&
      (filters.searchNucleus === undefined || g.nucleus === filters.searchNucleus) &&
      (!filters.searchNumVisibleNucleusMin || g.numVisibleNucleus >= BigInt(filters.searchNumVisibleNucleusMin))) ?? null };
  });
  return { ctx, withIndex, order, reads: () => reads };
}

const options = {
  userId: "user-1", cursor: null, numItems: 1,
  sortOrder: "desc" as const, requestedSort: "numericId" as const,
  filterType: "classified" as const, filters: {},
};

describe("classified galaxy browse using the existing membership index", () => {
  beforeEach(() => vi.clearAllMocks());

  it("browses without search filters and stops after one lookahead match", async () => {
    const db = setup();
    const page = await handleClassifiedGalaxies({ ...options, ctx: db.ctx });
    expect(db.withIndex).toHaveBeenCalledWith("by_user_numericId", expect.any(Function));
    expect(db.order).toHaveBeenCalledWith("desc");
    expect(db.reads()).toBe(2);
    expect(page.galaxies.map((g: any) => g.id)).toEqual(["gal-3"]);
    expect(page.galaxies[0].classificationId).toBe("classification-gal-3");
    expect(page.hasNext).toBe(true);
  });

  it("keeps nucleus filters on the server and paginates matching galaxies", async () => {
    const db = setup();
    const filtered = { ...options, ctx: db.ctx, filters: { searchNucleus: true, searchNumVisibleNucleusMin: "1" } };
    const first = await handleClassifiedGalaxies(filtered);
    const second = await handleClassifiedGalaxies({ ...filtered, cursor: first.cursor });
    const offset = await handleClassifiedGalaxies({ ...filtered, offset: 1 });
    expect(first.galaxies.map((g: any) => g.id)).toEqual(["gal-3"]);
    expect(second.galaxies.map((g: any) => g.id)).toEqual(["gal-1"]);
    expect(offset.galaxies).toEqual(second.galaxies);
    expect(second.hasNext).toBe(false);
    expect(second.hasPrevious).toBe(true);
  });

  it("supports ascending order and an empty result", async () => {
    const db = setup();
    const asc = await handleClassifiedGalaxies({ ...options, ctx: db.ctx, sortOrder: "asc" });
    expect(asc.galaxies[0].id).toBe("gal-1");
    const empty = await handleClassifiedGalaxies({ ...options, ctx: db.ctx, filters: { searchId: "missing" } });
    expect(empty.galaxies).toEqual([]);
    expect(empty.isDone).toBe(true);
  });
});
