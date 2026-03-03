import { Hono } from "hono";
import { registerGenerateRoute } from "./routes/generate";
import { registerDevRoutes } from "./routes/dev";

const api = new Hono().basePath("/api");

api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

registerGenerateRoute(api);

if (process.env.NODE_ENV !== "production") {
  registerDevRoutes(api);
}

export { api };
