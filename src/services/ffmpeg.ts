export class FFmpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FFmpegError";
  }
}

export async function encodeFrames(
  frames: Buffer[],
  fps: number,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> {
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

  try {
    for (const frame of frames) {
      if (signal?.aborted) {
        proc.kill();
        throw new FFmpegError("Encoding cancelled");
      }
      await proc.stdin.write(frame);
    }
    await proc.stdin.end();
  } catch (err) {
    proc.kill();
    if (err instanceof FFmpegError) throw err;
    throw new FFmpegError(
      `Write to FFmpeg failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new FFmpegError(`FFmpeg exited with code ${exitCode}: ${stderr.slice(-500)}`);
  }
}
