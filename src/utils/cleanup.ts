import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_AGE_MS = config.RETENTION_HOURS * 60 * 60 * 1000;

async function cleanExpiredFiles() {
  const now = Date.now();

  try {
    const files = await readdir(config.OUTPUT_DIR);
    for (const file of files) {
      const filePath = join(config.OUTPUT_DIR, file);
      try {
        const bunFile = Bun.file(filePath);
        if (now - bunFile.lastModified > MAX_AGE_MS) {
          await unlink(filePath);
          console.log(JSON.stringify({ event: "cleanup_deleted", file: filePath }));
        }
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          console.error(JSON.stringify({ event: "cleanup_error", file: filePath, error: err.message }));
        }
      }
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      console.error(JSON.stringify({ event: "cleanup_scan_error", error: err.message }));
    }
  }
}

export function startCleanup(): Timer {
  console.log(JSON.stringify({ event: "cleanup_started", intervalMs: CLEANUP_INTERVAL_MS, retentionHours: config.RETENTION_HOURS }));
  cleanExpiredFiles();
  return setInterval(cleanExpiredFiles, CLEANUP_INTERVAL_MS);
}
