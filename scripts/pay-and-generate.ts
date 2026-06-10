/**
 * Manual testnet payment harness (Milestone 2).
 *
 * Pays a real $0.10 USDC payment on Base Sepolia through POST /api/generate and
 * confirms a video is rendered and returned. This is the manual/live-testnet proof
 * for the paid x402 path — it is NOT part of the automated `bun test` suite (it needs
 * a funded wallet and settles on-chain).
 *
 * The docs (MILESTONES §2.3) reference an `@x402/fetch` package; it does not exist at
 * the installed @x402 2.x line, so the x402 HTTP protocol is driven manually here via
 * the installed @x402/core + @x402/evm client packages.
 *
 * Run a server first (`bun run start` with WALLET_ADDRESS set), then: `bun run pay-gen`.
 */
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { RenderResult } from "../src/services/renderer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Set it in your gitignored .env (see .env.example).`);
  }
  return value;
}

// Treats an empty/whitespace-only env var the same as unset, so a `.env` copied from
// `.env.example` (which ships empty values) falls back to the default instead of "".
function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  return value;
}

// A valid generateRequestSchema body (mirrors the discovery example in src/middleware/x402.ts).
const REQUEST_BODY = {
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

async function main(): Promise<void> {
  const clientKey = requireEnv("CLIENT_PRIVATE_KEY");
  const serverUrl = optionalEnv("SERVER_URL", "http://localhost:3000").replace(/\/$/, "");
  const rpcUrl = optionalEnv("RPC_URL", baseSepolia.rpcUrls.default.http[0]);

  // The signer only needs an address + signTypedData — the exact-EVM USDC payment is an
  // EIP-3009 signed authorization; the scheme uses rpcUrl for any on-chain reads.
  const account = privateKeyToAccount(clientKey as `0x${string}`);
  const signer = toClientEvmSigner({
    address: account.address,
    signTypedData: (message) => account.signTypedData(message),
  });

  const client = new x402Client();
  registerExactEvmScheme(client, { signer, schemeOptions: { rpcUrl } });
  const http = new x402HTTPClient(client);

  const url = `${serverUrl}/api/generate`;
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(REQUEST_BODY),
  };

  console.log(`→ Paying from ${account.address}`);
  console.log(`→ POST ${url} (expecting 402 payment challenge)`);

  // 1. Unpaid request — expect a 402 with the exact-EVM payment requirements.
  const challenge = await fetch(url, requestInit);
  if (challenge.status !== 402) {
    throw new Error(
      `Expected HTTP 402 payment challenge, got ${challenge.status}. ` +
        `Is the server running with WALLET_ADDRESS set (not in dev-bypass mode)?`,
    );
  }
  const paymentRequired = http.getPaymentRequiredResponse(
    (name) => challenge.headers.get(name),
    await challenge.json().catch(() => undefined),
  );
  console.log("← 402 received; signing exact-EVM payment…");

  // 2. Sign the payment and retry with the payment header.
  const payload = await http.createPaymentPayload(paymentRequired);
  const paid = await fetch(url, {
    ...requestInit,
    headers: {
      ...(requestInit.headers as Record<string, string>),
      ...http.encodePaymentSignatureHeader(payload),
    },
  });

  // 3. Confirm settlement + a rendered video.
  const result = await http.processResponse(paid);
  if (result.kind !== "success") {
    const detail = "body" in result ? result.body : result.paymentRequired;
    throw new Error(
      `Payment did not settle: kind=${result.kind} status=${paid.status} detail=${JSON.stringify(detail)}`,
    );
  }
  const render = result.body as RenderResult;
  console.log("✓ Payment settled on Base Sepolia. Render result:");
  console.log(JSON.stringify(render, null, 2));

  // 4. Prove the returned video is actually playable.
  const videoResponse = await fetch(`${serverUrl}${render.videoUrl}`);
  const contentType = videoResponse.headers.get("content-type") ?? "";
  if (videoResponse.status !== 200 || !contentType.includes("video/mp4")) {
    throw new Error(
      `Video not playable: GET ${render.videoUrl} → ${videoResponse.status} (${contentType})`,
    );
  }
  console.log(`✓ Video is playable: ${serverUrl}${render.videoUrl} (${contentType})`);
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
