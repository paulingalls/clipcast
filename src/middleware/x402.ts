import type { MiddlewareHandler } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import type { config } from "../config";

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

  const routes = {
    "POST /api/generate": {
      accepts: [
        {
          scheme: "exact" as const,
          price: "$0.10",
          network: cfg.NETWORK,
          payTo: cfg.WALLET_ADDRESS,
        },
      ],
    },
  };

  return paymentMiddleware(routes, server);
}
