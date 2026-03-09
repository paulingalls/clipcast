import type { Hono } from "hono";
import { generateRequestSchema, formatZodError } from "../utils/validation";
import { PacingError } from "../services/pacing";
import { renderVideo, RenderError } from "../services/renderer";

export function registerGenerateRoute(app: Hono) {
  app.post("/generate", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!body) {
      return c.json(
        { error: "validation_error", details: [{ path: "", message: "Invalid JSON body" }] },
        400,
      );
    }

    const result = generateRequestSchema.safeParse(body);
    if (!result.success) {
      return c.json(formatZodError(result.error), 400);
    }

    try {
      const renderResult = await renderVideo(result.data);
      return c.json(renderResult);
    } catch (err) {
      if (err instanceof PacingError) {
        return c.json(
          {
            error: "validation_error",
            details: [{ path: "options.pacing", message: err.message }],
          },
          400,
        );
      }
      if (err instanceof RenderError) {
        const status = err.code === "capacity" ? 503 : err.code === "timeout" ? 504 : 500;
        return c.json({ error: err.code, message: err.message }, status);
      }
      throw err;
    }
  });
}
