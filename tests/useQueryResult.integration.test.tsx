import { StrictMode, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { useQueryResult } from "../src/hooks/useQueryResult";

const query = makeFunctionReference<"query", { filter: string; count?: bigint; optional?: string }, string[]>("test:browse");

// Keep the actual Convex React hooks and subscription observer. Only replace
// the network watch so loading, errors, and server updates are deterministic.
function createHarness() {
  let value: string[] | Error | undefined;
  const listeners = new Set<() => void>();
  const subscribe = vi.fn((callback: () => void) => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  });
  const watchQuery = vi.fn(() => ({
    onUpdate: subscribe,
    localQueryResult: () => {
      if (value instanceof Error) throw value;
      return value;
    },
    journal: () => undefined,
  }));
  const client = { watchQuery } as unknown as ConvexReactClient;
  return {
    subscribe,
    update(next: typeof value) {
      act(() => {
        value = next;
        for (const callback of listeners) callback();
      });
    },
    wrapper({ children }: { children: ReactNode }) {
      return <StrictMode><ConvexProvider client={client}>{children}</ConvexProvider></StrictMode>;
    },
  };
}

describe("useQueryResult with real Convex subscriptions", () => {
  it("mounts skipped queries and switches between skipped and active queries", () => {
    const harness = createHarness();
    const { result, rerender } = renderHook(({ skip }) => useQueryResult(query, skip ? "skip" : { filter: "all" }), {
      wrapper: harness.wrapper, initialProps: { skip: true },
    });
    expect(result.current).toEqual({ data: undefined, error: undefined });
    expect(harness.subscribe).not.toHaveBeenCalled();
    rerender({ skip: false });
    harness.update(["galaxy-1"]);
    expect(result.current.data).toEqual(["galaxy-1"]);
    rerender({ skip: true });
    expect(result.current).toEqual({ data: undefined, error: undefined });
  });

  it("handles inline arguments, equivalent rerenders, errors, and recovery", () => {
    const harness = createHarness();
    const { result, rerender } = renderHook(({ filter }) => useQueryResult(query, { filter, count: 1n, optional: undefined }), {
      wrapper: harness.wrapper, initialProps: { filter: "classified" },
    });
    expect(result.current).toEqual({ data: undefined, error: undefined });
    const subscriptions = harness.subscribe.mock.calls.length;
    rerender({ filter: "classified" });
    expect(harness.subscribe).toHaveBeenCalledTimes(subscriptions);
    const error = new Error("Server read limit");
    harness.update(error);
    expect(result.current).toEqual({ data: undefined, error });
    rerender({ filter: "all" });
    harness.update(["galaxy-2"]);
    expect(result.current).toEqual({ data: ["galaxy-2"], error: undefined });
  });
});
