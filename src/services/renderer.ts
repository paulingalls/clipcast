import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config";
import { ASPECT_RATIO_RESOLUTIONS, type GenerateRequest, type AspectRatio } from "../utils/validation";
import { calculatePacing } from "./pacing";
import { getTemplate, injectData, resolveColors, type TemplateData } from "./templates";
import { captureFrames } from "./browser";
import { encodeFrames } from "./ffmpeg";

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

const OUTPUT_DIR = resolve("./output");
mkdirSync(OUTPUT_DIR, { recursive: true });

let activeRenders = 0;
const FPS = 30;

export async function renderVideo(
  request: GenerateRequest
): Promise<RenderResult> {
  if (activeRenders >= config.MAX_CONCURRENT_RENDERS) {
    throw new RenderError(
      `Server at capacity (${config.MAX_CONCURRENT_RENDERS} concurrent renders)`,
      "capacity"
    );
  }

  activeRenders++;
  try {
    const result = await Promise.race([
      doRender(request),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new RenderError("Render timed out", "timeout")),
          config.RENDER_TIMEOUT_MS
        )
      ),
    ]);
    return result;
  } finally {
    activeRenders--;
  }
}

async function doRender(request: GenerateRequest): Promise<RenderResult> {
  const aspectRatio: AspectRatio = request.options?.aspectRatio ?? "16:9";
  const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];

  const timing = calculatePacing(
    request.phrases,
    request.options?.duration,
    request.options?.pacing
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

  const frames = await captureFrames(html, width, height, timing.totalDuration, FPS);

  const id = nanoid();
  const outputPath = resolve(OUTPUT_DIR, `${id}.mp4`);

  await encodeFrames(frames, FPS, width, height, outputPath);

  return {
    id,
    videoUrl: `/output/${id}.mp4`,
    duration: timing.totalDuration / 1000,
    resolution: `${width}x${height}`,
    templateUsed: request.template,
  };
}
