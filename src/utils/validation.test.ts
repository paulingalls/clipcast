import { test, expect, describe } from "bun:test";
import { generateRequestSchema, formatZodError } from "./validation";

describe("generateRequestSchema", () => {
  test("accepts valid minimal input", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["Hello world"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.template).toBe("slide-fade");
    }
  });

  test("accepts valid full input", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["First phrase", "Second phrase"],
      images: ["https://example.com/image.png"],
      template: "slide-fade",
      options: {
        title: "My Video",
        duration: 10,
        colorScheme: { background: "#000000", text: "#FFFFFF" },
        aspectRatio: "9:16",
        pacing: [3, 2],
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty phrases", () => {
    const result = generateRequestSchema.safeParse({ phrases: [] });
    expect(result.success).toBe(false);
  });

  test("rejects more than 10 phrases", () => {
    const result = generateRequestSchema.safeParse({
      phrases: Array(11).fill("phrase"),
    });
    expect(result.success).toBe(false);
  });

  test("rejects phrase over 200 characters", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["x".repeat(201)],
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid URL in images", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      images: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });

  test("rejects bad hex color", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { colorScheme: { background: "red" } },
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid aspect ratio", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { aspectRatio: "4:3" },
    });
    expect(result.success).toBe(false);
  });

  // --- Phrases edge cases ---

  test("rejects empty string phrase", () => {
    const result = generateRequestSchema.safeParse({ phrases: [""] });
    expect(result.success).toBe(false);
  });

  test("accepts exactly 10 phrases", () => {
    const result = generateRequestSchema.safeParse({
      phrases: Array(10).fill("phrase"),
    });
    expect(result.success).toBe(true);
  });

  test("accepts single-character phrase", () => {
    const result = generateRequestSchema.safeParse({ phrases: ["A"] });
    expect(result.success).toBe(true);
  });

  test("accepts exactly 200 character phrase", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["x".repeat(200)],
    });
    expect(result.success).toBe(true);
  });

  // --- Images edge cases ---

  test("accepts empty images array", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      images: [],
    });
    expect(result.success).toBe(true);
  });

  test("defaults when only phrases provided (images, template, options)", () => {
    const result = generateRequestSchema.safeParse({ phrases: ["hello"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toBeUndefined();
      expect(result.data.template).toBe("slide-fade");
      expect(result.data.options).toBeUndefined();
    }
  });

  // --- Duration edge cases ---

  test("accepts duration at lower boundary (3s)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { duration: 3 },
    });
    expect(result.success).toBe(true);
  });

  test("accepts duration at upper boundary (30s)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { duration: 30 },
    });
    expect(result.success).toBe(true);
  });

  test("rejects duration below minimum (2s)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { duration: 2 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects duration above maximum (31s)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { duration: 31 },
    });
    expect(result.success).toBe(false);
  });

  test("accepts empty options (duration, title omitted)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options?.duration).toBeUndefined();
      expect(result.data.options?.title).toBeUndefined();
    }
  });

  // --- Pacing edge cases ---

  test("accepts valid pacing array", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["a", "b"],
      options: { pacing: [3, 2] },
    });
    expect(result.success).toBe(true);
  });

  test("rejects pacing with zero values", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["a", "b"],
      options: { pacing: [3, 0] },
    });
    expect(result.success).toBe(false);
  });

  test("rejects pacing with negative values", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["a", "b"],
      options: { pacing: [3, -1] },
    });
    expect(result.success).toBe(false);
  });

  // --- Color scheme edge cases ---

  test("rejects 3-char hex color", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { colorScheme: { background: "#FFF" } },
    });
    expect(result.success).toBe(false);
  });

  test("accepts valid lowercase hex color", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { colorScheme: { background: "#ff00aa" } },
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-hex characters in color", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { colorScheme: { background: "#GGGGGG" } },
    });
    expect(result.success).toBe(false);
  });

  test("accepts color scheme with all fields", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: {
        colorScheme: { background: "#000000", text: "#FFFFFF", accent: "#FF0000" },
      },
    });
    expect(result.success).toBe(true);
  });

  // --- Title edge cases ---

  test("accepts title at max length (100 chars)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { title: "x".repeat(100) },
    });
    expect(result.success).toBe(true);
  });

  test("rejects title over max length (101 chars)", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      options: { title: "x".repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  // --- Template edge cases ---

  test("accepts slide-fade template", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      template: "slide-fade",
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown template", () => {
    const result = generateRequestSchema.safeParse({
      phrases: ["hello"],
      template: "unknown-template",
    });
    expect(result.success).toBe(false);
  });
});

describe("formatZodError", () => {
  test("formats errors with path and message", () => {
    const result = generateRequestSchema.safeParse({ phrases: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.error).toBe("validation_error");
      expect(formatted.details.length).toBeGreaterThan(0);
      expect(formatted.details[0]).toHaveProperty("path");
      expect(formatted.details[0]).toHaveProperty("message");
    }
  });
});
