import { resolve } from "node:path";
import { config } from "./config";
import { api } from "./api";
import { startCleanup } from "./utils/cleanup";
import { closeBrowser } from "./services/browser";
import index from "./index.html";

const OUTPUT_DIR = config.OUTPUT_DIR;

const isDev = process.env.NODE_ENV === "development";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bun HTML imports return HTMLBundle, not Response
const routes: Record<string, any> = {
  "/": index,
};

if (isDev) {
  const harness = await import("./dev/harness.html");
  routes["/dev/harness"] = harness.default;
}

const server: ReturnType<typeof Bun.serve> = Bun.serve({
  port: config.PORT,
  hostname: config.HOST,

  routes,

  async fetch(req): Promise<Response> {
    // Fast string check to avoid URL parsing on non-output requests
    if (req.url.includes("/output/")) {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/output/")) {
        const resolved = resolve(OUTPUT_DIR, url.pathname.slice("/output/".length));
        if (!resolved.startsWith(OUTPUT_DIR)) {
          return new Response("Forbidden", { status: 403 });
        }
        const file = Bun.file(resolved);
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              "Content-Type": "video/mp4",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
        return new Response("Not found", { status: 404 });
      }
    }

    // Delegate everything else (including /api/*) to Hono
    return api.fetch(req, { server });
  },

  development: process.env.NODE_ENV === "development" && {
    hmr: true,
    console: true,
  },
});

startCleanup();

// Graceful shutdown: clean up browser child processes
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  closeBrowser()
    .catch((err: unknown) => {
      console.error("Browser cleanup failed:", err);
    })
    .finally(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`Server running at ${server.url}`);
