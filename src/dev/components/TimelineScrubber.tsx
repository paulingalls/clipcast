interface TimelineScrubberProps {
  currentTime: number;
  totalDuration: number;
  fps: number;
  onSeek: (timeMs: number) => void;
}

export function TimelineScrubber({
  currentTime,
  totalDuration,
  fps,
  onSeek,
}: TimelineScrubberProps) {
  if (totalDuration <= 0) return null;

  const step = 1000 / fps;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground font-mono w-20">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={totalDuration}
        step={step}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 h-2 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground font-mono w-20 text-right">
        {formatTime(totalDuration)}
      </span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
