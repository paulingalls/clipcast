import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HarnessApp } from "./components/HarnessApp";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");

const app = (
  <StrictMode>
    <HarnessApp />
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
