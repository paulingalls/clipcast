import { Hono } from "hono";
import { registerGenerateRoute } from "./routes/generate";

const api = new Hono().basePath("/api");

api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

registerGenerateRoute(api);

export { api };
