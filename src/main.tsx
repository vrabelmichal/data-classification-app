import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";
import { RenderErrorBoundary } from "./components/RenderErrorBoundary";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <RenderErrorBoundary message="The application could not load. Try again or reload the page to reconnect.">
      <App />
    </RenderErrorBoundary>
  </ConvexAuthProvider>,
);
