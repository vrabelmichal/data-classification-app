import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQueries } from "convex/react";
import { api } from "../convex/_generated/api";
import { useQueryResult } from "../src/hooks/useQueryResult";

vi.mock("convex/react", () => ({ useQueries: vi.fn() }));

it("returns a server failure without throwing and recovers on changed arguments", () => {
  const error = new Error("Server Error: too many documents read");
  vi.mocked(useQueries).mockReturnValue({ result: error });
  const { result, rerender } = renderHook(({ filter }) => useQueryResult(
    api.galaxies.browse.browseGalaxies, { offset: 0, numItems: 200, filter },
  ), { initialProps: { filter: "classified" as "classified" | "all" } });
  expect(result.current).toEqual({ data: undefined, error });
  const recovered = { galaxies: [], hasNext: false };
  vi.mocked(useQueries).mockReturnValue({ result: recovered });
  rerender({ filter: "all" });
  expect(result.current).toEqual({ data: recovered, error: undefined });
});

it("keeps loading and skipped requests distinct from failures", () => {
  vi.mocked(useQueries).mockReturnValue({});
  const { result } = renderHook(() => useQueryResult(api.galaxies.browse.browseGalaxies, "skip"));
  expect(result.current).toEqual({ data: undefined, error: undefined });
  expect(useQueries).toHaveBeenLastCalledWith({});
});
