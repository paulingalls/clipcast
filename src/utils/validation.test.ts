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
