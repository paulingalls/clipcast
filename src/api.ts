import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo } from "hono/bun";
import { rateLimiter } from "hono-rate-limiter";
import { registerGenerateRoute } from "./routes/generate";
import { registerDevRoutes } from "./routes/dev";
import { createPaymentMiddleware } from "./middleware/x402";
import { config } from "./config";

const api = new Hono().basePath("/api");

api.use("*", secureHeaders());
api.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1 MB

// x402 payment gate on /api/generate
const paymentMw = createPaymentMiddleware(config);
if (paymentMw) {
  api.use("/generate", paymentMw);
} else {
  console.warn("No WALLET_ADDRESS set — running without x402 payment gate (dev mode)");
}

// Rate limit /api/generate: 5 requests per minute per IP
api.use(
  "/generate",
  rateLimiter({
    windowMs: 60_000,
    limit: 5,
    keyGenerator: (c) => {
      try {
        return getConnInfo(c as unknown as Context).remote.address ?? "unknown";
      } catch {
        return "unknown";
      }
    },
  }),
);

api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

registerGenerateRoute(api);

if (process.env.NODE_ENV === "development") {
  registerDevRoutes(api);
}

api.onError((err, c) => {
  console.error(
    JSON.stringify({
      event: "unhandled_error",
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    }),
  );
  return c.json({ error: "internal_error", message: "Internal server error" }, 500);
});

export { api };
