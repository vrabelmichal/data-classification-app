import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { GalaxyBrowser } from "../src/components/browse/GalaxyBrowser";
import { createEmptyBrowseResult } from "../convex/galaxies/browser/shared";

it("opens the complete galaxy browser with real query hooks and initially skipped subscriptions", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const emptyPage = createEmptyBrowseResult();
  const settings = {};
  const view = {
    status: "ok", viewKey: "test-view",
    state: { filter: "all", sortBy: "numericId", sortOrder: "asc", isSearchActive: false },
  };
  const browseRequests: Record<string, unknown>[] = [];
  const client = {
    mutation: vi.fn(async () => ({ viewKey: view.viewKey })),
    watchQuery(query: Parameters<typeof getFunctionName>[0], args: Record<string, unknown>) {
      if (getFunctionName(query).endsWith(":browseGalaxies")) browseRequests.push(args);
      const name = getFunctionName(query);
      return {
        onUpdate: () => () => {},
        journal: () => undefined,
        localQueryResult: () => {
          if (name.endsWith(":browseGalaxies")) return emptyPage;
          if (name.endsWith(":resolveBrowserView")) return view;
          if (name.endsWith(":getPublicSystemSettings")) return settings;
          return undefined;
        },
      };
    },
  } as unknown as ConvexReactClient;
  try {
    render(
      <StrictMode><ConvexProvider client={client}><MemoryRouter initialEntries={["/browse"]}>
        <GalaxyBrowser />
      </MemoryRouter></ConvexProvider></StrictMode>,
    );
    await waitFor(() => expect(screen.getByText("No galaxies match your filters.")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Galaxy Browser" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Count All" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Search Galaxies/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /LSB classification/ }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Morphology/ }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Search" }));
    await waitFor(() => expect(browseRequests[browseRequests.length - 1]).toMatchObject({ searchLsbClass: "0", searchMorphology: "2" }));
    expect(JSON.parse(window.localStorage.getItem("galaxyBrowserSettings")!)).toMatchObject({ searchLsbClass: "0", searchMorphology: "2" });
    fireEvent.click(screen.getByRole("button", { name: "Clear Search" }));
    await waitFor(() => expect(browseRequests[browseRequests.length - 1].searchLsbClass).toBeUndefined());
    expect((screen.getByRole("combobox", { name: /Morphology/ }) as HTMLSelectElement).value).toBe("");
    expect(errors).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    errors.mockRestore();
    scroll.mockRestore();
  }
});
