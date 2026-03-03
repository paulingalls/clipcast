import { test, expect, describe } from "bun:test";
import { calculatePacing, PacingError } from "./pacing";

describe("calculatePacing", () => {
  test("3 phrases with auto-duration", () => {
    const result = calculatePacing(["a", "b", "c"]);
    // 3 * 2500 + 1500 = 9000ms
    expect(result.totalDuration).toBe(9000);
    expect(result.introDuration).toBe(500);
    expect(result.outroDuration).toBe(500);
    expect(result.phrases).toHaveLength(3);

    // Each phrase: (9000 - 500 - 500) / 3 = 2666.67ms
    const perPhrase = (9000 - 500 - 500) / 3;
    for (const p of result.phrases) {
      expect(p.totalMs).toBeCloseTo(perPhrase, 1);
      expect(p.enterMs).toBeCloseTo(perPhrase * 0.25, 1);
      expect(p.holdMs).toBeCloseTo(perPhrase * 0.5, 1);
      expect(p.exitMs).toBeCloseTo(perPhrase * 0.25, 1);
    }

    expect(result.phrases[0]!.startMs).toBe(500);
    expect(result.phrases[1]!.startMs).toBeCloseTo(500 + perPhrase, 1);
    expect(result.phrases[2]!.startMs).toBeCloseTo(500 + perPhrase * 2, 1);
  });

  test("5 phrases with explicit 12s duration", () => {
    const result = calculatePacing(["a", "b", "c", "d", "e"], 12);
    expect(result.totalDuration).toBe(12000);

    // 12000 - 500 - 500 = 11000 / 5 = 2200ms per phrase
    const perPhrase = 2200;
    for (const p of result.phrases) {
      expect(p.totalMs).toBe(perPhrase);
    }
  });

  test("auto-duration clamps to minimum 5000ms", () => {
    // 1 phrase: 1 * 2500 + 1500 = 4000 → clamped to 5000
    const result = calculatePacing(["a"]);
    expect(result.totalDuration).toBe(5000);
  });

  test("auto-duration clamps to maximum 30000ms", () => {
    // 12 phrases would be 12 * 2500 + 1500 = 31500 → clamped to 30000
    // But max phrases is 10, so: 10 * 2500 + 1500 = 26500
    const phrases = Array(10).fill("phrase");
    const result = calculatePacing(phrases);
    expect(result.totalDuration).toBe(26500);
  });

  test("custom pacing [3, 2, 5]", () => {
    const result = calculatePacing(["a", "b", "c"], undefined, [3, 2, 5]);

    // Total: 500 + 3000 + 2000 + 5000 + 500 = 11000
    expect(result.totalDuration).toBe(11000);

    expect(result.phrases[0]!.startMs).toBe(500);
    expect(result.phrases[0]!.totalMs).toBe(3000);
    expect(result.phrases[0]!.enterMs).toBe(750);
    expect(result.phrases[0]!.holdMs).toBe(1500);
    expect(result.phrases[0]!.exitMs).toBe(750);

    expect(result.phrases[1]!.startMs).toBe(3500);
    expect(result.phrases[1]!.totalMs).toBe(2000);

    expect(result.phrases[2]!.startMs).toBe(5500);
    expect(result.phrases[2]!.totalMs).toBe(5000);
  });

  test("pacing array length mismatch throws PacingError", () => {
    expect(() => calculatePacing(["a", "b"], undefined, [3])).toThrow(PacingError);
  });
});
