# Clipcast — Development Milestones

Each milestone is a self-contained unit of work. Build them in order. Each should produce something runnable and testable before moving on.

See `REQUIREMENTS.md` for the full product spec. This doc tells you **what to build and in what order**, with enough detail to implement without guessing.

---

## Phase 1 — Core Rendering (MVP)

### 1.1 — Project Setup & Server Skeleton

**Goal:** Bun.serve() + Hono app running, health endpoint responding, static file serving for output videos.

**Build:**
- Initialize project with `bun init` if not already done
- Install dependencies: `hono`, `zod`, `nanoid`
- Create `src/index.ts` — Bun.serve() entry point
- Create `src/api.ts` — Hono app with `/api` basePath
- Wire Bun.serve() to delegate to Hono:

```ts
import { Hono } from "hono";

const api = new Hono().basePath("/api");

api.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/output/*": {
      GET: async (req) => {
        const path = new URL(req.url).pathname;
        const file = Bun.file(`./output${path.replace("/output", "")}`);
        return file.exists() ? new Response(file) : new Response("Not found", { status: 404 });
      },
    },
  },
  fetch: api.fetch,
});
```

- Create `./output/` directory (gitignored)
- Create `.env.example` with PORT, HOST, MAX_CONCURRENT_RENDERS, RENDER_TIMEOUT_MS, RETENTION_HOURS
- Create `src/config.ts` that reads env vars with defaults

**Test:** `curl http://localhost:3000/api/health` returns `{"status":"ok",...}`

---

### 1.2 — Input Validation

**Goal:** POST /api/generate accepts and validates request bodies, returns structured errors for bad input.

**Build:**
- Create `src/utils/validation.ts` with Zod schemas:

```ts
import { z } from "zod";

export const generateRequestSchema = z.object({
  phrases: z.array(z.string().max(200).min(1)).min(1).max(10),
  images: z.array(z.string().url()).max(5).optional().default([]),
  template: z.string().optional().default("slide-fade"),
  options: z.object({
    title: z.string().max(100).optional(),
    duration: z.number().min(5).max(30).optional(),
    colorScheme: z.enum(["auto", "light", "dark"]).or(z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional().default("dark"),
    aspectRatio: z.enum(["9:16", "1:1", "4:5"]).optional().default("9:16"),
    pacing: z.literal("auto").or(z.array(z.number().positive())).optional().default("auto"),
  }).optional().default({}),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
```

- Create `src/routes/generate.ts` — POST handler that validates input and returns a placeholder response:

```ts
// For now, return a mock response after validation passes
return c.json({
  videoUrl: "http://localhost:3000/output/placeholder.mp4",
  thumbnailUrl: null,
  duration: validated.options.duration || calculateAutoDuration(validated.phrases.length),
  resolution: "1080x1920",
  templateUsed: validated.template,
});
```

- Validation errors return 400 with structured JSON: `{ error: "validation_error", details: [...] }`
- Unknown template IDs return 400: `{ error: "unknown_template", template: "..." }`

**Test:**
- Valid request returns 200 with mock response
- Empty phrases returns 400
- 11 phrases returns 400
- Phrase over 200 chars returns 400
- Invalid URL in images returns 400
- Bad hex color returns 400

---

### 1.3 — Pacing Engine

**Goal:** Calculate per-phrase timing from duration and phrase count.

**Build:**
- Create `src/services/pacing.ts`:

```ts
export interface PhraseTimings {
  totalDuration: number;       // total video duration in ms
  introDuration: number;       // ms before first phrase
  outroDuration: number;       // ms after last phrase
  phrases: PhraseTiming[];     // per-phrase breakdown
}

export interface PhraseTiming {
  index: number;
  startMs: number;             // when this phrase segment begins
  enterMs: number;             // duration of enter animation
  holdMs: number;              // duration phrase is fully visible
  exitMs: number;              // duration of exit animation
  totalMs: number;             // enterMs + holdMs + exitMs
}
```

- Auto-duration: `phraseCount * 2500 + 1500` (ms). Clamp to 5000–30000.
- Auto-pacing: distribute evenly after reserving 500ms intro + 500ms outro. Each phrase gets `(totalMs - 1000) / phraseCount`. Within each phrase allocation: 25% enter, 50% hold, 25% exit.
- Custom pacing (array of seconds): validate array length matches phrase count, sum ≤ duration. Convert to ms, apply same 25/50/25 split.
- Export a `calculatePacing(phrases: string[], duration?: number, pacing?: "auto" | number[]): PhraseTimings` function.

**Test:**
- 3 phrases, no duration → auto-duration of 9000ms, each phrase ~2667ms
- 5 phrases, 12s duration → 1000ms reserved, 2200ms per phrase
- Custom pacing [3, 2, 5] with 3 phrases → correct start times and splits
- Custom pacing array length mismatch → throws error

---

### 1.4 — Slide-Fade Template

**Goal:** A complete, self-contained HTML template that renders phrase sequences with fade/slide animations, driven entirely by CSS animation `currentTime` manipulation.

**Build:**
- Create `src/templates/slide-fade.html` — a single HTML file with inlined CSS and JS.

**Template spec:**

The template receives data as a JSON object injected into a `<script>` tag by the server before loading in the browser. The data shape:

```js
window.__CLIPCAST_DATA = {
  phrases: ["Phrase 1", "Phrase 2", ...],
  title: "Brand Name" | null,
  images: ["data:image/jpeg;base64,..." | "https://..."] | [],
  colors: {
    background: "#1a1a2e",
    text: "#ffffff",
    accent: "#e94560"
  },
  timing: {
    totalDuration: 12000,
    introDuration: 500,
    outroDuration: 500,
    phrases: [
      { index: 0, startMs: 500, enterMs: 550, holdMs: 1100, exitMs: 550, totalMs: 2200 },
      // ...
    ]
  },
  resolution: { width: 1080, height: 1920 }
};
```

**Visual design:**
- Full-screen viewport at target resolution (1080×1920 default)
- Dark background (uses `colors.background`)
- If title is provided: persistent header at top within safe zone (top 10%), white text, 32px, fades in during intro
- Each phrase: centered vertically, large text (48-64px, auto-shrink if phrase is long), white color (`colors.text`)
- Phrase enter animation: fade in (opacity 0→1) + slide up (translateY 40px→0), 25% of phrase duration
- Phrase hold: fully visible, stationary
- Phrase exit animation: fade out (opacity 1→0) + slide up (translateY 0→-20px), 25% of phrase duration
- If images provided: first image as full-bleed background with dark overlay (60% opacity black), crossfade between images as phrases change. If no images: solid color background.
- Safe zones: no text in top 10% (except title) or bottom 15% of viewport

**Animation contract:**
- ALL CSS animations use `animation-play-state: paused`
- The template builds animations dynamically in JS at load time based on `window.__CLIPCAST_DATA.timing`
- Each phrase gets a `<div>` with CSS animation whose `delay` and `duration` map to the timing data
- Expose `window.__seekTo(timeMs)` that calls `document.getAnimations().forEach(a => a.currentTime = timeMs)`
- No setTimeout, setInterval, or rAF loops

**Long phrase handling:** If a phrase is longer than 60 characters, reduce font size. Scale: 64px for ≤30 chars, 48px for 31–60, 36px for 61–100, 28px for 100+. Max 4 lines, overflow hidden with ellipsis on last line.

**Image handling for MVP:** If 0 images, use solid background color. If 1+ images, use first image as background for all phrases. Image crossfading between multiple images is deferred to Phase 4.

---

### 1.5 — Template Dev Harness

**Goal:** A browser-based development tool served at `/dev/harness` that loads real Clipcast template HTML files, injects test data, and provides a timeline scrubber for frame-by-frame preview. What you see in the harness = what the headless renderer will capture.

**Why this is here:** You need to visually verify templates before wiring up the Playwright capture pipeline. Without this, template development is blind — you'd have to render a full video every time you tweak an animation.

**Build:**
- Create `src/dev/harness.html` — an HTML page with embedded React (bundled by Bun) that provides the harness UI
- Serve at `/dev/harness` in Bun.serve() routes (only in development mode)
- Create `GET /api/dev/template/:id` — returns the raw template HTML with test data injected (reuses the same injection logic the renderer will use)

**Harness features:**

1. **Template preview iframe** — Loads the injected template HTML in an iframe at the exact target resolution (e.g., 1080×1920), scaled to fit the screen. The iframe is the source of truth for what the renderer will capture.

2. **Timeline scrubber** — A slider spanning 0 to `totalDuration` ms. As you drag it, the harness calls into the iframe:
```js
iframe.contentWindow.document.getAnimations().forEach(a => a.currentTime = timeMs);
if (iframe.contentWindow.__seekTo) iframe.contentWindow.__seekTo(timeMs);
```
This is the exact same mechanism the production renderer uses.

3. **Playback controls:**
   - Play/Pause (steps at target FPS using requestAnimationFrame, advancing currentTime each frame)
   - Step forward/backward one frame (±1000/fps ms)
   - Skip ±1 second
   - Jump to start/end

4. **Phrase timing visualization** — A horizontal bar showing each phrase's allocation (enter/hold/exit) as colored segments. A playhead tracks current position. Clicking a segment jumps to that phrase.

5. **Safe zone overlay** — Toggle hatched red zones showing platform-specific unsafe areas (top 10%, bottom 15% for IG Reels, etc.). Dropdown to switch between platform presets.

6. **Editable test data panel:**
   - Phrases: one per line, editable textarea
   - Title: text input
   - Duration: number input
   - Color pickers for background, text, accent
   - Platform/aspect ratio dropdown
   - "Reload" button that regenerates timing, re-injects data into template, reloads iframe

7. **Frame info display:** Current frame number, timecode (MM:SS.mmm), current phrase index

**Data flow:**
1. User edits phrases/colors/duration in the panel
2. User clicks "Reload"
3. Harness calls `GET /api/dev/template/slide-fade?phrases=...&title=...&duration=...&colorScheme=...` (query params or POST body)
4. Server runs the pacing engine, injects data into template HTML, returns complete HTML
5. Harness loads HTML into iframe via `srcdoc` or blob URL
6. User scrubs timeline — all animation seeking happens client-side via `getAnimations()`

**Important:** The harness must not introduce its own animation logic. The iframe contains the real template with the real animations. The harness only controls time from the outside. This guarantees visual fidelity with the headless renderer.

**Test:** Start the dev server, open `/dev/harness`, verify you can see the slide-fade template animating through test phrases, scrub the timeline, and see correct phrase transitions at the expected times.

---

### 1.6 — Browser Service & Frame Stepping

**Goal:** Launch Playwright, load a template, capture frames via deterministic frame-stepping.

**Build:**
- Install: `bun add playwright` then `bunx playwright install chromium`
- Create `src/services/browser.ts`:

```ts
import { chromium, Browser, BrowserContext, Page } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

export async function captureFrames(
  htmlContent: string,
  width: number,
  height: number,
  durationMs: number,
  fps: number = 30
): Promise<Buffer[]> {
  const b = await getBrowser();
  const context = await b.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  const totalFrames = Math.ceil((durationMs / 1000) * fps);
  const frames: Buffer[] = [];

  for (let i = 0; i <= totalFrames; i++) {
    const timeMs = (i / fps) * 1000;

    // Seek all animations to exact time
    await page.evaluate((t) => {
      document.getAnimations().forEach((a) => { a.currentTime = t; });
      if ((window as any).__seekTo) (window as any).__seekTo(t);
    }, timeMs);

    // Double-rAF to ensure paint
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    const buffer = await page.screenshot({ type: "png" });
    frames.push(buffer);
  }

  await context.close();
  return frames;
}
```

**Test:** Load a simple HTML page with a CSS animation, capture 10 frames, verify you get 10 PNG buffers of the correct dimensions.

---

### 1.7 — FFmpeg Encoding

**Goal:** Take an array of PNG frame buffers and encode them into an MP4 via FFmpeg stdin pipe.

**Build:**
- Verify FFmpeg is available: `which ffmpeg` or install via system package manager
- Create `src/services/ffmpeg.ts`:

```ts
import { spawn } from "child_process";

export async function encodeFrames(
  frames: Buffer[],
  fps: number,
  width: number,
  height: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f", "image2pipe",
      "-framerate", String(fps),
      "-i", "-",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-vf", `scale=${width}:${height}`,
      outputPath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      // Log FFmpeg progress if needed
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on("error", reject);

    // Write all frames to stdin
    for (const frame of frames) {
      ffmpeg.stdin.write(frame);
    }
    ffmpeg.stdin.end();
  });
}
```

**Test:** Generate 30 solid-color PNG frames (1080×1920) in memory, encode to MP4, verify the file exists and is a valid video (check file size > 0, optionally use ffprobe to verify duration).

---

### 1.8 — Renderer Pipeline (Wire It Together)

**Goal:** Connect validation → pacing → template injection → browser capture → FFmpeg encoding → file output → response URL.

**Build:**
- Create `src/services/renderer.ts` that orchestrates the full pipeline:

```ts
export async function renderVideo(request: GenerateRequest): Promise<RenderResult> {
  // 1. Calculate pacing
  const timing = calculatePacing(request.phrases, request.options.duration, request.options.pacing);

  // 2. Resolve colors
  const colors = resolveColors(request.options.colorScheme);

  // 3. Read template HTML from cache
  const templateHtml = getTemplate(request.template);

  // 4. Inject data into template
  const html = injectData(templateHtml, {
    phrases: request.phrases,
    title: request.options.title || null,
    images: [], // MVP: skip image fetching for now
    colors,
    timing,
    resolution: getResolution(request.options.aspectRatio),
  });

  // 5. Capture frames
  const { width, height } = getResolution(request.options.aspectRatio);
  const frames = await captureFrames(html, width, height, timing.totalDuration, 30);

  // 6. Encode to MP4
  const videoId = nanoid(12);
  const outputPath = `./output/${videoId}.mp4`;
  await encodeFrames(frames, 30, width, height, outputPath);

  // 7. Return result
  return {
    videoUrl: `${getBaseUrl()}/output/${videoId}.mp4`,
    thumbnailUrl: null,
    duration: timing.totalDuration / 1000,
    resolution: `${width}x${height}`,
    templateUsed: request.template,
  };
}
```

- Template loading: read HTML files from `src/templates/` at startup, cache in a `Map<string, string>`
- Template injection: replace a `<!-- __CLIPCAST_DATA__ -->` placeholder in the HTML with `<script>window.__CLIPCAST_DATA = ${JSON.stringify(data)};</script>`
- Color resolution: "dark" → `{ background: "#1a1a2e", text: "#ffffff", accent: "#e94560" }`, "light" → `{ background: "#ffffff", text: "#1a1a2e", accent: "#2563eb" }`, hex → `{ background: hex, text: "#ffffff", accent: "#ffffff" }`, "auto" → falls back to "dark" for MVP (no image color extraction yet)
- Resolution map: `"9:16"` → 1080×1920, `"1:1"` → 1080×1080, `"4:5"` → 1080×1350
- Update `src/routes/generate.ts` to call `renderVideo()` and return the real result

**Test:** Send a POST to `/api/generate` with 3 phrases, get back a videoUrl, fetch it, confirm it's a valid MP4.

---

### 1.9 — Error Handling & Cleanup

**Goal:** Graceful error responses, render timeouts, and expired video cleanup.

**Build:**
- Wrap the render pipeline in a try/catch in the route handler. Return structured errors:
  - `{ error: "render_failed", message: "..." }` with 500
  - `{ error: "render_timeout", message: "..." }` with 504
- Add a render timeout (from RENDER_TIMEOUT_MS env var, default 60000ms) using `Promise.race` with a timeout promise
- Create `src/utils/cleanup.ts`: a setInterval (every 10 minutes) that scans `./output/` and deletes files older than RETENTION_HOURS
- Start cleanup on server boot
- Add Hono error handler middleware for unhandled exceptions

**Test:**
- Malformed template → 500 with error JSON, not a crash
- Create a file in output/ with old timestamp, verify cleanup removes it

---

### 1.10 — Basic Tests

**Goal:** Test suite covering the critical path.

**Build:**
- Create test files using `bun:test`:
  - `tests/validation.test.ts` — test Zod schema accepts/rejects various inputs
  - `tests/pacing.test.ts` — test auto-duration, auto-pacing, custom pacing
  - `tests/render.test.ts` — integration test: POST /api/generate with valid input, verify response shape and that video file exists (this test is slow, ~30s, mark appropriately)

**Run:** `bun test`

---

## Phase 2 — x402 Integration

### 2.1 — Payment Middleware Setup

**Goal:** Add x402 payment middleware to the Hono app, gating `/api/generate` behind a $0.10 USDC payment on Base Sepolia testnet.

**Build:**
- Install: `bun add @x402/hono @x402/core @x402/evm @x402/extensions`
- Create `src/middleware/x402.ts` that configures the payment middleware:
  - Facilitator URL: `https://x402.org/facilitator` (or env var)
  - Network: `eip155:84532` (Base Sepolia for testing)
  - Price: `$0.10`
  - PayTo: env var `WALLET_ADDRESS`
- Apply middleware to `/api/generate` route only — `/api/health` and `/api/templates` remain free
- Return `402 Payment Required` with payment instructions when no payment header is present

**Test:** Request `/api/generate` without payment headers → 402. Request `/api/health` → 200 (no payment needed).

---

### 2.2 — Bazaar Discovery Metadata

**Goal:** Add discovery metadata so Clipcast appears in x402 Bazaar listings.

**Build:**
- Add `declareDiscoveryExtension` to the route config with:
  - Input example (sample phrases + template)
  - Input JSON schema (matching Zod schema)
  - Output example (sample response)
  - Output schema
  - Description: "Generate animated portrait videos for social media from structured phrases and images"
- Verify discovery is working by querying the facilitator's discovery endpoint

---

### 2.3 — Testnet End-to-End Payment

**Goal:** Complete a real payment flow on Base Sepolia.

**Build:**
- Get testnet USDC from Circle faucet
- Set up a test wallet (can use CDP Wallet API or MetaMask on Base Sepolia)
- Configure WALLET_ADDRESS in .env with your testnet wallet
- Write a test script using `@x402/fetch` that calls `/api/generate` and pays the $0.10 testnet USDC
- Verify: payment goes through, video is generated and returned

---

## Phase 3 — Production Hardening

### 3.1 — S3/R2 Object Storage

**Goal:** Upload rendered videos to Cloudflare R2 (or S3-compatible) instead of local disk. Serve via CDN URL.

**Build:**
- Install: `bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- Create `src/services/storage.ts` with upload/delete/getUrl functions
- Env vars: S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, CDN_BASE_URL
- Update renderer to upload MP4 to S3 after encoding, return CDN URL
- Thumbnail generation: extract mid-video frame via FFmpeg (`-ss` flag), upload as JPEG
- Add `expiresAt` to response (current time + RETENTION_HOURS)

### 3.2 — Render Queue & Concurrency

**Goal:** Limit concurrent renders to prevent OOM. Queue excess requests.

**Build:**
- Create `src/utils/queue.ts` — simple in-memory queue with configurable concurrency (MAX_CONCURRENT_RENDERS)
- When queue is full and request is synchronous: hold connection until a slot opens (up to RENDER_TIMEOUT_MS), then render
- Track active renders count, expose via `/api/health` response

### 3.3 — Rate Limiting

**Goal:** Rate limit per wallet address to prevent abuse.

**Build:**
- Extract wallet address from x402 payment signature (available in middleware context)
- In-memory rate limiter: 60 requests per minute per wallet
- Return 429 with `Retry-After` header when exceeded
- Also add a global rate limit as a safety valve

### 3.4 — Async Response Mode

**Goal:** For queued renders, return 202 Accepted with a job ID and polling endpoint.

**Build:**
- Create `src/routes/jobs.ts` — `GET /api/jobs/:id` returns job status
- Job states: `queued`, `rendering`, `completed`, `failed`
- When completed: response includes full video metadata (same as sync response)
- Route handler logic: if a render slot is available, render synchronously (return 200). If queue is backed up, create a job and return 202 with `{ jobId, statusUrl, estimatedWaitSeconds }`.

### 3.5 — Cleanup & Docker Optimization

**Goal:** S3 lifecycle rules for expiration. Optimized Docker image.

**Build:**
- Set R2/S3 lifecycle rule to auto-delete objects after RETENTION_HOURS
- Remove the local file cleanup cron (no longer needed)
- Multi-stage Dockerfile: Playwright base → install Bun + FFmpeg → copy app → slim final image
- Document Docker flags needed for production: `--init`, `--ipc=host` or `--shm-size=2gb`

---

## Phase 4 — Template Expansion & Intelligence

### 4.1 — Text-Focus Template

**Goal:** Bold scale-up animation template for quotes and stats. No images needed.

**Spec:** Each phrase scales from 80% to 100% with opacity fade-in, centered, large bold text. Minimal background. Good for text-only content.

### 4.2 — Zoom Ken-Burns Template

**Goal:** Slow zoom/pan on background image with phrase overlays.

**Spec:** Image slowly zooms (105% over phrase duration) with slight pan. Phrases appear as overlays in lower third with text shadow. Best with 1-2 high-quality images.

### 4.3 — Carousel Template

**Goal:** Swipe-style horizontal transitions pairing phrases with images.

**Spec:** Each phrase+image pair slides in from right, slides out to left. Split layout: image on top 60%, phrase text on bottom 40%.

### 4.4 — Split-Reveal Template

**Goal:** Screen wipe/split transitions revealing each phrase.

**Spec:** Various wipe directions (left, right, top, diagonal) alternating per phrase. Full-screen text centered. Good for listicles and countdowns.

### 4.5 — Image Fetching & Color Extraction

**Goal:** Fetch images from URLs, resize with Sharp, extract dominant colors.

**Build:**
- Create `src/services/images.ts`: fetch URL with 10s timeout, reject >10MB, accept JPEG/PNG/WebP/GIF only
- Resize to fit template needs (1080px wide max) via Sharp
- Convert to base64 data URI for injection into template
- Color extraction: use Sharp to get dominant color, compute complementary background/text with WCAG AA contrast
- Wire into renderer: when `colorScheme: "auto"` and images are provided, extract colors from first image

### 4.6 — Auto Template Selection

**Goal:** `"template": "auto"` selects best template based on content.

**Build:**
- Create `src/services/template-select.ts` with heuristics:
  - No images + short phrases (≤6 words avg) → text-focus
  - 1+ images + 3+ phrases → slide-fade
  - 1-2 images + longer phrases → zoom-ken-burns
  - Images count matches phrase count → carousel
  - Sequential content (numbered, "Step N") → split-reveal
- Add rich metadata to `GET /api/templates`: `bestFor`, `idealPhraseCount`, `idealImageCount`, `tags`

---

## Phase 5 — Brand Kits

### 5.1 — Brand Kit CRUD

**Goal:** Create, retrieve, and delete brand kits with secret token access.

**Build:**
- Create `POST /api/brand-kits` — accepts name, logo URL, colors, font, tagline
- Returns `brandKitId` + `secretToken` (shown once)
- Storage: SQLite via `bun:sqlite` (brand kits are small, long-lived, relational)
- `DELETE /api/brand-kits/:token` — deletes the kit
- Gate creation behind x402 ($0.50)

### 5.2 — Brand Kit Integration in Generate

**Goal:** Reference brand kit in `/api/generate` requests.

**Build:**
- Add `brandKit` field to generate request schema (string, optional)
- When present: look up kit by secret token, apply colors/logo/font/title as defaults
- Inline `brand` config as alternative (pass full config in request body, no storage)
- Kit values are defaults — explicit request fields override them

### 5.3 — Wallet Pinning

**Goal:** Optional access control for brand kits.

**Build:**
- Add `pinnedWallets` array to brand kit creation
- When pinning is enabled: verify x402 payment signature wallet is in the allowlist before allowing kit usage
- No pinning = anyone with the token can use it

---

## Phase 6 — Multi-Platform Output

### 6.1 — Platform-Specific Rendering

**Goal:** Generate videos with correct aspect ratios and safe zones per platform.

**Build:**
- Add `platforms` field to generate request (array of platform IDs)
- Platform config map: instagram-reels (9:16, top 10% + bottom 15%), tiktok (9:16, top 10% + bottom 20%), linkedin (4:5, 5% all sides), youtube-shorts (9:16, bottom 15%)
- Templates receive safe zone config and adjust text placement
- Render each platform variant (same data, different resolution/safe zones)

### 6.2 — Multi-Video Response

**Goal:** Return array of platform-specific videos.

**Build:**
- Multi-platform response: `{ videos: [{ platform, videoUrl, thumbnailUrl, resolution, aspectRatio }], duration, templateUsed }`
- Pricing: $0.10 base + $0.05 per additional platform

---

## Phase 7 — Scale, Observe & Ecosystem

### 7.1 — Marketing Landing Page

**Goal:** Build the marketing site served at `/` alongside the API.

**Build:**
- Create `site/index.html`, `site/app.tsx`, `site/styles.css`
- React + Tailwind, bundled by Bun
- Content: what Clipcast does, how x402 payments work, example request/response, pricing, link to API docs
- Eventually: interactive demo where humans can try generating a video

### 7.2 — Redis Queue & Multi-Instance

**Goal:** Replace in-memory queue with Redis for horizontal scaling.

**Build:**
- Switch to `Bun.redis` for job queue
- Shared state: active renders, rate limit counters, job status
- Multiple Clipcast instances can share the same Redis and render independently

### 7.3 — Observability

**Goal:** Structured logging, metrics, error alerting.

**Build:**
- Replace console.log with structured JSON logger
- Key metrics: render time, queue depth, success/failure rate, video file size
- Health endpoint includes queue stats
- Error alerting via webhook (Discord, Slack, or email)

### 7.4 — Mainnet Launch

**Goal:** Switch from Base Sepolia to Base mainnet.

**Build:**
- Update NETWORK env var to `eip155:8453`
- Set up CDP API keys for production facilitator
- Fund wallet with small amount of ETH on Base for gas
- Verify end-to-end payment flow with real USDC
- Update Bazaar discovery metadata

### 7.5 — MCP Server Wrapper

**Goal:** Wrap Clipcast API as an MCP tool for direct LLM agent integration.

**Build:**
- MCP server that exposes `clipcast_generate` tool with typed parameters
- Handles x402 payment flow transparently
- Agents can call the tool directly without writing HTTP/payment code
