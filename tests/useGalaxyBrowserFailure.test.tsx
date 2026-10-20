import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { getFunctionName } from "convex/server";
import { expect, it, vi } from "vitest";
import { useQueryResult } from "../src/hooks/useQueryResult";
import { useGalaxyBrowser } from "../src/components/browse/useGalaxyBrowser";

const { ensureView } = vi.hoisted(() => ({ ensureView: vi.fn(async () => ({ viewKey: "new-view" })) }));
vi.mock("convex/react", () => ({ useMutation: () => ensureView }));
vi.mock("../src/hooks/useQueryResult", () => ({ useQueryResult: vi.fn() }));

it("stops saved-view loading with a recoverable error and skips browsing unknown filters", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(useQueryResult).mockImplementation((query) => getFunctionName(query).includes("resolveBrowserView")
    ? { data: undefined, error: new Error("Server Error") }
    : { data: undefined, error: undefined });
  const { result } = renderHook(() => useGalaxyBrowser(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={["/browse?view=saved-view"]}>{children}</MemoryRouter>,
  });
  await waitFor(() => expect(result.current.isUrlStateReady).toBe(true));
  expect(result.current.isViewUnavailable).toBe(true);
  expect(result.current.viewStateIssue?.message).toContain("server could not load this saved view");
  const browseCalls = vi.mocked(useQueryResult).mock.calls.filter(([query]) => getFunctionName(query).endsWith(":browseGalaxies"));
  expect(browseCalls.every(([, args]) => args === "skip")).toBe(true);
  log.mockRestore();
});

it("keeps browsing available if search bounds fail", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(useQueryResult).mockImplementation((query) => getFunctionName(query).includes("getGalaxySearchBounds")
    ? { data: undefined, error: new Error("Aggregate failed") }
    : { data: undefined, error: undefined });
  const { result } = renderHook(() => useGalaxyBrowser(), { wrapper: MemoryRouter });
  await waitFor(() => expect(result.current.isUrlStateReady).toBe(true));
  expect(result.current.isViewUnavailable).toBe(false);
  expect(result.current.browserQueryWarning).toContain("search ranges or display preferences");
  log.mockRestore();
});
