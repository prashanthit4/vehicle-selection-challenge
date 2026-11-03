// Runtime-limit defaults and env parsing, shared by the frontend (import.meta.env) and backend (process.env).

/** Used when the env var is unset or invalid. */
export const DEFAULT_MAX_LOGBOOK_BYTES = 1048576; // 1 MB

/**
 * Parses a byte-count env var. Falls back to DEFAULT_MAX_LOGBOOK_BYTES when the value is unset,
 * not a whole number, or not positive. Strict on purpose: parseInt('1mb') would silently give 1.
 */
export function parseMaxSizeBytes(envValue: string | undefined): number {
  if (!envValue) return DEFAULT_MAX_LOGBOOK_BYTES;
  const trimmed = envValue.trim();
  if (!/^\d+$/.test(trimmed)) return DEFAULT_MAX_LOGBOOK_BYTES;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_MAX_LOGBOOK_BYTES : parsed;
}

const KB = 1024;
const MB = 1024 * KB;

/** Human-readable size for messages: 1048576 → "1 MB", 524288 → "512 KB", 300 → "300 bytes". */
export function formatBytes(bytes: number): string {
  if (bytes >= MB && bytes % MB === 0) return `${bytes / MB} MB`;
  if (bytes >= KB && bytes % KB === 0) return `${bytes / KB} KB`;
  return `${bytes} bytes`;
}
