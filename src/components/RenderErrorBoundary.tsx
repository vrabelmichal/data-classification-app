import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  message: string;
  resetKey?: string;
}

// Last resort for render failures, including queries in nested components.
// Expected request failures should still be handled beside the relevant controls.
export class RenderErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Page render failed", error, info);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="m-6 rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <p>{this.props.message}</p>
        <div className="mt-4 flex gap-4">
          <button className="rounded border border-current px-3 py-2" onClick={() => this.setState({ failed: false })}>Try again</button>
          <button className="rounded border border-current px-3 py-2" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
