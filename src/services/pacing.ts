export interface PhraseTiming {
  index: number;
  startMs: number;
  enterMs: number;
  holdMs: number;
  exitMs: number;
  totalMs: number;
}

export interface PhraseTimings {
  totalDuration: number;
  introDuration: number;
  outroDuration: number;
  phrases: PhraseTiming[];
}

const INTRO_MS = 500;
const OUTRO_MS = 500;
const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 30000;

function splitPhraseTiming(index: number, startMs: number, totalMs: number): PhraseTiming {
  return {
    index,
    startMs,
    enterMs: totalMs * 0.25,
    holdMs: totalMs * 0.5,
    exitMs: totalMs * 0.25,
    totalMs,
  };
}

export function calculatePacing(
  phrases: string[],
  duration?: number,
  pacing?: number[],
): PhraseTimings {
  const phraseCount = phrases.length;

  // Auto-duration if not specified
  let totalMs: number;
  if (duration != null) {
    totalMs = duration * 1000;
  } else {
    totalMs = phraseCount * 2500 + 1500;
    totalMs = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, totalMs));
  }

  const introDuration = INTRO_MS;
  const outroDuration = OUTRO_MS;

  if (pacing) {
    // Custom pacing: validate length matches
    if (pacing.length !== phraseCount) {
      throw new PacingError(
        `Pacing array length (${pacing.length}) must match phrase count (${phraseCount})`,
      );
    }

    const pacingSumMs = pacing.reduce((sum, s) => sum + s * 1000, 0);
    const computedTotal = pacingSumMs + introDuration + outroDuration;
    if (computedTotal > MAX_DURATION_MS) {
      throw new PacingError(
        `Total pacing duration (${(pacingSumMs / 1000).toFixed(1)}s) exceeds maximum (${(MAX_DURATION_MS - introDuration - outroDuration) / 1000}s)`,
      );
    }

    let currentMs = introDuration;
    const phraseTimings: PhraseTiming[] = pacing.map((seconds, index) => {
      const totalPhraseMs = seconds * 1000;
      const timing = splitPhraseTiming(index, currentMs, totalPhraseMs);
      currentMs += totalPhraseMs;
      return timing;
    });

    return {
      totalDuration: computedTotal,
      introDuration,
      outroDuration,
      phrases: phraseTimings,
    };
  }

  // Auto-pacing: distribute remaining time evenly
  const availableMs = totalMs - introDuration - outroDuration;
  const perPhraseMs = availableMs / phraseCount;

  const phraseTimings: PhraseTiming[] = phrases.map((_, index) => {
    return splitPhraseTiming(index, introDuration + index * perPhraseMs, perPhraseMs);
  });

  return {
    totalDuration: totalMs,
    introDuration,
    outroDuration,
    phrases: phraseTimings,
  };
}

export class PacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PacingError";
  }
}
