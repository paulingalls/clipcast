import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { registerGenerateRoute } from "./routes/generate";
import { registerDevRoutes } from "./routes/dev";

const api = new Hono().basePath("/api");

api.use("*", secureHeaders());
api.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1 MB

api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

registerGenerateRoute(api);

if (process.env.NODE_ENV !== "production") {
  registerDevRoutes(api);
}

api.onError((err, c) => {
  console.error(JSON.stringify({ event: "unhandled_error", error: err.message, stack: err.stack }));
  return c.json({ error: "internal_error", message: "Internal server error" }, 500);
});

export { api };
