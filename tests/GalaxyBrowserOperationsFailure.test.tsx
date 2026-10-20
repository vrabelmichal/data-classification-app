import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { useQueries } from "convex/react";
import { GalaxyExport } from "../src/components/browse/GalaxyExport";
import { GalaxyQuickReview } from "../src/components/browse/GalaxyQuickReview";

vi.mock("convex/react", () => ({ useQueries: vi.fn(), useQuery: () => ({}), useAction: () => vi.fn() }));
vi.mock("../src/hooks/useAdminCloudflareCachePurgeAvailability", () => ({ useAdminCloudflareCachePurgeAvailability: () => ({ isAvailable: false }) }));
vi.mock("../src/hooks/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../src/components/classification/ImageViewer", () => ({ ImageViewer: () => <div>Galaxy image</div> }));

const filters = { filter: "classified" as const, sortBy: "numericId" as const, sortOrder: "desc" as const, isSearchActive: false };
beforeEach(() => { vi.mocked(useQueries).mockReturnValue({}); });

it("stops an export on a server exception without downloading a partial CSV", () => {
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click");
  vi.mocked(useQueries).mockImplementation((queries) => Object.keys(queries).length ? { result: new Error("Read limit") } : {});
  render(<GalaxyExport {...filters} page={1} pageSize={200} canExportAll />);
  fireEvent.click(screen.getByRole("button", { name: "Export Data" }));
  fireEvent.click(screen.getByRole("radio", { name: "All matching data" }));
  fireEvent.click(screen.getByRole("button", { name: "Export to CSV" }));
  expect(screen.getByRole("alert").textContent).toContain("server could not complete the export");
  expect(screen.getByRole("button", { name: "Export to CSV" })).toBeTruthy();
  expect(download).not.toHaveBeenCalled();
  download.mockRestore();
});

it("lets the user close quick review after its initial query fails", () => {
  vi.mocked(useQueries).mockReturnValue({ result: new Error("Read limit") });
  const onClose = vi.fn();
  render(<MemoryRouter><GalaxyQuickReview filters={filters} effectiveImageQuality="low" userPrefs={{}} initialIndex={0} onGalaxyChange={vi.fn()} onClose={onClose} /></MemoryRouter>);
  expect(screen.getByRole("alert").textContent).toContain("Unable to load more galaxies");
  expect(screen.queryByText("Loading galaxies…")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close quick review" }));
  expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ galaxyId: null, index: 0 }));
});

it("keeps a loaded galaxy visible when prefetching the next review batch fails", () => {
  vi.mocked(useQueries).mockImplementation((queries) => queries.result?.args.cursor
    ? {}
    : { result: { galaxies: [{ id: "gal-1" }], cursor: "next", hasNext: true } });
  const review = <MemoryRouter><GalaxyQuickReview filters={filters} effectiveImageQuality="low" userPrefs={{}} initialIndex={0} onGalaxyChange={vi.fn()} onClose={vi.fn()} /></MemoryRouter>;
  const { rerender } = render(review);
  expect(screen.getByText("Galaxy image")).toBeTruthy();
  vi.mocked(useQueries).mockReturnValue({ result: new Error("Read limit") });
  // New element identity makes the test re-render the mounted component.
  rerender(<MemoryRouter><GalaxyQuickReview filters={filters} effectiveImageQuality="low" userPrefs={{}} initialIndex={0} onGalaxyChange={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText("Galaxy image")).toBeTruthy();
  expect((screen.getByTitle("Next (→ or n)") as HTMLButtonElement).disabled).toBe(true);
});
