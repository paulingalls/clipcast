import { useState, useRef, useCallback, useEffect } from "react";
import "../harness.css";
import { DataPanel, type HarnessData } from "./DataPanel";
import { TemplatePreview } from "./TemplatePreview";
import { TimelineScrubber } from "./TimelineScrubber";
import { PlaybackControls } from "./PlaybackControls";
import { PhraseTimeline } from "./PhraseTimeline";
import { FrameInfo } from "./FrameInfo";
import { SafeZoneOverlay, type SafeZonePlatform } from "./SafeZoneOverlay";
import { ASPECT_RATIO_RESOLUTIONS } from "@/utils/validation";
import type { PhraseTimings } from "@/services/pacing";

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const PLAYBACK_STATE_THROTTLE_MS = 50; // ~20 React updates/sec during playback

const DEFAULT_DATA: HarnessData = {
  phrases:
    "Welcome to Clipcast\nCreate stunning videos from text\nAnimated phrases, perfect timing\nTry it now",
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
  const [timingData, setTimingData] = useState<PhraseTimings | null>(null);
  const [safeZone, setSafeZone] = useState<SafeZonePlatform | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playStartRef = useRef<number>(0);
  const playTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  // Keep ref in sync for use in rAF callback
  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  const seekIframe = useCallback((timeMs: number) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow?.document) return;
    try {
      iframe.contentWindow.document.getAnimations().forEach((a: Animation) => {
        a.currentTime = timeMs;
      });
    } catch {
      // iframe not ready
    }
  }, []);

  const seekTo = useCallback(
    (timeMs: number) => {
      const clamped = Math.max(0, Math.min(timeMs, totalDuration));
      setCurrentTime(clamped);
      seekIframe(clamped);
    },
    [totalDuration, seekIframe],
  );

  const loadTemplate = useCallback(async () => {
    const phrases = data.phrases.split("\n").filter((p) => p.trim());
    if (phrases.length === 0) return;

    const params = new URLSearchParams();
    phrases.forEach((p) => {
      params.append("phrases", p);
    });
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
    const match = /window\.__CLIPCAST_DATA__ = (.+?);<\/script>/.exec(text);
    if (match?.[1]) {
      const parsed = JSON.parse(match[1]) as { timing: PhraseTimings & { totalDuration: number } };
      setTotalDuration(parsed.timing.totalDuration);
      setTimingData(parsed.timing);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [data]);

  // Load on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState is called after async fetch, not synchronously
    void loadTemplate();
  }, [loadTemplate]);

  // Play loop — updates iframe on every frame, throttles React state updates
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    playStartRef.current = performance.now();
    playTimeRef.current = currentTime;
    lastStateUpdateRef.current = 0;

    const tick = (now: number) => {
      const elapsed = now - playStartRef.current;
      const newTime = playTimeRef.current + elapsed;
      const duration = totalDurationRef.current;

      if (newTime >= duration) {
        seekIframe(duration);
        setCurrentTime(duration);
        setIsPlaying(false);
        return;
      }

      // Always update the iframe (smooth visual playback)
      seekIframe(newTime);

      // Throttle React state updates to reduce re-renders
      if (now - lastStateUpdateRef.current >= PLAYBACK_STATE_THROTTLE_MS) {
        setCurrentTime(newTime);
        lastStateUpdateRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, seekIframe, currentTime]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      seekIframe(currentTime);
    }, 50);
  }, [seekIframe, currentTime]);

  const stepFrame = useCallback(
    (direction: number) => {
      setIsPlaying(false);
      seekTo(currentTime + direction * FRAME_MS);
    },
    [currentTime, seekTo],
  );

  const skipSeconds = useCallback(
    (seconds: number) => {
      setIsPlaying(false);
      seekTo(currentTime + seconds * 1000);
    },
    [currentTime, seekTo],
  );

  const jumpTo = useCallback(
    (timeMs: number) => {
      setIsPlaying(false);
      seekTo(timeMs);
    },
    [seekTo],
  );

  const togglePlay = useCallback(() => {
    if (currentTime >= totalDuration) {
      seekTo(0);
    }
    setIsPlaying((p) => !p);
  }, [currentTime, totalDuration, seekTo]);

  const resolution = ASPECT_RATIO_RESOLUTIONS[data.aspectRatio];

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground">Clipcast Template Dev Harness</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-72 shrink-0">
          <DataPanel
            data={data}
            onChange={setData}
            onReload={() => {
              void loadTemplate();
            }}
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
          {safeZone && <SafeZoneOverlay platform={safeZone} />}
        </div>
      </div>

      {timingData && (
        <PhraseTimeline timing={timingData} currentTime={currentTime} onSeek={jumpTo} />
      )}

      <TimelineScrubber
        currentTime={currentTime}
        totalDuration={totalDuration}
        fps={FPS}
        onSeek={(ms) => {
          setIsPlaying(false);
          seekTo(ms);
        }}
      />

      <div className="flex items-center gap-6 flex-wrap">
        <PlaybackControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onStepFrame={stepFrame}
          onSkipSeconds={skipSeconds}
          onJumpToStart={() => {
            jumpTo(0);
          }}
          onJumpToEnd={() => {
            jumpTo(totalDuration);
          }}
        />
        <FrameInfo currentTime={currentTime} fps={FPS} timing={timingData} />
        <SafeZoneToggle value={safeZone} onChange={setSafeZone} />
      </div>
    </div>
  );
}

function SafeZoneToggle({
  value,
  onChange,
}: {
  value: SafeZonePlatform | null;
  onChange: (v: SafeZonePlatform | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(e) => {
            onChange(e.target.checked ? "ig-reels" : null);
          }}
          className="rounded"
        />
        Safe Zones
      </label>
      {value !== null && (
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value as SafeZonePlatform);
          }}
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
