import type { PhraseTimings } from "@/services/pacing";
import { formatTimecode } from "../utils/format";

interface FrameInfoProps {
  currentTime: number;
  fps: number;
  timing: PhraseTimings | null;
}

export function FrameInfo({ currentTime, fps, timing }: FrameInfoProps) {
  const frameNumber = Math.floor(currentTime / (1000 / fps));
  const timecode = formatTimecode(currentTime);

  let phaseLabel = "—";
  if (timing) {
    if (currentTime < timing.introDuration) {
      phaseLabel = "Intro";
    } else if (currentTime >= timing.totalDuration - timing.outroDuration) {
      phaseLabel = "Outro";
    } else {
      const idx = timing.phrases.findIndex(
        (p) => currentTime >= p.startMs && currentTime < p.startMs + p.totalMs,
      );
      phaseLabel = idx >= 0 ? `Phrase ${idx + 1}` : "Transition";
    }
  }

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
      <span>F: {frameNumber}</span>
      <span>{timecode}</span>
      <span className="text-foreground font-sans font-medium">{phaseLabel}</span>
    </div>
  );
}
