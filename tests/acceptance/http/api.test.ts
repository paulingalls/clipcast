import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import type { Subprocess } from "bun";

// End-to-end HTTP acceptance for the Hono /api surface. These tests boot the REAL
// Bun.serve app as a subprocess and drive it over HTTP — including a full render
// (phrases -> Playwright frame-capture -> FFmpeg -> served MP4), which is the whole
// point of Clipcast. Wallet-free: dev mode bypasses the x402 gate for the render path;
// a dummy WALLET_ADDRESS exercises the 402 gate. The paid path (402 -> settle -> 200)
// needs a funded testnet wallet and is covered by the Milestone 2 payment flow.

interface RunningServer {
  proc: Subprocess;
  base: string;
}

async function startServer(env: Record<string, string>, port: number): Promise<RunningServer> {
  const proc = Bun.spawn(["bun", "src/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return { proc, base };
    } catch {
      // server not listening yet
    }
    await Bun.sleep(100);
  }
  proc.kill();
  throw new Error(`server on ${base} did not become healthy`);
}

async function stopServer(server: RunningServer): Promise<void> {
  server.proc.kill();
  await server.proc.exited;
}

describe("HTTP acceptance — generate pipeline (payment bypassed in dev mode)", () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer({ NODE_ENV: "development", WALLET_ADDRESS: "" }, 3200);
  });
  afterAll(async () => {
    await stopServer(server);
  });

  test("GET /api/health returns ok", async () => {
    const res = await fetch(`${server.base}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("POST /api/generate renders a real MP4 end to end and serves it", async () => {
    const res = await fetch(`${server.base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrases: ["Acceptance test", "End to end", "Real MP4"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { videoUrl: string; resolution: string };
    expect(body.videoUrl).toMatch(/^\/output\/.+\.mp4$/);

    const video = await fetch(`${server.base}${body.videoUrl}`);
    expect(video.status).toBe(200);
    expect(video.headers.get("content-type")).toBe("video/mp4");

    const bytes = new Uint8Array(await video.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // A valid MP4 carries an 'ftyp' box marker within the first 12 bytes.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 12));
    expect(head).toContain("ftyp");
  }, 60_000);

  test("POST /api/generate rejects invalid input with 400", async () => {
    const res = await fetch(`${server.base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrases: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("validation_error");
  });
});

describe("HTTP acceptance — x402 payment gate (prod mode, dummy wallet)", () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer(
      { NODE_ENV: "production", WALLET_ADDRESS: "0x000000000000000000000000000000000000dEaD" },
      3201,
    );
  });
  afterAll(async () => {
    await stopServer(server);
  });

  test("GET /api/health stays free (200)", async () => {
    const res = await fetch(`${server.base}/api/health`);
    expect(res.status).toBe(200);
  });

  test("POST /api/generate without payment returns 402", async () => {
    const res = await fetch(`${server.base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrases: ["No payment provided"] }),
    });
    expect(res.status).toBe(402);
  });
});
