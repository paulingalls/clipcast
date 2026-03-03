import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HarnessApp } from "./components/HarnessApp";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <HarnessApp />
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
