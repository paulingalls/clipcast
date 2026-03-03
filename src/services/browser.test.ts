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

test(
  "captureFrames returns correct count of valid PNGs",
  async () => {
    const frames = await captureFrames(MINIMAL_HTML, 320, 240, 1000, 10);

    // Correct frame count
    expect(frames.length).toBe(10);

    for (const frame of frames) {
      // Valid PNG magic bytes
      expect(frame[0]).toBe(0x89);
      expect(frame[1]).toBe(0x50); // P
      expect(frame[2]).toBe(0x4e); // N
      expect(frame[3]).toBe(0x47); // G

      // PNG IHDR chunk starts at byte 8, width at 16, height at 20 (big-endian)
      const width = frame.readUInt32BE(16);
      const height = frame.readUInt32BE(20);
      expect(width).toBe(320);
      expect(height).toBe(240);
    }
  },
  30000
);
