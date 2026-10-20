import { StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { expect, it } from "vitest";
import { createEmptyBrowseResult } from "../convex/galaxies/browser/shared";
import { useGalaxyBrowsePage } from "../src/hooks/useGalaxyBrowsePage";

type Request = { cursor?: string; searchMorphology?: string; numItems: number };
function harness(respond: (args: Request) => unknown) {
  const requests: Request[] = [];
  const client = {
    watchQuery(_query: unknown, args: Request) {
      requests.push(args);
      return {
        onUpdate: () => () => {}, journal: () => undefined,
        localQueryResult() {
          const result = respond(args);
          if (result instanceof Error) throw result;
          return result;
        },
      };
    },
  } as unknown as ConvexReactClient;
  return {
    requests,
    wrapper: ({ children }: { children: ReactNode }) => <StrictMode><ConvexProvider client={client}>{children}</ConvexProvider></StrictMode>,
  };
}
const base = { offset: 0, numItems: 2, searchLsbClass: "0" };
const g1 = { id: "gal-1" };
const g2 = { id: "gal-2" };
const final = { ...createEmptyBrowseResult(), galaxies: [g2] };

it("assembles a requested page across empty and partial server batches", async () => {
  const replies = new Map([
    [undefined, { ...createEmptyBrowseResult(), galaxies: [], isDone: false, hasNext: true, cursor: "second", scanIncomplete: true }],
    ["second", { ...createEmptyBrowseResult(), galaxies: [g1], isDone: false, hasNext: true, cursor: "third", scanIncomplete: true }],
    ["third", final],
  ]);
  const test = harness(({ cursor }) => replies.get(cursor));
  const { result } = renderHook(() => useGalaxyBrowsePage({ ...base }), { wrapper: test.wrapper });
  await waitFor(() => expect(result.current.data?.galaxies.map((g) => g.id)).toEqual([g1.id, g2.id]));
  expect(result.current.data?.hasPrevious).toBe(false);
  expect(test.requests.find((r) => r.cursor === "third")?.numItems).toBe(2);
});

it("discards a partial page on search change and recovers from a failed continuation", async () => {
  const error = new Error("Server error");
  const partial = { ...createEmptyBrowseResult(), galaxies: [g1], isDone: false, hasNext: true, cursor: "second", scanIncomplete: true };
  const test = harness((args) => args.searchMorphology === "2" ? final : args.cursor ? error : partial);
  const { result, rerender } = renderHook(({ morphology }) => useGalaxyBrowsePage({ ...base, searchMorphology: morphology }), {
    wrapper: test.wrapper, initialProps: { morphology: "1" },
  });
  await waitFor(() => expect(result.current.error).toBe(error));
  expect(result.current.data).toBeUndefined();
  rerender({ morphology: "2" });
  await waitFor(() => expect(result.current.data?.galaxies.map((g) => g.id)).toEqual([g2.id]));
  expect(result.current.error).toBeUndefined();
});


it("shows only the requested page and preserves the lookahead cursor", async () => {
  const test = harness(() => ({
    ...final, galaxies: [g1, g2, { id: "gal-3" }], cursorBeforeLastMatch: "resume-before-gal-3",
  }));
  const { result } = renderHook(() => useGalaxyBrowsePage({ ...base }), { wrapper: test.wrapper });
  await waitFor(() => expect(result.current.data?.galaxies.map((g) => g.id)).toEqual([g1.id, g2.id]));
  expect(result.current.data?.cursor).toBe("resume-before-gal-3");
  expect(result.current.data?.hasNext).toBe(true);
  expect(result.current.data?.isDone).toBe(false);
});
