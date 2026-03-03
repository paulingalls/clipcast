import type { PhraseTimings } from "@/services/pacing";

interface PhraseTimelineProps {
  timing: PhraseTimings;
  currentTime: number;
  onSeek: (timeMs: number) => void;
}

const PHASE_COLORS = [
  { enter: "#4ade80", hold: "#22c55e", exit: "#16a34a" },
  { enter: "#60a5fa", hold: "#3b82f6", exit: "#2563eb" },
  { enter: "#f472b6", hold: "#ec4899", exit: "#db2777" },
  { enter: "#facc15", hold: "#eab308", exit: "#ca8a04" },
  { enter: "#a78bfa", hold: "#8b5cf6", exit: "#7c3aed" },
  { enter: "#fb923c", hold: "#f97316", exit: "#ea580c" },
  { enter: "#2dd4bf", hold: "#14b8a6", exit: "#0d9488" },
  { enter: "#f87171", hold: "#ef4444", exit: "#dc2626" },
  { enter: "#818cf8", hold: "#6366f1", exit: "#4f46e5" },
  { enter: "#34d399", hold: "#10b981", exit: "#059669" },
];

export function PhraseTimeline({ timing, currentTime, onSeek }: PhraseTimelineProps) {
  const { totalDuration, introDuration, outroDuration, phrases } = timing;
  if (totalDuration <= 0) return null;

  const toPercent = (ms: number) => (ms / totalDuration) * 100;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    onSeek(pct * totalDuration);
  };

  const playheadPct = toPercent(currentTime);

  return (
    <div
      className="relative h-8 rounded bg-secondary cursor-pointer select-none overflow-hidden"
      onClick={handleClick}
    >
      {/* Intro */}
      <div
        className="absolute top-0 h-full bg-muted opacity-60"
        style={{ left: 0, width: `${toPercent(introDuration)}%` }}
        title="Intro"
      />

      {/* Phrase segments */}
      {phrases.map((pt, i) => {
        const colors = PHASE_COLORS[i % PHASE_COLORS.length];
        return (
          <div key={i}>
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${toPercent(pt.startMs)}%`,
                width: `${toPercent(pt.enterMs)}%`,
                backgroundColor: colors.enter,
                opacity: 0.7,
              }}
              title={`P${i + 1} enter`}
            />
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${toPercent(pt.startMs + pt.enterMs)}%`,
                width: `${toPercent(pt.holdMs)}%`,
                backgroundColor: colors.hold,
              }}
              title={`P${i + 1} hold`}
            />
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${toPercent(pt.startMs + pt.enterMs + pt.holdMs)}%`,
                width: `${toPercent(pt.exitMs)}%`,
                backgroundColor: colors.exit,
                opacity: 0.7,
              }}
              title={`P${i + 1} exit`}
            />
          </div>
        );
      })}

      {/* Outro */}
      <div
        className="absolute top-0 h-full bg-muted opacity-60"
        style={{
          left: `${toPercent(totalDuration - outroDuration)}%`,
          width: `${toPercent(outroDuration)}%`,
        }}
        title="Outro"
      />

      {/* Playhead */}
      <div
        className="absolute top-0 h-full w-0.5 bg-white z-10"
        style={{ left: `${playheadPct}%` }}
      />
    </div>
  );
}
