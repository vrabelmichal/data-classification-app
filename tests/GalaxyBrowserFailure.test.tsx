import { fireEvent, render, screen } from "@testing-library/react";
import { useQueries } from "convex/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { GalaxyBrowser } from "../src/components/browse/GalaxyBrowser";
import { useGalaxyBrowser } from "../src/components/browse/useGalaxyBrowser";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useQueries: vi.fn(() => ({})) }));
vi.mock("../src/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("../src/components/browse/useGalaxyBrowser", () => ({ useGalaxyBrowser: vi.fn() }));
vi.mock("../src/components/browse/GalaxyBrowserSearchForm", () => ({ GalaxyBrowserSearchForm: () => <div>Search form</div> }));
vi.mock("../src/components/browse/GalaxyBrowserLightTableView", () => ({ GalaxyBrowserLightTableView: ({ galaxyData }: any) => <div>{galaxyData?.galaxies?.map((g: any) => g.id).join(",")}</div> }));
vi.mock("../src/components/browse/GalaxyBrowserMobileCards", () => ({ GalaxyBrowserMobileCards: () => null }));
vi.mock("../src/components/browse/GalaxyExport", () => ({ GalaxyExport: () => <div>Export section</div> }));
vi.mock("../src/components/browse/GalaxyQuickReview", () => ({ GalaxyQuickReview: () => null }));

it("keeps controls mounted after a failed update, removes stale results, and recovers", () => {
  const setFilter = vi.fn();
  const state: any = {
    page: 1, pageSize: 200, sortBy: "numericId", sortOrder: "desc", filter: "classified",
    galaxyData: { galaxies: [{ id: "old-galaxy" }], hasNext: false },
    appliedSearchValues: {}, isUrlStateReady: true, setFilter,
  };
  vi.mocked(useGalaxyBrowser).mockImplementation(() => state);
  const renderBrowser = () => <MemoryRouter><GalaxyBrowser /></MemoryRouter>;
  const { rerender } = render(renderBrowser());
  expect(screen.getByText("old-galaxy")).toBeTruthy();

  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.galaxyQueryError = new Error("Server Error");
  state.galaxyData = { galaxies: [], hasNext: false };
  rerender(renderBrowser());
  expect(screen.getByRole("alert").textContent).toContain("Unable to load galaxies");
  expect(screen.getByText("Search form")).toBeTruthy();
  expect(screen.queryByText("old-galaxy")).toBeNull();
  expect(screen.queryByText("Updating results...")).toBeNull();
  expect(screen.queryByText("Export section")).toBeNull();
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "all" } });
  expect(setFilter).toHaveBeenCalledWith("all");

  state.galaxyQueryError = undefined;
  state.galaxyData = { galaxies: [{ id: "recovered-galaxy" }], hasNext: false };
  rerender(renderBrowser());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("recovered-galaxy")).toBeTruthy();
  log.mockRestore();
});


it("cancels an active count before sending an old cursor with new filters", () => {
  vi.mocked(useQueries).mockClear();
  const state: any = {
    page: 1, pageSize: 200, sortBy: "numericId", sortOrder: "desc", filter: "classified",
    galaxyData: { galaxies: [], hasNext: false }, appliedSearchValues: {}, isUrlStateReady: true,
  };
  vi.mocked(useGalaxyBrowser).mockImplementation(() => state);
  const { rerender } = render(<MemoryRouter><GalaxyBrowser /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Count All" }));
  expect(vi.mocked(useQueries).mock.calls.some(([queries]) => queries.result?.args.filter === "classified")).toBe(true);
  vi.mocked(useQueries).mockClear();
  state.filter = "all";
  rerender(<MemoryRouter><GalaxyBrowser /></MemoryRouter>);
  expect(vi.mocked(useQueries).mock.calls.every(([queries]) => Object.keys(queries).length === 0)).toBe(true);
});
