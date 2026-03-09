import { test, expect, afterAll } from "bun:test";
import { resolve } from "node:path";
import { config } from "../config";
import { renderVideo } from "./renderer";
import { closeBrowser } from "./browser";
import type { GenerateRequest } from "../utils/validation";

let createdId: string | null = null;

afterAll(async () => {
  await closeBrowser();
  if (createdId) {
    const path = resolve(config.OUTPUT_DIR, `${createdId}.mp4`);
    const file = Bun.file(path);
    if (await file.exists()) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(path);
    }
  }
});

test("renderVideo produces a valid MP4 for 2 phrases", async () => {
  const request: GenerateRequest = {
    phrases: ["Hello world", "Second phrase"],
    template: "slide-fade",
    options: { duration: 3 },
  };

  const result = await renderVideo(request);
  createdId = result.id;

  expect(result.id).toBeString();
  expect(result.id.length).toBeGreaterThan(0);
  expect(result.videoUrl).toBe(`/output/${result.id}.mp4`);
  expect(result.duration).toBe(3);
  expect(result.resolution).toBe("1920x1080");
  expect(result.templateUsed).toBe("slide-fade");

  // Verify MP4 exists and has ftyp header
  const file = Bun.file(resolve(config.OUTPUT_DIR, `${result.id}.mp4`));
  expect(await file.exists()).toBe(true);
  expect(file.size).toBeGreaterThan(0);

  const header = Buffer.from(await file.slice(0, 8).arrayBuffer());
  expect(header.toString("ascii", 4, 8)).toBe("ftyp");
}, 60000);
