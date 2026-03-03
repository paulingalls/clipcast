import { test, expect } from "bun:test";
import { getTemplate, injectData, resolveColors, type TemplateData } from "./templates";

test("getTemplate returns HTML containing the placeholder for slide-fade", async () => {
  const html = await getTemplate("slide-fade");
  expect(html).toContain("<!-- __CLIPCAST_DATA__ -->");
});

test("getTemplate throws for nonexistent template", async () => {
  expect(getTemplate("nonexistent")).rejects.toThrow("Template not found: nonexistent");
});

test("getTemplate throws for path traversal attempts", async () => {
  expect(getTemplate("../package")).rejects.toThrow();
});

test("injectData replaces placeholder with script tag containing valid JSON", () => {
  const html = "<html><!-- __CLIPCAST_DATA__ --><body></body></html>";
  const data: TemplateData = {
    phrases: ["Hello", "World"],
    colors: { background: "#000000", text: "#ffffff", accent: "#ff0000" },
    timing: {
      totalDuration: 5000,
      introDuration: 500,
      outroDuration: 500,
      phrases: [
        { index: 0, startMs: 500, enterMs: 500, holdMs: 1000, exitMs: 500, totalMs: 2000 },
        { index: 1, startMs: 2500, enterMs: 500, holdMs: 1000, exitMs: 500, totalMs: 2000 },
      ],
    },
    resolution: { width: 1080, height: 1920 },
  };

  const result = injectData(html, data);

  expect(result).not.toContain("<!-- __CLIPCAST_DATA__ -->");
  expect(result).toContain("<script>window.__CLIPCAST_DATA__");
  expect(result).toContain("</script>");

  // Extract the JSON and verify it's valid
  const match = result.match(/window\.__CLIPCAST_DATA__ = (.+?);<\/script>/);
  expect(match).not.toBeNull();
  const parsed = JSON.parse(match![1]);
  expect(parsed.phrases).toEqual(["Hello", "World"]);
  expect(parsed.resolution.width).toBe(1080);
});

test("resolveColors fills defaults when no scheme provided", () => {
  const colors = resolveColors();
  expect(colors.background).toBe("#1a1a2e");
  expect(colors.text).toBe("#ffffff");
  expect(colors.accent).toBe("#e94560");
});

test("resolveColors respects partial overrides", () => {
  const colors = resolveColors({ background: "#000000" });
  expect(colors.background).toBe("#000000");
  expect(colors.text).toBe("#ffffff");
  expect(colors.accent).toBe("#e94560");
});

test("resolveColors respects full overrides", () => {
  const colors = resolveColors({
    background: "#111111",
    text: "#222222",
    accent: "#333333",
  });
  expect(colors.background).toBe("#111111");
  expect(colors.text).toBe("#222222");
  expect(colors.accent).toBe("#333333");
});
