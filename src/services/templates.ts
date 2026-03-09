import { resolve } from "node:path";
import type { PhraseTimings } from "./pacing";

export interface TemplateData {
  phrases: string[];
  title?: string;
  images?: string[];
  colors: ResolvedColors;
  timing: PhraseTimings;
  resolution: { width: number; height: number };
}

export interface ResolvedColors {
  background: string;
  text: string;
  accent: string;
}

const DEFAULT_COLORS: ResolvedColors = {
  background: "#1a1a2e",
  text: "#ffffff",
  accent: "#e94560",
};

const templateCache = new Map<string, string>();
const TEMPLATES_DIR = resolve(import.meta.dir, "../templates");

export async function getTemplate(id: string): Promise<string> {
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev) {
    const cached = templateCache.get(id);
    if (cached) return cached;
  }

  const path = resolve(TEMPLATES_DIR, `${id}.html`);
  // Prevent path traversal
  if (!path.startsWith(TEMPLATES_DIR)) {
    throw new TemplateError(`Invalid template id: ${id}`);
  }

  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new TemplateError(`Template not found: ${id}`);
  }

  const content = await file.text();

  if (!isDev) {
    templateCache.set(id, content);
  }

  return content;
}

export function injectData(html: string, data: TemplateData): string {
  // Escape '<' to prevent </script> breakout in embedded JSON
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const script = `<script>window.__CLIPCAST_DATA__ = ${json};</script>`;
  return html.replace("<!-- __CLIPCAST_DATA__ -->", script);
}

export function resolveColors(scheme?: Partial<ResolvedColors>): ResolvedColors {
  return {
    background: scheme?.background ?? DEFAULT_COLORS.background,
    text: scheme?.text ?? DEFAULT_COLORS.text,
    accent: scheme?.accent ?? DEFAULT_COLORS.accent,
  };
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}
