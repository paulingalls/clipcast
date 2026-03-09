# CLAUDE.md — Clipcast

Clipcast is a pay-per-request video generation API (x402 / USDC on Base). Structured data in (phrases, images, styling), animated portrait videos out.

## Key Files

- `MILESTONES.md` — **Start here.** Step-by-step build milestones with implementation specs. Build them in order.
- `REQUIREMENTS.md` — Full product spec (API design, rendering pipeline, templates, x402, brand kits, multi-platform). Reference when you need deeper context on a feature.

## Bun Conventions

Default to Bun as runtime and package manager. No Node.js, no npm, no yarn.

- `bun <file>` not `node` or `ts-node`
- `bun install`, `bun test`, `bun run <script>`, `bunx <pkg>`
- `Bun.file()` over `node:fs` readFile/writeFile
- `bun:sqlite` not better-sqlite3; `Bun.redis` not ioredis
- Bun auto-loads `.env` — no dotenv
- Bun.$`cmd` for shell commands — no execa

### Server Architecture

`Bun.serve()` is the entry point. It serves the marketing site via HTML imports and delegates `/api/*` to a Hono app. This gives us Hono's middleware chain for x402 payments, rate limiting, and validation on API routes, plus Bun's native HTML bundling for the frontend.

```ts
import { Hono } from "hono";
import landing from "./site/index.html";

const api = new Hono().basePath("/api");
// x402 middleware, routes, etc.

Bun.serve({
  routes: {
    "/": landing,
  },
  fetch: api.fetch, // Hono handles /api/* and anything not matched by routes
  development: { hmr: true, console: true },
});
```

### Marketing Site

HTML files can import `.tsx`/`.jsx`/`.css` directly — Bun bundles automatically. Use React + Tailwind for the marketing site. Eventually the site will support human users generating videos too.

### Testing

```ts
import { test, expect } from "bun:test";
```

## Tech Stack

- **Runtime:** Bun
- **API framework:** Hono (middleware chain for x402, rate limiting, validation)
- **Entry point:** `Bun.serve()` (HTML imports for marketing site + delegates to Hono)
- **Rendering:** Playwright (headless Chromium) + FFmpeg
- **Image processing:** Sharp
- **Payments:** x402 (`@x402/hono`, `@x402/core`, `@x402/evm`, `@x402/extensions`)
- **Validation:** Zod
- **Storage:** S3-compatible (R2/S3/MinIO) — local file storage for Phase 1
- **Language:** TypeScript

## Project Structure

```
clipcast/
├── src/
│   ├── index.ts              # Bun.serve() entry — marketing site + Hono API
│   ├── api.ts                # Hono app with /api basePath, middleware, routes
│   ├── routes/
│   │   ├── generate.ts       # POST /api/generate
│   │   ├── templates.ts      # GET /api/templates
│   │   ├── brand-kits.ts     # POST /api/brand-kits
│   │   └── jobs.ts           # GET /api/jobs/{id}
│   ├── services/
│   │   ├── renderer.ts       # Pipeline orchestration
│   │   ├── browser.ts        # Browser pool + frame-stepping
│   │   ├── ffmpeg.ts         # FFmpeg encoding (stdin pipe)
│   │   ├── images.ts         # Fetch, resize, color extraction
│   │   ├── pacing.ts         # Auto-pacing calculation
│   │   ├── storage.ts        # S3 upload/URL signing
│   │   ├── brand-kits.ts     # Brand kit CRUD
│   │   └── template-select.ts
│   ├── templates/            # Animation HTML templates
│   │   └── slide-fade.html   # MVP template
│   └── utils/
│       ├── validation.ts     # Zod schemas
│       ├── color.ts          # Color extraction + contrast
│       └── queue.ts          # Render job queue
├── site/                     # Marketing site (React + Tailwind, served at /)
│   ├── index.html
│   ├── app.tsx
│   └── styles.css
├── package.json
├── tsconfig.json
├── REQUIREMENTS.md
├── CLAUDE.md
└── .env.example
```

## Current Phase: 1 — Core Rendering (MVP)

See `MILESTONES.md` for the full breakdown. Phase 1 milestones are numbered 1.1 through 1.10. Build them in order. Do not implement x402 payments, brand kits, multi-platform, or async jobs yet.

## Coding Conventions

- async/await throughout, no callbacks
- Validate inputs at route level (Zod), pass typed data to services
- Services are pure functions — data in, result out
- `nanoid` for IDs (filenames, job IDs, tokens)
- Throw typed errors from services; Hono error handler formats JSON responses
- `console.log` with structured JSON for logging (replace in Phase 3)
- Cache template HTML in memory at startup

## Critical Implementation Details

- **Frame-stepping:** All CSS animations start paused. For each frame: seek via `document.getAnimations().forEach(a => a.currentTime = timeMs)`, double-rAF wait, then screenshot. This is non-negotiable for deterministic output.
- **FFmpeg stdin pipe:** Spawn with `-f image2pipe -vcodec mjpeg -i -`, write JPEGs (quality 90) to stdin. No disk I/O.
- **Browser pool:** Single persistent Playwright browser, new `BrowserContext` per render. Viewport set to exact output resolution.
- **Video encoding:** Always `-pix_fmt yuv420p -movflags +faststart` or mobile playback breaks.
- **Template contract:** No setTimeout/setInterval/rAF loops. All motion = f(time). Expose `window.__seekTo(timeMs)` for JS animation.

## Environment

```
PORT=3000
HOST=0.0.0.0
MAX_CONCURRENT_RENDERS=4
RENDER_TIMEOUT_MS=60000
RETENTION_HOURS=24
```
