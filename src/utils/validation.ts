import { z } from "zod/v4";

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const urlRegex = /^https?:\/\/.+/;

export const KNOWN_TEMPLATES = ["slide-fade"] as const;

export const ASPECT_RATIO_RESOLUTIONS = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIO_RESOLUTIONS;

export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";

const phraseSchema = z
  .string()
  .min(1, "Phrase must not be empty")
  .max(200, "Phrase must be 200 characters or fewer");

// SECURITY: Currently safe because browser.ts blocks all network requests.
// If image fetching is added, validate against private IP ranges to prevent SSRF.
const imageSchema = z.string().regex(urlRegex, "Must be a valid HTTP(S) URL");

const colorSchemeSchema = z.object({
  background: z
    .string()
    .regex(hexColorRegex, "Must be a valid hex color (e.g. #FF0000)")
    .optional(),
  text: z.string().regex(hexColorRegex, "Must be a valid hex color (e.g. #FF0000)").optional(),
  accent: z.string().regex(hexColorRegex, "Must be a valid hex color (e.g. #FF0000)").optional(),
});

const optionsSchema = z.object({
  title: z.string().max(100).optional(),
  duration: z.number().min(3).max(30).optional(),
  colorScheme: colorSchemeSchema.optional(),
  aspectRatio: z
    .enum(Object.keys(ASPECT_RATIO_RESOLUTIONS) as [AspectRatio, ...AspectRatio[]])
    .optional(),
  pacing: z
    .array(z.number().positive().max(30, "Each pacing value must be 30 seconds or less"))
    .max(10)
    .optional(),
});

export const generateRequestSchema = z.object({
  phrases: z
    .array(phraseSchema)
    .min(1, "At least one phrase is required")
    .max(10, "Maximum 10 phrases allowed"),
  images: z.array(imageSchema).optional(),
  template: z.enum(KNOWN_TEMPLATES).default("slide-fade"),
  options: optionsSchema.optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export function formatZodError(error: z.ZodError) {
  return {
    error: "validation_error",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
