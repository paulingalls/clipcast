import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config";
import {
  ASPECT_RATIO_RESOLUTIONS,
  DEFAULT_ASPECT_RATIO,
  type GenerateRequest,
  type AspectRatio,
} from "../utils/validation";
import { calculatePacing } from "./pacing";
import {
  getTemplate,
  injectData,
  resolveColors,
  TemplateError,
  type TemplateData,
} from "./templates";
import { captureFrames, BrowserError } from "./browser";
import { encodeFrames, FFmpegError } from "./ffmpeg";

export interface RenderResult {
  id: string;
  videoUrl: string;
  duration: number;
  resolution: string;
  templateUsed: string;
}

export class RenderError extends Error {
  public code: "capacity" | "timeout" | "internal";

  constructor(message: string, code: "capacity" | "timeout" | "internal") {
    super(message);
    this.name = "RenderError";
    this.code = code;
  }
}

mkdirSync(config.OUTPUT_DIR, { recursive: true });

let activeRenders = 0;
const FPS = 30;

export async function renderVideo(request: GenerateRequest): Promise<RenderResult> {
  if (activeRenders >= config.MAX_CONCURRENT_RENDERS) {
    throw new RenderError(
      `Server at capacity (${config.MAX_CONCURRENT_RENDERS} concurrent renders)`,
      "capacity",
    );
  }

  activeRenders++;
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      doRender(request, abortController.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new RenderError("Render timed out", "timeout"));
        }, config.RENDER_TIMEOUT_MS);
      }),
    ]);
    return result;
  } catch (err) {
    if (err instanceof RenderError) throw err;
    if (err instanceof BrowserError || err instanceof FFmpegError || err instanceof TemplateError) {
      throw new RenderError(err.message, "internal");
    }
    throw new RenderError(err instanceof Error ? err.message : String(err), "internal");
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    activeRenders--;
  }
}

async function doRender(request: GenerateRequest, signal: AbortSignal): Promise<RenderResult> {
  const aspectRatio: AspectRatio = request.options?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];

  const timing = calculatePacing(
    request.phrases,
    request.options?.duration,
    request.options?.pacing,
  );

  const colors = resolveColors(request.options?.colorScheme);

  const templateHtml = await getTemplate(request.template);

  const templateData: TemplateData = {
    phrases: request.phrases,
    title: request.options?.title,
    images: request.images,
    colors,
    timing,
    resolution: { width, height },
  };

  const html = injectData(templateHtml, templateData);

  const frames = await captureFrames(html, {
    width,
    height,
    durationMs: timing.totalDuration,
    fps: FPS,
    signal,
  });

  const id = nanoid();
  const outputPath = resolve(config.OUTPUT_DIR, `${id}.mp4`);

  await encodeFrames(frames, FPS, outputPath, signal);

  return {
    id,
    videoUrl: `/output/${id}.mp4`,
    duration: timing.totalDuration / 1000,
    resolution: `${width}x${height}`,
    templateUsed: request.template,
  };
}
