/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (import.meta.hot) {
  const hotData = import.meta.hot.data as Record<string, ReturnType<typeof createRoot> | undefined>;
  const root = (hotData.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
