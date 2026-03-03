import { useState, useRef, useCallback, useEffect } from "react";
import "../harness.css";
import { DataPanel, type HarnessData } from "./DataPanel";
import { TemplatePreview } from "./TemplatePreview";
import { TimelineScrubber } from "./TimelineScrubber";
import { PlaybackControls } from "./PlaybackControls";
import { PhraseTimeline } from "./PhraseTimeline";
import { FrameInfo } from "./FrameInfo";
import { SafeZoneOverlay } from "./SafeZoneOverlay";

const FPS = 30;
const FRAME_MS = 1000 / FPS;

const DEFAULT_DATA: HarnessData = {
  phrases: "Welcome to Clipcast\nCreate stunning videos from text\nAnimated phrases, perfect timing\nTry it now",
  title: "Clipcast",
  duration: 12,
  background: "#1a1a2e",
  text: "#ffffff",
  accent: "#e94560",
  aspectRatio: "9:16" as const,
};

export function HarnessApp() {
  const [data, setData] = useState<HarnessData>(DEFAULT_DATA);
  const [html, setHtml] = useState<string>("");
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timingData, setTimingData] = useState<any>(null);
  const [safeZone, setSafeZone] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playStartRef = useRef<number>(0);
  const playTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const seekTo = useCallback((timeMs: number) => {
    const clamped = Math.max(0, Math.min(timeMs, totalDuration));
    setCurrentTime(clamped);
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document) return;
    try {
      iframe.contentWindow.document.getAnimations().forEach((a: Animation) => {
        a.currentTime = clamped;
      });
    } catch {
      // iframe not ready
    }
  }, [totalDuration]);

  const loadTemplate = useCallback(async () => {
    const phrases = data.phrases.split("\n").filter((p) => p.trim());
    if (phrases.length === 0) return;

    const params = new URLSearchParams();
    phrases.forEach((p) => params.append("phrases", p));
    if (data.title) params.set("title", data.title);
    params.set("duration", String(data.duration));
    params.set("aspectRatio", data.aspectRatio);
    params.set("background", data.background);
    params.set("text", data.text);
    params.set("accent", data.accent);

    const res = await fetch(`/api/dev/template/slide-fade?${params}`);
    const text = await res.text();
    setHtml(text);

    // Extract timing data from the injected JSON
    const match = text.match(/window\.__CLIPCAST_DATA__ = (.+?);<\/script>/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      setTotalDuration(parsed.timing.totalDuration);
      setTimingData(parsed.timing);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [data]);

  // Load on mount
  useEffect(() => {
    loadTemplate();
  }, []);

  // Play loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    playStartRef.current = performance.now();
    playTimeRef.current = currentTime;

    const tick = (now: number) => {
      const elapsed = now - playStartRef.current;
      const newTime = playTimeRef.current + elapsed;

      if (newTime >= totalDuration) {
        seekTo(totalDuration);
        setIsPlaying(false);
        return;
      }

      seekTo(newTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, totalDuration, seekTo]);

  const handleIframeLoad = useCallback(() => {
    // Seek to current time after iframe loads new content
    setTimeout(() => seekTo(currentTime), 50);
  }, [seekTo, currentTime]);

  const stepFrame = useCallback((direction: number) => {
    setIsPlaying(false);
    seekTo(currentTime + direction * FRAME_MS);
  }, [currentTime, seekTo]);

  const skipSeconds = useCallback((seconds: number) => {
    setIsPlaying(false);
    seekTo(currentTime + seconds * 1000);
  }, [currentTime, seekTo]);

  const jumpTo = useCallback((timeMs: number) => {
    setIsPlaying(false);
    seekTo(timeMs);
  }, [seekTo]);

  const togglePlay = useCallback(() => {
    if (currentTime >= totalDuration) {
      seekTo(0);
    }
    setIsPlaying((p) => !p);
  }, [currentTime, totalDuration, seekTo]);

  const resolution = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
  }[data.aspectRatio] ?? { width: 1080, height: 1920 };

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground">
        Clipcast Template Dev Harness
      </h1>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-72 shrink-0">
          <DataPanel
            data={data}
            onChange={setData}
            onReload={loadTemplate}
          />
        </div>
        <div className="flex-1 relative min-w-0">
          <TemplatePreview
            html={html}
            width={resolution.width}
            height={resolution.height}
            iframeRef={iframeRef}
            onLoad={handleIframeLoad}
          />
          {safeZone && (
            <SafeZoneOverlay platform={safeZone} />
          )}
        </div>
      </div>

      {timingData && (
        <PhraseTimeline
          timing={timingData}
          currentTime={currentTime}
          onSeek={jumpTo}
        />
      )}

      <TimelineScrubber
        currentTime={currentTime}
        totalDuration={totalDuration}
        fps={FPS}
        onSeek={(ms) => { setIsPlaying(false); seekTo(ms); }}
      />

      <div className="flex items-center gap-6 flex-wrap">
        <PlaybackControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onStepFrame={stepFrame}
          onSkipSeconds={skipSeconds}
          onJumpToStart={() => jumpTo(0)}
          onJumpToEnd={() => jumpTo(totalDuration)}
        />
        <FrameInfo
          currentTime={currentTime}
          fps={FPS}
          timing={timingData}
        />
        <SafeZoneToggle value={safeZone} onChange={setSafeZone} />
      </div>
    </div>
  );
}

function SafeZoneToggle({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => onChange(e.target.checked ? "ig-reels" : null)}
          className="rounded"
        />
        Safe Zones
      </label>
      {value !== null && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm bg-secondary text-secondary-foreground rounded px-2 py-1 border border-border"
        >
          <option value="ig-reels">IG Reels</option>
          <option value="tiktok">TikTok</option>
          <option value="yt-shorts">YT Shorts</option>
        </select>
      )}
    </div>
  );
}
