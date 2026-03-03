import type { Hono } from "hono";
import { nanoid } from "nanoid";
import { generateRequestSchema, formatZodError, ASPECT_RATIO_RESOLUTIONS, type AspectRatio } from "../utils/validation";
import { calculatePacing, PacingError } from "../services/pacing";

export function registerGenerateRoute(app: Hono) {
  app.post("/generate", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({ error: "validation_error", details: [{ path: "", message: "Invalid JSON body" }] }, 400);
    }

    const result = generateRequestSchema.safeParse(body);
    if (!result.success) {
      return c.json(formatZodError(result.error), 400);
    }

    const data = result.data;

    let timings;
    try {
      timings = calculatePacing(
        data.phrases,
        data.options?.duration,
        data.options?.pacing
      );
    } catch (err) {
      if (err instanceof PacingError) {
        return c.json({ error: "validation_error", details: [{ path: "options.pacing", message: err.message }] }, 400);
      }
      throw err;
    }

    const aspectRatio: AspectRatio = data.options?.aspectRatio ?? "16:9";
    const { width, height } = ASPECT_RATIO_RESOLUTIONS[aspectRatio];

    return c.json({
      id: nanoid(),
      videoUrl: `/output/placeholder.mp4`,
      duration: timings.totalDuration / 1000,
      resolution: `${width}x${height}`,
      templateUsed: data.template,
    });
  });
}
