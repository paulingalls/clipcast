import { resolve } from "node:path";
import { config } from "./config";
import { api } from "./api";
import index from "./index.html";

const OUTPUT_DIR = resolve("./output");

const isDev = process.env.NODE_ENV !== "production";

const routes: Record<string, Response> = {
  "/": index,
};

if (isDev) {
  const harness = await import("./dev/harness.html");
  routes["/dev/harness"] = harness.default;
}

const server = Bun.serve({
  port: config.PORT,
  hostname: config.HOST,

  routes,

  async fetch(req) {
    // Fast string check to avoid URL parsing on non-output requests
    if (req.url.includes("/output/")) {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/output/")) {
        const resolved = resolve("./output", url.pathname.slice("/output/".length));
        if (!resolved.startsWith(OUTPUT_DIR)) {
          return new Response("Forbidden", { status: 403 });
        }
        const file = Bun.file(resolved);
        if (await file.exists()) {
          return new Response(file);
        }
        return new Response("Not found", { status: 404 });
      }
    }

    // Delegate everything else (including /api/*) to Hono
    return api.fetch(req);
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
