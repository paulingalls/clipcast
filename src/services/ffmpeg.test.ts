import { test, expect, afterAll } from "bun:test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config";
import { captureFrames, closeBrowser } from "./browser";
import { createEncoder } from "./ffmpeg";

const OUTPUT_PATH = resolve(config.OUTPUT_DIR, "test-ffmpeg.mp4");

mkdirSync(config.OUTPUT_DIR, { recursive: true });

afterAll(async () => {
  await closeBrowser();
  const file = Bun.file(OUTPUT_PATH);
  if (await file.exists()) {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(OUTPUT_PATH);
  }
});

const SOLID_HTML = `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; background: #0000ff; width: 320px; height: 240px; }
</style></head><body></body></html>`;

test("createEncoder produces a valid MP4", async () => {
  const encoder = createEncoder(30, OUTPUT_PATH);

  let frameCount = 0;
  await captureFrames(
    SOLID_HTML,
    { width: 320, height: 240, durationMs: 500, fps: 30 },
    async (frame) => {
      frameCount++;
      await encoder.writeFrame(frame);
    },
  );
  expect(frameCount).toBe(15);

  await encoder.finish();

  const file = Bun.file(OUTPUT_PATH);
  expect(await file.exists()).toBe(true);
  expect(file.size).toBeGreaterThan(0);

  // MP4 ftyp box: bytes 4-7 should be "ftyp"
  const header = Buffer.from(await file.slice(0, 8).arrayBuffer());
  expect(header.toString("ascii", 4, 8)).toBe("ftyp");
}, 30000);
