import { test, expect, afterAll } from "bun:test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config";
import { captureFrames, closeBrowser } from "./browser";
import { encodeFrames } from "./ffmpeg";

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

test("encodeFrames produces a valid MP4", async () => {
  // Generate 15 solid-color frames (0.5s at 30fps)
  const frames = await captureFrames(SOLID_HTML, 320, 240, 500, 30);
  expect(frames.length).toBe(15);

  await encodeFrames(frames, 30, OUTPUT_PATH);

  const file = Bun.file(OUTPUT_PATH);
  expect(await file.exists()).toBe(true);
  expect(file.size).toBeGreaterThan(0);

  // MP4 ftyp box: bytes 4-7 should be "ftyp"
  const header = Buffer.from(await file.slice(0, 8).arrayBuffer());
  expect(header.toString("ascii", 4, 8)).toBe("ftyp");
}, 30000);
