export class FFmpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FFmpegError";
  }
}

export interface FFmpegEncoder {
  writeFrame(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
}

export function createEncoder(
  fps: number,
  outputPath: string,
  signal?: AbortSignal,
): FFmpegEncoder {
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ],
    {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    },
  );

  return {
    async writeFrame(frame: Buffer) {
      if (signal?.aborted) {
        proc.kill();
        throw new FFmpegError("Encoding cancelled");
      }
      try {
        await proc.stdin.write(frame);
      } catch (err) {
        proc.kill();
        throw new FFmpegError(
          `Write to FFmpeg failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    async finish() {
      try {
        await proc.stdin.end();
      } catch (err) {
        proc.kill();
        throw new FFmpegError(
          `FFmpeg stdin close failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        console.error(
          JSON.stringify({ event: "ffmpeg_error", exitCode, stderr: stderr.slice(-500) }),
        );
        throw new FFmpegError(`Video encoding failed (exit code ${exitCode})`);
      }
    },
  };
}
