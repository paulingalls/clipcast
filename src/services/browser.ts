import { chromium, type Browser } from "playwright";

export class BrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserError";
  }
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise;
    if (b.isConnected()) return b;
  }
  browserPromise = chromium.launch({
    args: ["--disable-dev-shm-usage"],
  });
  return browserPromise;
}

export interface CaptureOptions {
  width: number;
  height: number;
  durationMs: number;
  fps?: number;
  signal?: AbortSignal;
}

export async function captureFrames(html: string, options: CaptureOptions): Promise<Buffer[]> {
  const { width, height, durationMs, fps = 30, signal } = options;
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();

    // Block all network requests from user-controlled template content (SSRF prevention).
    // NOTE: This prevents templates from loading external resources (images, fonts).
    // When image URL support is added, allowlist data: URIs or pre-fetch and inline images
    // before injection rather than allowing network access here.
    await page.route("**/*", (route) => route.abort());

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const frameCount = Math.ceil((durationMs / 1000) * fps);
    const frames: Buffer[] = [];

    for (let i = 0; i < frameCount; i++) {
      if (signal?.aborted) {
        throw new BrowserError("Render cancelled");
      }

      const timeMs = (i / fps) * 1000;

      await page.evaluate((t: number) => {
        const win = window as Window & { __seekTo?: (ms: number) => void };
        if (typeof win.__seekTo === "function") {
          win.__seekTo(t);
        } else {
          document.getAnimations().forEach((a) => {
            a.currentTime = t;
          });
        }
      }, timeMs);

      // Double rAF for rendering
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }),
      );

      const buf = await page.screenshot({ type: "png" });
      frames.push(buf);
    }

    return frames;
  } catch (err) {
    if (err instanceof BrowserError) throw err;
    throw new BrowserError(
      `Frame capture failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = null;
    await b.close();
  }
}
