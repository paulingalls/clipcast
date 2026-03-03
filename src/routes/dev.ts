import type { Hono } from "hono";
import { getTemplate, injectData, resolveColors, TemplateError } from "../services/templates";
import { calculatePacing, PacingError } from "../services/pacing";
import { ASPECT_RATIO_RESOLUTIONS, type AspectRatio } from "../utils/validation";

const DEFAULT_PHRASES = [
  "Welcome to Clipcast",
  "Create stunning videos from text",
  "Animated phrases, perfect timing",
  "Try it now",
];

const VALID_ASPECT_RATIOS = new Set(Object.keys(ASPECT_RATIO_RESOLUTIONS));

export function registerDevRoutes(app: Hono) {
  app.get("/dev/template/:id", async (c) => {
    const id = c.req.param("id");

    // Parse query params
    const url = new URL(c.req.url);
    const phrasesParam = url.searchParams.getAll("phrases");
    const phrases = phrasesParam.length > 0 ? phrasesParam : DEFAULT_PHRASES;
    const title = url.searchParams.get("title") ?? undefined;
    const durationParam = url.searchParams.get("duration");
    const duration = durationParam ? Number(durationParam) : undefined;

    const aspectRatioParam = url.searchParams.get("aspectRatio") ?? "9:16";
    const aspectRatio: AspectRatio = VALID_ASPECT_RATIOS.has(aspectRatioParam)
      ? (aspectRatioParam as AspectRatio)
      : "9:16";

    const colorScheme = {
      background: url.searchParams.get("background") ?? undefined,
      text: url.searchParams.get("text") ?? undefined,
      accent: url.searchParams.get("accent") ?? undefined,
    };

    // Resolve
    const resolution = ASPECT_RATIO_RESOLUTIONS[aspectRatio];
    const colors = resolveColors(colorScheme);

    let timing;
    try {
      timing = calculatePacing(phrases, duration);
    } catch (err) {
      if (err instanceof PacingError) {
        return c.text(`Pacing error: ${err.message}`, 400);
      }
      throw err;
    }

    let html;
    try {
      html = await getTemplate(id);
    } catch (err) {
      if (err instanceof TemplateError) {
        return c.text(`Template error: ${err.message}`, 404);
      }
      throw err;
    }

    const injected = injectData(html, {
      phrases,
      title,
      images: [],
      colors,
      timing,
      resolution,
    });

    return c.html(injected);
  });
}
