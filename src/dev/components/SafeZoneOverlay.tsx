interface SafeZoneOverlayProps {
  platform: string;
}

const SAFE_ZONES: Record<string, { top: number; bottom: number }> = {
  "ig-reels": { top: 10, bottom: 15 },
  "tiktok": { top: 10, bottom: 20 },
  "yt-shorts": { top: 0, bottom: 15 },
};

export function SafeZoneOverlay({ platform }: SafeZoneOverlayProps) {
  const zones = SAFE_ZONES[platform];
  if (!zones) return null;

  return (
    <>
      {zones.top > 0 && (
        <div
          className="absolute left-0 right-0 top-0 pointer-events-none border-b-2 border-red-500/60 bg-red-500/15"
          style={{ height: `${zones.top}%` }}
        />
      )}
      {zones.bottom > 0 && (
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none border-t-2 border-red-500/60 bg-red-500/15"
          style={{ height: `${zones.bottom}%` }}
        />
      )}
    </>
  );
}
