export class FFmpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FFmpegError";
  }
}

export async function encodeFrames(
  frames: Buffer[],
  fps: number,
  outputPath: string
): Promise<void> {
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-f", "image2pipe",
      "-framerate", String(fps),
      "-i", "-",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-y", outputPath,
    ],
    {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    }
  );

  for (const frame of frames) {
    proc.stdin.write(frame);
  }
  proc.stdin.end();

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new FFmpegError(
      `FFmpeg exited with code ${exitCode}: ${stderr.slice(-500)}`
    );
  }
}
