export const config = {
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || "0.0.0.0",
  MAX_CONCURRENT_RENDERS: Number(process.env.MAX_CONCURRENT_RENDERS) || 4,
  RENDER_TIMEOUT_MS: Number(process.env.RENDER_TIMEOUT_MS) || 60000,
  RETENTION_HOURS: Number(process.env.RETENTION_HOURS) || 24,
} as const;
