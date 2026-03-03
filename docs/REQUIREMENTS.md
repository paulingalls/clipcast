# Clipcast — Requirements & Specification

## Overview

**Clipcast** is a pay-per-request API that generates short portrait-format (9:16) animated videos for social media. It accepts structured data — a sequence of phrases, optional images, and styling options — and renders them into polished animated videos using a template system. Monetized via the x402 protocol (USDC on Base) — no API keys, accounts, or subscriptions required. Discoverable by AI agents through the x402 Bazaar.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Bun |
| API Framework | Hono (on Bun) |
| Entry Point | `Bun.serve()` (marketing site + delegates to Hono) |
| Payments | x402 (USDC on Base via CDP facilitator) |
| Video rendering | FFmpeg (composition & encoding) |
| HTML rendering | Playwright (headless Chromium) |
| Animation engine | CSS animations / Web Animations API in HTML templates |
| Image processing | Sharp |
| Discovery | x402 Bazaar extension |
| Deployment | Docker container (Linux) |

---

## API Endpoints

### `POST /api/generate`

Generate a portrait video from structured content.

**Price:** ~$0.10 USDC per request

**Request body (JSON):**

```json
{
  "phrases": [
    "Introducing our Spring Collection",
    "Crafted from sustainable materials",
    "Available in 12 colorways",
    "Launching March 15th",
    "Shop now at example.com"
  ],
  "images": [
    "https://example.com/product1.jpg",
    "https://example.com/product2.jpg"
  ],
  "template": "slide-fade",
  "options": {
    "title": "ACME Co.",
    "duration": 12,
    "colorScheme": "auto",
    "aspectRatio": "9:16",
    "pacing": "auto"
  }
}
```

**Required fields:**
- `phrases` (string[], 1–10 items) — the content sequence displayed one after another; each phrase appears on screen individually with template-driven enter/exit transitions

**Optional fields:**
- `images` (string[], 0–5 items) — image URLs used as backgrounds, accents, or interleaved with phrases depending on the template; fetched server-side
- `template` (string) — template identifier; defaults to `"slide-fade"`
- `options.title` (string) — persistent header or brand name displayed throughout the video (e.g., a logo line or page title); distinct from the phrase sequence
- `options.duration` (number) — total video duration in seconds (5–30, default: auto-calculated from phrase count)
- `options.colorScheme` (string) — `"auto"` (extract from images), `"light"`, `"dark"`, or a hex color like `"#1a1a2e"`
- `options.aspectRatio` (string) — `"9:16"` (default), `"1:1"`, `"4:5"`
- `options.pacing` (string | number[]) — `"auto"` distributes time evenly across phrases (default); alternatively, an array of per-phrase durations in seconds (must match phrases length and sum to ≤ total duration)

**Auto-duration calculation:** When `duration` is not specified, Clipcast calculates a default based on phrase count: roughly 2.5 seconds per phrase plus 1.5 seconds for intro and outro transitions. A 5-phrase video defaults to ~14 seconds.

**Auto-pacing breakdown:** For a 12-second video with 5 phrases, auto-pacing allocates:
- 0.5s intro transition (template-specific opening)
- ~2.2s per phrase (enter transition → hold → exit transition)
- 0.5s outro transition (template-specific closing)

Templates control the exact split between enter, hold, and exit time within each phrase's allocation.

**Response (JSON):**

```json
{
  "videoUrl": "https://api.clipcast.dev/videos/abc123.mp4",
  "thumbnailUrl": "https://api.clipcast.dev/thumbs/abc123.jpg",
  "duration": 12,
  "resolution": "1080x1920",
  "expiresAt": "2026-03-01T00:00:00Z"
}
```

### `GET /api/templates`

List available templates with previews.

**Price:** Free (no x402 payment required)

**Response (JSON):**

```json
{
  "templates": [
    {
      "id": "slide-fade",
      "name": "Slide & Fade",
      "description": "Each phrase fades in and slides up, images crossfade in the background",
      "previewUrl": "https://api.clipcast.dev/previews/slide-fade.mp4",
      "maxPhrases": 10,
      "maxImages": 5,
      "tags": ["minimal", "product", "announcement"]
    }
  ]
}
```

### `GET /api/health`

Health check endpoint. Free, no payment.

---

## Template System

### Architecture

Each template is a self-contained HTML file with embedded CSS animations. When a request comes in:

1. The server selects the template and injects the user's data (title, subtitle, image URLs) into it
2. The HTML is loaded in a headless browser at the target resolution (e.g., 1080×1920)
3. The browser captures frames over the animation duration
4. FFmpeg encodes the frames into an MP4 (H.264, AAC-ready)

### Initial Template Set

| Template ID | Style | Best For |
|-------------|-------|----------|
| `slide-fade` | Each phrase fades in and slides up, crossfade between backgrounds | Product launches, announcements |
| `zoom-ken-burns` | Slow zoom/pan on images, phrases overlay with fade transitions | Storytelling, travel, real estate |
| `text-focus` | Bold scale-up punch on each phrase, minimal background | Quotes, stats, hot takes |
| `carousel` | Phrases paired with images, swipe-style horizontal transition | Multi-product, portfolios |
| `split-reveal` | Screen wipes/splits to reveal each new phrase | Listicles, step-by-step, countdowns |

### Template Requirements

Each template must:
- Be a single HTML file with all CSS/JS inlined
- Render at 1080×1920 (9:16), 1080×1080 (1:1), or 1080×1350 (4:5)
- Use CSS `animation` with `animation-play-state: paused` — never auto-playing
- All motion must be a pure function of time (no `setTimeout`, `setInterval`, or rAF loops)
- Expose `window.__seekTo(timeMs)` if using any JavaScript-driven animation
- Accept data injection via template variables (Mustache-style or DOM manipulation)
- Complete all animations within the configured duration
- Include a safe zone for text (avoid top 10% and bottom 10% where platform UI overlaps)
- Use web-safe fonts or bundle fonts as base64

### Color Extraction

When `colorScheme: "auto"`, the server:
1. Downloads the first image
2. Extracts dominant colors using Sharp or a palette extraction library
3. Selects a complementary background color and text color with sufficient contrast (WCAG AA minimum)
4. Injects the palette into the template CSS variables

---

## Rendering Pipeline

### Rendering Flow

```
Request → Validate input (Zod schema)
        → Fetch & process images if provided (resize, optimize via Sharp)
        → Calculate pacing (auto or from caller-specified durations)
        → Select template HTML
        → Inject data into template:
            - phrases array
            - image data URIs
            - title (if provided)
            - color palette (extracted or specified)
            - timing metadata (per-phrase enter/hold/exit durations)
        → Launch headless browser at target resolution
        → Deterministic frame-step capture (see below)
        → Encode frames to MP4 via FFmpeg (H.264, yuv420p)
        → Generate thumbnail from a mid-video frame
        → Upload to object storage
        → Return video URL + metadata
```

### Frame Capture Strategy — Deterministic Frame Stepping

Animations must be rendered with frame-perfect accuracy. Rather than capturing in real-time (which introduces timing drift, dropped frames, and load-dependent inconsistency), the pipeline uses a **deterministic frame-stepping** approach where each frame is individually seeked to and captured.

#### How It Works

1. **Pause all animations at load time.** Templates initialize with all CSS animations and Web Animations API timelines in a paused state. No animation plays in real-time.

2. **Calculate frame times.** For a 10-second video at 30fps, that's 300 frames. Frame `n` maps to time `n / fps` seconds (e.g., frame 0 = 0.000s, frame 1 = 0.033s, frame 150 = 5.000s).

3. **Seek to the target time.** For each frame, call into the page to advance every animation timeline to the exact target time:
   ```typescript
   await page.evaluate((timeMs) => {
     // Advance all Web Animations API animations
     document.getAnimations().forEach((anim) => {
       anim.currentTime = timeMs;
     });
     // Also update any JS-driven animation state via a global hook
     if (window.__seekTo) window.__seekTo(timeMs);
   }, frameTimeMs);
   ```

4. **Wait for paint.** After seeking, wait for the browser to complete layout and paint before capturing. Use a double-`requestAnimationFrame` to ensure the compositor has
flushed:
   ```typescript
   await page.evaluate(() => {
     return new Promise<void>((resolve) => {
       requestAnimationFrame(() => {
         requestAnimationFrame(() => resolve());
       });
     });
   });
   ```

5. **Capture the frame.** Take a screenshot of the viewport:
   ```typescript
   const frameBuffer = await page.screenshot({
     type: "png",
     clip: { x: 0, y: 0, width: 1080, height: 1920 },
   });
   ```

6. **Pipe to FFmpeg.** Frames are written sequentially to FFmpeg's stdin via a pipe (or to disk as numbered PNGs if memory is a concern).

7. **Repeat** for all frames until `frameTimeMs >= durationMs`.

#### Template Contract for Deterministic Rendering

Templates must follow these rules to work with the frame-stepping pipeline:

- **All CSS animations must use `animation-play-state: paused` by default.** The renderer will manipulate `currentTime` directly via the Web Animations API; the animations should never auto-play.
- **Expose a `window.__seekTo(timeMs)` function** if the template uses any JavaScript-driven animation (e.g., counter animations, particle systems, scroll-driven effects). This function receives the current time in milliseconds and must synchronously update all JS-driven visual state.
- **No `setTimeout` / `setInterval` / `requestAnimationFrame` loops for animation.** These are non-deterministic and won't work when time is being controlled externally. All motion must be expressible as a function of the current time.
- **Emit a `frame-ready` event** (optional, for complex templates) after all DOM updates for a given seek are complete, as a signal that the frame is safe to capture. Simple templates can rely on the double-rAF flush instead.

#### CSS Animation Pausing

Templates should declare animations normally but start paused:

```css
.title {
  animation: fadeInUp 1s ease-out forwards;
  animation-play-state: paused;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

The renderer's `document.getAnimations()` call picks up all CSS animations and steps them via `currentTime`. No additional JS is required for pure CSS animations.

#### Performance Considerations

- **This is slower than real-time capture** — a 10s video at 30fps takes 300 sequential screenshot cycles rather than 10 seconds of wall-clock recording. Expect 15–30 seconds of render time for a 10-second video depending on template complexity and screenshot speed.
- **PNG screenshots are the bottleneck.** Each full-resolution 1080×1920 PNG is ~2–5MB. Piping directly to FFmpeg via stdin avoids disk I/O.
- **Browser viewport must be set to exact output resolution** at page load — no resizing mid-render.
- **GPU acceleration** in headless Chromium (`--enable-gpu` flag) can improve CSS animation rendering quality (smoother gradients, transforms) but requires appropriate drivers in Docker.

#### Why Not Real-Time Capture?

| Concern | Real-time | Deterministic stepping |
|---------|-----------|----------------------|
| Frame accuracy | Drift and drops under load | Perfect — every frame is explicit |
| Server load sensitivity | Degrades with CPU pressure | Unaffected — just takes longer |
| Reproducibility | Non-deterministic | Identical output for identical input |
| Animation complexity | Limited by real-time budget | Unlimited — complex shaders/effects OK |
| Render speed | Faster (wall-clock) | Slower but predictable |

### FFmpeg Encoding Settings

```bash
ffmpeg -framerate 30 -i frame_%04d.png \
  -c:v libx264 -preset medium -crf 23 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -vf "scale=1080:1920" \
  output.mp4
```

- **H.264 baseline profile** for maximum compatibility (Instagram, TikTok, X, LinkedIn)
- **yuv420p** pixel format (required for most players)
- **faststart** flag for progressive download / streaming
- **CRF 23** balances quality and file size

---

## x402 Integration

### Payment Middleware

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);
server.registerExtension(bazaarResourceServerExtension);

const api = new Hono().basePath("/api");

// Payment-protected route with Bazaar discovery metadata
const routes = {
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      price: "$0.10",
      network: "eip155:8453", // Base mainnet
      payTo: process.env.WALLET_ADDRESS,
    },
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          phrases: [
            "Introducing our Spring Collection",
            "Crafted from sustainable materials",
            "Available in 12 colorways",
            "Shop now at example.com"
          ],
          images: ["https://example.com/image.jpg"],
          template: "slide-fade",
        },
        inputSchema: {
          properties: {
            phrases: {
              type: "array",
              items: { type: "string" },
              description: "1-10 phrases displayed sequentially as the core video content",
            },
            images: {
              type: "array",
              items: { type: "string" },
              description: "0-5 image URLs used as backgrounds or accents",
            },
            template: {
              type: "string",
              description: "Template ID (e.g. slide-fade, zoom-ken-burns, text-focus, carousel, split-reveal)",
            },
            options: {
              type: "object",
              properties: {
                title: { type: "string", description: "Persistent header or brand name shown throughout" },
                duration: { type: "number", description: "Total video duration in seconds (5-30)" },
                colorScheme: { type: "string", description: "auto, light, dark, or hex color" },
                aspectRatio: { type: "string", description: "9:16, 1:1, or 4:5" },
              },
            },
          },
          required: ["phrases"],
        },
        bodyType: "json",
        output: {
          example: {
            videoUrl: "https://api.clipcast.dev/videos/abc123.mp4",
            thumbnailUrl: "https://api.clipcast.dev/thumbs/abc123.jpg",
            duration: 12,
            resolution: "1080x1920",
          },
          schema: {
            properties: {
              videoUrl: { type: "string" },
              thumbnailUrl: { type: "string" },
              duration: { type: "number" },
              resolution: { type: "string" },
            },
          },
        },
      }),
    },
  },
};
```

### Facilitator Configuration

- **Network:** Base mainnet (`eip155:8453`) for production; Base Sepolia (`eip155:84532`) for testing
- **Facilitator:** Coinbase CDP hosted facilitator (`https://x402.org/facilitator`)
- **Asset:** USDC
- **Free tier:** 1,000 transactions/month via CDP facilitator, then $0.001/tx

---

## Security & Validation

### Input Validation

- **Phrases:** 1–10 items, each max 200 characters, strip HTML tags
- **Title:** Max 100 characters, strip HTML tags
- **Images:** Max 5 URLs; validate URL format; fetch with timeout (10s); reject files > 10MB; accept only JPEG, PNG, WebP, GIF
- **Template:** Must match a known template ID
- **Duration:** Clamp to 5–30 seconds
- **Pacing array:** If provided, must have same length as phrases and sum to ≤ total duration

### Rate Limiting

- Per-wallet address: 60 requests/minute
- Global: configurable based on infrastructure capacity
- Return `429 Too Many Requests` with `Retry-After` header

---

## Storage & Output

### Video Storage

- Store rendered videos in object storage (S3-compatible: R2, S3, MinIO)
- Videos expire after 24 hours (configurable via `RETENTION_HOURS` env var)
- A cleanup job runs periodically to purge expired files
- Thumbnails: extract first frame or a mid-point frame via FFmpeg

### File Naming

- Use a content-hash or UUID for filenames: `{uuid}.mp4`
- Serve via a CDN or signed URLs for fast delivery

---

## Configuration (Environment Variables)

```
# Server
PORT=3000
HOST=0.0.0.0

# x402
WALLET_ADDRESS=0x...
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=eip155:8453

# Storage
S3_BUCKET=videos
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
CDN_BASE_URL=https://cdn.clipcast.dev

# Rendering
MAX_CONCURRENT_RENDERS=4
RENDER_TIMEOUT_MS=60000
RETENTION_HOURS=24

# Browser
CHROMIUM_PATH=/usr/bin/chromium
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Render time (10s video, 30fps) | < 30 seconds |
| Single frame capture (seek + rAF + screenshot) | < 100ms |
| Concurrent renders | 4 per instance (tunable) |
| Video file size (10s, 1080×1920) | 2–8 MB |
| API response (excluding render) | < 500ms |

### Concurrency Management

- Use a job queue (in-memory for single instance; BullMQ/Redis for multi-instance)
- Limit concurrent headless browser instances to avoid OOM
- Return `202 Accepted` with a status-polling URL if the queue is backed up, or render synchronously if capacity is available

### Async vs Sync Response

Given rendering takes 10–20 seconds, support both patterns:

**Synchronous (default):** Hold the connection open and return the video URL when done. Simpler for agents, but ties up the connection.

**Asynchronous (optional):** Return `202 Accepted` with a job ID and a polling endpoint (`GET /api/jobs/{id}`). Better for high concurrency, but agents need to handle polling. Consider supporting a `webhook` field in the request body for callback-based notification.

---

## Project Structure

```
├── src/
│   ├── index.ts              # Bun.serve() entry — marketing site + Hono API
│   ├── api.ts                # Hono app with /api basePath, middleware, routes
│   ├── routes/
│   │   ├── generate.ts       # POST /api/generate handler
│   │   ├── templates.ts      # GET /api/templates listing endpoint
│   │   ├── brand-kits.ts     # POST /api/brand-kits, DELETE /api/brand-kits/:token
│   │   └── jobs.ts           # GET /api/jobs/{id} polling endpoint (async mode)
│   ├── services/
│   │   ├── renderer.ts       # Orchestrates the rendering pipeline
│   │   ├── browser.ts        # Headless browser pool, frame-stepping logic
│   │   ├── ffmpeg.ts         # FFmpeg encoding wrapper (stdin pipe)
│   │   ├── images.ts         # Image fetching, resizing, color extraction
│   │   ├── pacing.ts         # Auto-pacing calculation from phrase count + duration
│   │   ├── storage.ts        # S3 upload/delete, URL signing
│   │   ├── brand-kits.ts     # Brand kit CRUD, token generation, wallet verification
│   │   └── template-select.ts # Auto template selection heuristics
│   ├── templates/
│   │   ├── slide-fade.html
│   │   ├── zoom-ken-burns.html
│   │   ├── text-focus.html
│   │   ├── carousel.html
│   │   └── split-reveal.html
│   ├── utils/
│   │   ├── validation.ts     # Input validation schemas (Zod)
│   │   ├── color.ts          # Color extraction & contrast utilities
│   │   └── queue.ts          # Render job queue
│   └── config.ts             # Environment variable parsing
├── site/                     # Marketing site (React + Tailwind, served at /)
│   ├── index.html
│   ├── app.tsx
│   └── styles.css
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Dependencies

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@x402/hono": "latest",
    "@x402/core": "latest",
    "@x402/evm": "latest",
    "@x402/extensions": "latest",
    "sharp": "^0.33.x",
    "playwright": "^1.x",
    "zod": "^3.x",
    "nanoid": "^5.x",
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/bun": "latest"
  }
}
```

Note: FFmpeg is a system dependency installed in the Docker image, not an npm package.

---

## Docker

```dockerfile
FROM oven/bun:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  fonts-noto-color-emoji \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

ENV CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

---

## Brand Kits

### The Ownership Problem

x402 is stateless and transactional — there are no accounts, sessions, or user identity. This creates a challenge for stored brand kits: if anyone who knows a brand kit ID can use it, there's nothing preventing unauthorized usage. A few approaches address this at different levels of security.

### Access Model: Secret Token + Optional Wallet Pinning

Brand kits use a layered access model:

**Layer 1 — Secret token (default):** When a brand kit is created, Clipcast returns an opaque, unguessable token (e.g., `brk_a7f3x9...`). This token is the sole access credential. Anyone who possesses it can reference the kit in a `/api/generate` request. The creator is responsible for keeping it private — similar to how a bearer token or API key works, except it's scoped to a single brand kit rather than an account.

**Layer 2 — Wallet pinning (optional):** At creation time, the caller can pin the brand kit to one or more wallet addresses. When wallet pinning is enabled, Clipcast verifies that the x402 payment signature on the `/api/generate` request was signed by one of the pinned wallets before allowing the kit to be used. This ties brand kit access to payment identity without creating a full account system. An agent that always pays from the same wallet gets strong access control; agents that rotate wallets or use delegated signers can add multiple addresses to the allowlist.

**Layer 3 — Inline brand config (stateless fallback):** For callers who don't want to store anything server-side, the full brand configuration can be passed inline on every `/api/generate` request. This is the most x402-native approach — fully stateless, zero trust required — at the cost of verbosity.

### Endpoints

#### `POST /api/brand-kits`

Create a stored brand kit.

**Price:** ~$0.50 USDC (one-time creation fee; covers storage costs)

**Request body (JSON):**

```json
{
  "name": "ACME Co.",
  "logo": "https://example.com/logo.png",
  "colors": {
    "primary": "#1a1a2e",
    "secondary": "#e94560",
    "background": "#0f0f23",
    "text": "#ffffff"
  },
  "font": "Inter",
  "tagline": "Innovation for everyone",
  "pinnedWallets": ["0xabc...", "0xdef..."]
}
```

**Required fields:**
- `name` (string) — brand name, used as default title in videos

**Optional fields:**
- `logo` (string) — URL to a logo image; fetched and stored server-side
- `colors` (object) — `primary`, `secondary`, `background`, `text` as hex values
- `colors.palette` (string[]) — alternatively, an array of hex colors; the template picks appropriate roles
- `font` (string) — preferred font family; must be a Google Font name or web-safe font
- `tagline` (string) — optional tagline for use in templates that support it
- `pinnedWallets` (string[]) — wallet addresses allowed to use this kit; if omitted, anyone with the token can use it

**Response (JSON):**

```json
{
  "brandKitId": "brk_a7f3x9k2m4",
  "secretToken": "bkt_8h2j5n7p1q3r6t9w...",
  "createdAt": "2026-02-26T12:00:00Z",
  "expiresAt": null
}
```

The `secretToken` is shown only once at creation time. If lost, the brand kit must be re-created.

#### `DELETE /brand-kits/{secretToken}`

Delete a brand kit and its stored assets.

**Price:** Free

#### Using a Brand Kit in `/generate`

Reference a stored kit by its secret token, or pass the config inline:

```json
{
  "phrases": ["New product launch", "Available now"],
  "brandKit": "bkt_8h2j5n7p1q3r6t9w...",
  "template": "slide-fade"
}
```

Or inline (stateless):

```json
{
  "phrases": ["New product launch", "Available now"],
  "brand": {
    "name": "ACME Co.",
    "logo": "https://example.com/logo.png",
    "colors": { "primary": "#1a1a2e", "text": "#ffffff" }
  },
  "template": "slide-fade"
}
```

When a brand kit or inline brand config is provided:
- `options.title` defaults to the brand name (unless explicitly overridden)
- `options.colorScheme` defaults to the brand's color palette
- The logo is placed according to the template's logo slot (typically top-left or top-center)
- Font preference is applied to all text rendering

Explicit `options` fields always override brand kit defaults.

### Storage & Expiration

- Brand kits are stored in the same object storage as videos (S3/R2)
- Logos are fetched at creation time, resized, and stored as assets
- Brand kits do not expire by default; an optional `ttlDays` field can be set at creation
- A periodic cleanup job purges expired kits

---

## Intelligent Template Selection

### `"template": "auto"` Mode

When `template` is set to `"auto"` (or omitted), Clipcast selects the best template based on the request content. Selection heuristics:

| Signal | Template Preference |
|--------|-------------------|
| Images provided, 3+ phrases | `carousel` or `slide-fade` |
| No images, short punchy phrases | `text-focus` |
| 1–2 images, longer descriptive phrases | `zoom-ken-burns` |
| Sequential/numbered content (detected via patterns like "Step 1", "1.", "#1") | `split-reveal` |
| Brand kit with logo | Templates with logo slots preferred |

The selected template ID is included in the response so the caller knows what was chosen:

```json
{
  "videoUrl": "...",
  "templateUsed": "text-focus",
  "duration": 12
}
```

### Template Metadata for Agent Selection

The `/api/templates` endpoint includes semantic metadata to help agents choose:

```json
{
  "id": "text-focus",
  "name": "Text Focus",
  "description": "Bold scale-up punch on each phrase, minimal background",
  "bestFor": "Quotes, statistics, bold statements, and text-heavy content with no images",
  "idealPhraseCount": { "min": 2, "max": 6 },
  "idealImageCount": { "min": 0, "max": 1 },
  "hasLogoSlot": true,
  "previewUrl": "...",
  "tags": ["bold", "minimal", "text-heavy", "quotes"]
}
```

The `bestFor` field is written in natural language specifically to help LLM-based agents make good selections without needing to understand template internals.

---

## Multi-Platform Output

### `platforms` Field

Instead of specifying a single aspect ratio, callers can request output formatted for specific social media platforms. Clipcast renders the correct aspect ratio and adjusts safe zones per platform.

```json
{
  "phrases": ["..."],
  "platforms": ["instagram-reels", "linkedin", "tiktok"]
}
```

**Supported platforms and their mappings:**

| Platform ID | Aspect Ratio | Resolution | Safe Zone Notes |
|-------------|-------------|------------|-----------------|
| `instagram-reels` | 9:16 | 1080×1920 | Avoid bottom 15% (caption area), top 10% (camera/status bar) |
| `instagram-feed` | 1:1 | 1080×1080 | Minimal safe zone concerns |
| `instagram-story` | 9:16 | 1080×1920 | Same as reels |
| `tiktok` | 9:16 | 1080×1920 | Avoid bottom 20% (description/buttons), top 10% |
| `linkedin` | 1:1 or 4:5 | 1080×1080 or 1080×1350 | Minimal |
| `x-twitter` | 16:9 | 1920×1080 | Minimal |
| `youtube-shorts` | 9:16 | 1080×1920 | Avoid bottom 15% (title/subscribe) |
| `facebook-reels` | 9:16 | 1080×1920 | Similar to Instagram |

**Multi-platform response:**

```json
{
  "videos": [
    {
      "platform": "instagram-reels",
      "videoUrl": "https://api.clipcast.dev/videos/abc123-ig-reels.mp4",
      "thumbnailUrl": "https://api.clipcast.dev/thumbs/abc123-ig-reels.jpg",
      "resolution": "1080x1920",
      "aspectRatio": "9:16"
    },
    {
      "platform": "linkedin",
      "videoUrl": "https://api.clipcast.dev/videos/abc123-linkedin.mp4",
      "thumbnailUrl": "https://api.clipcast.dev/thumbs/abc123-linkedin.jpg",
      "resolution": "1080x1350",
      "aspectRatio": "4:5"
    }
  ],
  "duration": 12,
  "templateUsed": "slide-fade"
}
```

**Pricing:** Base price ($0.10) for the first platform, +$0.05 for each additional platform in the same request. Rendering multiple aspect ratios from the same template data is cheaper than separate requests because images are already fetched/processed and the template is already injected — only the frame capture and encoding steps run again at different dimensions.

**Backward compatibility:** The existing `options.aspectRatio` field continues to work for single-output requests. If both `platforms` and `options.aspectRatio` are provided, `platforms` takes precedence.

---

## Composability & Ecosystem Integration

### Design for Chaining

Clipcast is designed to be a composable building block in larger agent workflows. Key design decisions that support this:

- **Output is a URL, not a blob.** Video URLs are publicly accessible (or via signed URL) so downstream services can fetch them without special auth. An agent can pass the video URL directly to a social media posting API.
- **Response is structured JSON.** Every field an agent might need for downstream steps (duration, resolution, aspect ratio, platform) is in the response — no parsing or guessing required.
- **Deterministic output.** Same input produces the same video. Agents can retry without worrying about different results.
- **No session state required.** Every request is self-contained. An agent can call Clipcast from any context without setup.

### Example Agent Workflows

**Blog post → social video pipeline:**
1. Agent calls a web scraping x402 API to extract article content
2. Agent uses an LLM to generate 5 phrases summarizing the article
3. Agent calls `/generate` with the phrases + article hero image
4. Agent calls a social media posting x402 API with the video URL

**Product launch multi-platform push:**
1. Agent receives product data (name, features, images) from an internal system
2. Agent generates phrases from the feature list
3. Agent calls `/generate` with `platforms: ["instagram-reels", "tiktok", "linkedin"]` and a brand kit
4. Agent distributes each platform-specific video to the corresponding posting service

**Daily content series:**
1. Agent pulls trending topics from a data feed x402 API
2. Agent generates opinionated phrases via LLM
3. Agent calls `/generate` with `template: "text-focus"` (no images, bold text)
4. Agent posts to multiple platforms on a schedule

### MCP Server Wrapper

To make Clipcast directly usable by LLM-based agents (Claude, GPT, etc.) without writing x402 client code, provide an MCP (Model Context Protocol) server that wraps the API as a tool. This allows agents to call `clipcast_generate` as a native tool with typed parameters, and the MCP server handles the x402 payment flow transparently.

---

## Development Milestones

### Phase 1 — Core Rendering (MVP)
- [ ] Bun.serve() + Hono app with health check and marketing landing page
- [ ] Single template (`slide-fade`) with phrase sequence + data injection
- [ ] Deterministic frame-stepping capture pipeline
- [ ] FFmpeg encoding to MP4
- [ ] Local file storage (no S3 yet)
- [ ] Basic input validation with Zod
- [ ] Auto-pacing from phrase count

### Phase 2 — x402 Integration
- [ ] x402 payment middleware on `/api/generate`
- [ ] Bazaar discovery metadata with input/output schemas
- [ ] Test on Base Sepolia with testnet USDC
- [ ] Wallet configuration

### Phase 3 — Production Hardening
- [ ] S3 / R2 object storage with CDN
- [ ] Render queue with concurrency limits
- [ ] Rate limiting per wallet address
- [ ] Async response mode with job polling
- [ ] Video expiration cleanup job
- [ ] Thumbnail generation
- [ ] Docker image optimization

### Phase 4 — Template Expansion & Intelligence
- [ ] Additional templates (carousel, ken-burns, text-focus, split-reveal)
- [ ] Auto color extraction from images
- [ ] Custom font support
- [ ] Template preview generation for `/api/templates` endpoint
- [ ] `"template": "auto"` intelligent selection
- [ ] Rich semantic metadata on `/templates` for agent-friendly selection

### Phase 5 — Brand Kits
- [ ] `POST /api/brand-kits` creation endpoint with secret token
- [ ] Brand kit storage (logo assets, color config, font preference)
- [ ] Brand kit reference in `/generate` via `brandKit` field
- [ ] Inline `brand` config as stateless alternative
- [ ] Optional wallet pinning for access control
- [ ] Brand kit deletion and expiration cleanup

### Phase 6 — Multi-Platform Output
- [ ] `platforms` field on `/api/generate` with per-platform aspect ratio + safe zones
- [ ] Multi-video response schema
- [ ] Per-platform pricing (base + incremental)
- [ ] Platform-specific safe zone adjustments in templates

### Phase 7 — Scale, Observe & Ecosystem
- [ ] Multi-instance deployment with shared queue (Redis / BullMQ)
- [ ] Structured logging and metrics (render time, success rate, queue depth)
- [ ] Error alerting
- [ ] Move to Base mainnet
- [ ] MCP server wrapper for direct agent integration
- [ ] Publish example agent workflows (scrape → summarize → generate → post)

---

## Open Questions

1. **Audio support?** Should templates support background music or text-to-speech narration? This adds complexity but significantly increases social media engagement. Could be a Phase 7+ feature or a separate price tier.

2. **Webhook vs polling for async?** Agents may prefer one pattern over the other. Starting with synchronous + polling fallback is safest.

3. **Template marketplace?** Should third parties be able to submit templates? This could expand the template library without internal effort, but requires a review/approval process.

4. **x402 Hono middleware:** The `@x402/hono` package and example servers exist. Verify compatibility with our Bun.serve() + Hono hybrid setup where Hono runs under `Bun.serve({ fetch: api.fetch })`.

5. **Browser pooling:** Playwright supports browser contexts for isolation. Should we maintain a persistent browser instance with rotating contexts, or launch fresh browsers per render? Persistent is faster but uses more memory.

6. **Phrase length and line wrapping:** Templates need a strategy for phrases that are too long to fit on a single line at a readable font size. Options: auto-shrink font size, enforce a character limit, or allow multi-line with a max line count. Probably a combination — auto-shrink down to a minimum size, then truncate with ellipsis.

7. **Image placement strategy:** How should templates use images when the number of images doesn't match the number of phrases? Options: cycle through images, assign one image per N phrases, use the first image as a static background. This is likely template-specific rather than a global rule.

8. **Brand kit storage backend:** Should brand kits use the same S3 bucket as videos, or a separate persistent store (e.g., a lightweight KV database like Turso, DynamoDB, or even a JSON file on R2)? Brand kits are small but long-lived, unlike videos which are ephemeral. A KV store might be more appropriate.

9. **Brand kit abuse prevention:** Beyond wallet pinning, should there be rate limits on brand kit creation to prevent spam? A creation fee ($0.50) provides some natural friction, but a determined actor could still create many kits. Consider a per-wallet creation limit per time window.

10. **Multi-platform render parallelism:** When a request includes multiple platforms, should they render sequentially (simpler, less memory) or in parallel (faster, more resource-intensive)? Sequential is safer for MVP; parallel could be opt-in for paid tiers later.

11. **Asset bundle endpoint?** For the multi-platform vision, should there be an endpoint that returns a ZIP or structured bundle containing all platform videos plus thumbnails, rather than individual URLs? Agents managing content calendars might prefer a single downloadable package.
