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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return browserPromise;
}

export async function captureFrames(
  html: string,
  width: number,
  height: number,
  durationMs: number,
  fps = 30,
): Promise<Buffer[]> {
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const frameCount = Math.ceil((durationMs / 1000) * fps);
    const frames: Buffer[] = [];

    for (let i = 0; i < frameCount; i++) {
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
