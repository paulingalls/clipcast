# CLAUDE.md — Clipcast

Clipcast is a pay-per-request video generation API (x402 / USDC on Base). Structured data in (phrases, images, styling), animated portrait videos out.

## XP Values

Follow the values of Extreme Programming in all work:

- **Simplicity:** Do the simplest thing that works. No speculative abstractions, no premature generalization. Three similar lines beat a premature helper.
- **Feedback:** Run tests early and often. Verify assumptions with `bun test`, `bun run lint`, `bun run typecheck`. Let failing tests guide the work.
- **Communication:** Keep code self-documenting. Name things clearly. When something isn't obvious, say why in a comment — not what.
- **Courage:** Delete dead code. Fix the real problem instead of working around it. Refactor when the code tells you to, not before.

## Key Files

- `docs/MILESTONES.md` — Step-by-step build milestones with implementation specs. Build in order.
- `docs/REQUIREMENTS.md` — Full product spec. Reference for deeper context on any feature.

## Current Phase: 2 — x402 Integration

Phase 1 (Core Rendering MVP) is complete. Phase 2 milestones are 2.1–2.3: payment middleware, Bazaar discovery metadata, and testnet end-to-end payment. See `docs/MILESTONES.md`.

## Bun Conventions

Bun is the runtime and package manager. No Node.js, no npm, no yarn.

- `bun <file>`, `bun install`, `bun test`, `bun run <script>`, `bunx <pkg>`
- `Bun.file()` over `node:fs` readFile/writeFile
- `bun:sqlite` not better-sqlite3; `Bun.redis` not ioredis
- Bun auto-loads `.env` — no dotenv
- `Bun.$\`cmd\`` for shell — no execa
- Test with `import { test, expect } from "bun:test"`

## Architecture

`Bun.serve()` entry point serves the marketing site (React + Tailwind via HTML imports) and delegates `/api/*` to a Hono app. Hono provides the middleware chain for x402 payments, rate limiting, and validation.

## Tech Stack

Bun, Hono, Playwright + FFmpeg (rendering), Sharp (images), x402 (payments), Zod (validation), TypeScript. Local file storage (S3-compatible planned for Phase 3+).

## Project Structure

```
src/
├── index.ts                # Bun.serve() entry
├── api.ts                  # Hono app, /api basePath, middleware, routes
├── config.ts               # Env vars with defaults
├── routes/
│   ├── generate.ts         # POST /api/generate
│   └── dev.ts              # Dev harness routes
├── services/
│   ├── renderer.ts         # Pipeline orchestration
│   ├── browser.ts          # Browser pool + frame-stepping
│   ├── ffmpeg.ts           # FFmpeg encoding (stdin pipe)
│   ├── pacing.ts           # Auto-pacing calculation
│   └── templates.ts        # Template loading + listing
├── templates/
│   └── slide-fade.html     # MVP template
├── utils/
│   ├── validation.ts       # Zod schemas
│   └── cleanup.ts          # Output file cleanup
└── dev/                    # Dev harness UI (React)
site/                       # Marketing site (React + Tailwind)
docs/                       # MILESTONES.md, REQUIREMENTS.md
```

## Coding Conventions

- async/await throughout, no callbacks
- Validate inputs at route level (Zod), pass typed data to services
- Services are pure functions — data in, result out
- `nanoid` for IDs
- Throw typed errors from services; Hono error handler formats JSON responses
- Cache template HTML in memory at startup

## Critical Rendering Details

- **Frame-stepping:** CSS animations start paused. Seek via `document.getAnimations().forEach(a => a.currentTime = timeMs)`, double-rAF wait, then screenshot. Non-negotiable for deterministic output.
- **FFmpeg stdin pipe:** `-f image2pipe -vcodec mjpeg -i -`, write JPEGs to stdin. No disk I/O.
- **Browser pool:** Single persistent browser, new `BrowserContext` per render. Viewport = output resolution.
- **Video encoding:** Always `-pix_fmt yuv420p -movflags +faststart` or mobile playback breaks.
- **Template contract:** No setTimeout/setInterval/rAF loops. All motion = f(time).

## Environment

```
PORT=3000  HOST=0.0.0.0  MAX_CONCURRENT_RENDERS=4  RENDER_TIMEOUT_MS=60000  RETENTION_HOURS=24
```
