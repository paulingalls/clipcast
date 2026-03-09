import { test, expect, afterAll } from "bun:test";
import { captureFrames, closeBrowser } from "./browser";

afterAll(async () => {
  await closeBrowser();
});

const MINIMAL_HTML = `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; background: #ff0000; }
  .box {
    width: 100px; height: 100px; background: #00ff00;
    animation: slide 1s linear both paused;
  }
  @keyframes slide {
    from { transform: translateX(0); }
    to { transform: translateX(200px); }
  }
</style>
<script>
  window.__seekTo = function(timeMs) {
    document.getAnimations().forEach(a => { a.currentTime = timeMs; });
  };
</script>
</head><body><div class="box"></div></body></html>`;

test("captureFrames returns correct count of valid JPEGs", async () => {
  const frames: Buffer[] = [];
  await captureFrames(
    MINIMAL_HTML,
    { width: 320, height: 240, durationMs: 1000, fps: 10 },
    (frame) => {
      frames.push(frame);
      return Promise.resolve();
    },
  );

  // Correct frame count
  expect(frames.length).toBe(10);

  for (const frame of frames) {
    // Valid JPEG magic bytes (SOI marker)
    expect(frame[0]).toBe(0xff);
    expect(frame[1]).toBe(0xd8);
    expect(frame[2]).toBe(0xff);

    // Verify frame dimensions via JPEG SOF0 marker
    let i = 2;
    while (i < frame.length - 8) {
      if (frame[i] === 0xff && frame[i + 1] === 0xc0) {
        const height = frame.readUInt16BE(i + 5);
        const width = frame.readUInt16BE(i + 7);
        expect(width).toBe(320);
        expect(height).toBe(240);
        break;
      }
      i++;
    }
  }
}, 30000);
