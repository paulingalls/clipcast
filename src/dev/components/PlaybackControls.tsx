import { Button } from "@/components/ui/button";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepFrame: (direction: number) => void;
  onSkipSeconds: (seconds: number) => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
}

export function PlaybackControls({
  isPlaying,
  onTogglePlay,
  onStepFrame,
  onSkipSeconds,
  onJumpToStart,
  onJumpToEnd,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={onJumpToStart} title="Jump to start">
        &#x23EE;
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSkipSeconds(-1);
        }}
        title="Back 1s"
      >
        -1s
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onStepFrame(-1);
        }}
        title="Previous frame"
      >
        &#x23F4;
      </Button>
      <Button
        size="sm"
        onClick={onTogglePlay}
        className="w-16"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "Pause" : "Play"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onStepFrame(1);
        }}
        title="Next frame"
      >
        &#x23F5;
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSkipSeconds(1);
        }}
        title="Forward 1s"
      >
        +1s
      </Button>
      <Button variant="outline" size="sm" onClick={onJumpToEnd} title="Jump to end">
        &#x23ED;
      </Button>
    </div>
  );
}
