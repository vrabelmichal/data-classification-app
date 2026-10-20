import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RenderErrorBoundary } from "../src/components/RenderErrorBoundary";

it("contains render failures, preserves surrounding navigation, and retries", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let fails = true;
  function QueryConsumer() {
    if (fails) throw new Error("Convex server error");
    return <div>Recovered results</div>;
  }
  render(<><nav>Navigation</nav><RenderErrorBoundary message="Could not load browser"><QueryConsumer /></RenderErrorBoundary></>);
  expect(screen.getByRole("alert").textContent).toContain("Could not load browser");
  expect(screen.getByRole("navigation")).toBeTruthy();
  fails = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByText("Recovered results")).toBeTruthy();
  log.mockRestore();
});

it("resets a failed page when its route changes", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken() { throw new Error("Failed query"); return null; }
  const { rerender } = render(<RenderErrorBoundary resetKey="first" message="Failed"><Broken /></RenderErrorBoundary>);
  rerender(<RenderErrorBoundary resetKey="second" message="Failed"><div>New route</div></RenderErrorBoundary>);
  expect(screen.getByText("New route")).toBeTruthy();
  log.mockRestore();
});
