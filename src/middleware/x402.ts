import type { MiddlewareHandler } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions";
import { generateRequestJsonSchema } from "../utils/validation";
import type { config } from "../config";

export const GENERATE_DESCRIPTION =
  "Generate animated portrait videos for social media from structured phrases and images";

// Discovery example payloads. The input mirrors a valid generateRequestSchema body
// and the output mirrors RenderResult (src/services/renderer.ts) — both are asserted
// against the live types in x402.test.ts so they can't drift.
const GENERATE_INPUT_EXAMPLE = {
  phrases: ["Ship faster", "Pay per call", "No subscriptions"],
  template: "slide-fade",
  options: {
    title: "Clipcast",
    aspectRatio: "16:9",
    duration: 12,
    colorScheme: { background: "#1a1a2e", text: "#ffffff", accent: "#e94560" },
    pacing: [4, 4, 4],
  },
};

const GENERATE_OUTPUT_EXAMPLE = {
  id: "V1StGXR8_Z5j",
  videoUrl: "/output/V1StGXR8_Z5j.mp4",
  duration: 12,
  resolution: "1920x1080",
  templateUsed: "slide-fade",
};

/**
 * The x402 route table for the paid endpoints. Pure (no env reads, no I/O) so the
 * declared Bazaar discovery metadata can be asserted directly in tests. The bazaar
 * server extension enriches each declaration with the HTTP method from the route key
 * at request time, so `declareDiscoveryExtension` intentionally omits `method`.
 */
export function buildGenerateRoutes(cfg: {
  NETWORK: `${string}:${string}`;
  WALLET_ADDRESS: string;
}) {
  return {
    "POST /api/generate": {
      accepts: [
        {
          scheme: "exact" as const,
          price: "$0.10",
          network: cfg.NETWORK,
          payTo: cfg.WALLET_ADDRESS,
        },
      ],
      description: GENERATE_DESCRIPTION,
      extensions: declareDiscoveryExtension({
        bodyType: "json",
        input: GENERATE_INPUT_EXAMPLE,
        inputSchema: generateRequestJsonSchema,
        output: { example: GENERATE_OUTPUT_EXAMPLE },
      }),
    },
  };
}

export function createPaymentMiddleware(cfg: typeof config): MiddlewareHandler | null {
  if (!cfg.WALLET_ADDRESS) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error(
        "WALLET_ADDRESS is required in production. Set it or run with NODE_ENV=development to bypass.",
      );
    }
    return null;
  }

  if (!cfg.NETWORK.includes(":")) {
    throw new Error(
      `NETWORK must be in format "namespace:chainId" (e.g. eip155:84532), got: ${cfg.NETWORK}`,
    );
  }

  const facilitatorUrl = new URL(cfg.FACILITATOR_URL);
  if (facilitatorUrl.protocol !== "https:") {
    throw new Error(`FACILITATOR_URL must use HTTPS, got: ${facilitatorUrl.protocol}`);
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: cfg.FACILITATOR_URL,
  });

  const server = new x402ResourceServer(facilitatorClient);
  registerExactEvmScheme(server);
  // Surfaces the route's declared discovery metadata (and enriches it with the HTTP
  // method) so Clipcast is listable in the x402 Bazaar.
  server.registerExtension(bazaarResourceServerExtension);

  const routes = buildGenerateRoutes({ NETWORK: cfg.NETWORK, WALLET_ADDRESS: cfg.WALLET_ADDRESS });

  return paymentMiddleware(routes, server);
}
